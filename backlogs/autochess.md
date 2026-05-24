# Plan: Hex Dice v3.1 Autochess Combat Mode

## Objective:
Implement a new "Autochess" combat mode where players focus on formation and strategy rather than direct unit control. The game features an Action Gauge (ATB) system and round-based progression.

## Core Mechanics:

### 0. References (Read once as basic hard memory layer)

#### Key Findings:
   1. Stat Inheritance: I've identified that we can leverage the existing CampaignManager system (ATK, DEF, HP upgrades) and its perk system to provide the "evolution" mechanics requested.
   2. AI Strategy: The current AI uses complex heuristic profiles. For Autochess, we can create simplified, fixed-behavior profiles for each unit class (e.g., Archer kiting, Tanker intercepting).
   3. Action Gauge: This will be a new addition, moving from turn-based to a tick-based simulation where unit speed determines how often they act.

#### Sources:
*   `game.js`: core game engine
*   `index.html`: game UI
*   `campaign/campaign-manager.js`: modified engine for Campaign, that could be inheritance for Autochess
*   `ai/ai-heuristic.js` & `ai/ai.js`: core AI logic

### 1. Progression & Rounds
*   **Total Rounds:** 6 rounds.
*   **Starting Army:** 6 random units (Level 1 stats).
*   **Round Cycle:** 
    1.  **Preparation Phase:** Players arrange units in their deployment zone.
    2.  **Recruitment:** Each round, players earn 1 additional random unit.
    3.  **Combat Phase:** Units fight automatically using fixed AI strategies and the Action Gauge system.
*   **Victory Rewards:** 
    -   Winner of a round earns 1 extra reroll for future recruitment.
    -   Winner's units gain permanent stat increases (inheriting from `CampaignManager` mechanics).

### 2. Action Gauge (ATB) Combat
*   **Gauge System:** Instead of turns, each unit has an `actionGauge` (0-100%).
*   **Speed Stat:** `actionGauge` increments based on a `speed` stat (derived from unit class and stats).
*   **Action Execution:** When a unit's gauge reaches 100%, it performs its "Fixed Strategy" action and resets to 0.
*   **Real-time Simulation:** The combat phase runs in a loop, pausing only for animations.

### 3. Fixed AI Strategies
Each unit type has a predefined behavior:
*   **Fencer (1):** Aggressively targets the nearest enemy unit.
*   **Archer (2):** Maintains distance (2 hexes) and kites while shooting.
*   **Hussar (3):** Targets the lowest HP enemy (assassin).
*   **Knight (4):** Focuses on flanking or attacking units with high armor.
*   **Tanker (5):** Moves forward to intercept enemies and uses "Guard" frequently.
*   **Oracle (6):** Prioritizes healing/shielding allies or debuffing nearby enemies.

### 4. Stat Inheritance & Modification
*   **Base Stats:** Inherit from `UNIT_STATS`.
*   **Upgrades:** Use `CampaignManager`'s ATK/DEF/HP logic.
*   **Scaling:** Round winners get "Evolution Points" to boost specific units.

## Implementation Steps:

### Phase 1: Standalone Module Setup
- Create `autochess.html` and `autochess.js`.
- Refactor shared logic (hex grid, unit stats, movement) into reusable modules or include them as dependencies.
- Implement `AutochessManager` to handle:
    - Round state (1-10).
    - Unit inventory and recruitment.
    - Reward distribution.

### Phase 2: Action Gauge System
- Implement `simulateCombatStep()` in `autochess.js`.
- Add `actionGauge` and `speed` properties to unit objects.
- Implement the "Fixed AI" logic for each unit class.

### Phase 3: Formation Phase UI
- Create a "Deployment Mode" where players can drag/drop units within their half of the board.
- Add a "Start Battle" button to trigger the ATB simulation.

### Phase 4: Integration & Polish
- Connect with `CampaignManager` for stat persistence.
- Add visual indicators for the Action Gauge.
- Implement round recap UI.

### 5. Rules Configuration & Parameters
- **`BASE_HP` (100):** Starting health points for all units.
- **`WIN_REROLLS` (2):** Number of reroll credits granted to each player after winning a combat round.
- **`LOSS_REROLLS` (1):** Number of reroll credits granted to each player after losing a combat round.
- **`VETERAN_ATK_BONUS` (1):** ATK increment applied to survivors after a win.
- **`VETERAN_HP_BONUS` (10):** HP increment applied to survivors after a win.
- **Round Limit:** 6 total rounds per tournament.
- **Player Equality:** Every participant (Human/AI) manages their own `inventories` and `rerolls`.

### 8. Core Formulas & Stat Calculations

- **Base Stats:** Initialized directly from the `UNIT_STATS` constant for each unit value (1-6).
- **Damage Formula:** 
    - Combat Success: `Math.ceil((Attacker.Attack + CombatRoll) / 2) > Defender.Armor`
    - If Success: `Damage = 30 + (Attacker.Attack * 2)`
    - If Deflected: `Damage = 5 + Attacker.Attack`
    - Base `Attack` and `Armor` are inherited from `UNIT_STATS`.
- **Veteran Scaling:** 
    - `Unit.Attack += AUTOCHESS_CONFIG.VETERAN_ATK_BONUS` (Applied per win)
    - `Unit.MaxHP += AUTOCHESS_CONFIG.VETERAN_HP_BONUS` (Applied per win)
