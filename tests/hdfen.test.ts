import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { loadGameEngine } from "../js/engine-headless.ts";

async function newGame(engine: any, seed: number) {
	engine.setRandomSeed(seed);
	const game = engine.createGame();
	game.$nextTick = (fn: any) => fn();
	await game.init();
	return game;
}

Deno.test("HDFEN round-trip: gen -> load -> gen is identical", async () => {
	const engine = await loadGameEngine(2, 1);
	for (const seed of [1, 7, 42, 1234]) {
		const a = await newGame(engine, seed);
		a.randomStart();
		a.hexes.forEach((h: any, i: number) => { if (i % 11 === 0 && !h.unit && h.basePlayerId == null) a.setTerrainType(h, ['FOREST', 'LAKE', 'TOWER', 'MOUNTAIN'][i % 4]); });
		const fen = a.generateHDFEN();

		const b = await newGame(engine, seed + 1);
		await b.loadHDFEN(fen);
		assertEquals(b.generateHDFEN(), fen);
	}
});
