import { assert, assertEquals } from "https://deno.land/std/assert/mod.ts";
import { createRoomCore } from "../js/room-core.ts";
import { loadEngine } from "../js/engine-server.ts";

const HOST = { id: "u-host", name: "Host" };
const GUEST = { id: "u-guest", name: "Guest" };

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
			async remove(key: string) {
				if (!store[name][key]) throw Object.assign(new Error("document not found"), { code: 404 });
				delete store[name][key];
			},
			async update(key: string, patch: any) {
				if (!store[name][key]) throw Object.assign(new Error("document not found"), { code: 404 });
				Object.assign(store[name][key], structuredClone(patch));
				return store[name][key];
			},
		};
	};
	return { collection: coll, store };
}

function setup() {
	const db = fakeDb();
	const published: { topic: string; payload: any }[] = [];
	const mqttClient = { publish: (topic: string, payload: string) => published.push({ topic, payload: JSON.parse(payload) }) };
	const core = createRoomCore({ db, mqttClient, loadEngine, mqttUrl: "ws://localhost:1883", googleClientId: "test", verifyToken: async (t) => t || null });
	const post = async (path: string, { userId, ...body }: any, token = userId) => {
		const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
		const res = await core.handleApi(new Request(`http://t${path}`, { method: "POST", headers, body: JSON.stringify(body) }));
		return { status: res!.status, json: await res!.json() };
	};
	const lastState = (roomId: string) => published.filter((p) => p.topic === `hexdice/rooms/${roomId}/state`).at(-1)?.payload;
	return { db, core, post, published, lastState };
}

const opts = { sanitizeOps: false, sanitizeResources: false };

Deno.test({ name: "api: unrelated path returns null", ...opts, async fn() {
	const { core } = setup();
	assertEquals(await core.handleApi(new Request("http://t/index.js")), null);
} });

Deno.test({ name: "api: create room", ...opts, async fn() {
	const { post, db } = setup();
	const { status, json } = await post("/api/rooms/create", { userId: HOST.id, name: HOST.name });
	assertEquals(status, 200);
	assertEquals(json._key.length, 6);
	assertEquals(json.creator, HOST.id);
	assertEquals(json.status, "WAITING");
	assertEquals(json.players, [{ id: HOST.id, name: HOST.name, color: "Blue" }]);
	assert(db.store.rooms[json._key]);
} });

Deno.test({ name: "api: join adds guest with next colour", ...opts, async fn() {
	const { post } = setup();
	const { json: room } = await post("/api/rooms/create", { userId: HOST.id, name: HOST.name });
	const { status, json } = await post("/api/rooms/join", { roomId: room._key, userId: GUEST.id, name: GUEST.name });
	assertEquals(status, 200);
	assertEquals(json.players.map((p: any) => p.color), ["Blue", "Red"]);
} });

Deno.test({ name: "api: rejoin does not duplicate player", ...opts, async fn() {
	const { post } = setup();
	const { json: room } = await post("/api/rooms/create", { userId: HOST.id, name: HOST.name });
	const { json } = await post("/api/rooms/join", { roomId: room._key, userId: HOST.id, name: HOST.name });
	assertEquals(json.players.length, 1);
} });

Deno.test({ name: "api: join unknown room -> 404", ...opts, async fn() {
	const { post } = setup();
	const { status, json } = await post("/api/rooms/join", { roomId: "NOPE00", userId: GUEST.id, name: GUEST.name });
	assertEquals(status, 404);
	assert(json.error);
} });

Deno.test({ name: "api: join full room (6) rejected", ...opts, async fn() {
	const { post } = setup();
	const { json: room } = await post("/api/rooms/create", { userId: "p0", name: "p0" });
	for (let i = 1; i < 6; i++) await post("/api/rooms/join", { roomId: room._key, userId: `p${i}`, name: `p${i}` });
	const { status, json } = await post("/api/rooms/join", { roomId: room._key, userId: "p6", name: "p6" });
	assertEquals(status, 400);
	assertEquals(json.error, "Room is full");
} });

