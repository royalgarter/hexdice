# **Hex Dice**

## *Tactical hexagon board game where players command armies of dice, using their values to determine their abilities.*

## ***Foreword***

*In the gaming world, as in life, adaptation is key. This philosophy, coupled with a deep admiration for the strategic depth of titles like Final Fantasy Tactics, the emergent battles of GBA Advanced Wars and Polytopia, sparked an idea of the authors. We yearned for a tactical game where every session felt truly unique, a vibrant tapestry woven from simple, familiar threads.*

*"Why," authors pondered, "should dice merely be tools for chance, or static resources like in Catan? What if the dice were the game?" This became its core principle: **dice for everything**. In Hex Dice, the dice aren't just soldiers on the field; they are the very essence of your army, defining its composition through initial rolls and offering dynamic actions. They even play a role in setting up the battlefield, ensuring each game is a unique setup of terrain and challenges.*

*Hex Dice was born from a desire to meld the simplicity of everyday components with deep strategic possibility, creating a casual yet fiercely tactical experience where your dice are the very essence of your command, and life is adaptation on an ever-changing battlefield.*

## ***Development**: [Source](https://github.com/royalgarter/hexdice) / [Prototype](https://hexdice.phamthanh.me/)*

## *Rep. Author: [Tung “Djinni” Pham Thanh](mailto:royalgarter@gmail.com) / [Google](mailto:royalgarter@gmail.com) / [Github](https://github.com/royalgarter) / [Facebook](https://www.facebook.com/royalgarter) / [Twitter](https://x.com/royalgarter)*

---

## **[v1.1] Tactical Dice Combat on a Hexagonal Grid board game**

![hexdice-board][hexdice-board.png]

### **1. Overview**

Hex Dice is a tactical board game where players command armies of dice, using their face values to determine their unit type, abilities, and movement. Played on a hexagonal map, players maneuver their forces, engage in deterministic combat, and aim to defeat all opponents or capture their base.

### **2. Components**

- 1 Hexagonal Map (R=6 size)
- Standard 6-sided dice: Multiple sets of distinct colors are required, one color per player.
  - For 2 Players: 2 distinct colors (Red/Blue) set of dice. Players can select from the following scenario setups to begin the game.
    - 2 sets of 6 dice each (faster game play).
    - 2 sets of 8 dice each (more tactical depth game play).
  - For 3 Players: 3 sets of 6 dice each (3 distinct colors).
  - For 4 Players: 4 sets of 4 or 5 dice each (4 distinct colors).
  - For 6 Players: 6 sets of 3 or 4 dice each (6 distinct colors).

### **3. Setup**

1.  **Place the Hexagonal Map** in the center of the playground.
2.  **Each player takes the appropriate number of dice** for the player count (in section 2.) and chooses a distinct color.
3.  **Determine Your Army:**
    - Each player rolls all their assigned dice simultaneously.
    - The face values of these dice determine the types of units available to that player for the entire game.
    - The dice are placed showing the rolled value face up.
    - A hex can hold a maximum of one unit at all times.
    - Each player is able to choose ⅓ of maximum dice amount (round down) to reroll after their initial roll once (e.g., 2 players -> 6 dices each -> 2 maximum reroll, 6 players -> 4 dices each -> 1 maximum reroll)
4.  **Base Locations & Deployment:**
    - **2 Players:** The two dark-colored cells on the map are the Base cells for each team. Each player's Base cell is their starting deployment zone. Players deploy their 6 rolled dice units onto *any* empty hexes within their own Base cell or its immediate adjacent hexes. Each hex can initially hold only one unit.
    - **3, 4, or 6 Players:** The 6 hexes furthest from the center ("corner" hexes) are the potential Base locations. Players occupy these corners:
        - **3 Players:** Players choose 3 corners spaced evenly around the map (e.g., skipping one corner between each player).
        - **4 Players:** Players choose 4 corners, ideally spaced for balance.
        - **6 Players:** Players occupy all 6 corner hexes.
        * **Deployment Area:** Each player's deployment area consists of their chosen corner hex and its immediate adjacent hexes that point towards the center of the map. Players deploy their rolled dice units onto any empty hexes within *their* defined Base deployment area. Each hex can initially hold only one unit.
2.  **Determine the first player** (e.g., by rolling a dice , highest roll goes first). In multiplayer games, establish the turn order (e.g., clockwise around the table).

