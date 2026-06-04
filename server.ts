import {exists} from "https://deno.land/std/fs/mod.ts";
import {extname} from "https://deno.land/std/path/mod.ts";
import {load} from "https://deno.land/std/dotenv/mod.ts";
import { Database } from "https://cdn.jsdelivr.net/npm/arangojs/esm/index.js?+esm";
import { crypto } from "https://deno.land/std/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std/encoding/hex.ts";
import mqtt from "https://esm.sh/mqtt@4.3.7";
import { loadEngine, GameEngine } from "./js/engine-server.ts";

await load({export: true});

const ARANGO_URL = Deno.env.get("ARANGODB_URI");
const ARANGO_DB = Deno.env.get("ARANGODB_DATABASE");
const ARANGO_USER = Deno.env.get("ARANGODB_USER");
const ARANGO_PASS = Deno.env.get("ARANGODB_PASSWORD");
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");

const MQTT = Deno.env.get("MQTT") || "wss://broker.emqx.io:8084/mqtt";
const mqttClient = mqtt.connect(MQTT);

const MQTT_PULSE_MS = Number(Deno.env.get("MQTT_PULSE_MS")) || 100;

const roomEngines: Record<string, any> = {};

mqttClient.on("connect", () => {
	console.log("Connected to MQTT broker via esm.sh (v4)");
	mqttClient.subscribe("hexdice/rooms/+");
});

mqttClient.on("message", (topic, message) => {
	try {
		const roomId = topic.split("/")[2];
		const payload = JSON.parse(message.toString());
		handleRoomAction(roomId, payload);
	} catch (e) {
		console.error("MQTT message handling failed:", e);
	}
});

async function getOrInitEngine(roomId: string) {
	if (roomEngines[roomId]) return roomEngines[roomId];

	console.log(`Initializing engine for room ${roomId}`);

	// Fetch room from DB to get players
	const roomsColl = db.collection("rooms");
	let room: any;
	try {
		room = await roomsColl.document(roomId);
	} catch (e) {
		console.error(`Room ${roomId} not found in DB`);
		return null;
	}

	const engine = await loadEngine(room.players.length);
	const game = engine.createGame();

	// Map DB players to game players
	const PLAYER_CONFIG = [
		{ id: 0, color: 'Blue', sprite: 'yellow' },
		{ id: 1, color: 'Red', sprite: 'red' },
		{ id: 2, color: 'Green', sprite: 'green' },
		{ id: 3, color: 'Purple', sprite: 'purple' },
		{ id: 4, color: 'Black', sprite: 'shadow' },
		{ id: 5, color: 'Yellow', sprite: 'sepia' },
	];
	game.players = room.players.map((p: any, idx: number) => ({
		id: p.id,
		name: p.name,
		color: p.color,
		sprite: PLAYER_CONFIG[idx]?.sprite || 'yellow',
		dice: [],
		wins: 0
	}));

	game._engine = engine;
	game._initialized = false;
	game._isOnline = true;

	// Generate hex grid and base locations so deployment works, but defer army generation until seed arrives
	game.generateHexGrid(game.getRadius());
	game.determineBaseLocations(game.getRadius());

	roomEngines[roomId] = game;
	return game;
}

