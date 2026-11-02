import { assert, assertEquals, assertNotEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { loadGameEngine } from "../js/engine-headless.ts";
import { playMatch } from "../js/evolve.ts";

const engine = await loadGameEngine(2, 1);
const T = engine.profileTools;
const builtins = Object.keys(engine.heuristicProfiles).filter((n) => !n.startsWith("__"));

const numbers = (p: any): [string, number][] => {
	const out: [string, number][] = [];
	for (const [k, v] of Object.entries(p.weights)) {
		if (typeof v === "object") for (const [sk, sv] of Object.entries(v as any)) out.push([`${k}.${sk}`, sv as number]);
		else out.push([k, v as number]);
	}
	return out;
};

Deno.test("makeRng is deterministic and in [0,1)", () => {
	const a = T.makeRng(7), b = T.makeRng(7), c = T.makeRng(8);
	const xs = Array.from({ length: 50 }, () => a());
	assertEquals(xs, Array.from({ length: 50 }, () => b()));
	assert(xs.every((x) => x >= 0 && x < 1));
	assertNotEquals(xs[0], c());
});

Deno.test("mutateProfile: seeded runs are identical, different seeds differ, input untouched", () => {
	const before = JSON.stringify(engine.heuristicProfiles.baseline);
	const m1 = T.mutateProfile("baseline", 0.3, T.makeRng(5));
	const m2 = T.mutateProfile("baseline", 0.3, T.makeRng(5));
	const m3 = T.mutateProfile("baseline", 0.3, T.makeRng(6));
	assertEquals(JSON.stringify(m1), JSON.stringify(m2));
	assertNotEquals(JSON.stringify(m1), JSON.stringify(m3));
	assertEquals(JSON.stringify(engine.heuristicProfiles.baseline), before);
});

Deno.test("mutateProfile x1000 keeps every built-in legal (no NaN, float keys stay float, sign rules, priority set)", () => {
	const rng = T.makeRng(1);
	let nonInteger = 0;
	for (const name of builtins) {
		const base = engine.heuristicProfiles[name];
		for (let i = 0; i < 1000 / builtins.length + 1; i++) {
			const m = T.mutateProfile(name, 0.5, rng);
			for (const [k, v] of numbers(m)) {
				assert(Number.isFinite(v), `${name}: ${k} not finite`);
				if (/Penalty$/.test(k) && !k.endsWith("supportFarPenalty")) assert(v <= 0, `${name}: ${k}=${v} should be <= 0`);
				if (k.endsWith("supportFarPenalty")) assert(v >= 0);
				if (k.startsWith("spells.")) assert(v >= 0 && v <= 4);
				if (k === "teamPositionWeight" || k === "pressureWeight") {
					assert(v >= 0 && v <= 2);
					if (!Number.isInteger(v)) nonInteger++;
				}
			}
			assert(m.riskTolerance >= 0 && m.riskTolerance <= 1);
			assertEquals(new Set(m.priorityOrder).size, m.priorityOrder.length);
			assertEquals(m.priorityOrder.length, base.priorityOrder.length);
		}
	}
	assert(nonInteger > 100, `float-scale weights collapsed to integers (${nonInteger} non-integer)`);
});

Deno.test("completeProfile materialises role weights so they can evolve", () => {
	const full = T.completeProfile(engine.heuristicProfiles.baseline);
	assertEquals(full.weights.roleWeights.flankerEdge, 20);
	assertEquals(full.weights.roleWeights.kitingAdjacentPenalty, -500);
	assertEquals(full.weights.selfBlockPenalty, -80);
	assertEquals(engine.heuristicProfiles.baseline.weights.roleWeights, undefined);
});

Deno.test("a zero-valued weight can mutate", () => {
	const seen = new Set<number>();
	const rng = T.makeRng(3);
	for (let i = 0; i < 30; i++) seen.add(T.mutateProfile("ranger", 0.4, rng).weights.terrainWeights.losBlockBonus);
	const base = engine.heuristicProfiles.ranger.weights.terrainWeights.losBlockBonus;
	assert(base === 0 ? [...seen].some((v) => v !== 0) : seen.size > 1);
});

Deno.test("crossoverProfiles: every gene comes from a parent, result legal and deterministic", () => {
	const a = T.completeProfile(engine.heuristicProfiles.berserker), b = T.completeProfile(engine.heuristicProfiles.turtle);
	const c1 = T.crossoverProfiles(a, b, T.makeRng(2)), c2 = T.crossoverProfiles(a, b, T.makeRng(2));
	assertEquals(JSON.stringify(c1), JSON.stringify(c2));
	const bMap = new Map(numbers(b)), aMap = new Map(numbers(a));
	for (const [k, v] of numbers(c1)) assert(v === aMap.get(k) || v === bMap.get(k), `${k}=${v} from neither parent`);
	assert(c1.riskTolerance === a.riskTolerance || c1.riskTolerance === b.riskTolerance);
});

Deno.test("generateRandomProfile: seeded, finite, has spells and terrain", () => {
	const r1 = T.generateRandomProfile(T.makeRng(9)), r2 = T.generateRandomProfile(T.makeRng(9));
	assertEquals(JSON.stringify(r1), JSON.stringify(r2));
	for (const [k, v] of numbers(r1)) assert(Number.isFinite(v), k);
	assert(r1.weights.spells.SPELLCAST_SHIELD >= 0);
	assert(r1.weights.mergeOver6Penalty <= 0);
});

Deno.test("playMatch is reproducible: same (profiles, seed, seats) gives the same game", async () => {
	const task = { seats: ["berserker", "turtle"] as [string, string], seed: 4242 };
	const r1 = await playMatch(task), r2 = await playMatch(task);
	assertEquals([r1.winnerSeat, r1.plies], [r2.winnerSeat, r2.plies]);
	const other = await playMatch({ ...task, seed: 4243 });
	assert(other.plies > 0);
});

Deno.test("playMatch accepts profile objects and mutated profiles", async () => {
	const mutated = T.mutateProfile("baseline", 0.2, T.makeRng(1));
	const r = await playMatch({ seats: [mutated, "turtle"], seed: 11 });
	assert(r.plies > 0 && r.winnerSeat >= -1 && r.winnerSeat <= 1);
});
