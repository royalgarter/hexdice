#!/usr/bin/env -S deno run --allow-all

/**
 * Hex Dice AI evolution harness.
 *
 * Scores heuristic profiles against a fixed gauntlet of opponents in seeded, seat-swapped games,
 * and runs a basic (mu+lambda) mutation loop on top. See .chat/evolved-ai.md.
 *
 * Usage:
 *   deno run --allow-all js/evolve.ts --bench [--games=20]
 *   deno run --allow-all js/evolve.ts --gens=2 --pop=8 --games=10 [--workers=2] [--seed=1] [--rate=0.2]
 *
 * Reproducibility: every match seeds the game RNG AND replaces Math.random for its duration, so a
 * (profileA, profileB, seed, seat) tuple always plays out identically.
 */
import { parse } from "https://deno.land/std@0.208.0/flags/mod.ts";
import { ensureDir } from "https://deno.land/std@0.208.0/fs/ensure_dir.ts";
import { loadGameEngine } from "./engine-headless.ts";

const GAUNTLET = ["baseline", "berserker", "turtle", "assassin", "tactician"];
const MAX_PLIES = 300;

export interface MatchResult {
	/** index of the winning SEAT, or -1 for a draw (max plies / mutual elimination) */
	winnerSeat: number;
	plies: number;
	ms: number;
}

export interface MatchTask {
	/** profile objects or built-in names; seat 0 moves first */
	seats: [any, any];
	seed: number;
}

// ---------------------------------------------------------------------------------------------
// Match runner (runs inside a worker, or inline for --workers=0)
// ---------------------------------------------------------------------------------------------

let engine: any = null;

async function getEngine() {
	if (!engine) engine = await loadGameEngine(2, 1);
	return engine;
}

export async function playMatch(task: MatchTask): Promise<MatchResult> {
	const eng = await getEngine();
	const t0 = performance.now();
	const names = ["__seat0", "__seat1"];
	task.seats.forEach((s, i) => {
		eng.heuristicProfiles[names[i]] = typeof s === "string" ? eng.heuristicProfiles[s] : s;
		if (!eng.heuristicProfiles[names[i]]) throw new Error(`unknown profile ${s}`);
	});

	const realRandom = Math.random;
	const log = console.log;
	Math.random = eng.profileTools.makeRng(task.seed ^ 0x9E3779B9);
	console.log = () => {};
	try {
		eng.setRandomSeed(task.seed);
		const game = eng.createGame();
		game.$nextTick = (fn: any) => fn();
		await game.init();
		game.randomStart();
		game.players.forEach((p: any) => (p.isAI = true));
		game.performAITurn = () => {}; // _endTurn would schedule it via setTimeout; we drive turns ourselves

		let plies = 0;
		while (game.phase === "PLAYER_TURN" && plies < MAX_PLIES) {
			const seat = game.currentPlayerIndex;
			eng.performAIByHeuristic(game, names[seat], false);
			plies++;
		}
		const over = game.phase === "GAME_OVER";
		const winnerSeat = over && game.winnerPlayerId >= 0 ? game.winnerPlayerId : -1;
		return { winnerSeat, plies, ms: performance.now() - t0 };
	} finally {
		Math.random = realRandom;
		console.log = log;
	}
}

// ---------------------------------------------------------------------------------------------
// Worker pool
// ---------------------------------------------------------------------------------------------

const isWorker = typeof (globalThis as any).WorkerGlobalScope !== "undefined";

if (isWorker) {
	(self as any).onmessage = async (e: MessageEvent) => {
		const { id, task } = e.data;
		try {
			(self as any).postMessage({ id, result: await playMatch(task) });
		} catch (err) {
			(self as any).postMessage({ id, error: `${(err as Error).stack ?? err}`, task });
		}
	};
}

