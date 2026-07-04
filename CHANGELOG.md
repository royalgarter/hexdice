# Changelog

## 2026-07-04 — Autochess mode support in the CLI simulator

**File changed:** `js/simulate.ts`

### What

`simulate.ts` could only run tactical games; Autochess (RotDK) mode was untestable headlessly. Added:

- `--autochess` / `-a` flag — runs games in Autochess mode; `--rounds` / `-r` sets rounds per game (default `AUTOCHESS_CONFIG.MAX_ROUND`).
- `-t` in autochess mode takes heuristic profile names per player (e.g. `-t=berserker,turtle`); unknown names fall back to Autochess's per-class unit profiles.
- New `runAutochessGame()`: replaces the browser-bound `Autochess.runSimulation()` (setInterval + DOM renderer) with a synchronous tick loop over `Autochess.simulateStep()`; resolves timeouts by total HP (mirrors `resolveTimeout`), then auto-plays preparation between rounds — recruit all inventory options, merge same-value/same-level duplicates with random perk picks, redeploy — via `Autochess.nextRound()`.
- Loader modernized to match `tournament.ts`: now loads `constants.js` + `autochess.js`, adds full browser stubs (`window`, `localStorage`, `Alpine`, `alert`, `requestAnimationFrame`, richer `document`/`location`), a `StoryEngine` stub, and uses `game.js`'s built-in seeded `random`/`setSeed` (removed the stale `const random` string replacement that no longer matched).
- `Deno.exit(0)` at the end — engine schedules browser-style timers (audio, hit effects) that kept the event loop alive.

### Usage

```
deno run --allow-all js/simulate.ts --autochess -g=3 -t=baseline,berserker
deno run --allow-all js/simulate.ts -a -g=1 -r=5 -v
```

### Verification

- `-a -g=1 -r=3 -v` — full 3-round game with combat logs, perks, spells; winner reported per round and overall.
- `-a -g=2 -r=5 -t=berserker,turtle` — named team profiles work; 5 rounds per game, replay JSON saved.
- `-g=1` (no flag) — tactical mode regression-checked, still works.

## 2026-07-04 — Fix heuristic AI never taking kills ("coward AI")

**File changed:** `js/ai/ai-heuristic.js` (only file modified)

### Root cause

`heuristicMove()` simulates each candidate move with `applyMove(..., { noClone: true })`, which mutates `state` in place, then read the board *after* simulation to judge the move. Post-simulation lookups saw the outcome of the move, not the situation it was evaluated against:

- The defender on `move.targetHexId` was already removed (hex holds the attacker or nothing), so `canKillEnemy` / `canAttackEnemy` were never set for `MOVE` and `RANGED_ATTACK`. The `kill` and `attack` priorities never fired — every profile only positioned and dodged.
- Team position score compared the mutated state to itself (delta always 0), disabling `teamPositionWeight`.
- Oracle SHIELD gate read `isGuarding` after the cast had applied it; SKIRMISH gate read `skirmishBuff` after the buff — both spells scored ~0, so the Oracle never cast.
- SWAP evaluation looked up units after occupancy was swapped (`getUnitOnHex(targetHexId)` returned the Oracle itself), and its swap-back guard read `lastHexId` after the sim overwrote it.
- SACRIFICE re-validated targets against the already-mutated state.

### Fix

Capture combat context **before** simulation and use it in scoring:

- New pre-sim captures in `heuristicMove()`: `preSimTargetUnit`, `preSimDefenderArmor`, `preSimTargetIsGuarding`, `preSimTargetSkirmishBuff`, `preSimTeamScore` (alongside existing `preSimLastHexId` / `preSimPrevHexId`).
- Kill/attack detection uses `preSimTargetUnit` and `preSimDefenderArmor`.
- Team score delta computed against `preSimTeamScore`.
- SHIELD gated on `preSimTargetIsGuarding`; SKIRMISH gated on `preSimTargetSkirmishBuff`.
- SWAP uses pre-sim identities (`targetUnit = preSimTargetUnit`, `oracleUnit = unit`) and `preSimLastHexId` for the swap-back guard.
- SACRIFICE uses pre-sim identities; dropped the post-sim `calcValidSacrificeTargets` re-check (targets are validated at move generation).

No profile weights were changed.

### Verification

- `deno run --allow-all js/tournament.ts -g=1 --profiles=baseline,berserker -v` — "Found kill opportunity" / "Found attack opportunity" now fire regularly for both `MOVE` and `RANGED_ATTACK`; game plays to victory.
- `deno run --allow-all js/tournament.ts -g=3 --profiles=baseline,berserker,turtle -q` — berserker 3W/0L/3D (50%), baseline 0/3/3, turtle 0/0/6. No profile above the ~70% dominance threshold; berserker wins all as P2 (known E_21 P2 advantage).

### Known follow-up

Turtle profile draws every game by design (dodge-first priority, `killBonus: 500`, `riskTolerance: 0.05`). If turtle should also fight, raise its `killBonus` or move `kill` earlier in its `priorityOrder` in `js/ai/heuristic-profiles.js`.
