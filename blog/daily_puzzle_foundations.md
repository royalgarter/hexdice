# Hex Dice Devlog: Teaching the Engine to Prove a Win

The next big feature is a **Daily Puzzle**: one shared position per day, find the win in N moves. A puzzle is only worth shipping if a win is *forced* and the first move is the only one that works. That means the game needs a way to prove things about itself. This post covers the groundwork.

## A position you can write down

Hex Dice already had HDFEN, a one-line text snapshot of the board inspired by chess FEN. It had a gap: no terrain and no board size. Two positions with the same units but a forest in different places looked identical.

HDFEN now ends with a radius and a run-length list of terrain:

`... PT 12 ___ R5 37.3F2.1M...`

Old readers still work, because the new part is just a tail. The missing half was `loadHDFEN`: take that string and rebuild a live, playable board from it. Round-trip is the test. Generate, load, generate again, and the strings must match exactly.

## A solver that plays every reply

`solvePuzzle` answers one question: can player 0 win within N of their own moves, no matter what the opponent does? It tries each first move, then every opponent reply (including passing), and so on. It reuses the game's own move generator and undo snapshots, so it can't disagree with the real rules.

Two details matter:
- It runs on the live engine and restores state after every branch. The test suite checks the board is identical afterwards.
- It takes a node budget. If a position blows up, the solver reports "aborted" instead of an answer it can't back up.

## Checked on real games, not just fixtures

Hand-built fixtures prove the logic. Real games prove it survives mess. The end-to-end run plays AI-vs-AI games, snapshots positions, reloads each one and solves it at N=1, 2 and 3:

- Every round-trip came back identical.
- N=2 takes about 0.2 seconds. N=3 takes about 4 seconds on a crowded opening and under 0.3 seconds late in a game.
- Some openings go past 150,000 nodes at N=3. Those get skipped.
- One late-game position turned out to be a genuine puzzle: a win in one move, with exactly one winning first move.

A second test drives the real browser: it loads an HDFEN into the running Alpine game, checks the hexes render, and selects a unit.

## What's next

The generator. Sample positions from AI games, keep the ones with a single winning first move, and rank them by how many tempting-but-wrong moves they hide. Late-game positions look like the best source: they're cheap to solve and they're where the first real puzzle appeared.