class Pool {
	private workers: Worker[] = [];
	private idle: Worker[] = [];
	private queue: { task: MatchTask; resolve: (r: MatchResult) => void; reject: (e: Error) => void }[] = [];
	private pending = new Map<number, { resolve: (r: MatchResult) => void; reject: (e: Error) => void }>();
	private nextId = 0;

	constructor(size: number) {
		for (let i = 0; i < size; i++) {
			const w = new Worker(import.meta.url, { type: "module" });
			w.onmessage = (e: MessageEvent) => {
				const { id, result, error, task } = e.data;
				const p = this.pending.get(id)!;
				this.pending.delete(id);
				if (error) {
					// Keep the failing task so the crash can be replayed with playMatch(task)
					const failure = new Error(error) as Error & { task?: MatchTask };
					failure.task = task;
					p.reject(failure);
				} else {
					p.resolve(result);
				}
				this.idle.push(w);
				this.pump();
			};
			this.workers.push(w);
			this.idle.push(w);
		}
	}

	run(task: MatchTask): Promise<MatchResult> {
		return new Promise((resolve, reject) => {
			this.queue.push({ task, resolve, reject });
			this.pump();
		});
	}

	private pump() {
		while (this.idle.length && this.queue.length) {
			const w = this.idle.pop()!;
			const job = this.queue.shift()!;
			const id = this.nextId++;
			this.pending.set(id, job);
			w.postMessage({ id, task: job.task });
		}
	}

	close() {
		this.workers.forEach((w) => w.terminate());
	}
}

// ---------------------------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------------------------

export interface Score {
	/** wins + 0.5 * draws, over all games; in [0,1] */
	rate: number;
	games: number;
	wins: number;
	draws: number;
	avgPlies: number;
	perOpponent: Record<string, number>;
}

/**
 * Scores `candidate` against every gauntlet opponent: `gamesPerOpp` seeds, each played twice with seats swapped.
 * The same seed gives both seats the same dice/deployment RNG stream, so the swap cancels first-move and army luck.
 */