### **4. Dice Soldiers (Unit Types)**

Its face value (1-6) determines each dice unit's capabilities according to the table below. The rolled value is kept face up on the board.

| Dice  | Armor = Dice | Attack = Dice+1 | Attack Range | Distance ≥ 6-Dice | Movement | Notes |
| :---: | :---: | :---: | :---: | :---: | ----- | ----- |
| 1 | 1 | 2 | 0 | 3 | | (Pawn/Infantry) | Gains Momentum. Ignores Dice 6 Armor. |
| 2 | 2 | 3 | 0 | 3 | X (Bishop/Copter) | Melee Attack |
| 3 | 3 | 4 | 0 | 3 | L (Knight/Assault) | Gains Momentum. Jumps over units. |
| 4 | 4 | 5 | 0 | 2 | + (Rook/Cavalry) | Gains Momentum. |
| 5 | 5 | 6 | 2-3 | 1 | * (Archer/Artillery) | Ranged Attack |
| 6 | 6 | 6 | 1 | 0 | 0 (Legion/Engineer) | Special Attack. Buffs adjacent units. |

* **Armor:** Defensive value used in combat.
* **Attack:** The offensive value of a unit. Used to determine combat outcomes against an enemy's Armor.
* **Range:** Ranged/Special attack from current hex.
* **Distance:** The maximum distance (number of steps from the starting point) a unit can move following its shape pattern in a single turn.
* **Movement:** The pattern the unit can follow when moving.

**Dice Visualization Diagram**

#### Hexagon Grid Monospace Diagram

* Each player's primary axis on the board extends from their starting area towards the central hexagon.
* The game grid can be expanded accordingly for larger maps (e.g. 8 hex radius R=8).
* Moveable hex will be marked by + in diagrams below

` + "`" + `` + "`" + `` + "`" + `
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
` + "`" + `` + "`" + `` + "`" + `

#### Dice 1

* Forward: Players can move up to 3 steps straight ahead along their primary axis on the hex grid.
* Backward: Players can move 1 step straight backward along their primary axis on the hex grid.

` + "`" + `` + "`" + `` + "`" + `
                    .
                 .     .
              .     .     .
           .     .     .     .
        .     .     +     .     .
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
` + "`" + `` + "`" + `` + "`" + `

#### Dice 2

* Can move up to 3 steps along the left & right diagonal axes (forming an 'X' or 'diagonal' pattern based on primary axis on a hex grid).

` + "`" + `` + "`" + `` + "`" + `
                    .
                 .     .
              .     .     .
           .     .     .     .
        .     .     .     .     .
     .     .     .     .     .     .
        .     .     .     .     .
     .     +     .     .     +     .
        .     +     .     +     .
     .     .     +     +     .     .
        .     .     2     .     .
     .     .     +     +     .     .
        .     +     .     +     .
     .     +     .     .     +     .
        .     .     .     .     .
     .     .     .     .     .     .
        .     .     .     .     .
           .     .     .     .
              .     .     .
                 .     .
                    .
` + "`" + `` + "`" + `` + "`" + `

#### Dice 3
* Can move 3 steps following an 'L' pattern: 2 steps in a straight line along one of 6 hex axes, then 1 step into an adjacent hex along a different facing outward hex axis.
* Can jump over friendly units: This unit ignores hexes occupied by other friendly units but not enemy units for movement purposes, but cannot end its movement on an occupied hex unless performing combat with enemy units.

` + "`" + `` + "`" + `` + "`" + `
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
` + "`" + `` + "`" + `` + "`" + `

#### Dice 4
* Can move to any adjacent hex (1 step distance).
* Can move up to 2 steps in vertical & horizontal straight-line hex directions (based on primary axis on a hex grid)

` + "`" + `` + "`" + `` + "`" + `
                    .
                 .     .
              .     .     .
           .     .     .     .
        .     .     .     .     .
     .     .     .     .     .     .
        .     .     +     .     .
     .     .     .     .     .     .
        .     .     +     .     .
     .     .     +     +     .     .
        .     +     4     +     .
     .     .     +     +     .     .
        .     .     +     .     .
     .     .     .     .     .     .
        .     .     +     .     .
     .     .     .     .     .     .
        .     .     .     .     .
           .     .     .     .
              .     .     .
                 .     .
                    .
` + "`" + `` + "`" + `` + "`" + `

