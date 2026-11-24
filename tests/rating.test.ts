import { assert, assertEquals } from "https://deno.land/std/assert/mod.ts";
import { createRoomCore } from "../js/room-core.ts";
import { loadEngine } from "../js/engine-server.ts";
import { ELO_START, eloDelta, expectedScore, getRating, K_NEW, K_SETTLED, PAIR_CAP, PAIR_WINDOW_MS, rateMatch } from "../js/rating.ts";

const A = { id: "u-a", name: "Alice" };
const B = { id: "u-b", name: "Bob" };

function fakeDb() {
	const store: Record<string, Record<string, any>> = {};
	const coll = (name: string) => {
		store[name] ??= {};
		return {
			async document(key: string) {
				if (!store[name][key]) throw Object.assign(new Error("document not found"), { code: 404 });
				return structuredClone(store[name][key]);
			},
			async save(doc: any) {
				if (store[name][doc._key]) throw Object.assign(new Error("unique constraint violated"), { code: 409 });
				store[name][doc._key] = structuredClone(doc);
				return doc;
			},
			async update(key: string, patch: any) {
				if (!store[name][key]) throw Object.assign(new Error("document not found"), { code: 404 });
				Object.assign(store[name][key], structuredClone(patch));
				return store[name][key];
			},
		};
	};
	// Only the leaderboard query exists: top ratings by elo.
	const query = async (_aql: string, vars: { limit: number }) => ({
		all: async () => Object.values(store.ratings ?? {})
			.sort((x: any, y: any) => y.elo - x.elo || y.games - x.games)
			.slice(0, vars.limit)
			.map((r: any) => ({ name: r.name, elo: r.elo, games: r.games, wins: r.wins, losses: r.losses, draws: r.draws })),
	});
	return { collection: coll, query, store };
}

const opts = { sanitizeOps: false, sanitizeResources: false };
const match = (db: any, roomId: string, winnerId: string | null, now?: Date) =>
	rateMatch(db, { roomId, mode: "autochess", players: [A, B], winnerId, now });

Deno.test("elo math: symmetric, equal ratings split evenly, new players move faster", () => {
	assertEquals(expectedScore(1500, 1500), 0.5);
	assert(Math.abs(expectedScore(1700, 1500) + expectedScore(1500, 1700) - 1) < 1e-9);
	assertEquals(eloDelta(1500, 1500, 1, 0), K_NEW / 2);
	assertEquals(eloDelta(1500, 1500, 1, 50), K_SETTLED / 2);
	assertEquals(eloDelta(1500, 1500, 0.5, 0), 0);
	assert(eloDelta(1300, 1700, 1, 50) > eloDelta(1700, 1300, 1, 50), "an upset pays more than a favourite win");
});

Deno.test("rateMatch: winner gains, loser drops, records updated", async () => {
	const db = fakeDb();
	const r = await match(db, "room1", A.id);
	assertEquals(r.rated, true);
	assertEquals(r.deltas, { [A.id]: 20, [B.id]: -20 });
	const a = await getRating(db, A.id);
	const b = await getRating(db, B.id);
	assertEquals([a!.elo, a!.games, a!.wins, a!.losses], [1520, 1, 1, 0]);
	assertEquals([b!.elo, b!.games, b!.wins, b!.losses], [1480, 1, 0, 1]);
	assertEquals(db.store.matches.room1.rated, true);
});

Deno.test("rateMatch: a draw between equals changes nothing but counts the game", async () => {
	const db = fakeDb();
	await match(db, "room1", null);
	const a = await getRating(db, A.id);
	assertEquals([a!.elo, a!.draws, a!.games], [ELO_START, 1, 1]);
});

Deno.test("rateMatch: the same room is only ever applied once", async () => {
	const db = fakeDb();
	await match(db, "room1", A.id);
	const again = await match(db, "room1", A.id);
	assertEquals(again, { rated: false, reason: "already finalized" });
	assertEquals((await getRating(db, A.id))!.elo, 1520);
});

Deno.test("rateMatch: an account cannot rate against itself", async () => {
	const db = fakeDb();
	const r = await rateMatch(db, { roomId: "r", mode: "autochess", players: [A, { id: A.id, name: "alt" }], winnerId: A.id });
	assertEquals(r, { rated: false, reason: "same account" });
	assertEquals(db.store.ratings, undefined);
});

