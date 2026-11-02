/**
 * Hex Dice puzzle generator.
 *
 * Plays seeded AI-vs-AI games, samples late positions with the eventual winner to move, and keeps those where
 * the solver proves a forced win in N (smallest N) with exactly ONE winning first move.
 * Every kept puzzle is re-solved from a fresh game in reverse move order as an independent check.
 *
 * Usage:
 *   deno run --allow-all js/puzzle-gen.ts --count=20 --seed=1 --out=puzzles/pool
 *   Options: --min-n=1 --min-decoys=2 (decoy gate applies to N=1 only) --max-n=3 --budget=200000 --max-turns=300 --tail=10 --max-units=8 --games=200 --per-game=2
 */
import { parse } from "https://deno.land/std@0.208.0/flags/mod.ts";
import { ensureDir } from "https://deno.land/std@0.208.0/fs/ensure_dir.ts";
import { loadGameEngine } from "./engine-headless.ts";
import { PuzzleMove, solvePuzzle } from "./puzzle-solver.ts";

const args = parse(Deno.args, {
	default: { count: 20, seed: 1, out: "puzzles/pool", "min-n": 1, "min-decoys": 2, "max-n": 3, budget: 200000, "max-turns": 300, tail: 10, "max-units": 8, games: 200, "per-game": 2 },
});

const quiet = <T>(fn: () => T): T => {
	const log = console.log;
	console.log = () => {};
	try { return fn(); } finally { console.log = log; }
};

const engine = await loadGameEngine(2, 1);
const profiles: string[] = Object.keys(engine.heuristicProfiles);

const newGame = async (seed: number) => {
	engine.setRandomSeed(seed);
	const g = engine.createGame();
	g.$nextTick = (fn: any) => fn();
	await quiet(() => g.init());
	return g;
};

const moveKey = (m: PuzzleMove) => `${m.actionType}:${m.unitHexId ?? ""}:${m.targetHexId ?? ""}`;
const aliveCount = (g: any, pid: number) => g.players[pid].dice.filter((d: any) => d.isDeployed && !d.isDeath).length;

// A "decoy" is a forcing-looking first move (capture/attack) that does NOT win — the trap the solver must avoid.
function countDecoys(g: any, winning: PuzzleMove[]): number {
	const won = new Set(winning.map(moveKey));
	const all: PuzzleMove[] = quiet(() => engine.generateAllPossibleMoves(g, g, null));
	return all.filter(m => {
		if (won.has(moveKey(m))) return false;
		if (m.actionType === "RANGED_ATTACK") return true;
		if (m.actionType !== "MOVE") return false;
		const target = g.getUnitOnHex(m.targetHexId);
		return !!target && target.playerId !== g.currentPlayerIndex;
	}).length;
}

interface Puzzle {
	id: string;
	hdfen: string;
	n: number;
	rules: "V1";
	/** player index to move (and to win); HDFEN's active-player field says the same */
	attacker: number;
	uniqueFirstMove: true;
	firstMove: { actionType: string; fromHex?: number; toHex?: number; unit: string };
	difficulty: number;
	decoys: number;
	units: [number, number];
	seed: number;
	generator: string;
}

const hash = (s: string) => {
	let h = 5381;
	for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
	return h.toString(36);
};

const stats = { aborted: 0, noWin: 0, trivial: 0, multi: 0, crossFail: 0, kept: 0 };

