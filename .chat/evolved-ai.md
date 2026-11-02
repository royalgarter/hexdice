# Evolved AI Personalities

## Goal
Replace hand-tuned heuristic profiles with profiles found by self-play evolution. Ship named, distinct, strong opponents (campaign bosses, difficulty tiers) whose style comes from the evolved weights.

## Existing pieces (read first)
- `js/ai/heuristic-profiles.js` — `heuristicProfiles`, `mutateProfile` (uses `Math.random`, so not reproducible), `generateRandomProfile`.
- `js/ai/ai-heuristic.js` — consumes `w.*` weights, `roleWeights`, `spells`, `terrainWeights`, `riskTolerance`, `priorityOrder`.
- `js/tournament.ts` (+ `test_tournaments*`, `tournaments/`) — profile round-robin. `js/simulate.ts` — headless single games.
- Target from TODO.md: no profile above ~70% win rate.

## Design
- **Genome** = the profile object: flat numeric weights, `terrainWeights`, `spells`, `roleWeights`, `riskTolerance`, `priorityOrder`. Float-scale keys (<10) stay float.
- **Fitness** = win rate vs a fixed **gauntlet** (baseline, berserker, turtle, assassin, tactician + hall of fame), both seats, N games each, fixed seed list. Seat-swap removes first-player bias.
- **Algorithm** = (mu+lambda) evolution with elitism. Gaussian mutation scaled per-key, uniform crossover, occasional priority-order swap. Hall of Fame of past champions prevents cycling.
- **Diversity** = keep a behaviour descriptor per profile (avg game length, ranged-kill share, guard rate, capture-win share, avg distance to enemy). Use MAP-Elites grid: one champion per cell. This produces *personalities* (aggressive/turtle/sniper...) instead of one best blob.
- **Reproducibility** = all randomness via injected seeded RNG; every run writes `evolution/<runId>/config.json` + per-generation stats.

## Phases

### P1 — Harness (shares the headless sim work with Daily Puzzle P1)
- [x] Make `mutateProfile` / `generateRandomProfile` take an `rng` param (default `Math.random`). Keep old signature working.
- [x] `js/evolve.ts`: load engine like `simulate.ts`, evaluate a profile list vs gauntlet in parallel (worker pool; see `tournament` parallel scripts).
- [x] Profile (de)serialisation to JSON, validation (clamp ranges: `mergeOver6Penalty` negative, `riskTolerance` 0-1).
- [x] Throughput benchmark: games/sec. Decide population and games-per-eval from it.
- Notes: seeded `makeRng`; `completeProfile` materialises hidden role weights; `clampProfile`; `crossoverProfiles`. Bench: 2.3 games/s on 2 workers, ~47 plies/game; a 100-game profile score is ~45s, a gen of 8 is ~4-5 min. Run 2 gens x 8 pop x 10 games: gen0 best 75.0% / mean 59.9%, gen1 best 73.5% / mean 67.7% (small samples; gauntlet includes baseline, so these are not yet evidence of improvement - P2 adds held-out seeds/opponents).
- Fixed on the way: `performMove` dereferenced the attacker before its null check (crashed ~1 in 400 games with mutated minimax profiles).
- TODO: root-cause why minimax produces a move for a unit `getUnitOnHex` sees as dead (cloned-state aliasing); currently a logged no-op.
- Exit: `deno run --allow-all js/evolve.ts --gens=2 --pop=8 --games=10` runs and logs.

### P2 — Evolution run + selection
- [ ] Implement crossover, elitism, hall of fame, MAP-Elites archive (behaviour descriptors collected by hooks in sim: counts only, no game logic change).
- [ ] Overfitting guard: final champions re-scored on held-out seeds and held-out opponents; reject if drop >10 points.
- [ ] Noise handling: re-evaluate top-k with more games before promotion (win rate CI).
- [ ] Runs: 6-player-free first (2 players, R=5, V1). Then V2 and campaign V3 variants as separate runs (different genome pools).
- Exit: archive of >=6 distinct champions each beating hand-tuned baseline >55% and none >70% vs the gauntlet.

### P3 — Integration
- [ ] Export champions into `js/ai/evolved-profiles.js` (generated file, header notes run id + date). Register in `heuristicProfiles`; load order after `heuristic-profiles.js` in `index.html`.
- [ ] Human-readable names + 1-line style blurb from descriptors ("Iron Wall: guards 3x average, wins by attrition").
- [ ] Difficulty tiers: easy/normal/hard mapped to champion strength; easy = hand-profile + random move noise.
- [ ] Campaign bosses: map each boss in `ro_quest_db.json` to a champion (data only; `StoryEngine` stays thin). Keep fallback to old profile if missing.
- Exit: boss levels use evolved profiles; smoke test plays a level to completion.

### P4 — Continuous improvement
- [ ] `scripts/nightly-evolve.sh` seeded from last archive; PR/commit artefact only if gauntlet score improves.
- [ ] Rules-change regression: when `RULES.md`/`constants.js` change, re-run gauntlet and flag stale champions.
- [ ] Feed A4 balance observatory (win rates by unit/terrain) from the same logs.

### P5 — Stretch
- [ ] Ghost opponents: fit a profile to human HDPGN logs by minimising move-prediction loss (supervised, not self-play).
- [ ] Learn with minimax depth as an evolved gene.

## Compute budget
Nightly runs: 2 CPU cores -> worker pool size 2. Size population/games-per-eval from the P1 throughput benchmark; use successive halving (few games for all, more for the top quarter).

## Risks
- Compute: heuristic AI per move may be slow; mitigate via worker pool, fewer games early, successive halving.
- Evolved weights exploit simulator quirks or AI-vs-AI loops that humans beat trivially -> include human-readable review of replays for each champion; keep 2-3 hand profiles in gauntlet.
- Rock-paper-scissors cycles -> hall of fame.
- Float-key handling (the B2 bug class). Unit test: mutate 1000x, assert no float key collapses to 0/1.
- Balance: strong AI on fixed campaign levels may spike difficulty -> tier mapping + playtest.

## Verification
- Unit tests for mutate/crossover/clamp (Deno).
- Same seed + config twice -> identical champion (reproducibility test).
- Final tournament: `deno run --allow-all js/tournament.ts -g=5 --profiles=<champions>,baseline -q`; no profile above ~70%.