Deno.test({ name: "api: join started room rejected unless rejoin", ...opts, async fn() {
	const { post, db } = setup();
	const { json: room } = await post("/api/rooms/create", { userId: HOST.id, name: HOST.name });
	await post("/api/rooms/join", { roomId: room._key, userId: GUEST.id, name: GUEST.name });
	db.store.rooms[room._key].status = "PLAYING";
	const late = await post("/api/rooms/join", { roomId: room._key, userId: "late", name: "Late" });
	assertEquals(late.status, 400);
	assertEquals(late.json.error, "Game already in progress");
	const back = await post("/api/rooms/join", { roomId: room._key, userId: GUEST.id, name: GUEST.name });
	assertEquals(back.status, 200);
	assertEquals(back.json.status, "PLAYING");
} });

Deno.test({ name: "api: concurrent joins keep all players", ...opts, async fn() {
	const { post } = setup();
	const { json: room } = await post("/api/rooms/create", { userId: HOST.id, name: HOST.name });
	const results = await Promise.all(["a", "b", "c"].map((u) => post("/api/rooms/join", { roomId: room._key, userId: u, name: u })));
	const final = await post("/api/rooms/join", { roomId: room._key, userId: HOST.id, name: HOST.name });
	assertEquals(final.json.players.length, 4);
	assert(results.every((r) => r.status === 200));
} });

Deno.test({ name: "api: create/join without token rejected", ...opts, async fn() {
	const { post } = setup();
	assertEquals((await post("/api/rooms/create", { name: "x" }, "")).status, 401);
	const { json: room } = await post("/api/rooms/create", { userId: HOST.id, name: HOST.name });
	assertEquals((await post("/api/rooms/join", { roomId: room._key, name: "x" }, "")).status, 401);
} });

Deno.test({ name: "api: user id comes from token, not body", ...opts, async fn() {
	const { post } = setup();
	const { json: room } = await post("/api/rooms/create", { userId: HOST.id, name: HOST.name });
	const res = await post("/api/rooms/join", { roomId: room._key, userId: HOST.id, name: "Evil" }, GUEST.id);
	assertEquals(res.json.players.map((p: any) => p.id), [HOST.id, GUEST.id]);
} });

Deno.test({ name: "api: debug token only works when allowed", ...opts, async fn() {
	const mk = (allowDebugAuth: boolean) => createRoomCore({ db: fakeDb(), mqttClient: { publish() {} }, loadEngine, mqttUrl: "ws://x", allowDebugAuth });
	const req = () => new Request("http://t/api/rooms/create", { method: "POST", headers: { Authorization: "Bearer debug:alice" }, body: JSON.stringify({ name: "alice" }) });
	const ok = await mk(true).handleApi(req());
	assertEquals(ok!.status, 200);
	assertEquals((await ok!.json()).creator, "alice");
	const no = await mk(false).handleApi(req());
	assertEquals(no!.status === 200, false);
} });

async function startedRoom() {
	const ctx = setup();
	const { json: room } = await ctx.post("/api/rooms/create", { userId: HOST.id, name: HOST.name });
	await ctx.post("/api/rooms/join", { roomId: room._key, userId: GUEST.id, name: GUEST.name });
	const id = room._key;
	await ctx.core.handleRoomAction(id, { type: "GUEST_JOINED", sender: GUEST.id, data: { name: GUEST.name } });
	return { ...ctx, id };
}

Deno.test({ name: "room: GUEST_JOINED builds engine with both players", ...opts, async fn() {
	const { core, id, lastState } = await startedRoom();
	const game = core.roomEngines[id];
	assertEquals(game.players.map((p: any) => p.id), [HOST.id, GUEST.id]);
	assertEquals(lastState(id).players.length, 2);
} });

