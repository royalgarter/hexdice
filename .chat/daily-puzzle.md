# Daily Puzzle — "Win in N"

## Goal
One shared, deterministic tactical puzzle per UTC day. Player must find a forced win within N of their own turns. Result is shareable as an emoji grid. Doubles as tutorial source.

## Non-goals
Accounts, leaderboards on server, ranked play. v1 is fully client-side + static JSON.

## Decisions (defaults; revisit if wrong)
- Puzzle = HDFEN position, player 0 to move, fixed rules version (V1 Decisive, deterministic, so solvability is provable; V2/campaign HP out of scope).
- Win condition: base capture or annihilation, per puzzle field.
- N in {1,2,3} (player turns). Opponent replies with best-defence (full minimax over its moves), so "forced" means against all replies.
- Puzzles pre-generated offline into `puzzles/YYYY-MM-DD.json`; client fetches by date. No runtime generation, so no client/server drift and no cheating via seed guess.
- Fallback when file missing: pick `puzzles/pool/<hash(date)%poolSize>.json`.

## Data format
```json
{ "id": "2026-11-03", "hdfen": "...", "n": 2, "rules": "V1", "win": "base|annihilation",
  "difficulty": 1-5, "solution": ["move","..."], "uniqueFirstMove": true, "title": "..." }
```

## Phases

### P1 — HDFEN round-trip + solver (foundation, shared with Evolved AI harness)
- [x] Add `loadHDFEN(str)` inverse of `generateHDFEN` (`js/game.js:5504`). Round-trip test: random sim positions -> gen -> load -> gen identical.
- [x] Check HDFEN covers everything (gap found: terrain + radius; fixed with a backward-compatible `R<n> <terrain RLE>` tail. Bases are derived from radius + player count. HP/armor perks not encoded: V1 only) a puzzle needs (terrain per hex, base hexes, guard/skirmish flags). If terrain missing, extend format (backward compatible, version prefix).
- [x] `js/puzzle-solver.ts`: headless, uses `engine-server.ts` style sandbox like `simulate.ts`. Exhaustive DFS depth 2N-1 with alpha-beta; move generation via existing `generateAllPossibleMoves` (ai.js). Must use state snapshot/restore (`_saveHeuristicSnapshot`) not structuredClone.
- [x] Output: set of winning first moves + proof depth.
- Done 2026-11-02. Notes: runs on the live game via real `endTurn` + `_saveHeuristicSnapshot` restore; defender may pass; SACRIFICE excluded; transposition table keyed by unit positions. Engine loader extracted to `js/engine-headless.ts` (shared with simulate.ts). Tests: `tests/hdfen.test.ts`, `tests/puzzle-solver.test.ts`.
- E2E 2026-11-02: browser (`tests/browser-hdfen.mjs`) loads HDFEN into the live Alpine game, DOM renders, unit selectable. Headless (`tests/e2e-puzzle-p1.ts`) on 9 real AI-game positions: all round-trips identical, solver leaves state untouched, found a real unique win-in-1 at turn 84. Cost: n=2 ~0.2s, n=3 ~4s on crowded openings (83k-90k nodes), <0.3s late game; n=3 on some openings exceeds 150k nodes -> `maxNodes` budget added, generator must skip aborted positions.
- Exit: solver solves hand-made mate-in-1 and mate-in-2 fixtures; round-trip test passes. Tests in `tests/puzzle-solver.test.ts`.

### P2 — Generator (in progress; log 2026-11-02)
Solver bug found and fixed 2026-11-02: the transposition key omitted `lastActionWasGuard`, `lastHexId`, `hasMovedOrAttackedThisTurn`, so results depended on search order (forward {43}, reverse {21,31,43}, truth {43,21}). Key widened; regression test added; `js/puzzle-verify.ts` re-solves a pool both ways. All 123 pool puzzles passed re-verification (0 rejected) with the fixed solver.
Pool status: 123 puzzles (N1: 17, N2: 76, N3: 30; difficulty 1: 85, 2: 33, 3: 5). Gap: difficulty 4-5 needs a recalibrated score or Guard/Oracle-based puzzles.

