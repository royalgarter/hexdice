# **Hex Dice**

## *Tactical hexagon board game where players command armies of dice, using their values to determine their abilities.*

## ***Foreword***

*In the gaming world, as in life, adaptation is key. This philosophy, coupled with a deep admiration for the strategic depth of titles like Final Fantasy Tactics, the emergent battles of GBA Advanced Wars and Polytopia, sparked an idea of the authors. We yearned for a tactical game where every session felt truly unique, a vibrant tapestry woven from simple, familiar threads.*

*"Why," authors pondered, "should dice merely be tools for chance, or static resources like in Catan? What if the dice were the game?" This became its core principle: **dice for everything**. In Hex Dice, the dice aren't just soldiers on the field; they are the very essence of your army, defining its composition through initial rolls and offering dynamic actions. They even play a role in setting up the battlefield, ensuring each game is a unique setup of terrain and challenges.*

*Hex Dice was born from a desire to meld the simplicity of everyday components with deep strategic possibility, creating a casual yet fiercely tactical experience where your dice are the very essence of your command, and life is adaptation on an ever-changing battlefield.*

## ***Development**: [Source](https://github.com/royalgarter/hexdice) / [Prototype](https://hexdice.phamthanh.me/)*

## *Rep. Author: [Tung “Djinni” Pham Thanh](mailto:royalgarter@gmail.com) / [Google](mailto:royalgarter@gmail.com) / [Github](https://github.com/royalgarter) / [Facebook](https://www.facebook.com/royalgarter) / [Twitter](https://x.com/royalgarter)*

---

## **\[v1.5\] Tactical Dice Combat on a Hexagonal Grid board game**

![Hexagonal Grid board](board.png)


### **1\. Overview**

Hex Dice is a tactical board game where players command armies of dice, using their face values to determine their unit type, abilities, and movement. Played on a hexagonal map, players maneuver their forces, engage in deterministic combat, and aim to defeat all opponents or capture their base.

### **2\. Components**

- 1 Hexagonal Map (R=6 size)  
- Standard 6-sided dice: Multiple sets of distinct colors are required, one color per player.  
  - For 2 Players: 2 distinct colors (Red/Blue) set of dice. Players can select from the following scenario setups to begin the game.  
    - 2 sets of 6 dice each (faster game play).  
    - 2 sets of 8 dice each (more tactical depth game play).  
  - For 3 Players: 3 sets of 6 dice each (3 distinct colors).  
  - For 4 Players: 4 sets of 4 or 5 dice each (4 distinct colors).  
  - For 6 Players: 6 sets of 3 or 4 dice each (6 distinct colors).

### **3\. Setup**

1. **Place the Hexagonal Map** in the center of the playground.  
2. **Each player takes the appropriate number of dice** for the player count (in section 2.) and chooses a distinct color.  
3. **Determine Your Army:**   
   - Each player rolls all their assigned dice simultaneously.   
   - The face values of these dice determine the types of units available to that player for the entire game.   
   - The dice are placed showing the rolled value face up.   
   - A hex can hold a maximum of one unit at all times.   
   - Each player is able to choose ⅓ of maximum dice amount (round down) to reroll after their initial roll once (e.g., 2 players \-\> 6 dices each \-\> 2 maximum reroll, 6 players \-\> 4 dices each \-\> 1 maximum reroll)  
4. **Base Locations & Deployment:**  
   - **2 Players:** The two dark-colored cells on the map are the Base cells for each team. Each player's Base cell is their starting deployment zone. Players deploy their 6 rolled dice units onto *any* empty hexes within their own Base cell or its immediate adjacent hexes. Each hex can initially hold only one unit.  
   - **3, 4, or 6 Players:** The 6 hexes furthest from the center ("corner" hexes) are the potential Base locations. Players occupy these corners:  
     - **3 Players:** Players choose 3 corners spaced evenly around the map (e.g., skipping one corner between each player).  
     - **4 Players:** Players choose 4 corners, ideally spaced for balance.  
     - **6 Players:** Players occupy all 6 corner hexes.  
     * **Deployment Area:** Each player's deployment area consists of their chosen corner hex and its immediate adjacent hexes that point towards the center of the map. Players deploy their rolled dice units onto any empty hexes within *their* defined Base deployment area. Each hex can initially hold only one unit.  
2. **Determine the first player** (e.g., by rolling a dice , highest roll goes first). In multiplayer games, establish the turn order (e.g., clockwise around the table).  
 


### **4\. Dice Soldiers (Unit Types)**

Its face value (1-6) determines each dice unit's capabilities according to the table below. The rolled value is kept face up on the board.

