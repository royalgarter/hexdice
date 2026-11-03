#!/usr/bin/env -S deno run --allow-all

/**
 * Puzzle replay gate (Daily Puzzle P3 QA).
 *
 * The solver proves a win against defender replies *inside its own move set*. The client's defender is the live
 * heuristic AI, which can reply with moves the solver never considered. This replays every pool puzzle the way the
 * client plays it: the attacker takes a solver-chosen winning move each turn, the defender is
 * performAIByHeuristic(game, 'baseline'), and the attacker must win within N turns on every seed.
 * Also spies on gameOver / _endTurn while the AI thinks, since a hook there would fire mid-think.
 *
 * Usage: deno run --allow-all js/puzzle-replay.ts [--dir=puzzles/pool] [--seeds=3] [--out=puzzles/replay-report.json]
 */
import { parse } from "https://deno.land/std@0.208.0/flags/mod.ts";
import { loadGameEngine } from "./engine-headless.ts";
import { solvePuzzle } from "./puzzle-solver.ts";

export const DEFENDER_PROFILE = "baseline";

export interface ReplayResult {
	id: string;
	ok: boolean;
	reason?: string;
	/** gameOver / _endTurn calls beyond the one the AI's own final action legitimately makes (should stay 0) */
	thinkLeaks: number;
}

const quiet = <T>(fn: () => T): T => {
	const saved = { log: console.log, info: console.info, warn: console.warn, debug: console.debug };
	console.log = console.info = console.warn = console.debug = () => {};
	try { return fn(); } finally { Object.assign(console, saved); }
};

export async function replayPuzzle(engine: any, puzzle: any, seed: number): Promise<ReplayResult> {
	const result: ReplayResult = { id: puzzle.id, ok: false, thinkLeaks: 0 };
	engine.setRandomSeed(seed);
	const game = engine.createGame();
	game.$nextTick = (fn: any) => fn();
	await quiet(() => game.init());
	await quiet(() => game.loadHDFEN(puzzle.hdfen));

	if (game.currentPlayerIndex !== puzzle.attacker) {
		result.reason = `attacker ${puzzle.attacker} is not the HDFEN active seat ${game.currentPlayerIndex}`;
		return result;
	}
	const defender = 1 - puzzle.attacker;
	game.players[puzzle.attacker].isAI = false;
	game.players[defender].isAI = true;
	game.players[defender].profileName = DEFENDER_PROFILE;
	game.performAITurn = () => {}; // we drive the defender ourselves; _endTurn would schedule it via setTimeout

	let thinking = false;
	let overCalls = 0, endCalls = 0;
	const realOver = game.gameOver.bind(game);
	const realEnd = game._endTurn.bind(game);
	game.gameOver = (...a: any[]) => { if (thinking) overCalls++; return realOver(...a); };
	game._endTurn = (state?: any) => { if (thinking && !state) endCalls++; return realEnd(state); };

	for (let turn = 0; turn < puzzle.n && game.phase === "PLAYER_TURN"; turn++) {
		const left = puzzle.n - turn;
		const solved = quiet(() => solvePuzzle(engine, game, left, { stopAfter: 1 }));
		if (!solved.win) {
			result.reason = `no forced win with ${left} turn(s) left (defender left the solver's tree)`;
			return result;
		}
		quiet(() => engine.applyMove(game, solved.winningFirstMoves[0]));
		if (game.phase !== "PLAYER_TURN") break;
		if (game.currentPlayerIndex !== defender) {
			result.reason = "attacker move did not hand the turn over";
			return result;
		}
		thinking = true;
		overCalls = endCalls = 0;
		quiet(() => engine.performAIByHeuristic(game, DEFENDER_PROFILE, false));
		thinking = false;
		// One _endTurn (and at most one gameOver, only if the AI's real move won) is the AI acting; more means simulation leaked.
		if (endCalls > 1 || overCalls > 1 || (overCalls === 1 && game.phase !== "GAME_OVER")) result.thinkLeaks++;
		if (game.phase === "PLAYER_TURN" && game.currentPlayerIndex === defender) {
			quiet(() => game._endTurn());
		}
	}

	if (game.phase !== "GAME_OVER") result.reason = `no result after ${puzzle.n} attacker turn(s)`;
	else if (game.winnerPlayerId !== puzzle.attacker) result.reason = `defender won (winner ${game.winnerPlayerId})`;
	else result.ok = result.thinkLeaks === 0;
	if (result.thinkLeaks) result.reason = `${result.thinkLeaks} gameOver/_endTurn call(s) during AI think`;
	return result;
}

export async function loadPool(dir: string): Promise<any[]> {
	const puzzles: any[] = [];
	for await (const sub of Deno.readDir(dir)) {
		if (!sub.isDirectory || ["rejected", "unverified"].includes(sub.name)) continue;
		for await (const f of Deno.readDir(`${dir}/${sub.name}`)) {
			if (!f.name.endsWith(".json") || f.name === "index.json") continue;
			const p = JSON.parse(await Deno.readTextFile(`${dir}/${sub.name}/${f.name}`));
			p.path = `${sub.name}/${f.name}`;
			puzzles.push(p);
		}
	}
	return puzzles.sort((a, b) => a.id.localeCompare(b.id));
}

if (import.meta.main) {
	const args = parse(Deno.args, { default: { dir: "puzzles/pool", seeds: 3, out: "puzzles/replay-report.json" } });
	const engine = await loadGameEngine(2, 1);
	const pool = await loadPool(args.dir);
	const report: Record<string, { ok: boolean; reasons: string[] }> = {};
	let bad = 0;
	for (const puzzle of pool) {
		const reasons: string[] = [];
		for (let s = 0; s < Number(args.seeds); s++) {
			const r = await replayPuzzle(engine, puzzle, 7000 + s);
			if (!r.ok) reasons.push(`seed ${7000 + s}: ${r.reason}`);
		}
		report[puzzle.path] = { ok: reasons.length === 0, reasons };
		if (reasons.length) {
			bad++;
			console.log(`FAIL ${puzzle.path} (n=${puzzle.n}): ${reasons[0]}`);
		}
	}
	await Deno.writeTextFile(args.out, JSON.stringify(report, null, "\t"));
	console.log(`${pool.length - bad}/${pool.length} puzzles survive the live defender; report ${args.out}`);
	Deno.exit(bad ? 1 : 0);
}
