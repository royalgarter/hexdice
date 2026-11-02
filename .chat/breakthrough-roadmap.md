# Breakthrough Roadmap

Source: brainstorm session 2026-11-02. Status key: [ ] not started, [~] planned in detail, [x] shipped.

## Committed (detailed plans exist)

| # | Item | Plan | Status |
|---|---|---|---|
| 1 | Daily Puzzle ("win in N") | `.chat/daily-puzzle.md` | [~] |
| 2 | Evolved AI personalities | `.chat/evolved-ai.md` | [~] |

Shared foundation both depend on: deterministic headless sim + HDFEN (`generateHDFEN`, game.js:5504) + a `loadHDFEN` inverse (to build in Puzzle P1) + seeded RNG (`setSeed`, game.js:8).

## Candidate backlog (not committed; ordered by value/risk)

Each gets its own `.chat/<name>.md` before work starts. Entry criteria listed so nothing starts half-specified.

### A. Reuse existing infrastructure
- [ ] **A3 Ghost opponents** — distil recorded human games into a heuristic profile. Needs: replay log format (HDPGN) + Evolved-AI fitness harness. Start after #2 P3.
- [ ] **A4 Balance observatory** — nightly sim, win rate per unit/preset/terrain, CI gate at ~70% cap. Needs: tournament JSON output (shared with #2 P1).

### B. Rule-level (each prototyped in the simulator first, AI-vs-AI, behind a flag)
- [ ] **B5 Dice draft** — shared pool, snake draft replaces setup roll. Metric: first-player advantage and win-rate spread vs. roll setup.
- [ ] **B6 Promotion** — far-edge reach changes face. Metric: game length, stalemate rate.
- [ ] **B7 Simultaneous planning** — highest reward/risk. Spike: engine-level resolver for two queued orders + conflict rules; measure game completion and decision depth with AI. No UI until the spike passes.
- [ ] **B8 Living board** (tide/fire/collapse) — per-RO-map hazard tick. Terrain config in `constants.js`.
- [ ] **B9 Fog of war** — visibility system (see `backlogs/ai.md` Phase 1). Needs AI to read a per-player visibility mask.
- [ ] **B10 Action-point economy** — N points/turn spread across units. Touches turn system (`turn-system-analysis.md`).

### C. Campaign shape
- [ ] **C11 Roguelite branching map** — behind `?campaign=true&mode=rogue`. Reuses devotion/perks/fatigue; replaces linear levelN.json with generated nodes. Depends on `generator.js` + evolved bosses (#2).
- [ ] **C12 Ghosts of the fallen** — dead veterans give one-shot buff next level. Small; can ship inside C11.
- [ ] **C13 Co-op campaign** — two humans, one army. Depends on online stack stability.

### D. Reach
- [ ] **D14 Map editor + share-by-URL** — HDFEN in URL hash. Shares code with Puzzle P4.
- [ ] **D15 Replays + spectate** — seed + action log. Shares code with Puzzle P4 replay-of-solution.
- [ ] **D16 Mobile-first pass** — touch targets, one-hand play, offline daily puzzle (service worker already present).

### E. Wild cards
- [ ] **E17 Persona narrator** — boss taunts from game events; data in `ro_quest_db.json`.
- [ ] **E18 Dice roll reveal / game feel** — SFX, haptics, easing.
- [ ] **E19 Cross-mode meta** — Autochess and campaign share account progression.

## Sequencing

```
Puzzle P1 (HDFEN load + solver) ─┬─> Puzzle P2..P5 ──> D14, D15
                                 └─> Evolved-AI P1 (harness) ──> P2..P4 ──> A3, A4, C11
```

Rule: no B-item ships without a simulator experiment showing it does not break the 70% win-rate cap or inflate game length.