Deno.test({ name: "room: START_GAME inits game once and marks room PLAYING", ...opts, async fn() {
	const { core, id, db } = await startedRoom();
	await core.handleRoomAction(id, { type: "START_GAME", sender: HOST.id, data: { seed: 42, hostName: HOST.name } });
	const game = core.roomEngines[id];
	assert(game._initialized);
	assertEquals(game.Autochess.state.phase, "PREPARATION");
	assertEquals(db.store.rooms[id].status, "PLAYING");
	assert(db.store.rooms[id].gameState);
	const dice0 = game.players[0].dice.length;
	await core.handleRoomAction(id, { type: "START_GAME", sender: HOST.id, data: { seed: 99 } });
	assertEquals(game.players[0].dice.length, dice0);
} });

Deno.test({ name: "room: same seed gives same state", ...opts, async fn() {
	const a = await startedRoom();
	const b = await startedRoom();
	await a.core.handleRoomAction(a.id, { type: "START_GAME", sender: HOST.id, data: { seed: 7 } });
	await b.core.handleRoomAction(b.id, { type: "START_GAME", sender: HOST.id, data: { seed: 7 } });
	const sig = (g: any) => JSON.stringify(g.players.map((p: any) => p.dice.map((d: any) => d.value)));
	assertEquals(sig(a.core.roomEngines[a.id]), sig(b.core.roomEngines[b.id]));
} });

Deno.test({ name: "room: AUTOCHESS_READY toggles; unknown sender ignored", ...opts, async fn() {
	const { core, id, lastState } = await startedRoom();
	await core.handleRoomAction(id, { type: "START_GAME", sender: HOST.id, data: { seed: 1 } });
	await core.handleRoomAction(id, { type: "AUTOCHESS_READY", sender: HOST.id, data: {} });
	assertEquals(lastState(id).autochess.ready[HOST.id], true);
	await core.handleRoomAction(id, { type: "AUTOCHESS_READY", sender: HOST.id, data: {} });
	assertEquals(lastState(id).autochess.ready[HOST.id], false);
	const before = JSON.stringify(core.roomEngines[id].Autochess.state.ready);
	await core.handleRoomAction(id, { type: "AUTOCHESS_READY", sender: "stranger", data: {} });
	assertEquals(JSON.stringify(core.roomEngines[id].Autochess.state.ready), before);
} });

Deno.test({ name: "room: AUTOCHESS_RECRUIT rejects bad index", ...opts, async fn() {
	const { core, id } = await startedRoom();
	await core.handleRoomAction(id, { type: "START_GAME", sender: HOST.id, data: { seed: 1 } });
	const g = core.roomEngines[id];
	const n = g.players[0].dice.length;
	await core.handleRoomAction(id, { type: "AUTOCHESS_RECRUIT", sender: HOST.id, data: { index: 999 } });
	await core.handleRoomAction(id, { type: "AUTOCHESS_RECRUIT", sender: HOST.id, data: { index: -1 } });
	assertEquals(g.players[0].dice.length, n);
} });

Deno.test({ name: "room: malformed payload does not throw", ...opts, async fn() {
	const { core, id } = await startedRoom();
	await core.handleRoomAction(id, { type: "AUTOCHESS_RECRUIT", sender: HOST.id });
	await core.handleRoomAction(id, null as any);
	await core.handleRoomAction(id, { type: 5 } as any);
} });

Deno.test({ name: "room: START_GAME ignored from non-host or bad seed", ...opts, async fn() {
	const { core, id } = await startedRoom();
	await core.handleRoomAction(id, { type: "START_GAME", sender: GUEST.id, data: { seed: 1 } });
	assertEquals(core.roomEngines[id]._initialized, false);
	await core.handleRoomAction(id, { type: "START_GAME", sender: HOST.id, data: { seed: "x" } });
	assertEquals(core.roomEngines[id]._initialized, false);
} });

Deno.test({ name: "api: join does not leak gameState", ...opts, async fn() {
	const { post, core, db } = await startedRoom();
	await core.handleRoomAction(Object.keys(db.store.rooms)[0], { type: "START_GAME", sender: HOST.id, data: { seed: 3 } });
	const { json } = await post("/api/rooms/join", { roomId: Object.keys(db.store.rooms)[0], userId: HOST.id, name: HOST.name });
	assertEquals("gameState" in json, false);
} });

