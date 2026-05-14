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
let HTML_INDEX = "";
try {
	HTML_INDEX = (await Deno.readTextFile("./index.html"))
		.replaceAll('___VERSION___', appVersion)
		.replaceAll('___GOOGLE_CLIENT_ID___', GOOGLE_CLIENT_ID || "")
} catch (e) {
	console.error("Failed to prepare HTML_INDEX:", e);
}

const db = new Database({
	url: ARANGO_URL,
	databaseName: ARANGO_DB,
	auth: { username: ARANGO_USER, password: ARANGO_PASS },
});

const head_json = {
	"Content-Type": "application/json; charset=utf-8"
};

async function handleRequest(req: Request) {
	const {pathname, searchParams} = new URL(req.url);

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
		} catch (e) {
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
		} catch (e) {
			return new Response(JSON.stringify({ error: e.message }), { status: 500 });
		}
	}

	if (pathname === "/api/rooms/join" && req.method === "POST") {
		try {
			const { roomId, userId, name } = await req.json();
			const roomsColl = db.collection("rooms");
			const room = await roomsColl.document(roomId);

			if (room.status !== 'WAITING' && !room.players.find(p => p.id === userId)) {
				return new Response(JSON.stringify({ error: "Room is not available" }), { status: 400 });
			}

			if (!room.players.find(p => p.id === userId)) {
				room.players.push({ id: userId, name, color: 'Red' });
				room.status = 'PLAYING';
				room.updatedAt = new Date().toISOString();
				await roomsColl.update(roomId, room);
			}

			return new Response(JSON.stringify(room), { headers: head_json });
		} catch (e) {
			return new Response(JSON.stringify({ error: e.message }), { status: 404 });
		}
	}

	if (pathname === "/api/rooms/state" && req.method === "POST") {
		try {
			const { roomId, gameState } = await req.json();
			await db.collection("rooms").update(roomId, { gameState, updatedAt: new Date().toISOString() });
			return new Response(JSON.stringify({ success: true }), { headers: head_json });
		} catch (e) {
			return new Response(JSON.stringify({ error: e.message }), { status: 500 });
		}
	}

	const localpath = `./${pathname}`;

	// console.log(pathname, params);
	const response = (data, options) => {
		// console.log(pathname, 'responsed');
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
		let mime = extname(localpath);
		
		if (mime?.includes('htm')) mime = 'html';
		else if (mime?.includes('css')) mime = 'css';
		else if (mime?.includes('js')) mime = 'javascript';

		return response(await Deno.readFile(localpath), {
			headers: {
				"Content-Type": `${mime ? ('text/' + mime) : "text/plain"}; charset=utf-8`,
				"Cache-Control": "public, max-age=604800",
			}
		})
	}

	return response(JSON.stringify({error: 'E404'}), {status: 404});
}

const PORT = Number(Deno.env.get('PORT')) || 1166;
console.log(`Server opened: http://localhost:${PORT}`);
console.log(`Versioning url: http://localhost:${PORT}/?v=${appVersion}`);
Deno.serve({ port: PORT }, handleRequest);