Welcome to the panel. We have assembled three distinct experts—a **Chess Grandmaster**, a **Modern Board Game Designer**, and a **Mobile Casual Tactical Lead**—to review "Hex Dice" and brainstorm its expansion into a sprawling Single-Player Campaign Mode. 

Here is our collaborative blueprint for taking Hex Dice to the next level.

---

### 📱 The Mobile Casual Tactical Expert: *The Engagement Loop & Progression*
*Focus: Player retention, UI/UX, meta-progression, and bite-sized satisfaction.*

**1. The Overworld Map & Meta-Progression**
*   **The Campaign Map:** Instead of one massive board, use a node-based Overworld Map (similar to *Polytopia* or *Candy Crush*). Players travel through different biomes (The Forest of Pips, The Glass Mountains, The RNG Lakes).
*   **Army Building (Meta-Progression):** You don't start the campaign with 12 dice of all values. You start with just 4 dice, and maybe they are locked to values 1-3. As you beat levels, you "rescue" or "forge" new dice, increasing your army size and unlocking the ability to roll 4s, 5s, and 6s.
*   **The 3-Star Rating System:** Every level has a primary objective to pass, but secondary objectives for stars. 
    *   *1 Star:* Complete the objective.
    *   *2 Stars:* Complete within X turns.
    *   *3 Stars:* Complete without losing a single unit (or without using Reroll).

**2. Dynamic Quest Types**
Move beyond "Annihilation" and "Base Capture" to keep the campaign fresh:
*   **Escort Mission:** Move a special "VIP Dice" (maybe a unique D8 or a fragile D1) from one side of a massive scrolling map to the other while endless AI units spawn from the edges.
*   **Survival:** Hold a central Mountain/Tower fortress against waves of AI enemies for 10 turns.
*   **Boss Battles:** Introduce "Giant Dice" (e.g., a massive D20 that occupies 3 hexes). It has massive armor and sweeps adjacent hexes. The player must use Oracles (Skirmish/Swap) and Archers to whittle it down.

### ♟️ The Chess Expert: *Puzzles & Deterministic Mastery*
*Focus: Perfect information, positional advantages, and deep tactical calculation.*

**1. "Mate in X" Tactical Puzzles**
Interspersed between large campaign battles, include micro-levels that act as tactical puzzles. 
*   *Scenario:* You are given a pre-set board state. You have 3 units, the enemy has 5. You have exactly 2 turns to capture the enemy base. 
*   *Why it works:* Because Hex Dice combat is deterministic (Attack vs. Effective Armor), players can calculate exact outcomes. This teaches advanced mechanics like Oracle Sacrifices, L-shape Hussar blocks, and manipulating Guard charges.

**2. Advanced AI Archetypes**
To make a large campaign work, the AI needs distinct "personalities" or "factions" rather than just one generic bot:
*   *The Swarm:* AI heavily weighted to roll 1s and 3s. Aggressive, rushes the player.
*   *The Phalanx:* AI heavily weighted to 5s (Tankers) and 2s (Archers). Moves in tight formations, utilizing Forests and Towers.
*   *The Coven:* AI uses multiple 6s (Oracles) to constantly Swap and Skirmish, creating a highly elusive, frustratingly clever opponent.

### 🎲 The Board Game Expert: *World-Building & Map Dynamics*
*Focus: Physicality, legacy elements, terrain interaction, and narrative.*

**1. Modular "Scrolling" Maps**
For epic, large-scale quests, use modular map tiles. As the player's units reach the edge of the R=5 map, you physically lay down a new map tile, expanding the world dynamically. This simulates a "march" across a continent, managing a persistent army across multiple boards without resetting.

**2. Interactive & Hazard Terrain**
To make large maps interesting, introduce campaign-exclusive terrain:
*   **Dice Forges:** Capturing this hex allows you to immediately upgrade a unit's face value by +1 without rerolling.
*   **Teleportation Runes:** Moving onto Rune A instantly transports the unit to Rune B on the other side of the massive map.
*   **Lava/Quicksand:** Hexes that destroy a unit if they end their turn there, forcing players to use Hussars (jump) or Knights (diagonal bypass) to navigate safely.

**3. The "Legacy" Campaign Mechanic**
Give the dice *scars and medals*. If a specific dice survives a grueling boss level, it gets a "Veteran Token" (permanently giving it +1 Armor in future campaign levels). If a unit is defeated, that specific die is "injured" and cannot be deployed in the next immediate level, forcing the player to adapt their strategy with a smaller pool.

### Summary of the Campaign Flow
A player logs in, looks at the **Overworld Map**, and selects a **Siege Level**. They deploy their persistent, upgraded army. The map is shrouded in **Fog of War**. They push forward, solving a **Chess-like positional puzzle** to breach the gates, utilizing **Teleportation Runes** to flank the enemy. Finally, they defeat the **Swarm AI Faction**, earning **3 Stars** and unlocking the ability to roll **Oracle (6)** dice for the rest of the campaign.

---

<REASONING>
<CONDUCTOR_NOTE>
The user has provided a specific, constrained vision for the first draft: *Journey of the Six*. The player has exactly 6 dice (one of each value), faces deployment limits per map, must manage a fatigue/scar system preventing 3 consecutive deployments, and can collect consumable runes. I will convene the panel to refine this draft, specifically looking for mathematical edge cases in the deployment rules.
</CONDUCTOR_NOTE>

<EXPERT NAME="Garry" FIELD="Chess Grandmaster & Puzzle Designer">
Garry, let's look at the core premise: you only have 6 dice, one of each value (1 through 6), and you must pick a subset (e.g., 3 or 5) for each map. How does this affect the tactical depth?
</EXPERT>

