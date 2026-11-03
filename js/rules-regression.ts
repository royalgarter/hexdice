#!/usr/bin/env -S deno run --allow-all

/**
 * Rules-change regression (Evolved AI P4).
 *
 * js/ai/evolved-profiles.js records a hash of rules/RULES.md + js/constants.js taken when the champions were exported.
 * If the hash no longer matches, the rules moved under the champions: re-score each one against the gauntlet on the
 * held-out seed block and flag any that now fall outside the validation bounds (>55% vs baseline, <=70% overall).
 *
 * Usage: deno run --allow-all js/rules-regression.ts [--vgames=10] [--workers=2] [--force] [--out=evolution/rules-regression.json]
 * Exit 0 = fresh or all champions still pass, 1 = stale champions flagged.
 */
import { parse } from "https://deno.land/std@0.208.0/flags/mod.ts";
import { loadGameEngine } from "./engine-headless.ts";
import { type MatchTask, playMatch, scoreProfile } from "./evolve.ts";

const GAUNTLET = ["baseline", "berserker", "turtle", "assassin", "tactician"];

// playMatch patches console and Math.random, so inline games must not overlap (the worker pool in evolve.ts isolates them)
let tail: Promise<unknown> = Promise.resolve();
const serial = (t: MatchTask) => {
	const run = tail.then(() => playMatch(t));
	tail = run.catch(() => {});
	return run;
};

export async function rulesHash(): Promise<string> {
	const a = await Deno.readFile("rules/RULES.md");
	const b = await Deno.readFile("js/constants.js");
	const all = new Uint8Array(a.length + b.length);
	all.set(a);
	all.set(b, a.length);
	const digest = await crypto.subtle.digest("SHA-256", all);
	return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

if (import.meta.main) {
	const args = parse(Deno.args, { boolean: ["force"], default: { vgames: 10, out: "evolution/rules-regression.json" } });
	const src = await Deno.readTextFile("js/ai/evolved-profiles.js");
	const exported = src.match(/EVOLVED_RULES_HASH = '([0-9a-f]+)'/)?.[1];
	const now = await rulesHash();
	if (!exported) {
		console.log("evolved-profiles.js has no EVOLVED_RULES_HASH; re-export champions (scripts/export-champions.js)");
		Deno.exit(1);
	}
	if (exported === now && !args.force) {
		console.log(`champions fresh: rules hash ${now} matches export`);
		Deno.exit(0);
	}
	console.log(`rules changed (export ${exported}, now ${now}); re-scoring champions`);

	const eng = await loadGameEngine(2, 1);
	const report: any[] = [];
	for (const [key, profile] of Object.entries<any>(eng.evolvedProfiles)) {
		const s = await scoreProfile(serial, profile, GAUNTLET, Number(args.vgames), 9_000_000);
		const vsBaseline = s.perOpponent.baseline ?? NaN;
		const stale = !(vsBaseline > 0.55 && s.rate <= 0.7);
		report.push({ key, rate: s.rate, vsBaseline, stale });
		console.log(`  ${key}: ${(s.rate * 100).toFixed(1)}% gauntlet, ${(vsBaseline * 100).toFixed(1)}% vs baseline ${stale ? "STALE" : "ok"}`);
	}
	await Deno.mkdir("evolution", { recursive: true });
	await Deno.writeTextFile(args.out, JSON.stringify({ exported, now, champions: report }, null, "\t"));
	const stale = report.filter((r) => r.stale);
	console.log(stale.length ? `${stale.length}/${report.length} champions stale: re-run evolution (scripts/nightly-evolve.sh)` : "all champions still pass");
	Deno.exit(stale.length ? 1 : 0);
}
