import {serve} from "https://deno.land/std/http/server.ts";
import {exists} from "https://deno.land/std/fs/mod.ts";
import {extname} from "https://deno.land/std/path/mod.ts";
import {load} from "https://deno.land/std/dotenv/mod.ts";
import { Database } from "npm:arangojs";

await load({export: true});

const ARANGO_URL = Deno.env.get("ARANGODB_URI") || "http://localhost:8529";
const ARANGO_DB = Deno.env.get("ARANGODB_DATABASE") || "hexdice";
const ARANGO_USER = Deno.env.get("ARANGODB_USER") || "root";
const ARANGO_PASS = Deno.env.get("ARANGODB_PASSWORD") || "";
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");

// console.log(ARANGO_URL, ARANGO_DB, ARANGO_PASS)

const db = new Database({
	url: ARANGO_URL,
	databaseName: ARANGO_DB,
	auth: { username: ARANGO_USER, password: ARANGO_PASS },
});

const head_json = {
	"Content-Type": "application/json; charset=utf-8"
};

// Initialize ArangoDB
async function initArango() {
	try {
		const sysDb = new Database({ url: ARANGO_URL, auth: { username: ARANGO_USER, password: ARANGO_PASS } });
		
		// const dbs = await sysDb.listDatabases();
		// if (!dbs.includes(ARANGO_DB)) {
		// 	await sysDb.createDatabase(ARANGO_DB);
		// 	console.log(`Database ${ARANGO_DB} created.`);
		// }

		// const usersColl = db.collection("users");
		// if (!(await usersColl.exists())) {
		// 	await usersColl.create();
		// 	console.log("Collection 'users' created.");
		// }

		// const roomsColl = db.collection("rooms");
		// if (!(await roomsColl.exists())) {
		// 	await roomsColl.create();
		// 	console.log("Collection 'rooms' created.");
		// }
	} catch (e) {
		console.error("ArangoDB init error:", e.message);
	}
}
initArango();

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
		return response(await Deno.readTextFile("./index.html"), {
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

let port = 1166;try {port = process.env.PORT || port} catch{}
serve(handleRequest, {port});