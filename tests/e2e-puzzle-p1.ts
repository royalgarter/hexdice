/**
 * E2E for Puzzle P1 on realistic positions (not hand-built fixtures).
 *
 * Plays full AI-vs-AI games, snapshots HDFEN every few turns, then for each snapshot:
 *   1. loadHDFEN into a fresh game and check the round-trip is byte-identical
 *   2. run the solver at N=1,2,3 and report time/nodes (budget check for P2)
 *   3. verify the solver left the loaded game unchanged
 *
 * Usage: deno run --allow-all tests/e2e-puzzle-p1.ts [--games=3] [--every=6] [--max-n=3]
 */
import { parse } from "https://deno.land/std@0.208.0/flags/mod.ts";
import { loadGameEngine } from "../js/engine-headless.ts";
import { solvePuzzle } from "../js/puzzle-solver.ts";

const args = parse(Deno.args, { default: { games: 3, every: 6, "max-n": 3, seed: 100, budget: 300000 } });
const quiet = <T>(fn: () => T): T => {
	const log = console.log;
	console.log = () => {};
	try { return fn(); } finally { console.log = log; }
};

const engine = await loadGameEngine(2, 1);
const newGame = async (seed: number) => {
	engine.setRandomSeed(seed);
	const g = engine.createGame();
	g.$nextTick = (fn: any) => fn();
	await g.init();
	return g;
};

let failures = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { failures++; console.error(`FAIL: ${msg}`); } };

const rows: string[] = [];
let positions = 0, solved = 0, prunedNodes = 0, fullNodes = 0;

for (let gi = 0; gi < args.games; gi++) {
	const seed = args.seed + gi;
	const game = await newGame(seed);
	game.randomStart();
	// Flag true so performAIByHeuristic acts; neutralise the setTimeout-based turn chaining so we drive turns ourselves.
	game.players.forEach((p: any) => p.isAI = true);
	game.performAITurn = () => {};

	const fens: string[] = [];
	quiet(() => {
		for (let t = 0; t < 120 && game.phase === 'PLAYER_TURN'; t++) {
			if (t % args.every === 0) fens.push(game.generateHDFEN());
			engine.performAIByHeuristic(game);
		}
	});

	for (const fen of fens) {
		const g = await newGame(seed + 1000);
		await g.loadHDFEN(fen);
		positions++;
		check(g.generateHDFEN() === fen, `round-trip mismatch (seed ${seed})\n  ${fen}\n  ${g.generateHDFEN()}`);

		for (let n = 1; n <= args["max-n"]; n++) {
			const t0 = performance.now();
			const res = solvePuzzle(engine, g, n, { maxNodes: args.budget });
			const ms = Math.round(performance.now() - t0);
			check(g.generateHDFEN() === fen, `solver mutated game (seed ${seed}, n=${n})`);
			if (!res.aborted && n <= 2) {
				// Pruning must not change the answer: compare with the exhaustive search
				const ref = solvePuzzle(engine, g, n, { maxNodes: args.budget * 4, prune: false });
				if (!ref.aborted) {
					const key = (r: typeof res) => r.winningFirstMoves.map(m => `${m.actionType}:${m.unitHexId}:${m.targetHexId}`).sort().join("|");
					check(key(ref) === key(res), `PRUNING CHANGED RESULT (seed ${seed}, n=${n}): pruned=[${key(res)}] exhaustive=[${key(ref)}]`);
					prunedNodes += res.nodes; fullNodes += ref.nodes;
				}
			}
			if (!res.aborted && n <= 2) {
				// Table + search order must not change the answer
				const k = (r: typeof res) => r.winningFirstMoves.map(m => `${m.unitHexId}>${m.targetHexId}`).sort().join("|");
				const noTable = solvePuzzle(engine, g, n, { maxNodes: args.budget * 4, table: false });
				const rev = solvePuzzle(engine, g, n, { maxNodes: args.budget * 4, reverseOrder: true });
				if (!noTable.aborted) check(k(noTable) === k(res), `TABLE CHANGED RESULT (seed ${seed}, n=${n})`);
				if (!rev.aborted) check(k(rev) === k(res), `ORDER CHANGED RESULT (seed ${seed}, n=${n})`);
			}
			check(res.turnModelViolations === 0, `turn model violated ${res.turnModelViolations}x (seed ${seed}, n=${n})`);
			if (res.win) solved++;
			const row = `seed=${seed} turn~${fen.split(' ')[3]} n=${n} ${res.aborted ? `ABORTED(>${args.budget} nodes)` : `win=${res.win} firstMoves=${res.winningFirstMoves.length}`} nodes=${res.nodes} ${ms}ms`;
			rows.push(row);
			console.log(row);
			if (res.aborted) break;
		}
	}
}

console.log(`\npositions=${positions} winsFound=${solved} failures=${failures} nodes pruned/full=${prunedNodes}/${fullNodes}`);
Deno.exit(failures ? 1 : 0);