async function handleRoomAction(roomId: string, payload: any) {
	const game = await getOrInitEngine(roomId);
	if (!game) return;

	const { type, data, sender } = payload;

	console.log(`[Room ${roomId}] Action: ${type} from ${sender}`);

	let updated = false;

	const findPlayerIdx = (senderId: string) => game.players.findIndex((p: any) => p.id === senderId);

	if (type === 'AUTOCHESS_RECRUIT') {
		const playerIdx = findPlayerIdx(sender);
		if (playerIdx !== -1) {
			const inventory = game.Autochess.state.inventories[sender];
			if (inventory && data.index >= 0 && data.index < inventory.length) {
				game.Autochess.recruitUnit(game, playerIdx, data.index);
				updated = true;
			}
		}
	} else if (type === 'AUTOCHESS_REROLL') {
		const playerIdx = findPlayerIdx(sender);
		if (playerIdx !== -1 && game.Autochess.state.rerolls[sender] > 0) {
			game.Autochess.rerollRecruits(game, playerIdx);
			updated = true;
		}
	} else if (type === 'AUTOCHESS_MOVE') {
		const playerIdx = findPlayerIdx(sender);
		if (playerIdx !== -1) {
			const dice = game.players[playerIdx].dice;
			if (data.fromIndex >= 0 && data.fromIndex < dice.length && data.toIndex >= 0 && data.toIndex < dice.length) {
				game.Autochess.moveUnit(game, playerIdx, data.fromIndex, data.toIndex);
				updated = true;
			}
		}
	} else if (type === 'AUTOCHESS_MERGE') {
		const playerIdx = findPlayerIdx(sender);
		if (playerIdx !== -1) {
			const dice = game.players[playerIdx].dice;
			const u1 = dice.find((u: any) => u.id === data.unitId1);
			const u2 = dice.find((u: any) => u.id === data.unitId2);
			if (u1 && u2 && u1.value === u2.value && u1.veteranLevel === u2.veteranLevel && u1.veteranLevel < 3) {
				game.Autochess.mergeUnits(game, playerIdx, data.unitId1, data.unitId2);
				updated = true;
			}
		}
	} else if (type === 'AUTOCHESS_START_COMBAT') {
		// Only host can force start combat, or wait for both ready
		const isHost = game.players[0]?.id === sender;
		if (isHost || game.players.every((p: any) => game.Autochess.state.ready[p.id])) {
			if (game.Autochess.state.phase !== 'COMBAT') {
				game.Autochess.startCombat(game);
				startCombatStreaming(roomId, game);
			}
			updated = true;
		}
	} else if (type === 'AUTOCHESS_NEXT_ROUND') {
		// Simple validation: any player can advance if in RECAP
		if (game.Autochess.state.phase === 'RECAP') {
			game.Autochess.nextRound(game);
		}
		updated = true;
	} else if (type === 'AUTOCHESS_READY') {
		const playerIdx = findPlayerIdx(sender);
		if (playerIdx !== -1) {
			const pid = game.players[playerIdx].id;
			game.Autochess.state.ready = game.Autochess.state.ready || {};
			game.Autochess.state.ready[pid] = !game.Autochess.state.ready[pid];
			updated = true;

			// Check if both (all) players are ready
			if (game.players.every((p: any) => game.Autochess.state.ready[p.id])) {
				game.Autochess.state.ready = {};
				if (game.Autochess.state.phase !== 'COMBAT') {
					game.Autochess.startCombat(game);
					startCombatStreaming(roomId, game);
				}
			}
		}
	} else if (type === 'AUTOCHESS_PLACE') {
		const playerIdx = findPlayerIdx(sender);
		if (playerIdx !== -1 && game.Autochess.state.phase === 'PREPARATION') {
			const { unitId, toHexId, fromHexId } = data;
			const unit = game.players[playerIdx].dice.find((d: any) => d.id === unitId);
			const toHex = game.getHex(toHexId);
			
			// Basic validation: target hex must be within deployment zone or occupied by same player
			if (unit && toHex && (!toHex.unit || toHex.unit.playerId === playerIdx)) {
				const validHexes = game.calcValidDeploymentHexes(playerIdx);
				if (validHexes.includes(toHexId)) {
					if (fromHexId) {
						const fromHex = game.getHex(fromHexId);
						if (fromHex && fromHex.unit?.playerId === playerIdx) { fromHex.unit = null; fromHex.unitId = null; }
					}
					// If target hex had a unit, swap them or just overwrite? (Autochess usually overwrites/swaps)
					if (toHex.unit) {
						toHex.unit.hexId = null;
						toHex.unit.isDeployed = false;
					}
					toHex.unit = unit;
					toHex.unitId = unit.id;
					unit.hexId = toHexId;
					unit.isDeployed = true;
					updated = true;
				}
			}
		}
	} else if (type === 'START_GAME') {
		// Host published the shared seed; initialize the game with it
		if (!game._initialized) {
			const { seed } = data;
			game._engine.setSeed(seed);
			game.Autochess.init(game);
			game._initialized = true;
			updated = true;

			// Update room status to PLAYING in DB
			const roomsColl = db.collection("rooms");
			roomsColl.update(roomId, { status: 'PLAYING' }).catch(e => console.error("Failed to update room status:", e));

			console.log(`[Room ${roomId}] Game initialized with seed ${seed}`);
		}
	} else if (type === 'GUEST_JOINED') {
		// If player already in game, just broadcast state to catch them up
		if (game.players.find((p: any) => p.id === sender)) {
			updated = true;
		} else {
			// New guest joining - only recreate if game hasn't started or room is waiting
			const roomsColl = db.collection("rooms");
			const room: any = await roomsColl.document(roomId);
			if (room.status === 'WAITING') {
				delete roomEngines[roomId];
				await getOrInitEngine(roomId);
				updated = true;
			}
		}
	}

	if (updated) {
		broadcastState(roomId, game, true);
	}
}