Findings that changed the plan:
- Mid-game AI positions almost never contain a forced win in <=3, so sampling is **endgame-only**: last N positions of finished games, winner to move. Yield is ~1 puzzle per 10 positions, ~3/min per core, limited by AI game play, not the solver.
- Solver pruning (leaf cut + last-ply "can this end the game" filter + stop at 2nd winner) cut nodes ~44x; `tests/e2e-puzzle-p1.ts` asserts pruned == exhaustive on real positions (and `turnModelViolations == 0`).
- Decoy count gates only N=1; for N>=2 it is a difficulty input (quiet endgames have few attacking moves).
- Generator emits `attacker` (either seat). P4 must either let the human take that seat or normalise by rotating 180 degrees (q,r -> -q,-r, swap ids) and re-solving.
- "Unique first move" holds within `generateAllPossibleMoves` (AI-pruned: GUARD anti-spam, SWAP-back skip, MERGE off, no SACRIFICE). P4's UI must offer the same move set or treat extra moves as wrong-by-definition; defence table only covers the solver set.
- Positions with radius not in {5,6,8} are unsupported by the client grid class; generator inherits radius from normal games so this holds.

- [ ] `js/puzzle-gen.ts`: sample mid/late-game positions from AI-vs-AI sims (reuse `simulate.ts`), keep those where solver finds forced win in <=N and **exactly one** winning first move (the aha).
- [ ] Use `solvePuzzle(..., maxNodes)`; skip `aborted` results. Prefer late-game positions (cheap, and the only ones with wins so far).
- [ ] Reject trivial: win available by plain capture of adjacent base at N>1, or any "obvious" kill-chain (score by number of losing-looking decoys: candidate first moves that a depth-1 heuristic prefers but lose).
- [ ] Difficulty score = f(N, branching factor, decoy count, solution uses Guard/Special/Spell).
- [ ] CLI: `deno run --allow-all js/puzzle-gen.ts --count=400 --out=puzzles/pool`. Seeded for reproducibility.
- Exit: 100+ puzzles with spread of difficulty; manual review of 20.

- [ ] TODO (later): recalibrate difficulty score. Pool has no difficulty 4-5 (85/33/5 at 1/2/3). Ideas: count plausible wrong first moves (not just attacks), reward Guard/Oracle-spell solutions, weight branching factor and unit count.

### P3 — Daily scheduler + content QA
- [ ] `scripts/schedule-puzzles.js`: assign pool entries to dates, difficulty ramp Mon(1) -> Sun(5), no repeats in 365 days.
- [ ] Human QA pass: title, flavour line, flag broken ones.
- [ ] Output `puzzles/YYYY-MM-DD.json` + `puzzles/index.json`. Add to service-worker cache list.

### P4 — Client UI
- [ ] URL: `?puzzle=daily` and `?puzzle=YYYY-MM-DD`. New phase `PUZZLE` in `game.js` state (alongside `SETUP_*`), gated by `isPuzzle` like `isCampaign`.
- [ ] `html/puzzle.html` partial via `loadComponent` in `index.html`: header (N moves left, attempt count), Hint (reveals piece), Reset, Show solution (marks run as failed).
- [ ] Engine hook: after each player move, opponent reply from solver's best-defence table (precomputed in JSON `defence`), not live AI, so behaviour is deterministic.
- [ ] Win/fail detection; wrong first move -> "that loses" feedback after the line plays out.
- [ ] Simulation guard rules apply; audio/UI side effects only when `!state`.
- Exit: playable end-to-end in Chromium (extend `tests/browser-smoke.mjs`).

### P5 — Share + retention
- [ ] Result string: `HexDice 2026-11-03 ⭐ 2/3 🟥🟩` (attempts, hint use). Copy-to-clipboard + Web Share API.
- [ ] localStorage `hexdice_puzzle_state`: streak, history, today's status. try/catch (private mode).
- [ ] Rules page / home page entry; update `sitemap.xml`, `llms.txt`.
- [ ] Offline: today's puzzle precached by service worker.

### P6 — Tutorial track (stretch)
- [ ] Curated ordered puzzles (one per unit type, terrain, Guard, Spell) at `?puzzle=learn`.

## Risks
- Solver blow-up on 6-player or big boards: restrict to 2 players, radius 5, <=8 units each in v1.
- Spell/RNG-free guarantee: confirm V1 has no hidden randomness in move resolution. If any, exclude those actions from puzzle move set.
- HDFEN gaps (see P1). Mitigation: versioned format.
- "Unique first move" may be too strict -> relax to <=2 with difficulty penalty.

## Verification
- Solver fixtures + round-trip tests (Deno).
- Generator output re-verified by an independent solve pass (different move ordering) before publish.
- Browser smoke test: load `?puzzle=daily`, play stored solution, assert win.