<SPEAKS NAME="Garry">
It turns the pre-game lobby into a brilliant puzzle. In standard Hex Dice, you roll to see what you get. Here, you have a deterministic toolkit. If a map is filled with Lava, you *must* bring the Hussar (3) and Knight (4). If it's a defense map, you bring the Tank (5) and Archer (2). It shifts the game from "adapting to RNG" to "perfect loadout optimization." I love it.
</SPEAKS>

<EXPERT NAME="Jordan" FIELD="Mobile Casual Strategy Designer">
Jordan, the user proposed a rule: "A unit could not be used consecutively 3 in a row of campaigns." How does this fatigue system interact with the deployment limits?
</EXPERT>

<SPEAKS NAME="Jordan">
There is a mathematical soft-lock here that we need to fix. If the player has exactly 6 dice, and a level requires them to deploy 5, they are leaving 1 behind.
Level 1: Leave Die A. (Dice B, C, D, E, F are used).
Level 2: Leave Die B. (Dice A, C, D, E, F are used).
Level 3: Leave Die C. (Dice A, B, D, E, F are used).
Notice that Dice D, E, and F have now been used 3 times in a row. If the rule is a strict lockout, the player literally cannot play Level 4 because they don't have enough legal dice to form a team of 5.
Instead of a strict lockout, the "Scar" should be a severe debuff. If used 3 times in a row, the unit enters the battle "Scarred" (e.g., -1 Armor, or movement reduced by 1). This forces the player to choose: play a sub-optimal team of 3 rested dice, or bring a 5-dice team but two of them are heavily crippled.
</SPEAKS>

<EXPERT NAME="Rob" FIELD="Legacy Board Game Creator">
Rob, what about the Runes? The user wants them to be one-time use abilities acquired across the journey.
</EXPERT>

<SPEAKS NAME="Rob">
Consumables are great for legacy/campaign feel. Since the player only has these six specific "heroes," the runes should be equipped to the dice between levels. Think of them as single-use equipment. A "Rune of Swiftness" lets the Tank (5) move two hexes for one turn. A "Rune of the Aegis" gives the fragile Pawn (1) a one-time shield. This gives players a way to mitigate the "Scarred" debuff Jordan mentioned—if you *must* bring a Scarred unit, you can burn a valuable Rune to keep it alive.
</SPEAKS>

<CONDUCTOR_NOTE>
The panel has identified a critical mathematical flaw in the strict lockout rule and proposed a more engaging "Scar Debuff" system. They have also fleshed out the Rune system. I will now synthesize this into the first official draft of *Journey of the Six*.
</CONDUCTOR_NOTE>

<DRAFT VERSION="1" BY="Conductor">
Synthesizing the panel's feedback into the final game design document for the user.
</DRAFT>
</REASONING>

<ANSWER>
Here is the first drafted version of your mobile game concept, refined by the expert panel to ensure the math and mechanics work smoothly for a campaign:

### 🎲 Game Title: *Journey of the Six*
**Core Concept:** You do not command a massive, faceless army. You command exactly six legendary dice, each representing a distinct class (1: Pawn, 2: Archer, 3: Hussar, 4: Knight, 5: Tank, 6: Oracle).

#### 1. The Overworld & Deployment Limits
*   **The Campaign Map:** Players navigate a node-based overworld. Each node is a specific tactical puzzle with unique terrain and enemy layouts.
*   **The Pre-Battle Puzzle:** You cannot bring all six dice to every fight. Each map has a strict deployment limit (e.g., "Deploy 3," "Deploy 4," or "Deploy 5"). Because you only have one of each class, choosing your loadout is half the strategy.
    *   *Example:* A map with impassable chasms means you *must* select the Hussar (3) to jump them, leaving your heavy Tank (5) behind.

#### 2. The "Scar" Fatigue System
*   *Expert Correction:* A strict "cannot be used 3 times in a row" rule mathematically breaks the game if a level requires you to deploy 5 out of your 6 dice (some dice will inevitably hit the 3-game limit, preventing you from starting the next level).
*   **The Solution - The Burden of War:** Instead of a hard lockout, we use a "Scar" debuff system.
    *   **Fresh:** Normal stats.
    *   **Fatigued (Used 2 times in a row):** Normal stats, but a visual warning.
    *   **Scarred (Used 3 times in a row):** The unit can still be deployed, but it enters the board with a "Scar" (e.g., -1 Effective Armor, or cannot use its class ability).
    *   **Resting:** Leaving a die out of a battle completely clears its fatigue/scars. This forces players to constantly rotate their squad and sometimes attempt levels with sub-optimal, but fully rested, classes.

#### 3. The Rune System (Consumables)
*   **Acquisition:** As you defeat enemies or land on specific hexes on the campaign map, you acquire Runes.
*   **Equipping:** Before a battle, you can attach these single-use Runes to specific dice in your loadout.
*   **Tactical Depth:** Runes allow you to break the deterministic rules in emergencies.
    *   *Rune of the Aegis:* Negates the first point of damage taken. (Perfect for protecting a "Scarred" unit you were forced to deploy).
    *   *Rune of the Pegasus:* Grants any unit the "Jump" ability for a single turn.
    *   *Rune of the Forge:* Temporarily changes a die's face value to anything you want for one turn, allowing a clutch Oracle swap or Knight diagonal strike.

**The Gameplay Loop:**
Look at the next map node -> See it requires 4 units -> Check your roster (The Archer and Tank are dangerously close to being Scarred) -> Decide to rest them and deploy the Pawn, Hussar, Knight, and Oracle -> Equip the fragile Pawn with a defensive Rune -> Enter the tactical battle.
</ANSWER>