Deno.test("rateMatch: pair cap stops win-trading inside 24h and lifts after", async () => {
	const db = fakeDb();
	const t0 = new Date("2026-11-24T10:00:00Z");
	for (let i = 0; i < PAIR_CAP; i++) assertEquals((await match(db, `r${i}`, A.id, t0)).rated, true);
	const eloAfterCap = (await getRating(db, A.id))!.elo;

	const capped = await match(db, "r-extra", A.id, new Date(t0.getTime() + 1000));
	assertEquals(capped, { rated: false, reason: "pair cap" });
	assertEquals((await getRating(db, A.id))!.elo, eloAfterCap);
	assertEquals(db.store.matches["r-extra"].rated, false);

	const later = await match(db, "r-later", A.id, new Date(t0.getTime() + PAIR_WINDOW_MS + 1000));
	assertEquals(later.rated, true);
});

Deno.test("rateMatch: cleans hostile display names", async () => {
	const db = fakeDb();
	await rateMatch(db, { roomId: "r", mode: "autochess", players: [{ id: A.id, name: "x".repeat(500) }, { id: B.id, name: 42 as unknown as string }], winnerId: A.id });
	assertEquals((await getRating(db, A.id))!.name.length, 40);
	assertEquals((await getRating(db, B.id))!.name, "Player");
});

// ---- room integration: finalizeMatch on a real server engine ----