export async function scoreProfile(run: (t: MatchTask) => Promise<MatchResult>, candidate: any, gauntlet: string[], gamesPerOpp: number, seedBase: number): Promise<Score> {
	const jobs: Promise<{ opp: string; points: number; draw: boolean; plies: number }>[] = [];
	for (const opp of gauntlet) {
		for (let g = 0; g < gamesPerOpp; g++) {
			const seed = seedBase + g;
			for (const candidateSeat of [0, 1]) {
				const seats: [any, any] = candidateSeat === 0 ? [candidate, opp] : [opp, candidate];
				jobs.push(run({ seats, seed }).then((r) => ({
					opp,
					points: r.winnerSeat === -1 ? 0.5 : r.winnerSeat === candidateSeat ? 1 : 0,
					draw: r.winnerSeat === -1,
					plies: r.plies,
				})));
			}
		}
	}
	const results = await Promise.all(jobs);
	const perOpp: Record<string, number[]> = {};
	results.forEach((r) => (perOpp[r.opp] ??= []).push(r.points));
	const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
	return {
		rate: sum(results.map((r) => r.points)) / results.length,
		games: results.length,
		wins: results.filter((r) => r.points === 1).length,
		draws: results.filter((r) => r.draw).length,
		avgPlies: sum(results.map((r) => r.plies)) / results.length,
		perOpponent: Object.fromEntries(Object.entries(perOpp).map(([k, v]) => [k, sum(v) / v.length])),
	};
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

if (import.meta.main && !isWorker) {
	const parsed = parse(Deno.args, {
		boolean: ["bench", "help"],
		string: ["out", "gauntlet"],
		default: { games: 10, gens: 2, pop: 8, workers: 2, seed: 1, rate: 0.2, out: "evolution", gauntlet: GAUNTLET.join(",") },
	});
	const args = {
		...parsed,
		games: Number(parsed.games), gens: Number(parsed.gens), pop: Number(parsed.pop),
		workers: Number(parsed.workers), seed: Number(parsed.seed), rate: Number(parsed.rate),
		out: String(parsed.out), bench: !!parsed.bench,
	};

	const pool = args.workers > 0 ? new Pool(args.workers) : null;
	const run = pool ? (t: MatchTask) => pool.run(t) : playMatch;
	const gauntlet = String(args.gauntlet).split(",");
	const eng = await getEngine();
	const tools = eng.profileTools;

	if (args.bench) {
		const t0 = performance.now();
		const s = await scoreProfile(run, "baseline", gauntlet.filter((g) => g !== "baseline"), Math.max(1, Math.floor(args.games / 2)), 1000);
		const secs = (performance.now() - t0) / 1000;
		console.log(`bench: ${s.games} games in ${secs.toFixed(1)}s with ${args.workers} worker(s) = ${(s.games / secs).toFixed(2)} games/s`);
		console.log(`       avg plies ${s.avgPlies.toFixed(0)}, draws ${s.draws}, baseline-vs-gauntlet rate ${(s.rate * 100).toFixed(1)}% (reference only: baseline vs the other four)`);
		pool?.close();
		Deno.exit(0);
	}

	// ---- basic (mu+lambda) mutation loop; crossover/HoF/MAP-Elites arrive in P2 ----
	const runId = `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
	const dir = `${args.out}/${runId}`;
	await ensureDir(dir);
	await Deno.writeTextFile(`${dir}/config.json`, JSON.stringify({ ...args, gauntlet, maxPlies: MAX_PLIES }, null, "\t"));

	const rng = tools.makeRng(args.seed);
	const mu = Math.max(2, Math.floor(args.pop / 2));
	let population: { name: string; profile: any; score?: Score }[] = [];
	for (let i = 0; i < args.pop; i++) {
		const base = i === 0 ? "baseline" : GAUNTLET[Math.floor(rng() * GAUNTLET.length)];
		const profile = i === 0 ? tools.completeProfile(eng.heuristicProfiles.baseline) : tools.mutateProfile(base, args.rate, rng);
		population.push({ name: `g0-${i}`, profile });
	}

	for (let gen = 0; gen < args.gens; gen++) {
		const t0 = performance.now();
		// Fixed seed block per generation so every member faces the same games; blocks differ across generations
		// to stop the population overfitting a single seed set.
		const seedBase = args.seed * 100000 + gen * 1000;
		await Promise.all(population.filter((m) => !m.score).map(async (m) => {
			m.score = await scoreProfile(run, m.profile, gauntlet, args.games, seedBase);
		}));
		population.sort((a, b) => b.score!.rate - a.score!.rate);
		const best = population[0];
		const mean = population.reduce((s, m) => s + m.score!.rate, 0) / population.length;
		console.log(`gen ${gen}: best ${(best.score!.rate * 100).toFixed(1)}% (${best.name}) mean ${(mean * 100).toFixed(1)}% in ${((performance.now() - t0) / 1000).toFixed(0)}s`);
		await Deno.writeTextFile(`${dir}/gen-${gen}.json`, JSON.stringify(population.map((m) => ({ name: m.name, score: m.score, profile: m.profile })), null, "\t"));

		if (gen === args.gens - 1) break;
		// Elites survive with their scores discarded: next generation uses a new seed block, so they must be re-scored.
		const elites = population.slice(0, mu);
		const next = elites.map((m) => ({ name: m.name, profile: m.profile }));
		for (let i = 0; next.length < args.pop; i++) {
			const parent = elites[i % elites.length];
			next.push({ name: `g${gen + 1}-${next.length}`, profile: tools.mutateProfile(parent.profile, args.rate, rng) });
		}
		population = next;
	}
	await Deno.writeTextFile(`${dir}/best.json`, JSON.stringify(population[0].profile, null, "\t"));
	console.log(`results in ${dir}`);
	pool?.close();
	Deno.exit(0);
}
