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
	/** per-seat counters for behaviour descriptors; counts only, no game logic involved */
	stats: [SeatStats, SeatStats];
}

export interface SeatStats {
	moves: number;
	kills: number;
	/** actions after which the seat had more guarding units than before */
	guardActs: number;
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
	const quiet = { info: console.info, warn: console.warn, debug: console.debug };
	Math.random = eng.profileTools.makeRng(task.seed ^ 0x9E3779B9);
	console.log = console.info = console.warn = console.debug = () => {};
	try {
		eng.setRandomSeed(task.seed);
		const game = eng.createGame();
		game.$nextTick = (fn: any) => fn();
		await game.init();
		game.randomStart();
		game.players.forEach((p: any) => (p.isAI = true));
		game.performAITurn = () => {}; // _endTurn would schedule it via setTimeout; we drive turns ourselves

		let plies = 0;
		const stats: [SeatStats, SeatStats] = [{ moves: 0, kills: 0, guardActs: 0 }, { moves: 0, kills: 0, guardActs: 0 }];
		const alive = (pi: number) => game.players[pi].dice.filter((d: any) => !d.isDeath).length;
		const guards = (pi: number) => game.players[pi].dice.filter((d: any) => !d.isDeath && d.isGuarding).length;
		while (game.phase === "PLAYER_TURN" && plies < MAX_PLIES) {
			const seat = game.currentPlayerIndex;
			const foe = 1 - seat;
			const foeBefore = alive(foe);
			const guardBefore = guards(seat);
			eng.performAIByHeuristic(game, names[seat], false);
			stats[seat].moves++;
			stats[seat].kills += Math.max(0, foeBefore - alive(foe));
			if (guards(seat) > guardBefore) stats[seat].guardActs++;
			plies++;
		}
		const over = game.phase === "GAME_OVER";
		const winnerSeat = over && game.winnerPlayerId >= 0 ? game.winnerPlayerId : -1;
		return { winnerSeat, plies, ms: performance.now() - t0, stats };
	} finally {
		Math.random = realRandom;
		console.log = log;
		Object.assign(console, quiet);
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

/** gauntlet entry: a built-in profile name, or a named profile object (hall of fame / held-out) */
export type Opponent = string | { name: string; profile: any };

const oppName = (o: Opponent) => (typeof o === "string" ? o : o.name);
const oppSeat = (o: Opponent) => (typeof o === "string" ? o : o.profile);

/** behaviour descriptor, averaged over the candidate's own actions */
export interface Descriptor {
	/** enemy units killed per own action */
	aggression: number;
	/** plies per game; guard-rate was tried first but sits near 0.01 for every profile, so it cannot separate styles */
	length: number;
}

export interface Score {
	/** wins + 0.5 * draws, over all games; in [0,1] */
	rate: number;
	games: number;
	wins: number;
	draws: number;
	avgPlies: number;
	perOpponent: Record<string, number>;
	desc: Descriptor;
}

/**
 * Scores `candidate` against every opponent: `gamesPerOpp` seeds, each played twice with seats swapped.
 * The same seed gives both seats the same dice/deployment RNG stream, so the swap cancels first-move and army luck.
 */
export async function scoreProfile(run: (t: MatchTask) => Promise<MatchResult>, candidate: any, gauntlet: Opponent[], gamesPerOpp: number, seedBase: number): Promise<Score> {
	const jobs: Promise<{ opp: string; points: number; draw: boolean; plies: number; own: SeatStats }>[] = [];
	for (const opp of gauntlet) {
		for (let g = 0; g < gamesPerOpp; g++) {
			const seed = seedBase + g;
			for (const candidateSeat of [0, 1]) {
				const seats: [any, any] = candidateSeat === 0 ? [candidate, oppSeat(opp)] : [oppSeat(opp), candidate];
				jobs.push(run({ seats, seed }).then((r) => ({
					opp: oppName(opp),
					points: r.winnerSeat === -1 ? 0.5 : r.winnerSeat === candidateSeat ? 1 : 0,
					draw: r.winnerSeat === -1,
					plies: r.plies,
					own: r.stats[candidateSeat],
				})));
			}
		}
	}
	const results = await Promise.all(jobs);
	const perOpp: Record<string, number[]> = {};
	results.forEach((r) => (perOpp[r.opp] ??= []).push(r.points));
	const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
	const moves = Math.max(1, sum(results.map((r) => r.own.moves)));
	return {
		rate: sum(results.map((r) => r.points)) / results.length,
		games: results.length,
		wins: results.filter((r) => r.points === 1).length,
		draws: results.filter((r) => r.draw).length,
		avgPlies: sum(results.map((r) => r.plies)) / results.length,
		perOpponent: Object.fromEntries(Object.entries(perOpp).map(([k, v]) => [k, sum(v) / v.length])),
		desc: {
			aggression: sum(results.map((r) => r.own.kills)) / moves,
			length: sum(results.map((r) => r.plies)) / results.length,
		},
	};
}

/** Pools two scores of the same candidate (different seed blocks) to cut noise; opponent sets must match. */
export function mergeScores(a: Score, b: Score): Score {
	const n = a.games + b.games;
	const w = (x: number, y: number) => (x * a.games + y * b.games) / n;
	return {
		rate: w(a.rate, b.rate),
		games: n,
		wins: a.wins + b.wins,
		draws: a.draws + b.draws,
		avgPlies: w(a.avgPlies, b.avgPlies),
		perOpponent: Object.fromEntries(Object.keys(a.perOpponent).map((k) => [k, w(a.perOpponent[k], b.perOpponent[k] ?? a.perOpponent[k])])),
		desc: { aggression: w(a.desc.aggression, b.desc.aggression), length: w(a.desc.length, b.desc.length) },
	};
}

// ---------------------------------------------------------------------------------------------
// MAP-Elites archive
// ---------------------------------------------------------------------------------------------

export interface Elite {
	name: string;
	profile: any;
	score: Score;
}

export interface Edges {
	aggression: number[];
	length: number[];
}

/** `bins - 1` cut points splitting `values` into equally populated bins */
export function quantileEdges(values: number[], bins: number): number[] {
	const v = [...values].sort((a, b) => a - b);
	const edges: number[] = [];
	for (let i = 1; i < bins; i++) edges.push(v[Math.min(v.length - 1, Math.floor((i * v.length) / bins))]);
	return edges;
}

const binOf = (x: number, edges: number[]) => edges.filter((e) => x >= e).length;

export function cellOf(desc: Descriptor, edges: Edges): string {
	return `${binOf(desc.aggression, edges.aggression)}:${binOf(desc.length, edges.length)}`;
}

/** Keeps the best-scoring profile per behaviour cell. Returns true if `e` took (or created) the cell. */
export function archiveInsert(archive: Map<string, Elite>, e: Elite, edges: Edges): boolean {
	const cell = cellOf(e.score.desc, edges);
	const cur = archive.get(cell);
	if (cur && cur.score.rate >= e.score.rate) return false;
	archive.set(cell, e);
	return true;
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

if (import.meta.main && !isWorker) {
	const parsed = parse(Deno.args, {
		boolean: ["bench", "help"],
		string: ["out", "gauntlet"],
		default: {
			games: 10, gens: 2, pop: 8, workers: 2, seed: 1, rate: 0.2, out: "evolution", gauntlet: GAUNTLET.join(","),
			bins: 3, topk: 3, hof: 4, vgames: 10, maxdrop: 0.1,
		},
	});
	const args = {
		...parsed,
		games: Number(parsed.games), gens: Number(parsed.gens), pop: Number(parsed.pop),
		workers: Number(parsed.workers), seed: Number(parsed.seed), rate: Number(parsed.rate),
		bins: Number(parsed.bins), topk: Number(parsed.topk), hof: Number(parsed.hof),
		vgames: Number(parsed.vgames), maxdrop: Number(parsed.maxdrop),
		out: String(parsed.out), bench: !!parsed.bench,
	};

	const pool = args.workers > 0 ? new Pool(args.workers) : null;
	const run = pool ? (t: MatchTask) => pool.run(t) : playMatch;
	const gauntlet = String(args.gauntlet).split(",");
	const eng = await getEngine();
	const tools = eng.profileTools;
	const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

	if (args.bench) {
		const t0 = performance.now();
		const s = await scoreProfile(run, "baseline", gauntlet.filter((g) => g !== "baseline"), Math.max(1, Math.floor(args.games / 2)), 1000);
		const secs = (performance.now() - t0) / 1000;
		console.log(`bench: ${s.games} games in ${secs.toFixed(1)}s with ${args.workers} worker(s) = ${(s.games / secs).toFixed(2)} games/s`);
		console.log(`       avg plies ${s.avgPlies.toFixed(0)}, draws ${s.draws}, baseline-vs-gauntlet rate ${pct(s.rate)} (reference only: baseline vs the other four)`);
		pool?.close();
		Deno.exit(0);
	}

	// ---- (mu+lambda) with crossover, hall of fame, MAP-Elites archive, held-out validation ----
	const runId = `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
	const dir = `${args.out}/${runId}`;
	await ensureDir(dir);
	await Deno.writeTextFile(`${dir}/config.json`, JSON.stringify({ ...args, gauntlet, maxPlies: MAX_PLIES }, null, "\t"));

	const rng = tools.makeRng(args.seed);
	const pick = <T>(a: T[]): T => a[Math.floor(rng() * a.length)];
	const mu = Math.max(2, Math.floor(args.pop / 2));
	const hof: Opponent[] = [];
	const archive = new Map<string, Elite>();
	let edges: Edges | null = null;

	let population: { name: string; profile: any; score?: Score }[] = [];
	for (let i = 0; i < args.pop; i++) {
		const profile = i === 0 ? tools.completeProfile(eng.heuristicProfiles.baseline) : tools.mutateProfile(pick(GAUNTLET), args.rate, rng);
		population.push({ name: `g0-${i}`, profile });
	}

	for (let gen = 0; gen < args.gens; gen++) {
		const t0 = performance.now();
		const opponents: Opponent[] = [...gauntlet, ...hof];
		// One seed block per generation: every member faces the same games, and blocks differ across generations
		// so the population cannot overfit a single seed set. +500 is the re-evaluation block (games < 500).
		const seedBase = args.seed * 100000 + gen * 1000;
		await Promise.all(population.map(async (m) => {
			m.score = await scoreProfile(run, m.profile, opponents, args.games, seedBase);
		}));
		population.sort((a, b) => b.score!.rate - a.score!.rate);

		// Noise guard: top-k get a second, larger sample before they can enter the archive or hall of fame.
		const top = population.slice(0, args.topk);
		await Promise.all(top.map(async (m) => {
			m.score = mergeScores(m.score!, await scoreProfile(run, m.profile, opponents, args.games * 2, seedBase + 500));
		}));
		population.sort((a, b) => b.score!.rate - a.score!.rate);

		if (!edges) {
			edges = {
				aggression: quantileEdges(population.map((m) => m.score!.desc.aggression), args.bins),
				length: quantileEdges(population.map((m) => m.score!.desc.length), args.bins),
			};
			await Deno.writeTextFile(`${dir}/edges.json`, JSON.stringify(edges));
		}
		// Archive candidates: re-scored top-k plus everyone else's single-sample score only if their cell is empty.
		let inserted = 0;
		for (const m of population) {
			const isTop = top.includes(m);
			if (!isTop && archive.has(cellOf(m.score!.desc, edges))) continue;
			if (archiveInsert(archive, { name: m.name, profile: m.profile, score: m.score! }, edges)) inserted++;
		}
		const champ = population[0];
		hof.push({ name: `hof-${champ.name}`, profile: champ.profile });
		while (hof.length > args.hof) hof.shift();

		const mean = population.reduce((s, m) => s + m.score!.rate, 0) / population.length;
		console.log(`gen ${gen}: best ${pct(champ.score!.rate)} (${champ.name}) mean ${pct(mean)} archive ${archive.size}/${args.bins ** 2} (+${inserted}) hof ${hof.length} in ${((performance.now() - t0) / 1000).toFixed(0)}s`);
		await Deno.writeTextFile(`${dir}/gen-${gen}.json`, JSON.stringify(population.map((m) => ({ name: m.name, score: m.score, profile: m.profile })), null, "\t"));
		await Deno.writeTextFile(`${dir}/archive.json`, JSON.stringify(Object.fromEntries(archive), null, "\t"));

		if (gen === args.gens - 1) break;
		// Parents: this generation's elites plus archive members, so niche profiles keep breeding.
		const parents = [...population.slice(0, mu).map((m) => m.profile), ...[...archive.values()].map((e) => e.profile)];
		const next: typeof population = population.slice(0, mu).map((m) => ({ name: m.name, profile: m.profile }));
		while (next.length < args.pop) {
			const child = rng() < 0.5 ? tools.crossoverProfiles(pick(parents), pick(parents), rng) : pick(parents);
			next.push({ name: `g${gen + 1}-${next.length}`, profile: tools.mutateProfile(child, args.rate, rng) });
		}
		population = next;
	}

	// ---- validation: held-out seeds and held-out opponents ----
	const heldOut: Opponent[] = Object.keys(eng.heuristicProfiles)
		.filter((k) => !gauntlet.includes(k) && !k.startsWith("__"));
	console.log(`validating ${archive.size} champions: held-out seeds vs [${gauntlet}], held-out opponents [${heldOut}]`);
	const validation = [];
	for (const [cell, e] of archive) {
		const seeds = await scoreProfile(run, e.profile, gauntlet, args.vgames, 9_000_000);
		const opps = heldOut.length ? await scoreProfile(run, e.profile, heldOut, args.vgames, 9_500_000) : null;
		const train = e.score.rate;
		const drops = [train - seeds.rate, opps ? train - opps.rate : 0];
		const vsBaseline = seeds.perOpponent.baseline ?? NaN;
		const ok = Math.max(...drops) <= args.maxdrop && vsBaseline > 0.55 && seeds.rate <= 0.7;
		validation.push({ cell, name: e.name, train, heldSeeds: seeds.rate, heldOpps: opps?.rate ?? null, vsBaseline, desc: e.score.desc, ok });
		console.log(`  cell ${cell} ${e.name}: train ${pct(train)} held-seeds ${pct(seeds.rate)} held-opps ${opps ? pct(opps.rate) : "n/a"} vs-baseline ${pct(vsBaseline)} agg ${e.score.desc.aggression.toFixed(3)} length ${e.score.desc.length.toFixed(0)} ${ok ? "PASS" : "reject"}`);
	}
	await Deno.writeTextFile(`${dir}/validation.json`, JSON.stringify(validation, null, "\t"));
	const passed = validation.filter((v) => v.ok);
	console.log(`${passed.length}/${validation.length} champions pass (drop <= ${pct(args.maxdrop)}, >55% vs baseline, <=70% vs gauntlet)`);
	const bestV = [...validation].sort((a, b) => b.heldSeeds - a.heldSeeds)[0];
	await Deno.writeTextFile(`${dir}/best.json`, JSON.stringify(archive.get(bestV.cell)!.profile, null, "\t"));
	console.log(`results in ${dir}`);
	pool?.close();
	Deno.exit(0);
}
