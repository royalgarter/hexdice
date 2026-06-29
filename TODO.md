# Hex Dice — TODO

## Quest Objective System (v1)

Make campaign quests mechanically real via a **bonus objective** layer.
Each level optionally declares a `questObjective` in `ro_quest_db.json`.
On win, condition is evaluated against existing game state.
Success: +1 devotion point + toast notification.

### Objective types supported (v1)

| type | condition (checked at gameOver) | new tracking needed |
|---|---|---|
| `win_no_casualties` | zero player unit deaths | none |
| `win_in_turns:N` | `turnCount <= param` | none |
| `protect_unit:V` | unit of value V not dead | none |
| `no_ranged` | player used no RANGED_ATTACK actions | none (`actionLog` already exists) |
| `no_spells` | player used no SPELLCAST actions | none (`actionLog` already exists) |
| `use_guard:N` | player used GUARD >= N times | none (`actionLog` already exists) |
| `hold_tower:N` | player holds >= N TOWER hexes at battle end | none (iterate hexes) |
| `kill_type:V` | killed at least one enemy of unit value V | one flag: `_questKillTypeAchieved` |

> Future v2 ideas: `capture_base`, `kill_with_type` (attacker tracking), combo objectives, timed sub-goals mid-battle.

### Implementation steps

- [x] **Step 1 — Data**: Add `questObjective: { type, param, bonusText }` to ~20 levels in `ro_quest_db.json`. No engine changes yet. Verify JSON parses cleanly.
- [x] **Step 2 — Engine query**: Add `StoryEngine.getQuestObjective(levelNum)` (3 lines) in `story-engine.js`. Returns `{ type:'win', param:null, bonusText:null }` default for levels without it.
- [x] **Step 3 — Expose to game**: Add `questObjective: StoryEngine.getQuestObjective(levelNumInt)` to the `story:` object in `campaign-manager.js` fetchCampaignMap (~line 990).
- [x] **Step 4 — Evaluator**: Add `CampaignManager.checkQuestObjective(game)` helper before `handleGameOver`. All 8 types. Uses `actionLog`, `hexes`, `players[0].dice` — all already on game object.
- [x] **Step 5 — Reward hook**: In `handleGameOver`, replace `completedQuests[levelNum] = true` with `{ completed: true, bonus: bonusAchieved }`. On bonus: `devotionPoints++` + delayed toast (4500ms, after victory toast clears).
- [x] **Step 6 — kill_type flag**: In `game.js resetGame()` add `_questKillTypeAchieved = false`. In `removeUnit` inside `if (!state)` block, set flag when enemy of matching value dies.
- [x] **Step 7 — HUD**: In `controller.html` Quest Log HUD, add 1 template line showing `◎ bonusText`. Live green highlight for `kill_type` via `_questKillTypeAchieved` (already Alpine-reactive).
- [x] **Step 8 — Verify backward compat**: Old saves with `completedQuests[n] = true` — `true.bonus` is `undefined` (falsy), all `if (completedQuests[n])` guards still pass. No migration code needed.

### Key files

- `js/campaign/ro_quest_db.json`
- `js/campaign/story-engine.js`
- `js/campaign/campaign-manager.js` — `checkQuestObjective()`, `handleGameOver()`, `fetchCampaignMap()`
- `js/game.js` — `resetGame()`, `removeUnit()`
- `html/controller.html` — Quest Log HUD