| Dice | Unit | Armor | Attack | Range | Distance | Movement | Notes |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| 1 | **Infantry** | 3 | 3 | 0 | 2 | \| | Balanced Core |
| 2 | **Archer** | 2 | 2 | 2 | 2 | \* | "Quad-2" Sniper |
| 3 | **Knight** | 2 | 3 | 0 | 3 | L | 3-Step Diver; Jump |
| 4 | **Assault** | 2 | 4 | 0 | 2 | X | 4-Attack Crusher |
| 5 | **Tanker** | 5 | 2 | 0 | 1 | \* | 5-Armor Wall |
| 6 | **Balance** | 6 | 2 | 1 | 0 | 0 | 6-Armor Glacier |

* **Armor:** Defensive value used in combat.  
* **Attack:** The minimum Effective Armor value an *enemy* unit must have for this unit to be able to defeat it in combat.  
* **Range:** Ranged/Special attack from current hex.  
* **Distance:** The maximum distance (number of steps from the starting point) a unit can move following its shape pattern in a single turn.  
* **Movement:** The pattern the unit can follow when moving.

**Dice Visualization Diagram**

#### Hexagon Grid Monospace Diagram

* Each player's primary axis on the board extends from their starting area towards the central hexagon.
* The game grid can be expanded accordingly for larger maps (e.g. 8 hex radius R=8).
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

#### Dice 1 (Infantry)

* Forward: Players can move up to 2 steps straight ahead along their primary axis on the hex grid.
* Backward: Players can move 1 step straight backward along their primary axis on the hex grid.

```
                    .
                 .     .
              .     .     .
           .     .     .     .
        .     .     .     .     .
     .     .     .     .     .     .
        .     .     +     .     .
     .     .     .     .     .     .
        .     .     +     .     .
     .     .     .     .     .     .
        .     .     1     .     .
     .     .     .     .     .     .
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

#### Dice 2 (Archer)

* Can move to any adjacent hex (up to 2 steps distance).
* Can perform ranged attacks to any single enemy unit located **exactly 2 hexes away**.

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
        .     x     2     x     .
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

#### Dice 3 (Knight)
* Can move 3 steps following an 'L' pattern: 2 steps in a straight line along one of 6 hex axes, then 1 step into an adjacent hex along a different facing outward hex axis.
* Can jump over friendly units: This unit ignores hexes occupied by other friendly units but not enemy units for movement purposes, but cannot end its movement on an occupied hex unless performing combat with enemy units.

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

#### Dice 4 (Assault)

* Can move up to 2 steps along the left & right diagonal axes (forming an 'X' pattern based on primary axis).

```
                    .
                 .     .
              .     .     .
           .     .     .     .
        .     .     .     .     .
     .     .     .     .     .     .
        .     .     .     .     .
     .     .     .     .     .     .
        .     +     .     +     .
     .     .     +     +     .     .
        .     .     4     .     .
     .     .     +     +     .     .
        .     +     .     +     .
     .     .     .     .     .     .
        .     .     .     .     .
     .     .     .     .     .     .
        .     .     .     .     .
           .     .     .     .
              .     .     .
                 .     .
                    .
```

#### Dice 5 (Tanker)
* Can move to any adjacent hex (1 step distance).

```
                    .
                 .     .
              .     .     .
           .     .     .     .
        .     .     .     .     .
     .     .     .     .     .     .
        .     .     .     .     .
     .     .     .     .     .     .
        .     .     .     .     .
     .     .     +     +     .     .
        .     +     5     +     .
     .     .     +     +     .     .
        .     .     .     .     .
     .     .     .     .     .     .
        .     .     .     .     .
     .     .     .     .     .     .
        .     .     .     .     .
           .     .     .     .
              .     .     .
                 .     .
                    .
```

#### Dice 6 (Balance)
* Cannot move except winning combat.
* Any unit adjacent (* in diagram) to Dice 6 has their Armor + 1.
* Special Attack: Can attack neighbors (Range 1) and move to their hex if successful.

```
                    .
                 .     .
              .     .     .
           .     .     .     .
        .     .     .     .     .
     .     .     .     .     .     .
        .     .     .     .     .
     .     .     .     .     .     .
        .     .     *     .     .
     .     .     *     *     .     .
        .     .     6     .     .
     .     .     *     *     .     .
        .     .     *     .     .
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

Players take turns in set order. On a player's turn, they activate one of their units currently on the board. Once a unit is activated, it performs one action: **Move, Reroll, Guard, Ranged Attack, Special Attack, or Merging**. After the unit completes its action, the turn passes to the next player in order, who then activates one of their units.

Units cannot move through hexes occupied by other units (friendly or enemy) unless the Movement explicitly allows it.

