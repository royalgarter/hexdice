import { assert, assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { loadGameEngine } from "../js/engine-headless.ts";
import { playMatch } from "../js/evolve.ts";

const engine = await loadGameEngine(2, 1);
const evolved = engine.evolvedProfiles;
const keys = Object.keys(evolved);

Deno.test("evolved profiles are exported, named and clamped", () => {
	assert(keys.length >= 4);
	for (const k of keys) {
		const p = evolved[k];
		assert(p.name && p.description && p.evolved === true, k);
		assertEquals(engine.profileTools.clampProfile(JSON.parse(JSON.stringify(p))).priorityOrder.length, p.priorityOrder.length, k);
	}
});

Deno.test("tiers reference real champions and do not overlap", () => {
	const { normal, hard } = engine.aiTiers;
	for (const k of [...normal, ...hard]) assert(evolved[k], `tier names unknown profile ${k}`);
	assertEquals(normal.filter((k: string) => hard.includes(k)).length, 0);
});

Deno.test("getProfile resolves evolved names; hand-tuned lookup unchanged", () => {
	const game = engine.createGame();
	assertEquals(game.pickAIProfile({ story: { boss: { aiProfile: keys[0] } } }), keys[0]);
	assert(engine.aiTiers.hard.includes(game.pickAIProfile({ story: { boss: { aiProfile: "hard" } } })));
	assert(Object.keys(engine.heuristicProfiles).includes(game.pickAIProfile(null)), "default stays a hand-tuned profile");
	assertEquals(game.pickAIProfile({ story: { boss: { aiProfile: "nope" } } }) in engine.heuristicProfiles, true);
});

Deno.test("every evolved champion plays a full game", async () => {
	for (const k of keys) {
		const r = await playMatch({ seats: [evolved[k], "baseline"], seed: 4242 });
		assert(r.plies > 0 && r.plies <= 300, `${k}: plies ${r.plies}`);
	}
});