function setup() {
	const db = fakeDb();
	const published: { topic: string; payload: any }[] = [];
	const mqttClient = { publish: (topic: string, payload: string) => published.push({ topic, payload: JSON.parse(payload) }) };
	const core = createRoomCore({ db, mqttClient, loadEngine, mqttUrl: "ws://localhost:1883", googleClientId: "test", verifyToken: async (t) => t || null });
	const call = async (method: string, path: string, userId?: string, body?: any) => {
		const headers: Record<string, string> = userId ? { Authorization: `Bearer ${userId}` } : {};
		const res = await core.handleApi(new Request(`http://t${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }));
		return { status: res!.status, json: await res!.json() };
	};
	return { db, core, call, published };
}

async function startedRoom(rated: boolean) {
	const ctx = setup();
	const { json: room } = await ctx.call("POST", "/api/rooms/create", A.id, { name: A.name, rated });
	await ctx.call("POST", "/api/rooms/join", B.id, { roomId: room._key, name: B.name });
	const id = room._key;
	await ctx.core.handleRoomAction(id, { type: "GUEST_JOINED", sender: B.id, data: { name: B.name } });
	await ctx.core.handleRoomAction(id, { type: "START_GAME", sender: A.id, data: { seed: 7 } });
	const game = ctx.core.roomEngines[id];
	return { ...ctx, id, game, room };
}

const rounds = (winners: (string | null)[]) => winners.map((winnerId, i) => ({ round: i + 1, winnerId }));
const tenRounds = (aWins: number) => rounds(Array.from({ length: 10 }, (_, i) => (i < aWins ? A.id : B.id)));

Deno.test({ name: "room: rated flag is stored, public, and defaults to false", ...opts, async fn() {
	const rated = await startedRoom(true);
	assertEquals(rated.room.rated, true);
	assertEquals(rated.db.store.rooms[rated.id].rated, true);
	const casual = await startedRoom(false);
	assertEquals(casual.room.rated, false);
	const { json } = await casual.call("POST", "/api/rooms/create", A.id, { name: A.name });
	assertEquals(json.rated, false);
} });

Deno.test({ name: "room: finishing a rated match updates ratings, room status and leaderboard", ...opts, async fn() {
	const { core, game, id, db, call, published } = await startedRoom(true);
	game._roundResults = tenRounds(6);
	await core.finalizeMatch(id, game);

	assertEquals(db.store.rooms[id].status, "FINISHED");
	assertEquals(db.store.rooms[id].result.winnerId, A.id);
	assertEquals(db.store.rooms[id].result.rating.rated, true);
	assertEquals((await getRating(db, A.id))!.elo, 1520);
	assertEquals((await getRating(db, B.id))!.elo, 1480);
	assert(published.some((p) => p.topic === `hexdice/rooms/${id}/result` && p.payload.winnerId === A.id));

	await core.finalizeMatch(id, game);
	assertEquals((await getRating(db, A.id))!.games, 1, "second finalize is a no-op");

	const board = await call("GET", "/api/leaderboard");
	assertEquals(board.status, 200);
	assertEquals(board.json.players.map((p: any) => p.name), ["Alice", "Bob"]);
	assertEquals(board.json.players[0].elo, 1520);

	const me = await call("GET", "/api/me/rating", B.id);
	assertEquals(me.json, { elo: 1480, games: 1, wins: 0, losses: 1, draws: 0 });
	assertEquals((await call("GET", "/api/me/rating", "nobody")).json.elo, ELO_START);
	assertEquals((await call("GET", "/api/me/rating")).status, 401);
} });

Deno.test({ name: "room: an unrated room finishes without touching ratings", ...opts, async fn() {
	const { core, game, id, db } = await startedRoom(false);
	game._roundResults = tenRounds(7);
	await core.finalizeMatch(id, game);
	assertEquals(db.store.rooms[id].status, "FINISHED");
	assertEquals(db.store.ratings, undefined);
} });

Deno.test({ name: "room: a rated match with missing rounds is not rated", ...opts, async fn() {
	const { core, game, id, db } = await startedRoom(true);
	game._roundResults = rounds([A.id, A.id, B.id]);
	await core.finalizeMatch(id, game);
	assertEquals(db.store.rooms[id].result.rating.rated, false);
	assertEquals(db.store.ratings, undefined);
} });

Deno.test({ name: "room: tied rounds are a draw", ...opts, async fn() {
	const { core, game, id, db } = await startedRoom(true);
	game._roundResults = tenRounds(5);
	await core.finalizeMatch(id, game);
	assertEquals(db.store.rooms[id].result.winnerId, null);
	assertEquals((await getRating(db, A.id))!.draws, 1);
} });

Deno.test({ name: "room: a drawn round counts for nobody, and a round is only recorded once", ...opts, async fn() {
	const { core, game, id, db } = await startedRoom(true);
	game.Autochess.state.round = 1;
	game.Autochess.state.lastWinnerId = null;
	core.recordRoundResult(game);
	core.recordRoundResult(game);
	assertEquals(game._roundResults, [{ round: 1, winnerId: null }]);
	game._roundResults = [...game._roundResults, ...rounds(Array(9).fill(A.id)).map((r, i) => ({ ...r, round: i + 2 }))];
	await core.finalizeMatch(id, game);
	assertEquals(db.store.rooms[id].result.winnerId, A.id);
} });

Deno.test({ name: "room: round results survive a restart (persisted with the room state)", ...opts, async fn() {
	const { core, game, id, db } = await startedRoom(true);
	game._roundResults = rounds([A.id, B.id]);
	await core.saveRoomState(id, game);
	assertEquals(db.store.rooms[id].gameState.roundResults.length, 2);
	const revived = createRoomCore({ db, mqttClient: { publish() {} }, loadEngine, mqttUrl: "ws://x", verifyToken: async (t) => t || null });
	const restored = await revived.getOrInitEngine(id);
	assertEquals(restored._roundResults, rounds([A.id, B.id]));
} });

Deno.test({ name: "room: the real end-of-round hook records the round and finishes the match after the final round", ...opts, async fn() {
	const { core, game, id, db } = await startedRoom(true);
	const max = game.Autochess.state.maxRound;
	game._roundResults = rounds(Array(max - 1).fill(A.id));
	game.Autochess.state.round = max;
	await core.handleRoomAction(id, { type: "AUTOCHESS_START_COMBAT", sender: A.id, data: {} });
	assertEquals(game.Autochess.state.phase, "COMBAT");
	game.Autochess.state.lastWinnerId = null;
	game.Autochess.resolveTimeout(game); // time-up path of the last round; its hook calls the same scheduleAutoAdvance as a normal finish
	await new Promise((r) => setTimeout(r, 100));
	assertEquals(game._roundResults.length, max);
	assertEquals(db.store.rooms[id].status, "FINISHED");
	assertEquals(db.store.rooms[id].result.winnerId, A.id);
	assertEquals((await getRating(db, A.id))!.elo > (await getRating(db, B.id))!.elo, true);
} });

Deno.test({ name: "room: an early round end does not finish the match", ...opts, async fn() {
	const { core, game, id, db } = await startedRoom(true);
	game.Autochess.state.round = 2;
	await core.handleRoomAction(id, { type: "AUTOCHESS_START_COMBAT", sender: A.id, data: {} });
	game.Autochess.resolveTimeout(game);
	await new Promise((r) => setTimeout(r, 100));
	assertEquals(game._roundResults.length, 1);
	assertEquals(db.store.rooms[id].status, "PLAYING");
} });