Deno.test({ name: "room: place on hex 0 moves unit instead of duplicating", ...opts, async fn() {
	const { core, id } = await startedRoom();
	await core.handleRoomAction(id, { type: "START_GAME", sender: HOST.id, data: { seed: 11 } });
	const g = core.roomEngines[id];
	const valid: number[] = g.calcValidDeploymentHexes(0);
	const unit = g.players[0].dice[0];
	const old = g.getHex(unit.hexId);
	old.unit = null; old.unitId = null;
	g.getHex(0).unit = unit; g.getHex(0).unitId = unit.id; unit.hexId = 0;
	const to = valid.find((h) => h !== 0 && !g.getHex(h).unit)!;
	assert(to !== undefined);
	await core.handleRoomAction(id, { type: "AUTOCHESS_PLACE", sender: HOST.id, data: { unitId: unit.id, toHexId: to, fromHexId: 0 } });
	assertEquals(g.getHex(0).unit, null);
	assertEquals(g.getHex(to).unit?.id, unit.id);
} });

Deno.test({ name: "room: START_GAME assigns bases and deploys every army", ...opts, async fn() {
	const { core, id } = await startedRoom();
	await core.handleRoomAction(id, { type: "START_GAME", sender: HOST.id, data: { seed: 21 } });
	const g = core.roomEngines[id];
	assert(g.players.every((p: any) => p.baseHexId != null), "every player has a base hex");
	assertEquals(g.players[0].baseHexId === g.players[1].baseHexId, false);
	for (const p of g.players) {
		assertEquals(p.dice.filter((d: any) => d.isDeployed && d.hexId != null).length, Math.min(6, p.dice.length));
	}
} });

Deno.test({ name: "room: restart restores state from db", ...opts, async fn() {
	const { core, id, db, post } = await startedRoom();
	await core.handleRoomAction(id, { type: "START_GAME", sender: HOST.id, data: { seed: 5 } });
	const dice = core.roomEngines[id].players[0].dice.map((d: any) => d.id);
	const core2 = createRoomCore({ db, mqttClient: { publish() {} }, loadEngine, mqttUrl: "ws://x" });
	const g2 = await core2.getOrInitEngine(id);
	assertEquals(g2.players[0].dice.map((d: any) => d.id), dice);
	assert(g2._initialized);
	void post;
} });

Deno.test({ name: "room: /api/rooms/state is gone and cannot corrupt restore", ...opts, async fn() {
	const { core, id, db, post } = await startedRoom();
	const res = await post("/api/rooms/state", { userId: HOST.id, roomId: id, gameState: { hexes: [], seed: 1, phase: "X" } });
	assertEquals(res.status, 410);
	const core2 = createRoomCore({ db, mqttClient: { publish() {} }, loadEngine, mqttUrl: "ws://x" });
	assert(await core2.getOrInitEngine(id));
	void core;
} });

const hmacHex = async (secret: string, msg: string) => {
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	return [...new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)))].map((b) => b.toString(16).padStart(2, "0")).join("");
};
const sign = async (secret: string, type: string, data: any, sender: string, seq = 1, ts = Date.now()) =>
	({ type, data, sender, seq, ts, sig: await hmacHex(secret, JSON.stringify([type, data ?? null, sender, seq, ts])) });

async function signedRoom() {
	const ctx = setup();
	const created = await ctx.post("/api/rooms/create", { userId: HOST.id, name: HOST.name });
	const joined = await ctx.post("/api/rooms/join", { roomId: created.json._key, userId: GUEST.id, name: GUEST.name });
	return { ...ctx, id: created.json._key as string, hostSecret: created.json.secret as string, guestSecret: joined.json.secret as string };
}

Deno.test({ name: "api: secrets are only returned to their owner", ...opts, async fn() {
	const { post, id, hostSecret, guestSecret } = await signedRoom();
	assert(hostSecret && guestSecret && hostSecret !== guestSecret);
	const again = await post("/api/rooms/join", { roomId: id, userId: HOST.id, name: HOST.name });
	assertEquals(again.json.secret, hostSecret);
	assert(again.json.players.every((p: any) => !("secret" in p)));
} });

