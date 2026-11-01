import { encodeHex } from "https://deno.land/std/encoding/hex.ts";

export interface RoomCoreDeps {
	db: any;
	mqttClient: { publish: (topic: string, payload: string, opts?: any) => any };
	loadEngine: (playerCount: number) => Promise<any>;
	googleClientId?: string;
	mqttUrl: string;
	mqttPulseMs?: number;
	fetchFn?: typeof fetch;
	verifyToken?: (token: string) => Promise<string | null>;
	allowDebugAuth?: boolean;
}

export function createRoomCore(deps: RoomCoreDeps) {
const { db, mqttClient, loadEngine, mqttUrl } = deps;
const GOOGLE_CLIENT_ID = deps.googleClientId;
const MQTT = deps.mqttUrl;
const MQTT_PULSE_MS = deps.mqttPulseMs ?? 90;
const fetch = deps.fetchFn ?? globalThis.fetch;
const verifyToken = (token: string): Promise<string | null> => {
	if (!token) return Promise.resolve(null);
	if (deps.allowDebugAuth && token.startsWith('debug:')) return Promise.resolve(token.slice(6) || null);
	return (deps.verifyToken ?? getUserIdFromToken)(token);
};

const roomEngines: Record<string, any> = {};

const engineInits: Record<string, Promise<any>> = {};

function getOrInitEngine(roomId: string) {
	if (roomEngines[roomId]) return Promise.resolve(roomEngines[roomId]);
	engineInits[roomId] ??= initEngine(roomId).finally(() => { delete engineInits[roomId]; });
	return engineInits[roomId];
}

async function initEngine(roomId: string) {

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
	game._engine = engine;
	game._isOnline = true;

	// Generate hex grid now; base locations need game.players, so they are set once players are mapped below
	game.generateHexGrid(game.getRadius());

	if (room.gameState) {
		console.log(`[Room ${roomId}] Restoring game state (Round ${room.gameState.autochess.round})`);
		game._initialized = room.gameState._initialized;
		Object.assign(game.Autochess.state, room.gameState.autochess);
		
		game.players = room.gameState.players.map((p: any) => ({
			...p,
			dice: p.dice || []
		}));

		room.gameState.hexes.forEach((sh: any) => {
			const lh = game.hexes[sh.id];
			if (lh) {
				lh.unitId = sh.unitId;
				lh.unit = sh.unit;
				lh.terrainType = sh.terrainType;
			}
		});
	} else {
		game._initialized = false;
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
	}

	game.determineBaseLocations(game.getRadius());

	roomEngines[roomId] = game;
	return game;
}

async function saveRoomState(roomId: string, game: any) {
	const state = {
		players: game.players.map((p: any) => ({
			id: p.id,
			name: p.name,
			wins: p.wins,
			dice: p.dice,
			sprite: p.sprite,
			color: p.color
		})),
		hexes: game.hexes.map((h: any) => ({
			id: h.id,
			unitId: h.unitId,
			unit: h.unit,
			terrainType: h.terrainType
		})),
		autochess: {
			...game.Autochess.state,
			ready: {} // Don't persist ready state
		},
		_initialized: game._initialized
	};
	try {
		const roomsColl = db.collection("rooms");
		await roomsColl.update(roomId, { gameState: state, updatedAt: new Date().toISOString() });
	} catch (e) {
		console.error(`Failed to save room state for ${roomId}:`, e);
	}
}

async function handleRoomAction(roomId: string, payload: any) {
	if (!payload || typeof payload.type !== 'string') return;
	const game = await getOrInitEngine(roomId);
	if (!game) return;

	const { type, sender } = payload;
	const data = payload.data ?? {};

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
		if (game.Autochess.state.phase === 'RECAP' && game.Autochess.state.round <= game.Autochess.state.maxRound) {
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
					if (fromHexId != null) {
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
		const { seed } = data;
		if (!game._initialized && game.players[0]?.id === sender && game.players.length >= 2 && Number.isFinite(seed)) {
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
		saveRoomState(roomId, game);

		// Manage Preparation Timeout (60s) for Round 2+
		if (game.Autochess.state.phase === 'PREPARATION' && game.Autochess.state.round > 1) {
			if (!game._prepTimeoutStarted) {
				game._prepTimeoutStarted = true;
				game.Autochess.state.prepTimeLeft = 60;
				
				const prepInterval = setInterval(() => {
					if (game.Autochess.state.phase !== 'PREPARATION') {
						clearInterval(prepInterval);
						game._prepTimeoutStarted = false;
						return;
					}
					game.Autochess.state.prepTimeLeft--;
					if (game.Autochess.state.prepTimeLeft <= 0) {
						clearInterval(prepInterval);
						game._prepTimeoutStarted = false;
						if (game.Autochess.state.phase === 'PREPARATION') {
							console.log(`[Room ${roomId}] Preparation timed out. Starting combat.`);
							game.Autochess.state.ready = {};
							game.Autochess.startCombat(game);
							startCombatStreaming(roomId, game);
							broadcastState(roomId, game, true);
							saveRoomState(roomId, game);
						}
					} else {
						broadcastState(roomId, game); // Periodic update of timer
					}
				}, 1000);
			}
		}
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
			prepTimeLeft: game.Autochess.state.prepTimeLeft,
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
		// Delta update for COMBAT: Only send units whose state changed since last broadcast
		const dirty: any[] = [];
		game.players.forEach((p: any) => p.dice.forEach((d: any) => {
			const prevHp = d._bcastHp;
			const prevGauge = d._bcastGauge;
			const prevDeath = d._bcastDeath;
			const prevHex = d._bcastHexId;
			if (d.hp !== prevHp || d.actionGauge !== prevGauge || d.isDeath !== prevDeath || d.hexId !== prevHex) {
				dirty.push({ id: d.id, hexId: d.hexId, hp: d.hp, actionGauge: d.actionGauge, isDeath: d.isDeath });
				d._bcastHp = d.hp;
				d._bcastGauge = d.actionGauge;
				d._bcastDeath = d.isDeath;
				d._bcastHexId = d.hexId;
			}
		}));
		if (dirty.length > 0) state.units = dirty;
	}
	// Skip publish if only autochess state with no unit changes
	if (!full && game.Autochess.state.phase === 'COMBAT' && !state.units) return;
	// qos:0 for combat streaming (loss-tolerant, next tick overwrites), qos:1 for critical state
	const qos = (!full && game.Autochess.state.phase === 'COMBAT') ? 0 : 1;
	mqttClient.publish(topic, JSON.stringify(state), { qos });
}

function startCombatStreaming(roomId: string, game: any) {
	// Hook into game.addLog to broadcast logs too
	const originalAddLog = game.addLog.bind(game);
	game.addLog = (msg: string) => {
		originalAddLog(msg);
		mqttClient.publish(`hexdice/rooms/${roomId}/logs`, JSON.stringify({ message: msg }), { qos: 0 });
	};

	// Use a throttled broadcast during simulation
	let stepCount = 0;
	let lastPhase = game.Autochess.state.phase;
	const broadcastEvery = Math.max(3, Math.floor(MQTT_PULSE_MS / 100));

	const originalSimStep = game.Autochess.simulateStep;
	const originalResolveTimeout = game.Autochess.resolveTimeout;

	const cleanup = () => {
		game.Autochess.simulateStep = originalSimStep;
		game.Autochess.resolveTimeout = originalResolveTimeout;
		// Clear stale delta-tracking props so next combat round starts clean
		game.players.forEach((p: any) => p.dice.forEach((d: any) => {
			delete d._bcastHp;
			delete d._bcastGauge;
			delete d._bcastDeath;
			delete d._bcastHexId;
		}));
	};

	game.Autochess.simulateStep = (g: any) => {
		originalSimStep.call(game.Autochess, g);
		stepCount++;

		if (g.Autochess.state.phase !== lastPhase) {
			broadcastState(roomId, g, true);
			lastPhase = g.Autochess.state.phase;
		} else if (stepCount % broadcastEvery === 0) {
			broadcastState(roomId, g);
		}
	};

	// Auto-advance to next round after 5 seconds in RECAP,
	// so game doesn't hang if no player clicks "Next Round"
	const scheduleAutoAdvance = () => {
		if (game.Autochess.state.phase !== 'RECAP') return;
		setTimeout(() => {
			if (game.Autochess.state.phase !== 'RECAP' || game.Autochess.state.round > game.Autochess.state.maxRound) return;
			game.Autochess.nextRound(game);
			broadcastState(roomId, game, true);
			saveRoomState(roomId, game);
			console.log(`[Room ${roomId}] Auto-advanced to round ${game.Autochess.state.round}`);
		}, 5000);
	};

	// Hook resolveTimeout (catches time-out path)
	game.Autochess.resolveTimeout = (g: any) => {
		originalResolveTimeout.call(game.Autochess, g);
		clearInterval(monitorInterval);
		cleanup();
		broadcastState(roomId, g, true);
		scheduleAutoAdvance();
	};

	// Monitor for combat end from winner-determination path (phase set in runSimulation
	// after simulateStep returns, so the simulateStep hook doesn't catch it)
	const monitorInterval = setInterval(() => {
		if (game.Autochess.state.phase !== 'COMBAT') {
			clearInterval(monitorInterval);
			cleanup();
			broadcastState(roomId, game, true);

			scheduleAutoAdvance();
		}
	}, 50);
}

const head_json = {
	"Content-Type": "application/json; charset=utf-8"
};

const roomLocks: Record<string, Promise<unknown>> = {};

// Serialize read-modify-write per room (single server process owns all rooms)
function withRoomLock<T>(roomId: string, fn: () => Promise<T>): Promise<T> {
	const run = (roomLocks[roomId] ?? Promise.resolve()).then(fn, fn);
	const tail = run.catch(() => {});
	roomLocks[roomId] = tail;
	tail.then(() => { if (roomLocks[roomId] === tail) delete roomLocks[roomId]; });
	return run;
}

function newSecret() {
	return encodeHex(crypto.getRandomValues(new Uint8Array(24)));
}

const publicRoom = (room: any) => ({
	_key: room._key,
	creator: room.creator,
	players: room.players.map(({ secret: _s, ...p }: any) => p),
	status: room.status
});

const PLAYER_COLORS = ['Blue', 'Red', 'Green', 'Purple', 'Black', 'Yellow'];
const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;
const secretCache: Record<string, Record<string, string>> = {};
const seenSignatures: Record<string, Set<string>> = {};

async function hmacHex(secret: string, message: string) {
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	return encodeHex(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

async function getPlayerSecret(roomId: string, userId: string) {
	const cached = secretCache[roomId]?.[userId];
	if (cached) return cached;
	try {
		const room: any = await db.collection("rooms").document(roomId);
		secretCache[roomId] = Object.fromEntries(room.players.map((p: any) => [p.id, p.secret]));
		return secretCache[roomId][userId] ?? null;
	} catch (_e) {
		return null;
	}
}

// Authenticate an MQTT action: sender must prove knowledge of the secret issued at join time
async function verifyRoomMessage(roomId: string, payload: any) {
	if (!payload || typeof payload.sender !== 'string' || typeof payload.sig !== 'string') return false;
	const ts = Number(payload.ts);
	if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > SIGNATURE_MAX_AGE_MS) return false;
	const secret = await getPlayerSecret(roomId, payload.sender);
	if (!secret) return false;
	const expected = await hmacHex(secret, JSON.stringify([payload.type, payload.data ?? null, payload.sender, payload.seq ?? null, ts]));
	if (expected !== payload.sig) return false;
	const seen = (seenSignatures[roomId] ??= new Set());
	if (seen.has(expected)) return false;
	seen.add(expected);
	if (seen.size > 5000) seen.delete(seen.values().next().value as string);
	return true;
}

async function handleRoomMessage(roomId: string, payload: any) {
	if (!await verifyRoomMessage(roomId, payload)) {
		console.warn(`[Room ${roomId}] Rejected unsigned/forged message`);
		return;
	}
	await handleRoomAction(roomId, payload);
}

function newRoomId() {
	const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	const bytes = crypto.getRandomValues(new Uint8Array(6));
	return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: head_json });

async function authUser(req: Request) {
	const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
	return await verifyToken(token);
}

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

async function handleApi(req: Request): Promise<Response | null> {
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
			const userId = await verifyToken(token || "");

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
			const userId = await authUser(req);
			if (!userId) return json({ error: "Unauthorized" }, 401);
			const { name } = await req.json();
			if (typeof name !== 'string' || !name) return json({ error: "Invalid input" }, 400);
			for (let attempt = 0; attempt < 5; attempt++) {
				const now = new Date().toISOString();
				const room = {
					_key: newRoomId(),
					creator: userId,
					players: [{ id: userId, name, color: 'Blue', secret: newSecret() }],
					status: 'WAITING',
					createdAt: now,
					updatedAt: now
				};
				try {
					await db.collection("rooms").save(room);
					return json({ ...publicRoom(room), secret: room.players[0].secret });
				} catch (e: any) {
					if (e?.code !== 409) throw e;
				}
			}
			return json({ error: "Could not allocate room id" }, 500);
		} catch (e: any) {
			return json({ error: e.message }, 500);
		}
	}

	if (pathname === "/api/rooms/join" && req.method === "POST") {
		try {
			const userId = await authUser(req);
			if (!userId) return json({ error: "Unauthorized" }, 401);
			const { roomId, name } = await req.json();
			if (typeof roomId !== 'string' || !roomId || typeof name !== 'string' || !name) {
				return json({ error: "Invalid input" }, 400);
			}
			return await withRoomLock(roomId, async () => {
				const roomsColl = db.collection("rooms");
				let room: any;
				try {
					room = await roomsColl.document(roomId);
				} catch (e: any) {
					return json({ error: "Room not found" }, e?.code === 404 || e?.errorNum === 1202 ? 404 : 500);
				}

				const isRejoin = room.players.find((p: any) => p.id === userId);

				if (room.status !== 'WAITING' && !isRejoin) {
					return json({ error: "Game already in progress" }, 400);
				}

				if (!isRejoin) {
					if (room.players.length >= 6) {
						return json({ error: "Room is full" }, 400);
					}
					room.players.push({ id: userId, name, color: PLAYER_COLORS[room.players.length], secret: newSecret() });
					room.updatedAt = new Date().toISOString();
					await roomsColl.update(roomId, { players: room.players, updatedAt: room.updatedAt });
					delete secretCache[roomId];
				}

				const me = room.players.find((p: any) => p.id === userId);
				return json({ ...publicRoom(room), secret: me.secret });
			});
		} catch (e: any) {
			return json({ error: e.message }, e instanceof SyntaxError ? 400 : 500);
		}
	}

	if (pathname === "/api/rooms/leave" && req.method === "POST") {
		try {
			const userId = await authUser(req);
			if (!userId) return json({ error: "Unauthorized" }, 401);
			const { roomId } = await req.json();
			if (typeof roomId !== 'string' || !roomId) return json({ error: "Invalid input" }, 400);
			return await withRoomLock(roomId, async () => {
				const roomsColl = db.collection("rooms");
				let room: any;
				try {
					room = await roomsColl.document(roomId);
				} catch (e: any) {
					return json({ error: "Room not found" }, e?.code === 404 || e?.errorNum === 1202 ? 404 : 500);
				}
				// Started games keep the seat so the player can rejoin
				if (room.status !== 'WAITING' || !room.players.some((p: any) => p.id === userId)) {
					return json({ success: true, left: false });
				}
				const players = room.players
					.filter((p: any) => p.id !== userId)
					.map((p: any, idx: number) => ({ ...p, color: PLAYER_COLORS[idx] }));
				delete roomEngines[roomId];
				delete secretCache[roomId];
				delete seenSignatures[roomId];
				if (players.length === 0) {
					await roomsColl.remove(roomId);
					return json({ success: true, left: true, closed: true });
				}
				await roomsColl.update(roomId, { players, creator: players[0].id, updatedAt: new Date().toISOString() });
				return json({ success: true, left: true, closed: false });
			});
		} catch (e: any) {
			return json({ error: e.message }, e instanceof SyntaxError ? 400 : 500);
		}
	}

	// DEPRECATED: server owns room state (saveRoomState); client-pushed snapshots had an incompatible shape and could corrupt restore
	if (pathname === "/api/rooms/state" && req.method === "POST") {
		return json({ error: "Gone" }, 410);
	}

	return null;
}

return { roomEngines, getOrInitEngine, handleRoomAction, handleRoomMessage, broadcastState, saveRoomState, handleApi };
}