function broadcastState(roomId: string, game: any, full = false) {
	const topic = `hexdice/rooms/${roomId}/state`;
	const state: any = {
		autochess: {
			phase: game.Autochess.state.phase,
			round: game.Autochess.state.round,
			roundTimer: game.Autochess.state.roundTimer,
			lastResult: game.Autochess.state.lastResult,
			lastWinnerId: game.Autochess.state.lastWinnerId,
			pulseMs: MQTT_PULSE_MS,
			inventories: game.Autochess.state.inventories,
			rerolls: game.Autochess.state.rerolls,
			ready: game.Autochess.state.ready || {}
		}
	};

	if (full || game.Autochess.state.phase !== 'COMBAT') {
		state.players = game.players.map((p: any) => ({
			id: p.id,
			name: p.name,
			wins: p.wins,
			dice: p.dice,
			sprite: p.sprite
		}));
		state.hexes = game.hexes.map((h: any) => ({
			id: h.id,
			unitId: h.unitId,
			unit: h.unit,
			terrainType: h.terrainType
		}));
	} else {
		// Light update for COMBAT: Only send dynamic unit data
		state.units = game.players.flatMap((p: any) => p.dice.map((d: any) => ({
			id: d.id,
			hexId: d.hexId,
			hp: d.hp,
			actionGauge: d.actionGauge,
			isDeath: d.isDeath
		})));
	}
	mqttClient.publish(topic, JSON.stringify(state));
}

function startCombatStreaming(roomId: string, game: any) {
	// Hook into game.addLog to broadcast logs too
	const originalAddLog = game.addLog.bind(game);
	game.addLog = (msg: string) => {
		originalAddLog(msg);
		mqttClient.publish(`hexdice/rooms/${roomId}/logs`, JSON.stringify({ message: msg }));
	};

	// Use a throttled broadcast during simulation
	let stepCount = 0;
	let lastPhase = game.Autochess.state.phase;
	const broadcastEvery = Math.max(1, Math.floor(MQTT_PULSE_MS / 100));

	const originalSimStep = game.Autochess.simulateStep.bind(game.Autochess);
	game.Autochess.simulateStep = (g: any) => {
		originalSimStep(g);
		stepCount++;

		if (g.Autochess.state.phase !== lastPhase) {
			broadcastState(roomId, g, true);
			lastPhase = g.Autochess.state.phase;
		} else if (stepCount % broadcastEvery === 0) {
			broadcastState(roomId, g);
		}
	};

	// Hook resolveTimeout (catches time-out path)
	const originalResolveTimeout = game.Autochess.resolveTimeout.bind(game.Autochess);
	game.Autochess.resolveTimeout = (g: any) => {
		originalResolveTimeout(g);
		clearInterval(monitorInterval);
		broadcastState(roomId, g, true);
	};

	// Monitor for combat end from winner-determination path (phase set in runSimulation
	// after simulateStep returns, so the simulateStep hook doesn't catch it)
	const monitorInterval = setInterval(() => {
		if (game.Autochess.state.phase !== 'COMBAT') {
			broadcastState(roomId, game, true);
			clearInterval(monitorInterval);

			// Auto-advance to next round after 5 seconds in RECAP,
			// so game doesn't hang if no player clicks "Next Round"
			if (game.Autochess.state.phase === 'RECAP') {
				setTimeout(() => {
					if (game.Autochess.state.phase === 'RECAP') {
						game.Autochess.nextRound(game);
						broadcastState(roomId, game, true);
						console.log(`[Room ${roomId}] Auto-advanced to round ${game.Autochess.state.round}`);
					}
				}, 5000);
			}
		}
	}, 50);
}

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
		return new Response(JSON.stringify({ GOOGLE_CLIENT_ID, MQTT }), { headers: head_json });
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

			const isRejoin = room.players.find((p: any) => p.id === userId);

			if (room.status !== 'WAITING' && !isRejoin) {
				return new Response(JSON.stringify({ error: "Game already in progress" }), { status: 400 });
			}

			if (!isRejoin) {
				if (room.players.length >= 6) {
					return new Response(JSON.stringify({ error: "Room is full" }), { status: 400 });
				}
				const PLAYER_COLORS = ['Blue', 'Red', 'Green', 'Purple', 'Black', 'Yellow'];
				room.players.push({ id: userId, name, color: PLAYER_COLORS[room.players.length] });
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