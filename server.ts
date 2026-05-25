import {exists} from "https://deno.land/std/fs/mod.ts";
import {extname} from "https://deno.land/std/path/mod.ts";
import {load} from "https://deno.land/std/dotenv/mod.ts";
import { Database } from "https://cdn.jsdelivr.net/npm/arangojs/esm/index.js?+esm";
import { crypto } from "https://deno.land/std/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std/encoding/hex.ts";

await load({export: true});

const ARANGO_URL = Deno.env.get("ARANGODB_URI");
const ARANGO_DB = Deno.env.get("ARANGODB_DATABASE");
const ARANGO_USER = Deno.env.get("ARANGODB_USER");
const ARANGO_PASS = Deno.env.get("ARANGODB_PASSWORD");
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");

const getAppVersion = async () => {
	try {
		const files = [];
		for await (const entry of Deno.readDir(".")) {
			if (entry.isFile && (entry.name.endsWith(".js") || entry.name.endsWith(".html") || entry.name.endsWith(".css"))) {
				files.push(entry.name);
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

const head_json = {
	"Content-Type": "application/json; charset=utf-8"
};

async function getUserIdFromToken(token: string) {
	if (!token) return null;
	try {
		const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
		const payload = await verifyRes.json();
		if (payload.aud !== GOOGLE_CLIENT_ID) return null;
		return payload.sub;
	} catch (e) {
		return null;
	}
}

async function handleRequest(req: Request) {
	const {pathname} = new URL(req.url);

	if (pathname === "/api/config") {
		return new Response(JSON.stringify({ GOOGLE_CLIENT_ID }), { headers: head_json });
	}

	if (pathname === "/api/auth/google" && req.method === "POST") {
		try {
			const { credential } = await req.json();
			const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
			const payload = await verifyRes.json();

			if (payload.aud !== GOOGLE_CLIENT_ID) {
				return new Response(JSON.stringify({ error: "Invalid audience" }), { status: 401 });
			}

			const user = {
				_key: payload.sub,
				email: payload.email,
				name: payload.name,
				picture: payload.picture,
				updatedAt: new Date().toISOString()
			};

			await db.collection("users").save(user, { overwriteMode: "update" });

			return new Response(JSON.stringify({ user, token: credential }), { headers: head_json });
		} catch (e: any) {
			return new Response(JSON.stringify({ error: e.message }), { status: 500 });
		}
	}

	// User Data Storage (KV)
	if (pathname === "/api/user/data" && (req.method === "POST" || req.method === "GET")) {
		try {
			const authHeader = req.headers.get("Authorization");
			const token = authHeader ? authHeader.replace("Bearer ", "") : null;
			const userId = await getUserIdFromToken(token || "");

			if (!userId) {
				return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
			}

			const coll = db.collection("user_data");

			if (req.method === "POST") {
				const { key, value } = await req.json();
				const docId = `${userId}:${key}`;
				await coll.save({
					_key: docId,
					userId,
					key,
					value,
					updatedAt: new Date().toISOString()
				}, { overwriteMode: "update" });
				return new Response(JSON.stringify({ success: true }), { headers: head_json });
			} else {
				const url = new URL(req.url);
				const key = url.searchParams.get("key");
				if (!key) {
					return new Response(JSON.stringify({ error: "Key required" }), { status: 400 });
				}
				const docId = `${userId}:${key}`;
				try {
					const doc: any = await coll.document(docId);
					return new Response(JSON.stringify({ value: doc.value }), { headers: head_json });
				} catch (e) {
					return new Response(JSON.stringify({ value: null }), { headers: head_json });
				}
			}
		} catch (e: any) {
			return new Response(JSON.stringify({ error: e.message }), { status: 500 });
		}
	}

	// Room Management
	if (pathname === "/api/rooms/create" && req.method === "POST") {
		try {
			const { userId, name } = await req.json();
			const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
			const room = {
				_key: roomId,
				creator: userId,
				players: [{ id: userId, name, color: 'Blue' }],
				status: 'WAITING',
				createdAt: new Date().toISOString()
			};
			await db.collection("rooms").save(room);
			return new Response(JSON.stringify(room), { headers: head_json });
		} catch (e: any) {
			return new Response(JSON.stringify({ error: e.message }), { status: 500 });
		}
	}

	if (pathname === "/api/rooms/join" && req.method === "POST") {
		try {
			const { roomId, userId, name } = await req.json();
			const roomsColl = db.collection("rooms");
			const room: any = await roomsColl.document(roomId);

			if (room.status !== 'WAITING' && !room.players.find((p: any) => p.id === userId)) {
				return new Response(JSON.stringify({ error: "Room is not available" }), { status: 400 });
			}

			if (!room.players.find((p: any) => p.id === userId)) {
				room.players.push({ id: userId, name, color: 'Red' });
				room.status = 'PLAYING';
				room.updatedAt = new Date().toISOString();
				await roomsColl.update(roomId, room);
			}

			return new Response(JSON.stringify(room), { headers: head_json });
		} catch (e: any) {
			return new Response(JSON.stringify({ error: e.message }), { status: 404 });
		}
	}

	if (pathname === "/api/rooms/state" && req.method === "POST") {
		try {
			const { roomId, gameState } = await req.json();
			await db.collection("rooms").update(roomId, { gameState, updatedAt: new Date().toISOString() });
			return new Response(JSON.stringify({ success: true }), { headers: head_json });
		} catch (e: any) {
			return new Response(JSON.stringify({ error: e.message }), { status: 500 });
		}
	}

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

	if (pathname === "/game.js") {
		const content = await Deno.readTextFile("./game.js");
		return response(content.replaceAll("___GOOGLE_CLIENT_ID___", GOOGLE_CLIENT_ID || ""), {
			headers: {
				"Content-Type": "text/javascript; charset=utf-8",
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