async function evaluate(fen: string, seed: number): Promise<Puzzle | null> {
	const g = await newGame(seed + 7919);
	await quiet(() => g.loadHDFEN(fen));

	for (let n = 1; n <= args["max-n"]; n++) {
		const res = solvePuzzle(engine, g, n, { maxNodes: args.budget, stopAfter: 2 });
		if (res.aborted) { stats.aborted++; return null; }
		if (!res.win) continue;
		if (res.winningFirstMoves.length !== 1) { stats.multi++; return null; }

		// Independent cross-check on a fresh board, reversed search order
		const g2 = await newGame(seed + 104729);
		await quiet(() => g2.loadHDFEN(fen));
		const check = solvePuzzle(engine, g2, n, { maxNodes: args.budget * 2, reverseOrder: true, stopAfter: 2 });
		if (check.aborted || check.winningFirstMoves.length !== 1 || moveKey(check.winningFirstMoves[0]) !== moveKey(res.winningFirstMoves[0])) {
			console.error(`  cross-check DISAGREES for ${fen.slice(0, 40)}... n=${n}`);
			stats.crossFail++;
			return null;
		}

		const move = res.winningFirstMoves[0];
		const unit = g.getUnitOnHex(move.unitHexId);
		const decoys = countDecoys(g, res.winningFirstMoves);
		if (n < args["min-n"] || (n === 1 && decoys < args["min-decoys"])) { stats.trivial++; return null; }
		const branching = quiet(() => engine.generateAllPossibleMoves(g, g, null).length);
		const difficulty = Math.max(1, Math.min(5, Math.round(n + Math.min(2, decoys / 4) + (branching > 60 ? 1 : 0) - 1)));
		stats.kept++;
		return {
			id: hash(fen),
			hdfen: fen,
			n,
			rules: "V1",
			attacker: g.currentPlayerIndex,
			uniqueFirstMove: true,
			firstMove: { actionType: move.actionType, fromHex: move.unitHexId, toHex: move.targetHexId, unit: unit ? `D${unit.value}` : "?" },
			difficulty,
			decoys,
			units: [aliveCount(g, 0), aliveCount(g, 1)],
			seed,
			generator: "puzzle-gen v1",
		};
	}
	stats.noWin++;
	return null;
}

await ensureDir(args.out);
const found: Puzzle[] = [];
const seen = new Set<string>();
let positions = 0, gamesPlayed = 0;
const t0 = performance.now();

for (let gi = 0; gi < args.games && found.length < args.count; gi++) {
	const seed = args.seed * 100000 + gi;
	const game = await newGame(seed);
	quiet(() => game.randomStart());
	game.players.forEach((p: any, i: number) => {
		p.isAI = true;
		p.profileName = profiles[Math.floor(engine.random() * profiles.length)];
	});
	game.performAITurn = () => {};
	gamesPlayed++;

	// Endgame sampling: forced wins are rare mid-game, so keep the last positions before the game ended
	// with the eventual winner to move (the AI was already converting a win there).
	const history: { fen: string; mover: number }[] = [];
	quiet(() => {
		for (let t = 0; t < args["max-turns"] && game.phase === "PLAYER_TURN"; t++) {
			history.push({ fen: game.generateHDFEN(), mover: game.currentPlayerIndex });
			if (history.length > args.tail) history.shift();
			engine.performAIByHeuristic(game, game.players[game.currentPlayerIndex].profileName);
		}
	});
	if (game.phase !== "GAME_OVER" || game.winnerPlayerId < 0) continue;

	const candidates = history
		.filter(h => h.mover === game.winnerPlayerId)
		.map(h => h.fen)
		.reverse()
		.filter(fen => {
			const g = fen.split(" ")[0].split("/").filter(t => t.length === 6);
			const count = (pid: number) => g.filter(t => t[0] === String(pid)).length;
			return Math.min(count(0), count(1)) >= 2 && Math.max(count(0), count(1)) <= args["max-units"];
		});

	let keptThisGame = 0;
	for (const fen of candidates) {
		if (keptThisGame >= args["per-game"] || found.length >= args.count) break;
		positions++;
		const p = await evaluate(fen, seed);
		if (!p || seen.has(p.id)) continue;
		seen.add(p.id);
		found.push(p);
		keptThisGame++;
		await Deno.writeTextFile(`${args.out}/${p.id}.json`, JSON.stringify(p, null, "\t") + "\n");
		console.log(`[${found.length}/${args.count}] game ${gi} n=${p.n} diff=${p.difficulty} decoys=${p.decoys} units=${p.units} ${p.firstMove.unit} ${p.firstMove.actionType} ${p.firstMove.fromHex}->${p.firstMove.toHex}`);
	}
}

const index = found.map(({ id, n, difficulty }) => ({ id, n, difficulty }));
await Deno.writeTextFile(`${args.out}/index.json`, JSON.stringify(index, null, "\t") + "\n");
console.log(`rejects: ${JSON.stringify(stats)}`);
console.log(`\ngames=${gamesPlayed} positions=${positions} puzzles=${found.length} in ${Math.round((performance.now() - t0) / 1000)}s -> ${args.out}`);