#### **Actions**

* ##### **Move**

  * Choose one of your units.  
  * Determine its valid move destinations based on its current face value, Movement, and Distance.  
  * Choose an empty hex or an enemy-occupied hex within range and reachable by the unit's shape.  
  * If moving to an empty hex, the unit occupies that hex. Action complete.  
  * If moving to an enemy-occupied hex, combat occurs (see Section 6: Combat). If the attacker wins, it moves to the hex. If it fails, it stays in its original hex. Action complete.

* ##### **Reroll**

  * Choose one of your units.  
  * The unit stays in its current hex.  
  * Roll the dice . The new face value determines the unit's type and stats for the rest of the game (or until rerolled).  
  * Action complete. This unit cannot Move or Attack this turn.

* ##### **Guard**

  * Choose one of your units.  
  * Declare “Activate Guard Mode” to add their Armor \+ 1  
  * The unit stays in its current hex and is given a guard token (could be a mini blue dice, face 1 up), indicating it’s in Guard Mode.  
  * Guard Mode is automatically deactivated (remove guard token) if the unit moves next turn.  
  * Action complete. This unit cannot Move or Attack this turn.

* ##### **Ranged Attack (Dice 2\)**

  * Choose one of your Dice 2 Archer units.  
  * The unit stays in its current hex.  
  * Target any single enemy unit located **exactly 2 hexes away** in a straight line along any of the 6 radial axes. Units in adjacent hexes (1 away) or hexes 3+ away cannot be targeted by Ranged Attack.  
  * Combat occurs (see Section 6: Combat) between the attacking Dice 2 and the targeted enemy unit.  
  * Regardless of the combat outcome, the attacking Dice 2 unit **remains in its current hex**.  
  * Action complete. This unit cannot Move or Reroll this turn.

* ##### **Special Attack (Dice 6\)**

  * Choose one of your Dice 6 units.  
  * Target any single enemy unit located **exactly 1 hex away** along any of the 6 radial axes.  
  * Combat occurs (see Section 6: Combat) between the attacking Dice 6 and the targeted enemy unit.  
  * If the attack is successful, the Dice 6 **moves into the target hex**. If unsuccessful, **it remains in its original hex**.  
  * Action complete. This unit cannot Move or Reroll this turn.

### **6\. Combat**

Combat occurs when:

1. A unit uses a Move action to enter an enemy-occupied hex (Melee Combat).  
2. A Dice 2 unit uses a Ranged Attack action on an enemy unit at range (Ranged Combat).  
3. A Dice 6 unit uses a Special Attack action on an enemy unit at range.

Combat is deterministic:

- A unit's Effective Armor value used in combat is its base Armor value (from the Dice Soldiers table) minus the total value of any Armor Reduction tokens currently on it. A unit's Effective Armor cannot go below 0 for combat comparison.  
- Compare the **Attacking** unit's **Attack** value to the **Defending** unit's **Armor** value.  
- If the Attacking unit's **Attack is greater than or equal to** the Defending unit's **Armor** (Attacker.Attack ≥ Defender.Armor), the attack is successful. The Defending unit is defeated and removed from the board.  
  - In Melee Combat, the Attacking unit then moves into the hex vacated by the defeated unit.  
  - In Ranged Combat, the Attacking Dice 2 unit remains in its original hex.  
  - In Special Combat, the Attacking Dice 6 unit moves to its target hex.  
- If the Attacking unit's **Attack is less than** the Defending unit's **Armor** (Attacker.Attack \< Defender.Armor), the attack fails. Both the Attacking and Defending units suffer **Armor \- 1** reduction.  
  - Armor reductions from failed attacks stack cumulatively.  
  - The minimum trackable Armor value is 0\.  
  - If a unit's Armor reaches 0, the next attack it suffers, regardless of the attacker's Attack value, automatically defeats it.  
  - Armor reduction is indicated using Armor Reduction Token (could be another mini red dice) from a value range **from \[-1\] to \[-6\]**.

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

The map is an R=6 hexagonal grid, meaning it extends 6 hexes in any straight direction from the center to the edge. Movement is measured in steps between adjacent hexes. Specific hexes are marked as Base locations for 2-player games, and the corner hexes serve as Base locations for multiplayer games.

### **9\. Development References**

* [https://hamhambone.github.io/hexgrid/](https://hamhambone.github.io/hexgrid/)  
* [https://github.com/kislay707/hexagonGenerator](https://github.com/kislay707/hexagonGenerator)   
* [https://www.redblobgames.com/grids/hexagons/](https://www.redblobgames.com/grids/hexagons/) 

---
