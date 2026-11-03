#!/usr/bin/env -S deno run --allow-all

/**
 * Balance observatory feed (Evolved AI P4): mirror matches of one profile vs itself, so any skew comes from the rules,
 * not from AI strength. Reports seat win rate and, per unit value, how a seat's win rate shifts with how many of that
 * unit it started with (points above 50% = the unit helps its owner).
 *
 * Usage: deno run --allow-all js/balance-feed.ts [--games=100] [--profile=baseline] [--seed=4000000] [--out=evolution/balance.json]
 */
import { parse } from "https://deno.land/std@0.208.0/flags/mod.ts";
import { playMatch } from "./evolve.ts";

const UNIT_NAMES = ["Fencer", "Archer", "Hussar", "Knight", "Tanker", "Oracle"];

if (import.meta.main) {
	const args = parse(Deno.args, { default: { games: 100, profile: "baseline", seed: 4_000_000, out: "evolution/balance.json" } });
	const n = Number(args.games);
	let seatWins = [0, 0], draws = 0, plies = 0;
	const byUnit = UNIT_NAMES.map(() => ({ games: 0, moreWon: 0 }));
	for (let g = 0; g < n; g++) {
		const r = await playMatch({ seats: [args.profile, args.profile], seed: Number(args.seed) + g });
		plies += r.plies;
		if (r.winnerSeat === -1) { draws++; continue; }
		seatWins[r.winnerSeat]++;
		for (let u = 0; u < 6; u++) {
			const w = r.comp[r.winnerSeat][u], l = r.comp[1 - r.winnerSeat][u];
			if (w === l) continue;
			byUnit[u].games++;
			if (w > l) byUnit[u].moreWon++;
		}
	}
	const decided = Math.max(1, n - draws);
	const units = byUnit.map((b, u) => ({ unit: UNIT_NAMES[u], value: u + 1, unevenGames: b.games, winRateWhenMore: b.games ? b.moreWon / b.games : null }));
	const report = { profile: args.profile, games: n, draws, avgPlies: plies / n, seat0WinRate: seatWins[0] / decided, units };
	await Deno.mkdir("evolution", { recursive: true });
	await Deno.writeTextFile(args.out, JSON.stringify(report, null, "\t"));
	console.log(`seat0 ${(report.seat0WinRate * 100).toFixed(1)}% over ${decided} decided games (${draws} draws), avg ${report.avgPlies.toFixed(0)} plies`);
	units.forEach((u) => console.log(`  ${u.unit.padEnd(7)} seat with more of it wins ${u.winRateWhenMore === null ? "n/a" : (u.winRateWhenMore * 100).toFixed(1) + "%"} (${u.unevenGames} uneven games)`));
	Deno.exit(0);
}