#### Dice 5
* Can move to any adjacent hex (1 step distance).
* This unit can perform ranged attacks to any single enemy unit located from 2 to 3 hexes away (x in diagram) and could not attack adjacent units.

` + "`" + `` + "`" + `` + "`" + `
                    .
                 .     .
              .     .     .
           .     .     .     .
        .     .     x     .     .
     .     .     x     x     .     .
        .     x     x     x     .
     .     x     x     x     x     .
        .     x     +     x     .
     .     x     +     +     x     .
        .     x     5     x     .
     .     x     +     +     x     .
        .     x     +     x     .
     .     x     x     x     x     .
        .     x     x     x     .
     .     .     x     x     .     .
        .     .     x     .     .
           .     .     .     .
              .     .     .
                 .     .
                    .
` + "`" + `` + "`" + `` + "`" + `

#### Dice 6
* Cannot move except winning combat.
* Any unit adjacent (* in diagram) to Dice 6 has their Armor + 1.

` + "`" + `` + "`" + `` + "`" + `
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
` + "`" + `` + "`" + `` + "`" + `

#### Two-Players Bases
* Player can deploy each single new unit in base or its adjacent hex

` + "`" + `` + "`" + `` + "`" + `
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
` + "`" + `` + "`" + `` + "`" + `

### **5. Gameplay**

The gameplay will proceed with an **Alternating Activations** turn structure (players activating one unit each turn) to enhance player engagement, tactical responsiveness, and balance.

Players take turns in set order. On a player's turn, they activate one of their units currently on the board. Once a unit is activated, it performs one action: **Move, Reroll, Guard, Ranged Attack, or Special Attack**. After the unit completes its action, the turn passes to the next player in order, who then activates one of their units.

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
  * Declare “Activate Guard Mode” to add their Armor + 1
  * The unit stays in its current hex and is given a guard token (could be a mini blue dice, face 1 up), indicating it’s in Guard Mode.
  * Guard Mode is automatically deactivated (remove guard token) if the unit moves next turn.
  * Action complete. This unit cannot Move or Attack this turn.

* ##### **Ranged Attack (Dice 5)**

  * Choose one of your Dice 5 units.
  * The unit stays in its current hex.
  * Target any single enemy unit located **exactly 2 or 3 hexes away** in a straight line along any of the 6 radial axes. Units in adjacent hexes (1 away) or hexes 4+ away cannot be targeted by Ranged Attack.
  * Combat occurs (see Section 6: Combat) between the attacking Dice 5 and the targeted enemy unit.
  * Regardless of the combat outcome, the attacking Dice 5 unit **remains in its current hex**.
  * Action complete. This unit cannot Move or Reroll this turn.

* ##### **Special Attack (Dice 6)**

  * Choose one of your Dice 6 units.
  * Target any single enemy unit located **exactly 1 hex away** along any of the 6 radial axes.
  * Combat occurs (see Section 6: Combat) between the attacking Dice 6 and the targeted enemy unit.
  * If the attack is successful, the Dice 6 **moves into the target hex**. If unsuccessful, **it remains in its original hex**.
  * Action complete. This unit cannot Move or Reroll this turn.

### **6. Combat**

Combat is deterministic and resolved by comparing the attacker's `Attack` value to the defender's `Armor` value.

- **Combat Resolution:**
  - If `Attack > Armor`, the attacker wins, and the defender is removed from the board. The attacker occupies the defender's hex (unless it was a ranged attack).
  - If `Attack == Armor`, **both the attacker and the defender are destroyed** and removed from the board. This is considered a trade.
  - If `Attack < Armor`, the attack fails. The defender is unharmed, and the attacker remains in its original position.

#### **Advanced Combat Rules**

- ##### **Momentum Bonus**
  > If a unit moves its Maximum Distance (or greater than 2 hexes) before attacking, it gains **+1 Attack** for that combat.
  - *Tactical Note:* This rewards aggressive maneuvering. Dice 1, 3, and 4 are the most likely to benefit, allowing them to punch above their weight class.

- ##### **David & Goliath Rule**
  > Dice 1 (Infantry) **ignores the Armor value of Dice 6** (Legion). If a Dice 1 attacks a Dice 6, it is an automatic victory for the Dice 1.
  - *Tactical Note:* This ensures no unit is invincible and that even the mighty Dice 6 must be wary of the humble infantry.

---
