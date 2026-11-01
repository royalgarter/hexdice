import {exists} from "https://deno.land/std/fs/mod.ts";
import {extname} from "https://deno.land/std/path/mod.ts";
import {load} from "https://deno.land/std/dotenv/mod.ts";
import { Database } from "https://cdn.jsdelivr.net/npm/arangojs/esm/index.js?+esm";
import { crypto } from "https://deno.land/std/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std/encoding/hex.ts";
import mqtt from "https://esm.sh/mqtt@4.3.7";
import { loadEngine } from "./js/engine-server.ts";
import { createRoomCore } from "./js/room-core.ts";

await load({export: true});

const ARANGO_URI = Deno.env.get("ARANGODB_URI") || "";
const arangoUrl = new URL(ARANGO_URI);
const ARANGO_URL = `${arangoUrl.protocol}//${arangoUrl.host}`;
const ARANGO_DB = arangoUrl.pathname.slice(1) || "_system";
const ARANGO_USER = arangoUrl.username || "";
const ARANGO_PASS = arangoUrl.password || "";
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");

const MQTT = Deno.env.get("MQTT") || "wss://broker.emqx.io:8084/mqtt";

const mqttUrl = new URL(MQTT);
const mqttClient = mqtt.connect(MQTT, {
	username: mqttUrl.username || undefined,
	password: mqttUrl.password || undefined,
});

const MQTT_PULSE_MS = Number(Deno.env.get("MQTT_PULSE_MS")) || 90;


mqttClient.on("connect", () => {
	console.log("Connected to MQTT broker via esm.sh (v4)", MQTT);
	mqttClient.subscribe("hexdice/rooms/+");
});

mqttClient.on("message", (topic, message) => {
	try {
		const roomId = topic.split("/")[2];
		const payload = JSON.parse(message.toString());
		core.handleRoomAction(roomId, payload).catch((e: unknown) => console.error("Room action failed:", e));
	} catch (e) {
		console.error("MQTT message handling failed:", e);
	}
});

const getAppVersion = async () => {
	try {
		const files = [];

		const DIRS = [".", "./html", "./js"]
		for (const dir of DIRS) {
			for await (const entry of Deno.readDir(dir)) {
				if (entry.isFile && (entry.name.endsWith(".js") || entry.name.endsWith(".html") || entry.name.endsWith(".css"))) {
					files.push(dir + '/' + entry.name);
				}
			}
		}
		files.sort();

		let combinedData = new Uint8Array(0);
		for (const file of files) {
			const data = await Deno.readFile(file);
			const newCombined = new Uint8Array(combinedData.length + data.length);
			newCombined.set(combinedData);
			newCombined.set(data, combinedData.length);
			combinedData = newCombined;
		}

		const hashBuffer = await crypto.subtle.digest("SHA-1", combinedData);
		return encodeHex(hashBuffer).slice(0, 7);
	} catch (error) {
		console.error('Failed to generate version hash:', error);
		return 'unknown';
	}
};

const appVersion = await getAppVersion();
console.dir({appVersion})

if (Deno.args.includes('--version')) {
	console.log(appVersion);
	Deno.exit(0);
}

// Pre-calculate processed index.html
let HTML_INDEX = '';
async function prepareIndex() {
	try {
		HTML_INDEX = (await Deno.readTextFile('./index.html'))
			.replaceAll('___VERSION___', appVersion)
			.replaceAll('___MQTT___', MQTT)
			.replaceAll('___GOOGLE_CLIENT_ID___', GOOGLE_CLIENT_ID || "")
		// console.log('prepareIndex:', HTML_INDEX.length);
	} catch (e: any) {
		console.error("Failed to prepare HTML_INDEX:", e);
	}
}

const db = new Database({
	url: ARANGO_URL,
	databaseName: ARANGO_DB,
	auth: { username: ARANGO_USER, password: ARANGO_PASS },
});

// Initialize Database Collections and Indexes
async function initDatabase() {
	try {
		const collections = ['users', 'rooms', 'user_data'];
		for (const name of collections) {
			const coll = db.collection(name);
			const exists = await coll.exists();
			if (!exists) {
				console.log(`Creating collection: ${name}`);
				await coll.create();
			}
			
			// Ensure indexes for performance and cleanup queries
			if (name === 'users') {
				await coll.ensureIndex({ type: 'persistent', fields: ['email'], unique: true });
				await coll.ensureIndex({ type: 'persistent', fields: ['updatedAt'] });
			} else if (name === 'rooms') {
				await coll.ensureIndex({ type: 'persistent', fields: ['status'] });
				await coll.ensureIndex({ type: 'persistent', fields: ['updatedAt'] });
				await coll.ensureIndex({ type: 'persistent', fields: ['createdAt'] });
			} else if (name === 'user_data') {
				await coll.ensureIndex({ type: 'persistent', fields: ['userId', 'key'] });
			}
		}
		console.log("ArangoDB initialization complete.");
	} catch (e: any) {
		console.error("ArangoDB initialization failed:", e);
	}
}

const core = createRoomCore({ db, mqttClient, loadEngine, googleClientId: GOOGLE_CLIENT_ID, mqttUrl: MQTT, mqttPulseMs: MQTT_PULSE_MS, allowDebugAuth: Deno.env.get("DEBUG_AUTH") === "1" });

async function handleRequest(req: Request) {
	const {pathname} = new URL(req.url);

	const apiResponse = await core.handleApi(req);
	if (apiResponse) return apiResponse;

	const localpath = `./${pathname}`;

	const response = (data: any, options?: ResponseInit) => {
		return new Response(data, options);
	}

	if (pathname === "/") {
		return response(HTML_INDEX, {
			headers: {
				"Content-Type": "text/html; charset=utf-8",
				"Cache-Control": "public, max-age=604800",
			}
		});
	}

	// Serve rules HTML page for /rules
	if (pathname === "/rules") {
		return response(await Deno.readTextFile("./rules.html"), {
			headers: {
				"Content-Type": "text/html; charset=utf-8",
				"Cache-Control": "public, max-age=604800",
			}
		});
	}

	if (await exists(localpath)) {
		const ext = extname(localpath).toLowerCase();
		const mimeMap: Record<string, string> = {
			".html": "text/html",
			".htm": "text/html",
			".css": "text/css",
			".js": "text/javascript",
			".mjs": "text/javascript",
			".json": "application/json",
			".png": "image/png",
			".jpg": "image/jpeg",
			".jpeg": "image/jpeg",
			".gif": "image/gif",
			".svg": "image/svg+xml",
			".wav": "audio/wav",
			".mp3": "audio/mpeg",
			".ogg": "audio/ogg",
			".ico": "image/x-icon",
		};
		
		const contentType = mimeMap[ext] || "application/octet-stream";

		return response(await Deno.readFile(localpath), {
			headers: {
				"Content-Type": contentType,
				"Cache-Control": "public, max-age=604800",
			}
		})
	}

	return response(JSON.stringify({error: 'E404'}), {status: 404});
}

// Warm up
initDatabase();
prepareIndex();
// setInterval(() => prepareIndex(), 30e3);

const PORT = Number(Deno.env.get('PORT')) || 1166;
console.log(`Server opened: http://localhost:${PORT}`);
console.log(`Versioning url: http://localhost:${PORT}/?v=${appVersion}`);
Deno.serve({ port: PORT }, handleRequest);