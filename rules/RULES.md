# **Hex Dice**

### *Tactical hexagon board game where players command armies of dice, using their values to determine their abilities.*

![Hex Dice Introduction](/assets/infographics/hexdice_intro_full.jpg)

<small>

*In the gaming world, as in life, adaptation is key. This philosophy, coupled with a deep admiration for the strategic depth of titles like Final Fantasy Tactics, the emergent battles of GBA Advanced Wars and Polytopia, sparked an idea of the authors. We yearned for a tactical game where every session felt truly unique, a vibrant tapestry woven from simple, familiar threads.*

*"Why," authors pondered, "should dice merely be tools for chance, or static resources like in Catan? What if the dice were the game?" This became its core principle: **dice for everything**. In Hex Dice, the dice aren't just soldiers on the field; they are the very essence of your army, defining its composition through initial rolls and offering dynamic actions. They even play a role in setting up the battlefield, ensuring each game is a unique setup of terrain and challenges.*

*Hex Dice was born from a desire to meld the simplicity of everyday components with deep strategic possibility, creating a casual yet fiercely tactical experience where your dice are the very essence of your command, and life is adaptation on an ever-changing battlefield.*

***Development**: [Source](https://github.com/royalgarter/hexdice), [Printable transparent board](/assets/board.png)*

**Authors: [Tung “Djinni” Pham Thanh](mailto:royalgarter@gmail.com) / [Github](https://github.com/royalgarter) et al.**

</small>

## **1\. Overview**

Hex Dice is a tactical board game where players command armies of dice, using their face values to determine their unit type, abilities, and movement. Played on a hexagonal map, players maneuver their forces, engage in combat, and aim to defeat all opponents or capture their base.

**Players can choose one of two Gameplay Versions before starting:**
- **Version 1 (Decisive Dice):** Strategic, deterministic combat with armor tracking and alternating activations.
- **Version 2 (Destiny Dice):** Fast-paced, explosive turns with "Fate" rolls, probabilistic combat, and risk of fumbles.

## **2\. Standard Components**

- 1 Hexagonal Map (**Dynamic Size**: R=5 for 2-3 players, R=6+ for 4-6 players)
- Standard 6-sided dice: Multiple sets of distinct colors are required, one color per player.
  - For 2 Players: 12+ dice each.
  - For 3 Players: 12+ dice each.
  - For 4 Players: 8+ dice each.
  - For 6 Players: 6+ dice each.
- **Armor Tokens (Version 1 Only)**: Small markers (e.g., tiny-dice, beads, tokens, or coins) used to track damage to a unit's armor.
- **Combat Die (Version 2 Only)**: One common 6-sided die (`1D6`) to resolve attacks and spells.


## **3\. Setup**

Players should consense on the rule version and any modifiers that fit the theme of the playground (e.g., combat version, or enabling features like Reroll, Merge, and Terrain). The rulebook serves as a standard guideline rather than a strict requirement.

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

## **4\. Dice Soldiers (Unit Types)**

Its face value (1-6) determines each dice unit's capabilities according to the table below. The rolled value is kept face up on the board.

![Units](/assets/infographics/hexdice_units.png)

|  Dice |    Unit    | Armor | Attack| Range | Distance | Movement | Notes |
| :---: |   :---:    | :---: | :---: | :---: |   :---:  |   :---:  | :---: |
|   1   | **Fencer** |   2   |   2   |   0   |     2    |    `*`   | Balanced All-rounder (BFS 2-step). |
|   2   | **Archer** |   1   |   2   |   2   |     1    |    `*`   | BFS 1-step. Ranged (LoS req). Range 2+ (requires Skirmish) has -1 Atk power. |
|   3   | **Hussar** |   0   |   3   |   0   |     3    |    `L`   | Fast Striker (L-shape jump). |
|   4   | **Knight** |   1   |   2   |   0   |     3    |    `ж`   | Six Diagonal Maneuver (six-star shape). |
|   5   | **Tanker** |   4   |   1   |   0   |     1    |    `*`   | Heavy Reflected Armor. (See Section 6 for combat details). |
|   6   | **Oracle** |   0   |   0   |   2   |     1    |    `*`   | Spells: Shield, Swap, Skirmish; Transmute (Sacrifice); Engaged: Cannot cast spells. |

- **Rule of thumb - Rule of Six:** Each dice should have total value of base stats `Armor`, `Attack`, `Range`, `Distance`, `Spells` equals 6.
- **Armor:** Defensive value used in combat.
- **Attack:** Unit's offensive power (Base Attack).
- **Range:** Ranged/Special attack from current hex.
- **Distance:** The maximum distance a unit can move following its pattern.
- **Movement:** The pattern the unit follows:
	- **`*`**: Breadth-First Search (BFS) movement (broadcast maximum n-steps to any direction, can move through empty hexes).
	- **`L`**: L-shaped jump (2 steps straight, then 1 step offset, knight-like in traditional chess).
	- **`ж`**: Six diagonal movement (only along the six diagonal axes).

### **Hexagon Grid & Dice Monospace Visualization Diagram**

- Each player's primary axis on the board extends from their starting area towards the central hexagon.
- Moveable hex will be marked by `~` in diagrams below
- Target-able hex will be marked by `x` in diagrams below

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

- All-round Balanced Unit.
- Can move up to 2 steps in any direction (BFS pattern).

```
                .
             .     .
          .     .     .
       .     .     .     .
    .     .     .     .     .
 .     .     .     .     .     .
    .     .     ~     .     .
 .     .     ~     ~     .     .
    .     ~     ~     ~     .
 .     ~     ~     ~     ~     .
    ~     ~     1     ~     ~
 .     ~     ~     ~     ~     .
    .     ~     ~     ~     .
 .     .     ~     ~     .     .
    .     .     ~     .     .
 .     .     .     .     .     .
    .     .     .     .     .
       .     .     .     .
          .     .     .
             .     .
                .
```

#### Dice 2 (Archer)

- Ranged Unit that can move up to 1 step in any direction (BFS pattern).
- **Ranged Attack**: Can target an enemy exactly **2 hexes away**. Can not perform melee adjacent hex attack.
- **Line of Sight**: Attack is blocked by any unit on the path.
- **Engaged Restriction**: Cannot perform ranged attacks if an enemy unit is in an adjacent hex (unless on TOWER or MOUNTAIN).
- **Long Range Penalty**: Attacks at extra-range 3 (with special buff or terrain) have **-1 Attack power** (minimum attack remains 1).

```
                .
             .     .
          .     .     .
       .     .     .     .
    .     .     .     .     .
 .     .     .     .     .     .
    .     .     x     .     .
 .     .     x     x     .     .
    .     x     ~     x     .
 .     x     ~     ~     x     .
    x     ~     2     ~     x
 .     x     ~     ~     x     .
    .     x     ~     x     .
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

- Special Unit that can move 3 steps following an `L` pattern: 2 steps in a straight line, then 1 step into an adjacent hex along a different axis.
- Can jump over units (could not be blocked).

```
                .
             .     .
          .     .     .
       .     .     .     .
    .     .     .     .     .
 .     .     ~     ~     .     .
    .     ~     ▪     ~     .
 .     .     .     .     .     .
    .     ▪     ▪     ▪     .
 .     ~     ▪     ▪     ~     .
    .     .     3     .     .
 .     ~     ▪     ▪     ~     .
    .     ▪     ▪     ▪     .
 .     .     .     .     .     .
    .     ~     ▪     ~     .
 .     .     ~     ~     .     .
    .     .     .     .     .
       .     .     .     .
          .     .     .
             .     .
                .
```

#### Dice 4 (Knight)

- Flanking Maneuver Unit that can move up to 3 steps along the six diagonal axes (forming an six-star pattern).
- **Blocked Path**: Movement is blocked by any unit on the path.

```
                .
             .     .
          .     .     .
       .     .     .     .
    .     .     ~     .     .
 .     .     .     .     .     .
    .     .     ~     .     .
 .     ~     .     .     ~     .
    .     ~     ~     ~     .
 .     .     ~     ~     .     .
    .     .     4     .     .
 .     .     ~     ~     .     .
    .     ~     ~     ~     .
 .     ~     .     .     ~     .
    .     .     ~     .     .
 .     .     .     .     .     .
    .     .     ~     .     .
       .     .     .     .
          .     .     .
             .     .
                .
```

#### Dice 5 (Tanker)

- Heavy Counter Armor Unit that can move to any adjacent hex (1 step BFS).
- **Reflected Damage (V1 Only)**: During Guarding, melee attackers are eliminated if their Effective Armor drops to 0 or less after a failed attack against this unit.

```
                .
             .     .
          .     .     .
       .     .     .     .
    .     .     .     .     .
 .     .     .     .     .     .
    .     .     .     .     .
 .     .     .     .     .     .
    .     .     ~     .     .
 .     .     ~     ~     .     .
    .     ~     5     ~     .
 .     .     ~     ~     .     .
    .     .     ~     .     .
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

- Strategic Spellcaster Unit that can move to any adjacent hex (1 step BFS).
- **Spellcast Action**: When activated, the Oracle performs a spellcast based on the selected **Gameplay Version** (See Section 5).
  - **Shield**: Target friendly unit within Range 2 gains **2 Guard Charges** (+2 Effective Armor).
  - **Swap**: The Oracle and a target friendly unit within Range 2 **exchange positions**.
  - **Skirmish**: Target friendly unit within Range 2 gains **Hit & Run** status for its next turn.
	- **Effect**: During the next attack, the unit has **-1 Attack strength**, additionally **ranged** unit has **+1 Attack range**,  minimum attack remains **1**.
	- **On Success (Win)**: The target is removed, and the melee attacker **chooses any adjacent empty hex to the target** to move to (this includes staying in their original starting hex).
	- **On Failure (Loss/Tie)**: The melee attacker is **immediately eliminated** from the board.
	- **Duration**: Buff expires after one attack or at the end of the player's next activation.
- **Engaged Casting Limitation**: The Oracle **cannot cast spells when an enemy unit is adjacent** (engaged in melee). This prevents Oracles from safely supporting while in danger and encourages tactical positioning.
- **Transmute (Sacrifice)**: The Oracle can perform a forbidden art to convert an enemy if the player only has Oracle unit(s) left, losing its own life in the chaotic process.
  - **Target**: One adjacent enemy unit.
  - **Effect**: The Oracle is removed from the board. Remove the target enemy die and replace it with your own new one. You must immediately **Reroll** this new die to determine its new unit type.
  - **Penalty**: The newly created unit suffers the standard Reroll penalty (**0 Effective Armor** until the start of your next turn) and **cannot act this turn**.
```
                .
             .     .
          .     .     .
       .     .     .     .
    .     .     .     .     .
 .     .     .     .     .     .
    .     .     x     .     .
 .     .     x     x     .     .
    .     x     ~     x     .
 .     x     ~     ~     x     .
    x     ~     6     ~     x
 .     x     ~     ~     x     .
    .     x     ~     x     .
 .     .     x     x     .     .
    .     .     x     .     .
 .     .     .     .     .     .
    .     .     .     .     .
       .     .     .     .
          .     .     .
             .     .
                .
```

#### Two-Players Bases
- Player can deploy each single new unit in base or its adjacent hex

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

## **5\. Gameplay**

Players can choose one of two Gameplay Versions before starting:
- **Version 1 (Decisive Dice):** Strategic, deterministic combat with armor tracking and alternating activations.
- **Version 2 (Destiny Dice):** Fast-paced, explosive turns with "Fate" rolls, probabilistic combat, and risk of fumbles.

### **Version 1: Decisive Dice (Alternating Activations)**
The gameplay proceeds with an **Alternating Activations** turn structure. On a player's turn, they activate **one** unit to perform one action: **Move, Reroll, Guard, Ranged Attack, or Spell Cast**.

### **Version 2: Destiny Dice (Fate's Call)**
Each turn is divided into two explosive phases:
1. **Phase 1: Fate's Call.** The active player rolls `1D6`. **All** friendly units on the board matching that face value immediately perform a free **Move** action.
2. **Phase 2: Tactical Command.** Choose exactly **one** friendly unit (even one that moved in Phase 1) to perform any standard action: **Move, Attack, Guard, or Spell**.

---

### **Standard Actions**

- #### **Move**
  - Choose one of your units and determine its valid destinations.
  - If moving to an enemy-occupied hex, combat occurs (see Section 6).
  - If moving to an empty hex, the unit occupies it.

- #### **Reroll**
  - Choose a unit on its owner's **Base hex**.
  - Roll the dice to determine its new type.
  - **Penalty**: The unit has **0 Effective Armor** until its owner's next turn starts.

- #### **Guard**
  - Activate **Guard Mode** to gain **1 Shield Charge** (+1 Effective Armor).
  - The charge absorbs one attack without taking Armor Reduction, then expires.
  - Cannot stack manually.

- #### **Ranged Attack (Dice 2)**
  - Target an enemy **2 or 3 hexes away** (range 3 requires Skirmish buff or terrain).
  - **Restrictions**: Requires Line of Sight. Cannot attack if an enemy is adjacent (unless on TOWER or MOUNTAIN).

- #### **Spellcast (Dice 6)**
  - **Version 1 (Choice):** Choose a spell (Shield, Swap, or Skirmish), then choose a friendly target within Range 2.
  - **Version 2 (Channel First):** Roll the Combat Die `1D6` first to see what the gods grant:
    - **1 or 4**: **Shield** (+2 Guard Charges)
    - **2 or 5**: **Swap** (Oracle and target unit exchange positions)
    - **3 or 6**: **Skirmish** (Grants Hit & Run buff)
    - After the spell is revealed, the Oracle chooses a valid target. If no target is valid, the spell fizzles.
  - **Restriction**: Oracle cannot cast spells if an enemy unit is adjacent.

- ##### **Transmute (Sacrifice)**
  - Choose an adjacent enemy unit.
  - Both Oracle and target are removed; a new unit from reserve is placed and rerolled.
  - **Penalty**: New unit has **0 Effective Armor** and cannot act this turn.

## **6\. Combat**

### **Version 1: Deterministic (Decisive Dice)**

Effective Armor is calculated as: `Unit Armor + Terrain Bonus + Guard Charges - Armor Reduction`.

1. **Attacker Wins** if:
   - Defender's Armor Reduction >= Unit Armor OR
   - Attack Strength >= Defender's Effective Armor (if NOT guarding) OR
   - Attack Strength > Defender's Effective Armor (if guarding).
2. **On Success**: Defender is removed. Melee attacker moves in.
3. **On Failure**:
   - Melee attacker suffers **1 Armor Reduction**.
   - Defender suffers **1 Armor Reduction** (unless it has 2 Guard Charges).

### **Version 2: Probabilistic (Destiny Dice)**

Effective Armor is calculated as: `Unit Armor + Terrain Bonus + Guard Charges`.

1. **The Math**: `Total ATK = (Unit Base ATK + Combat Die Roll) / 2` (Always round up).
2. **The Clash**:
   - If `Total ATK > Defender's Effective Armor`: Defender is destroyed.
   - If `Total ATK <= Defender's Effective Armor`: Attack is deflected.
3. **The Fumble**: If the attack is deflected AND the Combat Die roll was a **`1`**, the **Attacker is destroyed**!


## **7\. Winning the Game**

The conditions for winning depend on the number of players:

- **2 Players:** A player wins immediately if either of the following conditions is met during their turn:
  1. **Annihilation:** All enemy units are removed from the board.
  2. **Base Capture:** One of your units successfully moves onto the opponent's Base cell. If the Base cell was occupied by an enemy unit, your unit must win the combat to occupy the cell and win.
- **3, 4, or 6 Players:** The game ends immediately when only one player has units remaining on the board. That player is the winner.
  - A player is **eliminated** from the game if either of the following conditions is met during *any* player's turn:
	1. All their units are removed from the board.
	2. An opponent's unit successfully moves onto and occupies their Base corner hex. If the Base hex was occupied by one of the eliminated player's units, combat occurs first, and the attacking unit must win to occupy the hex and eliminate the player.
  - Play continues among the remaining players until only one player is left.


## **8\. Terrains**

Each hex on the map has a terrain type that affects movement and combat. By default, all hexes are `PLAIN` terrain unless modified by expansion rules.

![Terrains](/assets/infographics/hexdice_terrain.png)

| Terrain | Movement Cost | Defense Bonus | Line of Sight | Special Effects |
| :--- | :---: | :---: | :---: | :--- |
| **PLAIN** | 1 | None | Transparent | Default terrain, no effects |
| **FOREST** | 1 | +1 Armor | **Blocked** | Defensive terrain |
| **LAKE** | **Impassable** | N/A | Transparent | Cannot enter or move through |
| **TOWER** | 1 | +1 Armor | **Blocked** | Allow Archer to attack adjacent unit |
| **MOUNTAIN** | 2 | +1 Armor | **Blocked** | Extends Archer range to 1-3, Reduces movement distance by 1 (except Tanker) |

**Terrain Effects Details:**
- **Base Defense**: A unit defending on its own color Base gains +2 Armor.
- **Defensive Bonus**: Units defending on FOREST, TOWER, or MOUNTAIN gain +1 Armor. This stacks with Guard charges.
- **Line of Sight (LoS) Blocking**: FOREST, TOWER, and MOUNTAIN block ranged attacks. LAKE is transparent to LoS.
- **Movement**: LAKE is completely impassable. MOUNTAIN costs 2 movement steps and reduces max distance by 1 for most units.
- **Ranged Attacks**: Units on TOWER or MOUNTAIN can perform ranged attacks even when engaged by adjacent enemies. TOWER allows range 1-2, MOUNTAIN allows range 1-3.

<div align="center">
	<a href="/" style="
		background-color: #896648;
		color: white;
		padding: 1rem 2rem;
		text-decoration: none;
		text-transform: uppercase;
		font-size: 1.5rem;
		font-weight: bold;
		border-radius: 0.3rem;
		display: inline-block;
	">🎲 Start New Game ⚔</a>
</div>

## **9\. Development References**

### Hexagon grid:

- [https://hamhambone.github.io/hexgrid/](https://hamhambone.github.io/hexgrid/)
- [https://github.com/kislay707/hexagonGenerator](https://github.com/kislay707/hexagonGenerator)
- [https://www.redblobgames.com/grids/hexagons/](https://www.redblobgames.com/grids/hexagons/)

---

## **10\. Expansions**

![Red vs Blue](/assets/infographics/red_n_blue.jpg)

- [v1.0](/rules?path=rules/v1.0.md)
- [v1.1](/rules?path=rules/v1.1.md)
- [v1.2](/rules?path=rules/v1.2.md)
- [v1.3](/rules?path=rules/v1.3.md)
- [v1.4](/rules?path=rules/v1.4.md)
- [v1.5](/rules?path=rules/v1.5.md)
- [v1.6](/rules?path=rules/v1.6.md)
- [v1.7](/rules?path=rules/v1.7.md)
- [v1.8](/rules?path=rules/v1.8.md)
- [v2.0](/rules?path=rules/v2.0.md)

---