Deno.test({ name: "mqtt: signed host START_GAME accepted", ...opts, async fn() {
	const { core, id, hostSecret } = await signedRoom();
	await core.handleRoomMessage(id, await sign(hostSecret, "START_GAME", { seed: 5 }, HOST.id));
	assert(core.roomEngines[id]._initialized);
} });

Deno.test({ name: "mqtt: unsigned, forged, stale and replayed messages rejected", ...opts, async fn() {
	const { core, id, hostSecret, guestSecret } = await signedRoom();
	const start = { seed: 5 };
	await core.handleRoomMessage(id, { type: "START_GAME", sender: HOST.id, data: start });
	assertEquals(core.roomEngines[id], undefined);
	await core.handleRoomMessage(id, await sign(guestSecret, "START_GAME", start, HOST.id));
	assertEquals(core.roomEngines[id], undefined);
	await core.handleRoomMessage(id, await sign(hostSecret, "START_GAME", start, HOST.id, 1, Date.now() - 3600_000));
	assertEquals(core.roomEngines[id], undefined);
	const tampered = await sign(hostSecret, "START_GAME", start, HOST.id);
	await core.handleRoomMessage(id, { ...tampered, data: { seed: 6 } });
	assertEquals(core.roomEngines[id], undefined);
	const good = await sign(hostSecret, "AUTOCHESS_READY", {}, HOST.id);
	await core.handleRoomMessage(id, good);
	const before = core.roomEngines[id].Autochess.state.ready?.[HOST.id];
	await core.handleRoomMessage(id, good);
	assertEquals(core.roomEngines[id].Autochess.state.ready?.[HOST.id], before);
} });

Deno.test({ name: "api: leave removes player from waiting room and recolours", ...opts, async fn() {
	const { post, id, db } = await signedRoom();
	await post("/api/rooms/join", { roomId: id, userId: "third", name: "Third" });
	const res = await post("/api/rooms/leave", { userId: GUEST.id, roomId: id });
	assertEquals(res.json, { success: true, left: true, closed: false });
	assertEquals(db.store.rooms[id].players.map((p: any) => [p.id, p.color]), [[HOST.id, "Blue"], ["third", "Red"]]);
} });

Deno.test({ name: "api: creator leaving passes host to next player; last leaver closes room", ...opts, async fn() {
	const { post, id, db } = await signedRoom();
	await post("/api/rooms/leave", { userId: HOST.id, roomId: id });
	assertEquals(db.store.rooms[id].creator, GUEST.id);
	const last = await post("/api/rooms/leave", { userId: GUEST.id, roomId: id });
	assertEquals(last.json.closed, true);
	assertEquals(db.store.rooms[id], undefined);
} });

Deno.test({ name: "api: leave keeps seat in started game; needs auth", ...opts, async fn() {
	const { post, id, db } = await signedRoom();
	assertEquals((await post("/api/rooms/leave", { roomId: id }, "")).status, 401);
	db.store.rooms[id].status = "PLAYING";
	const res = await post("/api/rooms/leave", { userId: GUEST.id, roomId: id });
	assertEquals(res.json.left, false);
	assertEquals(db.store.rooms[id].players.length, 2);
} });

Deno.test({ name: "room: NEXT_ROUND does not advance past the final round", ...opts, async fn() {
	const { core, id } = await startedRoom();
	await core.handleRoomAction(id, { type: "START_GAME", sender: HOST.id, data: { seed: 2 } });
	const st = core.roomEngines[id].Autochess.state;
	st.round = st.maxRound;
	st.phase = "RECAP";
	await core.handleRoomAction(id, { type: "AUTOCHESS_NEXT_ROUND", sender: HOST.id, data: {} });
	assertEquals(st.round, st.maxRound + 1);
	await core.handleRoomAction(id, { type: "AUTOCHESS_NEXT_ROUND", sender: GUEST.id, data: {} });
	assertEquals(st.round, st.maxRound + 1);
} });