- **ATB (Action Gauge) Calculation:**
    - **Gauge Increase:** `Unit.actionGauge += Unit.speed` (calculated every tick).
    - **Speed Base:** Derived from `UNIT_STATS` distance/class or a hardcoded lookup: `{ 1: 10, 2: 12, 3: 15, 4: 8, 5: 5, 6: 10 }`.
    - **Action Threshold:** An action is triggered when `Unit.actionGauge >= 100`.
- **Current Armor:** 
    - Initialized as `UNIT_STATS[value].armor`.
    - Remains constant during a combat round unless specifically modified by active abilities or spells.


---

# Review 01: HexDice Autochess

Welcome to the advisory review board. As a panel of mobile board game experts—comprising Lead Game Designers, System Architects, and Mobile UX Specialists—we have thoroughly reviewed the proposed "Autochess" mode for **HexDice**.

Taking a tactical, deterministic dice game and adapting it into a fast-paced, asynchronous auto-battler is a brilliant pivot for mobile retention. It taps into the highly successful "Super Auto Pets" and "Teamfight Tactics" (TFT) demographic.

Here is our comprehensive analysis of your design document and implementation, broken down by our respective areas of expertise.

---

### 🎲 1. The Game Designer's Perspective: Balance & Mechanics
*Focus: Player experience, economic loops, and game balance.*

**🟢 The Good:**
* **The ATB (Action Gauge) Shift:** Moving from alternating turns to a tick-based speed gauge is the right call for an auto-battler. It allows for dynamic, simultaneous-feeling combat that is fun to watch.
* **Class-Based AI:** Leveraging your existing heuristic AI to give units distinct personalities (e.g., Archer "kiting," Hussar "assassinating") will create highly readable and engaging visual gameplay without requiring complex player input.
* **HP System Introduction:** Transitioning from the base game's "1-hit kill / armor reduction" to a 100 HP base system is necessary for the auto-battler genre. It ensures combats last long enough for players to actually enjoy the spectacle of the fight.

**🔴 The Critical Risks:**
* **The "Win-More" Snowball Effect:** Your reward structure gives round winners **+2 Rerolls** and **permanent stat buffs** (+1 ATK, +10 HP), while losers only get **+1 Reroll** and no buffs. In auto-battlers, this is a fatal flaw. The winner will snowball out of control by Round 3.
  * *Fix:* Reverse or flatten the economy. Losers need comeback mechanics (e.g., loss-streak bonuses or more shop rerolls). Base stat buffs should come from merging identical dice (e.g., combining three "1"s makes a Level 2 Fencer), not just surviving.

---

### 💻 2. The Systems Architect's Perspective: Code & Execution
*Focus: Logic flow, scalability, and technical debt.*

**🟢 The Good:**
* **Clean State Separation:** Introducing `GAME.Autochess.state` keeps this mode cleanly separated from your base version V1/V2 logic, preventing massive technical debt.
* **Randomized Tie-Breaking:** `(b.actionGauge - a.actionGauge) || (Math.random() - 0.5)` is a very elegant and cheap way to handle simultaneous turn priority.

**🔴 The Critical Risks:**
* **Action Hook Override Conflict:** In `executeAction`, you use `applyMove(GAME, move);` from the base game. However, you also have a custom `handleCombat` function in `autochess.js` designed for the new HP system. **If `applyMove` relies on the base game's V1/V2 combat logic (which insta-kills units or reduces armor), your custom HP system will be completely bypassed.**
  * *Fix:* You must either intercept the combat resolution inside `applyMove` when `GAME.Autochess.state.enabled` is true, OR refactor `executeAction` to manually move units and trigger `handleCombat` directly.
* **Simulation Loop (`setInterval`):** Relying on a fixed `100ms` interval for combat steps is okay for a web prototype, but on mobile devices, DOM/Canvas rendering can desync.
  * *Fix:* Tie your simulation steps to a `requestAnimationFrame` loop with a delta-time multiplier to ensure smooth animations and consistent logic execution regardless of device frame rate.

---

### 🎯 Summary of Actionable Recommendations

- **Rebalance the Economy:** Remove the "Winner gets more stats and rerolls" mechanic. Instead, implement a **Merge System**: buying 2 identical dice from the shop combines them into a Veteran die with the +ATK/+HP buffs. This rewards economy management, not just early RNG luck.
- **Check Your Combat Hooks:** Ensure that the AI executing `applyMove` actually triggers your new `handleCombat(HP)` function instead of the base game's instant-kill mechanics.

**Final Verdict:** This is a fantastic expansion of the *HexDice* IP. The groundwork is solid, and with a few crucial tweaks to the economy and code-hooking, you have a highly addictive mobile game loop on your hands.

---

# TODO

- **Combat Hook Interception:** Modified `js/ai/ai.js` to redirect combat actions to `Autochess.handleCombat` when Autochess mode is active, bypassing base game logic.
- **Merge System:** Added `mergeUnits` in `js/autochess.js` allowing players to combine 2 identical units for stat upgrades. UI will have click to highlight and [Merge] button to upgrade it's stats.
- **Economy Rebalance:** Eech round is rewarded 1 unit with change of reroll (Losers: 1, Winners: 2) and removed post-match stat buffs in favor of the merge system.
- **Team Management:**
    - Removed 6-unit cap in `recruitUnit`, allowing collection.
    - Updated `prepareCombat` to only deploy the first 6 units in the player's team list for battle.
    - Added drag & drop reordering UI in `index.html` to allow player control over team formation.
- **Timeout and Tie-Breaker:**
    - Added a 1-minute round timer and UI display.
    - Added `resolveTimeout` which determines the winner based on remaining units and HP if time expires.
