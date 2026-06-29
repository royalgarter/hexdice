# Hex Dice — TODO

## Quest Objective System (v1) ✓ COMPLETE

v1 shipped: 8 passive types (win_no_casualties, win_in_turns, protect_unit, no_ranged, no_spells, use_guard, hold_tower, kill_type), 33 levels covered. +1 devotion on bonus, delayed toast.

---

## Quest Objective System (v2) — Hard Challenges

Adds 7 harder types requiring deliberate risk/mastery. Boss and late-game levels (60+) get v2 objectives; early levels keep v1 as onramp.

### New types (v2)

| type | condition | tracking needed |
|---|---|---|
| `solo_survivor` | exactly 1 player unit alive at win | none |
| `unit_bloodied` | ≥1 player unit at effectiveArmor ≤ 1 but alive at win | none |
| `no_guard` | player never used GUARD action | none (actionLog) |
| `use_special` | player used SPECIAL_ATTACK ≥ N times | none (actionLog) |
| `oracle_last` | Oracle (value 6) is a surviving unit at win | none |
| `chain_kill` | killed ≥ N enemies in a single player turn | `_questChainKillMax` + `_questChainKillThisTurn` counters |
| `win_by_capture` | won by occupying enemy base (not elimination) | `_questWonByCapture` flag in `checkWinConditions` |

> Future v3 ideas: combo objectives (two conditions both met), timed sub-goals mid-battle, "no movement" (teleport-only Oracle win).

### Implementation steps

- [x] **Step 1 — TODO update** *(this file)*
- [x] **Step 2 — Evaluator**: Add 7 new cases to `CampaignManager.checkQuestObjective()` switch in `campaign-manager.js`
- [x] **Step 3 — chain_kill tracking**: In `game.js resetGame()` add 3 new flags. In `removeUnit` inside `if (!state)` block add chain counter. In `_endTurn` reset counter each player-0 turn.
- [x] **Step 4 — win_by_capture flag**: In `game.js checkWinConditions()` at `baseCaptured && !annihilationMode` branch, set `_questWonByCapture = true` when enemy base is captured.
- [x] **Step 5 — Data**: Replace 12 boss/late-game level objectives in `ro_quest_db.json` with v2 types. Verify JSON parses.
- [x] **Step 6 — Verify**: Syntax check all JS files. Spot-check objective logic by code review.

### Levels getting v2 objectives

| Level | Type | Param |
|---|---|---|
| 60 | `solo_survivor` | — |
| 70 | `win_by_capture` | — |
| 80 | `chain_kill` | 2 |
| 90 | `no_guard` | — |
| 100 | `use_special` | 2 |
| 110 | `chain_kill` | 2 |
| 120 | `unit_bloodied` | — |
| 130 | `solo_survivor` | — |
| 140 | `oracle_last` | — |
| 150 | `no_guard` | — |
| 155 | `chain_kill` | 3 |
| 161 | `solo_survivor` | — |

### Key files
- `js/campaign/campaign-manager.js` — `checkQuestObjective()`: +7 cases
- `js/game.js` — `resetGame()`, `removeUnit()`, `_endTurn()`, `checkWinConditions()`: ~8 new lines
- `js/campaign/ro_quest_db.json` — replace 12 objectives

---

## AI Improvements — Priority Order

### Step 1 — Fix random spell gate [ai-heuristic.js] ← START HERE
Remove `random() < ratio` in `executePriority('spell')`.
Always cast if `viableSpells[0].score > 0`. Keep sacrifice special-case unchanged.
Risk: none.

### Step 2 — Fix minimax candidate filter [ai-heuristic.js]
Change filter from `actionType === 'MOVE' || actionType === 'POSITION'`
→ `actionType === 'MOVE' || actionType === 'RANGED_ATTACK'`
`POSITION` doesn't exist — minimax never refined ranged attacks.
Risk: none — correctness fix only.

### Step 3 — Fix phase detection overlap [ai-heuristic.js]
`late` condition: remove `|| state.turnCount > 100` (causes overlap with early).
Keep: `deployedUnits < totalPossibleUnits * 0.2` only.
Risk: low.

### Step 4 — Re-enable Guard action [ai.js + ai-heuristic.js]
- Uncomment Guard in `generateAllPossibleMoves` (ai.js).
- Anti-spam: only generate Guard move if `!unit.isGuarding && !unit.lastActionWasGuard`.
  Set `unit.lastActionWasGuard = true` in applyMove Guard branch (cleared on any other action).
- Guard scores high only when: unit is threatened AND on FOREST/TOWER/MOUNTAIN.
  `w.guardPenalty` (already -500) prevents spam on plain terrain.
- Skip Merge — future work.
Risk: medium — anti-spam flag is safety net.

### Step 5 — Archer proactive kiting [ai-heuristic.js]
When evaluating Dice 2 MOVE: if destination puts a ranged target at distance 2 with LoS, add +300 "setup" bonus.
Existing +200 for landing at distance 2 stays.
Risk: low — additive.

### Step 6 — Hussar flanking bonus [ai-heuristic.js]
When Hussar MOVE lands adjacent to enemy value >= 3 that it can kill next turn (attack >= defenderArmor), add +200.
Risk: low — additive.
