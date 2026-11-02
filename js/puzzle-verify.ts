/**
 * Re-solve every puzzle JSON in a directory tree and move failures to <dir>/rejected/.
 * A puzzle passes when forward AND reverse search (table on) both find exactly its stored first move at its stored N.
 * Usage: deno run --allow-all js/puzzle-verify.ts puzzles/pool [--budget=400000]
 */
import { parse } from "https://deno.land/std@0.208.0/flags/mod.ts";
import { walk } from "https://deno.land/std@0.208.0/fs/walk.ts";
import { ensureDir } from "https://deno.land/std@0.208.0/fs/ensure_dir.ts";
import { loadGameEngine } from "./engine-headless.ts";
import { solvePuzzle } from "./puzzle-solver.ts";

const args = parse(Deno.args, { default: { budget: 400000 } });
const root = String(args._[0] ?? "puzzles/pool");
const engine = await loadGameEngine(2, 1);
const quiet = async <T>(fn: () => Promise<T>) => { const l = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = l; } };
const load = async (fen: string) => {
	engine.setRandomSeed(1);
	const g = engine.createGame();
	g.$nextTick = (f: any) => f();
	await quiet(() => g.init());
	await quiet(() => g.loadHDFEN(fen));
	return g;
};

let ok = 0, bad = 0, aborted = 0;
await ensureDir(`${root}/rejected`);
await ensureDir(`${root}/unverified`);
for await (const e of walk(root, { exts: [".json"], skip: [/rejected/, /unverified/, /index\.json$/] })) {
	const p = JSON.parse(await Deno.readTextFile(e.path));
	if (!p.hdfen) continue;
	const stored = `${p.firstMove.fromHex}>${p.firstMove.toHex}`;
	const results = [];
	for (const reverseOrder of [false, true]) {
		results.push(solvePuzzle(engine, await load(p.hdfen), p.n, { maxNodes: args.budget, reverseOrder }));
	}
	if (results.some(r => r.aborted)) { aborted++; await Deno.rename(e.path, `${root}/unverified/${e.name}`); continue; }
	const unique = results.every(r => r.winningFirstMoves.length === 1 && `${r.winningFirstMoves[0].unitHexId}>${r.winningFirstMoves[0].targetHexId}` === stored);
	if (unique) { ok++; continue; }
	bad++;
	await Deno.rename(e.path, `${root}/rejected/${e.name}`);
	console.log(`REJECT ${e.name} n=${p.n} stored=${stored} found=[${results.map(r => r.winningFirstMoves.map(m => `${m.unitHexId}>${m.targetHexId}`).join("|")).join(" / ")}]`);
}
console.log(`verified=${ok} rejected=${bad} budget-aborted (moved to unverified/)=${aborted}`);
