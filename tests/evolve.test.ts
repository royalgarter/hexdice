import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { archiveInsert, cellOf, Elite, mergeScores, quantileEdges, Score } from "../js/evolve.ts";

const score = (rate: number, aggression: number, guard: number, games = 10): Score => ({
	rate, games, wins: 0, draws: 0, avgPlies: 40, perOpponent: { baseline: rate }, desc: { aggression, length: guard },
});
const edges = { aggression: [0.1, 0.2], length: [0.1, 0.2] };

Deno.test("quantileEdges splits into equal bins", () => {
	assertEquals(quantileEdges([1, 2, 3, 4, 5, 6], 3), [3, 5]);
});

Deno.test("cellOf bins both axes", () => {
	assertEquals(cellOf({ aggression: 0.05, length: 0.25 }, edges), "0:2");
	assertEquals(cellOf({ aggression: 0.1, length: 0.1 }, edges), "1:1");
});

Deno.test("archiveInsert keeps the best per cell", () => {
	const archive = new Map<string, Elite>();
	const mk = (name: string, s: Score): Elite => ({ name, profile: {}, score: s });
	assertEquals(archiveInsert(archive, mk("a", score(0.6, 0.05, 0.05)), edges), true);
	assertEquals(archiveInsert(archive, mk("b", score(0.5, 0.05, 0.05)), edges), false);
	assertEquals(archiveInsert(archive, mk("c", score(0.7, 0.05, 0.05)), edges), true);
	assertEquals(archiveInsert(archive, mk("d", score(0.4, 0.15, 0.05)), edges), true);
	assertEquals(archive.size, 2);
	assertEquals(archive.get("0:0")!.name, "c");
});

Deno.test("mergeScores weights by games", () => {
	const m = mergeScores(score(0.5, 0.1, 0.1, 10), score(0.8, 0.2, 0.2, 20));
	assertEquals(m.games, 30);
	assertEquals(Math.round(m.rate * 1000), 700);
});
