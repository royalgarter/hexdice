import { assert, assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { loadGameEngine } from "../js/engine-headless.ts";
import { solvePuzzle } from "../js/puzzle-solver.ts";

type Placement = [playerId: number, value: number, q: number, r: number];

async function blankGame(engine: any) {
	engine.setRandomSeed(1);
	const game = engine.createGame();
	game.$nextTick = (fn: any) => fn();
	await game.init();
	await game.loadHDFEN("37 0 PT 0 ___ R3 37.");
	return game;
}

// Sets up a radius-3 plain board with the given units, round-tripped through HDFEN like a real puzzle.
async function solveFrom(engine: any, units: Placement[], n: number) {
	const probe = await blankGame(engine);
	const tokens = probe.hexes.map((h: any) => {
		const u = units.find(([, , q, r]) => q === h.q && r === h.r);
		return u ? `${u[0]}${u[1]}mgd0` : "1";
	});
	const fen = `${tokens.join("/")} 0 PT 0 ___ R3 37.`;
	const game = await blankGame(engine);
	await game.loadHDFEN(fen);
	const fenBefore = game.generateHDFEN();
	const result = solvePuzzle(engine, game, n);
	return { game, fenBefore, result };
}

async function baseOf(engine: any, playerId: number) {
	const g = await blankGame(engine);
	const hex = g.hexes[g.players[playerId].baseHexId];
	return { q: hex.q, r: hex.r };
}

const dist = (a: { q: number; r: number }, b: { q: number; r: number }) =>
	Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.q + a.r - b.q - b.r));

// A hex on the board far from everything in `avoid`, used to park a harmless defender.
function parkingHex(avoid: Array<{ q: number; r: number }>) {
	const all = [];
	for (let q = -3; q <= 3; q++) for (let r = -3; r <= 3; r++) if (Math.abs(q + r) <= 3) all.push({ q, r });
	return all.sort((a, b) => Math.min(...avoid.map(v => dist(b, v))) - Math.min(...avoid.map(v => dist(a, v))))[0];
}

// Axial neighbour offsets
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

Deno.test("mate in 1: Fencer adjacent to enemy base captures it", async () => {
	const engine = await loadGameEngine(2, 1);
	const base = await baseOf(engine, 1);
	const own = await baseOf(engine, 0);
	const adj = DIRS.map(([dq, dr]) => ({ q: base.q + dq, r: base.r + dr }))
		.find(p => Math.max(Math.abs(p.q), Math.abs(p.r), Math.abs(p.q + p.r)) <= 3 && !(p.q === own.q && p.r === own.r))!;
	const park = parkingHex([adj, base, own]);
	const { result } = await solveFrom(engine, [[0, 1, adj.q, adj.r], [1, 1, park.q, park.r]], 1);
	assert(result.win, "capture should win in 1");
	assertEquals(result.winningFirstMoves.length >= 1, true);
});

Deno.test("Tanker (1 step) two hexes from base: no win in 1, forced win in 2 vs a far-away defender", async () => {
	const engine = await loadGameEngine(2, 1);
	const base = await baseOf(engine, 1);
	const own = await baseOf(engine, 0);
	const two = { q: base.q + 2, r: base.r - 1 };
	const inBoard = Math.max(Math.abs(two.q), Math.abs(two.r), Math.abs(two.q + two.r)) <= 3;
	assert(inBoard, "fixture hex must be on board");
	const park = parkingHex([two, base, own]);
	const units: Placement[] = [[0, 5, two.q, two.r], [1, 1, park.q, park.r]];
	const one = (await solveFrom(engine, units, 1)).result;
	assertEquals(one.win, false);
	const two_ = (await solveFrom(engine, units, 2)).result;
	assert(two_.win, "forced win in 2 expected");
});

Deno.test("solver leaves game state untouched", async () => {
	const engine = await loadGameEngine(2, 1);
	const own = await baseOf(engine, 0);
	const base = await baseOf(engine, 1);
	const start = { q: own.q + 1, r: own.r };
	const park = parkingHex([start, base, own]);
	const { game, fenBefore } = await solveFrom(engine, [[0, 1, start.q, start.r], [1, 1, park.q, park.r]], 2);
	assertEquals(game.generateHDFEN(), fenBefore);
});
