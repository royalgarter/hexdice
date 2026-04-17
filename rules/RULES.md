# **Hex Dice**

## *Tactical hexagon board game where players command armies of dice, using their values to determine their abilities.*

### ***Foreword***

*In the gaming world, as in life, adaptation is key. This philosophy, coupled with a deep admiration for the strategic depth of titles like Final Fantasy Tactics, the emergent battles of GBA Advanced Wars and Polytopia, sparked an idea of the authors. We yearned for a tactical game where every session felt truly unique, a vibrant tapestry woven from simple, familiar threads.*

*"Why," authors pondered, "should dice merely be tools for chance, or static resources like in Catan? What if the dice were the game?" This became its core principle: **dice for everything**. In Hex Dice, the dice aren't just soldiers on the field; they are the very essence of your army, defining its composition through initial rolls and offering dynamic actions. They even play a role in setting up the battlefield, ensuring each game is a unique setup of terrain and challenges.*

*Hex Dice was born from a desire to meld the simplicity of everyday components with deep strategic possibility, creating a casual yet fiercely tactical experience where your dice are the very essence of your command, and life is adaptation on an ever-changing battlefield.*

***Development**: [Source](https://github.com/royalgarter/hexdice) / [Prototype](https://hexdice.phamthanh.me/)*

**Rep. Author: [Tung “Djinni” Pham Thanh](mailto:royalgarter@gmail.com) / [Google](mailto:royalgarter@gmail.com) / [Github](https://github.com/royalgarter) / [Facebook](https://www.facebook.com/royalgarter) / [Twitter](https://x.com/royalgarter)**

![Hexagonal Grid board](board.png)


---


### **1\. Overview**

Hex Dice is a tactical board game where players command armies of dice, using their face values to determine their unit type, abilities, and movement. Played on a hexagonal map, players maneuver their forces, engage in deterministic combat, and aim to defeat all opponents or capture their base.

### **2\. Components**

- 1 Hexagonal Map (**Dynamic Size**: R=5 for 2-3 players, R=6 for 4-6 players)
- Standard 6-sided dice: Multiple sets of distinct colors are required, one color per player.  
  - For 2 Players: 2 distinct colors (Red/Blue), 12 dice each (Total 24).
  - For 3 Players: 3 distinct colors, 8 dice each (Total 24).
  - For 4 Players: 4 distinct colors, 6 dice each (Total 24).
  - For 6 Players: 6 distinct colors, 6 dice each (Total 36).
- **Armor Reduction Tokens**: Small markers (e.g., beads, tokens, or coins) used to track damage to a unit's armor. These help players calculate the current **Effective Armor** of each unit.

### **3\. Setup**

1. **Place the Hexagonal Map** in the center of the playground.  
2. **Each player takes the appropriate number of dice** for the player count (in section 2.) and chooses a distinct color.  
3. **Determine Your Army:**   
   - Each player rolls all their assigned dice simultaneously.   
   - The face values of these dice determine the types of units available to that player for the entire game.   
   - The dice are placed showing the rolled value face up.   
   - A hex can hold a maximum of one unit at all times.   
   - Each player is able to choose ⅓ of maximum dice amount (round down) to reroll after their initial roll once (e.g., 2 players \-\> 12 dices each \-\> 4 maximum reroll, 3 players \-\> 8 dices each \-\> 2 maximum reroll)
4. **Base Locations & Deployment:**  
   - **Deployment Area Scaling:** The deployment area expands based on the number of dice per player:
     - **6 dice or fewer:** The Base cell and its immediate adjacent hexes.
     - **7 to 9 dice:** The Base cell, its adjacent hexes, and two specific offset hexes along the primary axis.
     - **10 to 14 dice:** The Base cell and a full 2-ring expansion around it.
   - **2 Players:** The two far ends of the map along the vertical axis are the Base cells. Players deploy their rolled dice units onto empty hexes within their defined deployment area.
   - **3, 4, or 6 Players:** Corner hexes serve as potential Base locations, with deployment areas extending towards the center based on the scaling rules above.
5. **Determine the first player** (e.g., by rolling a dice , highest roll goes first). In multiplayer games, establish the turn order (e.g., clockwise around the table).
 


### **4\. Dice Soldiers (Unit Types)**

Its face value (1-6) determines each dice unit's capabilities according to the table below. The rolled value is kept face up on the board.

| Dice | Unit | Armor | Attack | Range | Distance | Movement | Notes |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| 1 | **Fencer** | 2 | 2 | 0 | 2 | \* | Balanced All-rounder |
| 2 | **Archer** | 1 | 2 | 2-3* | 1 | \* | Ranged (LoS req). Range 2+ (requires Skirmish) has -1 Atk power. |
| 3 | **Hussar** | 0 | 3 | 0 | 3 | L | Fast Striker (L-shape jump) |
| 4 | **Knight** | 1 | 2 | 0 | 3 | X | Six Diagonal Maneuver (X-shape) |
| 5 | **Tanker** | 4 | 1 | 0 | 1 | \* | Steady Heavy Armor (BFS 1-step) |
| 6 | **Oracle** | 0 | 0 | 2 | 1 | \* | Spells: Shield, Swap, Skirmish; Sacrifice (Anti-stalemate); Engaged: Cannot cast spells |

* **Armor:** Defensive value used in combat.  
* **Attack:** The minimum Effective Armor value an *enemy* unit must have for this unit to be able to defeat it in combat.  
* **Range:** Ranged/Special attack from current hex.  
* **Distance:** The maximum distance a unit can move following its pattern.
* **Movement:** The pattern the unit follows:
    - **`*`**: Breadth-First Search (BFS) movement (any direction, can move through empty hexes).
    - **`L`**: L-shaped jump (2 steps straight, then 1 step offset).
    - **`X`**: Six diagonal movement (only along the six diagonal axes).
    - **`0`**: Stationary (cannot move except when attacking).

**Dice Visualization Diagram**

#### Hexagon Grid Monospace Diagram

* Each player's primary axis on the board extends from their starting area towards the central hexagon.
* Moveable hex will be marked by + in diagrams below

```
                ^
             .     .
          .     |     .
       .     .     .     .
    .     .     |     .     .
 .     .     .     .     .     .
    .     .     |     .     .
 .     .     .     .     .     .
    .     .     |     .     .
 .     .     .     .     .     .
    .     .     |     .     .
 .     .     .     .     .     .
    .     .     |     .     .
 .     .     .     .     .     .
    .     .     |     .     .
 .     .     .     .     .     .
    .     .     |     .     .
       .     .     .     .
          .     B     .
             .     .
                |
```

#### Dice 1 (Fencer)

* Can move up to 2 steps in any direction (BFS pattern).

```
                .
             .     .
          .     .     .
       .     .     .     .
    .     .     .     .     .
 .     .     .     .     .     .
    .     .     +     .     .
 .     .     +     +     .     .
    .     +     +     +     .
 .     +     +     +     +     .
    +     +     1     +     +
 .     +     +     +     +     .
    .     +     +     +     .
 .     .     +     +     .     .
    .     .     +     .     .
 .     .     .     .     .     .
    .     .     .     .     .
       .     .     .     .
          .     .     .
             .     .
                .
```

#### Dice 2 (Archer)

* Can move up to 1 step in any direction (BFS pattern).
* **Ranged Attack**: Can target an enemy exactly **2 hexes away**.
* **Long Range Penalty**: Attacks at range 3 have **-1 Attack power** (minimum attack remains 1).
* **Line of Sight**: Attack is blocked by any unit on the path.
* **Engaged Restriction**: Cannot perform ranged attacks if an enemy unit is in an adjacent hex (unless on TOWER or MOUNTAIN).

```
                .
             .     .
          .     .     .
       .     .     .     .
    .     .     .     .     .
 .     .     .     .     .     .
    .     .     x     .     .
 .     .     x     x     .     .
    .     x     +     x     .
 .     x     +     +     x     .
    x     +     2     +     x
 .     x     +     +     x     .
    .     x     +     x     .
 .     .     x     x     .     .
    .     .     x     .     .
 .     .     .     .     .     .
    .     .     .     .     .
       .     .     .     .
          .     .     .
             .     .
                .
```

#### Dice 3 (Hussar)
* Can move 3 steps following an 'L' pattern: 2 steps in a straight line, then 1 step into an adjacent hex along a different axis.
* Can jump over units.

```
                .
             .     .
          .     .     .
       .     .     .     .
    .     .     .     .     .
 .     .     +     +     .     .
    .     +     ▪     +     .
 .     .     .     .     .     .
    .     ▪     ▪     ▪     .
 .     +     ▪     ▪     +     .
    .     .     3     .     .
 .     +     ▪     ▪     +     .
    .     ▪     ▪     ▪     .
 .     .     .     .     .     .
    .     +     ▪     +     .
 .     .     +     +     .     .
    .     .     .     .     .
       .     .     .     .
          .     .     .
             .     .
                .
```

#### Dice 4 (Knight)

* Can move up to 3 steps along the four diagonal axes (forming an 'X' pattern).
* **Blocked Path**: Movement is blocked by any unit on the path.

```
                .
             .     .
          .     .     .
       .     .     .     .
    .     .     +     .     .
 .     .     .     .     .     .
    .     .     +     .     .
 .     +     .     .     +     .
    .     +     +     +     .
 .     .     +     +     .     .
    .     .     4     .     .
 .     .     +     +     .     .
    .     +     +     +     .
 .     +     .     .     +     .
    .     .     +     .     .
 .     .     .     .     .     .
    .     .     +     .     .
       .     .     .     .
          .     .     .
             .     .
                .
```

#### Dice 5 (Tanker)
* Can move to any adjacent hex (1 step BFS).
* Melee units are eliminated if Armor Reduction from attacking this unit drops their Armor to 0.

```
                .
             .     .
          .     .     .
       .     .     .     .
    .     .     .     .     .
 .     .     .     .     .     .
    .     .     .     .     .
 .     .     .     .     .     .
    .     .     +     .     .
 .     .     +     +     .     .
    .     +     5     +     .
 .     .     +     +     .     .
    .     .     +     .     .
 .     .     .     .     .     .
    .     .     .     .     .
 .     .     .     .     .     .
    .     .     .     .     .
       .     .     .     .
          .     .     .
             .     .
                .
```

#### Dice 6 (Oracle)
* Can move to any adjacent hex (1 step BFS).
* **Spellcast Action**: When activated, the Oracle can cast one of three spells on a **target friendly unit** within **Range 2** (requires Line of Sight):
  * **Shield**: Target unit gains **2 Guard Charges** (+2 Effective Armor, absorbs 2 attacks without Armor Reduction).
  * **Swap**: The Oracle and the target unit **exchange positions** on the board.
  * **Skirmish**: Target unit gains **Hit & Run** status for its next turn.
    * **Effect**: During the next attack, the unit has **-1 Attack strength**, additionally **ranged** unit has **+1 Attack range**,  minimum attack remains **1**.
    * **On Success (Win)**: The target is removed, and the melee attacker **chooses any adjacent empty hex to the target** to move to (this includes staying in their original starting hex).
    * **On Failure (Loss/Tie)**: The melee attacker is **immediately eliminated** from the board.
    * **Duration**: Buff expires after one attack or at the end of the player's next activation.
* **Engaged Casting Limitation**: The Oracle **cannot cast spells when an enemy unit is adjacent** (engaged in melee). This prevents Oracles from safely supporting while in danger and encourages tactical positioning.
* **Oracle Sacrifice (Anti-Stalemate)**: When the Oracle is the **last remaining unit** for its player, it can perform a **Sacrifice** action to eliminate an **adjacent enemy Oracle**. Both Oracles are removed from the game. This mechanic prevents unwinnable stalemates when both players are down to only Oracles.

```
                .
             .     .
          .     .     .
       .     .     .     .
    .     .     .     .     .
 .     .     .     .     .     .
    .     .     .     .     .
 .     .     .     .     .     .
    .     .     +     .     .
 .     .     +     +     .     .
    .     +     6     +     .
 .     .     +     +     .     .
    .     .     +     .     .
 .     .     .     .     .     .
    .     .     .     .     .
 .     .     .     .     .     .
    .     .     .     .     .
       .     .     .     .
          .     .     .
             .     .
                .
```

#### Two-Players Bases
* Player can deploy each single new unit in base or its adjacent hex

```
                R
             R     R
          R     R     R
       .     R     R     .
    .     .     R     .     .
 .     .     .     .     .     .
    .     .     .     .     .
 .     .     .     .     .     .
    .     .     .     .     .
 .     .     .     .     .     .
    .     .     .     .     .
 .     .     .     .     .     .
    .     .     .     .     .
 .     .     .     .     .     .
    .     .     B     .     .
       .     B     B     .
          B     B     B
             B     B
                B
```

### **5\. Gameplay**

The gameplay will proceed with an **Alternating Activations** turn structure (players activating one unit each turn) to enhance player engagement, tactical responsiveness, and balance.

Players take turns in set order. On a player's turn, they activate one of their units currently on the board. Once a unit is activated, it performs one action: **Move, Reroll, Guard, Ranged Attack or Command & Conquer**. After the unit completes its action, the turn passes to the next player in order, who then activates one of their units.

Units cannot move through hexes occupied by other units (friendly or enemy) unless the Movement explicitly allows it (e.g., Dice 3 jump).

#### **Actions**

* ##### **Move**

  * Choose one of your units.  
  * Determine its valid move destinations based on its current face value, Movement, and Distance.  
  * Choose an empty hex or an enemy-occupied hex within range and reachable by the unit's pattern.
  * If moving to an empty hex, the unit occupies that hex. Action complete.  
  * If moving to an enemy-occupied hex, melee combat occurs (see Section 6: Combat). If the attacker wins, it moves to the hex. If it fails, it stays in its original hex. Action complete.

* ##### **Reroll**

  * Choose one of your units that is **standing on its player's Base hex**.
  * The unit stays in its current hex.  
  * Roll the dice. The new face value determines the unit's type and stats.
  * **Penalty**: The rerolled unit has **0 Effective Armor** until its owner's next turn starts.
  * Action complete. This unit cannot Move or Attack this turn.

* ##### **Guard**

  * Choose one of your units that is **not currently guarding**.
  * Activate **Guard Mode** to gain **1 Shield Charge** (+1 Effective Armor).
  * The unit stays in its current hex. The charge absorbs **one attack** without taking Armor Reduction, then expires.
  * **Note**: A unit cannot stack Guard charges manually. Use the Oracle's **Shield** spell to grant **2 charges**.
  * Action complete. This unit cannot Move or Attack this turn.

* ##### **Ranged Attack (Dice 2\)**

  * Choose one of your Dice 2 Archer units.
  * **Restrictions**: Cannot attack if an enemy is adjacent (unless on specialized terrain). Requires clear Line of Sight.
  * Target any single enemy unit located **2 or 3 hexes away** (range 3 requires Archer to be in **Skirmish Buff** or special terrain).
  * **Long Range Penalty**: Attacks at range 3 have **-1 Attack power** (minimum attack remains 1).
  * Combat occurs. Regardless of the outcome, the attacking Dice 2 unit **remains in its current hex** and does not suffer counter-damage on failure.
  * Action complete.

* ##### **Spellcast (Dice 6\)**

  * Choose one of your Dice 6 Oracle units.
  * **Select a Spell**: Choose one of three spells - Shield, Swap, or Skirmish.
  * **Target**: Choose any single **friendly** unit within **Range 2** (requires Line of Sight).
  * **Shield**: Target unit gains **2 Guard Charges** (+2 Effective Armor, absorbs 2 attacks).
  * **Swap**: Oracle and target unit **exchange positions**.
  * **Skirmish**: Target unit gains **Hit & Run** status for its next turn.
    * **Effect**: During the next attack, the unit has **-1 Attack strength**, but minimum attack remains **1**.
    * **On Success (Win)**: The target is removed, and the attacker **chooses any adjacent empty hex to the target** to move to (this includes staying in their original starting hex).
    * **On Failure (Loss/Tie)**: The attacker is **immediately eliminated** from the board.
    * **Duration**: Buff expires after one attack or at the end of the player's next activation.
  * **Restriction**: The Oracle **cannot cast spells** if an enemy unit is adjacent (engaged in melee).
  * Action complete.

* ##### **Oracle Sacrifice (Dice 6\)**

  * **Condition**: Only available when the Oracle is the **last remaining unit** for its player.
  * Choose one of your Dice 6 Oracle units.
  * **Target**: Choose any single **enemy Oracle** in an **adjacent hex**.
  * **Effect**: Both the sacrificing Oracle and the target enemy Oracle are **removed from the game**.
  * **Purpose**: This action prevents unwinnable stalemates when both players are down to only Oracles.
  * Action complete.

### **6\. Combat**

Combat is deterministic and occurs when a unit enters an enemy hex or uses a special/ranged attack.

**Effective Armor calculation:**
`Base Armor + Terrain Bonus + Base Defense Bonus + Guard Charges - Armor Reduction`.

*   **Terrain Bonus**: Units on **FOREST**, **TOWER**, or **MOUNTAIN** gain **+1 Effective Armor**.
*   **Base Defense Bonus**: A unit on its own **Base hex** gains **+2 Effective Armor**.
*   **Guard Charges**: Temporary protection.
    *   **1 Charge** (+1 Armor) from the **Guard** action.
    *   **2 Charges** (+2 Armor) from the Oracle's **Shield** spell.
*   **Armor Reduction**: Cumulative damage. Track this using tokens.

**Combat Resolution:**

1.  **Clearance**: The attacker's Guard Charges are immediately reset to 0.
2.  **Attacker Wins** if one of below conditions matched:
    *   **Armor Depleted**: Defender's `Armor Reduction >= Defender's Base Armor`.
    *   **Attack > Defender's Effective Armor** (if Defender is currently guarding).
    *   **Attack ≥ Defender's Effective Armor** (if Defender is NOT guarding).
3.  **On Success (Win)**: The defending unit is removed. Melee attackers move into the hex.
4.  **On Failure (Loss/Tie)**:
    *   **Attacker**: Melee attackers suffer **1 Armor Reduction** if they have 1 or 0 Guard Charges *remaining after the attack*. Ranged attackers suffer no damage.
    *   **Defender**:
        *   **Standard Units**: Suffer **1 Armor Reduction** unless they have 2 Guard Charges. If they have 0 charges, this damage is lethal if Effective Armor hits 0.
        *   **Tanker (Dice 5)**: Suffer **1 Armor Reduction** only if they have 0 Guard Charges. This damage is not immediately lethal unless Effective Armor drops below 0.
5.  **Post-Combat**: All of the **Defender's** remaining Guard Charges are removed.

### **7\. Winning the Game**

The conditions for winning depend on the number of players:

- **2 Players:** A player wins immediately if either of the following conditions is met during their turn:  
  1. **Annihilation:** All enemy units are removed from the board.  
  2. **Base Capture:** One of your units successfully moves onto the opponent's Base cell. If the Base cell was occupied by an enemy unit, your unit must win the combat to occupy the cell and win.  
- **3, 4, or 6 Players:** The game ends immediately when only one player has units remaining on the board. That player is the winner.  
  - A player is **eliminated** from the game if either of the following conditions is met during *any* player's turn:  
    1. All their units are removed from the board.  
    2. An opponent's unit successfully moves onto and occupies their Base corner hex. If the Base hex was occupied by one of the eliminated player's units, combat occurs first, and the attacking unit must win to occupy the hex and eliminate the player.  
  - Play continues among the remaining players until only one player is left.

### **8\. Map Description**

The map is a hexagonal grid with a dynamic radius:
- **2-3 Players**: R=5 (extends 5 hexes from the center).
- **4-6 Players**: R=6 (extends 6 hexes from the center).

Movement is measured in steps between adjacent hexes. Specific hexes are marked as Base locations for 2-player games, and the corner hexes serve as Base locations for multiplayer games.

#### **Terrain Types**

Each hex on the map has a terrain type that affects movement and combat. By default, all hexes are `PLAIN` terrain unless modified by expansion rules (e.g., v1.2).

| Terrain | Movement Cost | Defense Bonus | Line of Sight | Special Effects |
| :--- | :---: | :---: | :---: | :--- |
| **PLAIN** | 1 | None | Transparent | Default terrain, no effects |
| **FOREST** | 1 | +1 Armor | **Blocked** | Defensive terrain |
| **LAKE** | **Impassable** | N/A | Transparent | Cannot enter or move through |
| **TOWER** | 1 | +1 Armor | **Blocked** | Allow Archer to attack adjacent unit |
| **MOUNTAIN** | 2 | +1 Armor | **Blocked** | Extends Archer range to 1-3, Reduces movement distance by 1 (except Tanker) |

**Terrain Effects Details:**
- **Defensive Bonus**: Units defending on FOREST, TOWER, or MOUNTAIN gain +1 Armor. This stacks with Guard charges.
- **Base Defense**: A unit defending on its own color Base gains +2 Armor.
- **Line of Sight Blocking**: FOREST, TOWER, and MOUNTAIN block ranged attacks and spell targeting. LAKE is transparent to LoS.
- **Movement**: LAKE is completely impassable. MOUNTAIN costs 2 movement steps and reduces max distance by 1 for most units.
- **Archer Ranged Attacks**: Units on TOWER or MOUNTAIN can perform ranged attacks even when engaged by adjacent enemies. TOWER allows range 1-2, MOUNTAIN allows range 1-3.

### **9\. Development References**

* [https://hamhambone.github.io/hexgrid/](https://hamhambone.github.io/hexgrid/)  
* [https://github.com/kislay707/hexagonGenerator](https://github.com/kislay707/hexagonGenerator)   
* [https://www.redblobgames.com/grids/hexagons/](https://www.redblobgames.com/grids/hexagons/) 

---

### **10\. Expansions**

* [v1.0](/rules?path=rules/v1.0.md)
* [v1.0.1](/rules?path=rules/v1.0.1.md)
* [v1.1](/rules?path=rules/v1.1.md)
* [v1.2](/rules?path=rules/v1.2.md)
* [v1.3](/rules?path=rules/v1.3.md)
* [v1.4](/rules?path=rules/v1.4.md)

---
