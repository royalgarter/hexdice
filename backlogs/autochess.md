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



