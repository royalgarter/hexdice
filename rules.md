# **Hex Dice**

## *Tactical hexagon board game where players command armies of dice, using their values to determine their abilities.*

## ***Foreword***

*In the gaming world, as in life, adaptation is key. This philosophy, coupled with a deep admiration for the strategic depth of titles like Final Fantasy Tactics, the emergent battles of GBA Advanced Wars and Polytopia, sparked an idea of the authors. We yearned for a tactical game where every session felt truly unique, a vibrant tapestry woven from simple, familiar threads.*

*"Why," authors pondered, "should dice merely be tools for chance, or static resources like in Catan? What if the dice were the game?" This became its core principle: **dice for everything**. In Hex Dice, the dice aren't just soldiers on the field; they are the very essence of your army, defining its composition through initial rolls and offering dynamic actions. They even play a role in setting up the battlefield, ensuring each game is a unique setup of terrain and challenges.*

*Hex Dice was born from a desire to meld the simplicity of everyday components with deep strategic possibility, creating a casual yet fiercely tactical experience where your dice are the very essence of your command, and life is adaptation on an ever-changing battlefield.*

## ***Development**: [Source](https://github.com/royalgarter/hexdice) / [Prototype](https://hexdice.phamthanh.me/)*

## *Rep. Author: [Tung “Djinni” Pham Thanh](mailto:royalgarter@gmail.com) / [Google](mailto:royalgarter@gmail.com) / [Github](https://github.com/royalgarter) / [Facebook](https://www.facebook.com/royalgarter) / [Twitter](https://x.com/royalgarter)*

---

## **\[v1.0\] Tactical Dice Combat on a Hexagonal Grid board game**

![][image1]

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

| Dice  | Armor \= Dice | Attack \= Dice+1 | Attack Range | Distance ≥ 6-Dice | Movement | Notes |
| :---: | :---: | :---: | :---: | :---: | ----- | ----- |
| 1 | 1 | 2 | 0 | 3 | | (Pawn/Infantry) | Melee Attack |
| 2 | 2 | 3 | 0 | 3 | X (Bishop/Copter) | Melee Attack |
| 3 | 3 | 4 | 0 | 3 | L (Knight/Assault) | Melee Attack Jump over units |
| 4 | 4 | 5 | 0 | 2 | \+ (Rook/Cavalry) | Melee Attack |
| 5 | 5 | 6 | 2-3 | 1 | \* (Archer/Artillery) | Ranged Attack |
| 6 | 6 | 6 | 1 | 0 | 0 (Legion/Engineer) | Special Attack Cannot Move |

* **Armor:** Defensive value used in combat.  
* **Attack:** The minimum Armor value an *enemy* unit must have for this unit to be able to defeat it in combat.  
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

#### Dice 1

* Forward: Players can move up to 3 steps straight ahead along their primary axis on the hex grid.
* Backward: Players can move 1 step straight backward along their primary axis on the hex grid.

```
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
```

#### Dice 2

* Can move up to 3 steps along the left & right diagonal axes (forming an 'X' or 'diagonal' pattern based on primary axis on a hex grid).

```
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
```

#### Dice 3
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

#### Dice 4
* Can move to any adjacent hex (1 step distance).
* Can move up to 2 steps in vertical & horizontal straight-line hex directions (based on primary axis on a hex grid)

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
```

#### Dice 5
* Can move to any adjacent hex (1 step distance).
* This unit can perform ranged attacks to any single enemy unit located from 2 to 3 hexes away (x in diagram) and could not attack adjacent units.

```
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
```

#### Dice 6
* Cannot move except winning combat.
* Any unit adjacent (* in diagram) to Dice 6 has their Armor + 1.

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

* ##### **Ranged Attack (Dice 5\)**

  * Choose one of your Dice 5 units.  
  * The unit stays in its current hex.  
  * Target any single enemy unit located **exactly 2 or 3 hexes away** in a straight line along any of the 6 radial axes. Units in adjacent hexes (1 away) or hexes 4+ away cannot be targeted by Ranged Attack.  
  * Combat occurs (see Section 6: Combat) between the attacking Dice 5 and the targeted enemy unit.  
  * Regardless of the combat outcome, the attacking Dice 5 unit **remains in its current hex**.  
  * Action complete. This unit cannot Move or Reroll this turn.

* ##### **Special Attack (Dice 6\)**

  * Choose one of your Dice 6 units.  
  * Target any single enemy unit located **exactly 1 hex away** along any of the 6 radial axes.  
  * Combat occurs (see Section 6: Combat) between the attacking Dice 6 and the targeted enemy unit.  
  * If the attack is successful, the Dice 6 **moves into the target hex**. If unsuccessful, **it remains in its original hex**.  
  * Action complete. This unit cannot Move or Reroll this turn.

#### **\[v1.1\] Merging**

* Merging counts as the moving unit's action for the turn.  
* A unit performing a **Move** action (called **Merg Unit**) must move to a hex currently occupied by a single friendly unit (called **Target Unit**). This action is called Merging.  
* **Resulting Unit:**  
  * Sum the face values of the two friendly units (the moving unit \+ the occupying unit).  
    * If the sum is **6 or less**, the two units merge into a single new unit with a face value equal to the sum. This new unit is placed on the hex. The new unit formed by the merging cannot perform any further actions this turn.  
    * If the sum is **greater than 6** (e.g., 7, 8, 9, 10, 11, 12), the merging units create a more potent force. The player chooses *any* desired face value from **Dice 1 through Dice 6** (Dice 1, Dice 2, Dice 3, Dice 4, Dice 5 or Dice 6\) for the single new unit. This new unit is placed on the hex. **And if the Target Unit did not act last turn**, the new unit may immediately perform one action (Move, Guard, or Ranged/Special Attack).   
  * The new unit (whether based on sum \<= 6 or chosen from 1-6) uses the stats (Attack, Armor, Range, Distance, Movement) corresponding to its new face value from the Dice Soldiers table.  
  * Both original units are removed from the board immediately upon merging, replaced by a single new unit.  
* Merging counts as the moving unit's action for the turn that initiates the merge.

### **6\. Combat**

Combat occurs when:

1. A unit uses a Move action to enter an enemy-occupied hex (Melee Combat).  
2. A Dice 5 unit uses a Ranged Attack action on an enemy unit at range (Ranged Combat).  
3. A Dice 6 unit uses a Special Attack action on an enemy unit at range.

Combat is deterministic:

- A unit's Effective Armor value used in combat is its base Armor value (from the Dice Soldiers table) minus the total value of any Armor Reduction tokens currently on it. A unit's Effective Armor cannot go below 0 for combat comparison.  
- Compare the **Attacking** unit's **Attack** value to the **Defending** unit's **Armor** value.  
- If the Attacking unit's **Attack is greater than or equal to** the Defending unit's **Armor** (Attacker.Attack ≥ Defender.Armor), the attack is successful. The Defending unit is defeated and removed from the board.  
  - In Melee Combat, the Attacking unit then moves into the hex vacated by the defeated unit.  
  - In Ranged Combat, the Attacking Dice 5 unit remains in its original hex.  
  - In Special Combat, the Attacking Dice 6 unit moves to its target hex.  
- If the Attacking unit's **Attack is less than** the Defending unit's **Armor** (Attacker.Attack \< Defender.Armor), the attack fails. The Defending unit remains on its hex but with armor reduction effect (Armor \- 1).  
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

## **\[v1.2\] Extended Terrain**

*Version 1.2 introduces the larger R=8 map option and rules for random terrain generation.*

### **1\. Overview**

Hex Dice is a tactical board game where players command armies of dice, using their face values to determine their unit type, abilities, and movement. Played on a hexagonal map, players maneuver their forces, engage in deterministic combat, and aim to defeat all opponents or capture their base. Version 1.2 adds rules for playing on a larger R=8 map with variable terrain.

### **2\. Components**

* 1 Hexagonal Map (Either R=6 or R=8 size)  
  * R=6 map: As described in v1.0, with two marked Base cells.  
  * R=8 map: A larger hexagonal map extending 8 hexes in any straight direction from the center to the edge. It should have 6 designated "corner" hexes for multiplayer bases and potentially marked neutral terrain cells or zones for terrain placement.  
* Standard 6-sided dice: Multiple sets of distinct colors, one color per player, *plus* additional dice specifically for terrain generation.  
  * For 2 Players (R=6 map): 6 Red Dice, 6 Blue Dice.  
  * For 3 Players (R=6 or R=8 map): 3 sets of 4 dice each.  
  * For 4 Players (R=6 or R=8 map): 4 sets of 3 dice each.  
  * For 6 Players (R=6 or R=8 map): 6 sets of 3 dice each.  
  * For Terrain Generation (R=8 map only): 6 standard D6 dice.  
* Terrain Layout Presets (Either R=6 or R=8 size)

### **3\. Setup Terrain**

Each map could have some variations of preset terrain layout to choose from. Each game could be chosen from Terrain Preset, Terrain Roulette or Terrain Generation method to set up terrain. 

1. **Terrain Preset Map:** If multiple pre-designed terrain layouts are available, players agree on a method to randomly select one layout from the available options (e.g., roll a dice  against a numbered list of layouts, draw a card). Place terrain layout onto the map according to the selected layout.  
2. **Terrain Roulette:**  
   * **Step a: Determine the Number of Terrain Cells:**  
     * Roll all 6 terrain D6 dice.  
     * Sum the results of these 6 dice. This sum is the total number of terrain hexes that will be placed on the map. (Minimum 6, Maximum 36).  
   * **Step b: Determine the Location of Each Terrain Cell:**  
     * The location phase begins in roulette (clockwise), each player places one terrain cell in their wish on valid hex, then passes to the next player’s placing.  
     * The valid terrain hex location is not the R=0 center hex, is not one of the 6 Base corner hexes, and does not already contain a terrain hex.  
         
3. **Terrain Generation (R=8 Map Only):** If using the R=8 map, terrain could be added randomly *before* deployment. Follow these three steps using the extra set of 6 dice:  
     
   * **Step a: Determine the Number of Terrain Cells:**  
     * Roll all 6 terrain D6 dice.  
     * Sum the results of these 6 dice. This sum is the total number of terrain hexes that will be placed on the map. (Minimum 6, Maximum 36).

     

   * **Step b: Determine the Location of Each Terrain Cell:**  
       
     * **For each** terrain hex determined in Step 3a, roll **4 standard D6** dice consecutively to determine it.  
       * **Roll 1 (Direction)**: Result 1-6. This selects one of the 6 main radial directions emanating from the center of the map (arbitrarily assign 1 to 6 to these directions).  
       * **Roll 2 (Distance)**: Result 1-6. Map this result to a distance from the center: 1-\>3 steps, 2-\>4 steps, 3-\>5 steps, 4-\>6 steps, 5-\>7 steps, 6-\>8 steps. The hex located this many steps from the map center along the chosen Direction is the Anchor Hex.  
       * **Roll 3 (Scatter)**: Result 1-6. This selects one of the 6 directions around the Anchor Hex (assign 1 to 6 to adjacent directions). Move 1 step from the Anchor Hex in the Scatter direction. This is the potential location for the terrain hex.  
       * **Roll 4 (Terrain)**: Result 1-6. This selects the terrain type for the target hex: 1 or 2 \-\> Forest, 3 or 4 \-\> Lake, 5 \-\> Tower, 6 \-\> Mountain.  
     * **Placement Check**: The potential terrain hex location is only valid if it is not the R=0 center hex, is not one of the 6 Base corner hexes, and does not already contain a terrain hex.  
       * If the location is valid, place a marker for the terrain hex there.  
       * If the location is invalid (R=0, Base, or already occupied by terrain), ignore this specific result. Do NOT re-roll for a new location; this potential terrain hex is simply not placed.   
     * Proceed to roll for the next terrain hex determined in **Step a**

   

After finishing the Terrain Setup, each player rolls one standard D6 dice. The player with the highest roll chooses their starting corner hex first. The player with the next highest roll chooses second, and so on, in descending order of their roll. (In case of ties, tied players reroll their dice until the tie is broken).

### **4\. Terrain Rules (R=8 Map Only)**

Terrain hexes are placed on the map during setup for R=8 games. A hex can only contain one terrain type. Units may move onto and occupy terrain hexes unless the terrain type explicitly makes the hex impassable. Units on terrain may gain benefits or suffer penalties as described below.

* **Forest:**  
  * **Movement:**   
    * Costs 1 movement step to enter or exit a Forest hex (normal).  
  * **Combat:**   
    * A unit defending while on a Forest hex gains **\+1 to its Armor** value against all attacks (melee or ranged).   
    * Forest hexes block line of sight for Ranged Attacks (Dice 5).  
* **Lake:**  
  * **Movement:**   
    * Lake hexes are **impassable**.   
    * Units cannot enter or move through Lake hexes.  
  * **Combat:**   
    * Units cannot occupy Lake hexes, so they cannot participate in combat from or on them.   
    * Lake hexes do not block line of sight for Ranged Attacks.  
* **Tower:**  
  * **Movement:**   
    * Costs 1 movement step to enter or exit a Tower hex (normal).  
  * **Combat:**   
    * A unit defending while on a Tower hex gains **\+1 to its Armor** value against all attacks.   
    * This bonus stacks with the Armor bonus gained from the Guard action.   
    * Tower hexes block line of sight for Ranged Attacks.  
    * A Dice 5 unit performing a Ranged Attack *from* a Tower hex can target enemy units located **1 (added melee), 2, or 3 hexes away** in a straight line.  
* **Mountain:**  
  * **Movement:**   
    * Costs 2 movement steps to enter or exit a Mountain hex. Dice 1, Dice 2 & Dice 4 are reduced maximum movement distance by 1\. Dice 5 is not affected by this cost. Dice 6 is still able to move on Mountain hex by winning a combat.  
    * Mountain hexes are impassable to Dice 3 units due to their movement style restriction.   
    * Mountain hexes block line of sight for Ranged Attacks (Dice 5).  
  * **Combat:**   
    * A unit defending while on a Mountain hex gains **\+2 to its Armor** value against all attacks.   
    * This bonus stacks with the Armor bonus gained from the Guard action.  
    * A Dice 5 unit performing a Ranged Attack *from* a Mountain hex can target enemy units located **2, 3, or 4 (extra range) hexes away** in a straight line. It still cannot target units 1 hex away.

### **5\. Gameplay**

Gameplay proceeds as described in Version 1.0. Players activate their units (Move, Reroll, or Ranged Attack for Dice 5). Movement rules are modified by terrain movement costs. Combat rules are modified by terrain defensive bonuses and Dice 5 range modifications from specific terrain types.

### **6\. Map Description**

The R=8 map is a larger hexagonal grid with 6 corner hexes serving as player Bases. Terrain hexes are placed randomly during setup according to the terrain generation rules, affecting movement and combat for units occupying or interacting with them. The R=0 center hex and the 6 Base corner hexes can never contain terrain.

---

## **\[v1.3\] Fog of War (FoW) / Single Player Mode**

To enhance the experience for single-player, integrating an AI opponent and a Fog of War (FoW) mechanic adds layers of excitement, exploration, and strategic depth. This refinement focuses on creating an engaging, yet "casual," single-player experience.

### **1\. Fog of War Mechanics**

The map will initially be obscured, with only the player's starting deployment area fully visible. The rest of the board is shrouded in "fog," concealing terrain and enemy units until explored.

* **Vision Range:**  
  * All **Dice 1, 2, 3, 4, 6** units have a base vision range of **2 hexes**. This means they reveal their current hex, all immediately adjacent hexes (1 step away), and all hexes 2 steps away.  
  * **Dice 5** units have an extended vision range of **3 hexes**. They reveal their current hex, all immediately adjacent hexes, and all hexes 2 or 3 steps away.  
  * Dice in Forest have vision range reduce by 1  
  * Dice on Mountain have vision range increase by 1  
* **Line of Sight (LoS):** Vision follows line of sight. Any hex containing **Forest, Tower, or Mountain** terrain (as per v1.2 rules) blocks LoS. This means a unit's vision will be obstructed if there's a blocking terrain hex between it and a hex it would normally see.  
* **Hidden Information:**  
  * **Unexplored Hexes:** Initially appear as unknown territory. When any of a player's units moves onto or adjacent to an unexplored hex, its terrain type (or lack thereof) is permanently revealed on the map.  
  * **Hidden Units:** Enemy units (AI or player) outside of a player's combined vision range are hidden. Their exact type and location are unknown. When an enemy unit comes into any of your units' vision range, it becomes visible, revealing its exact type and location.  
  * **Ghosting (Optional, for added tactical depth):** When an enemy unit moves *out* of a player's vision range, its last known position can be marked with a "ghost" token or marker. This indicates that an enemy *was* there, but its current presence or type is unknown. The ghost marker disappears if the hex is later revealed to be empty, or if a different unit is revealed there. This adds an element of tactical guesswork. (For a simpler "casual" experience, units simply disappear when out of vision).  
* **Initial Map Setup:** The game begins with the entire R=8 map (or R=6 map) under fog, except for each player's chosen Base deployment area, which is fully revealed. Terrain is generated (as per v1.2) *before* the game starts, but remains hidden by the fog until revealed.

### **2\. AI Opponent (Bot) Design**

The AI will operate with a simple, predictable logic to provide a challenging yet fair opponent for a "casual" game. The AI will generally adhere to the FoW rules, meaning it will also operate on limited information.

* **AI Vision:** The AI's units have the same vision rules and ranges as the player's units. The AI will make decisions based *only* on the hexes and enemy units currently revealed to *its* combined units' vision. The AI will always know the type and location of its *own* units.  
* **AI Army Generation:** The AI's army is generated identically to the player's (initial roll \+ 1/3 reroll), ensuring fairness at setup. The AI's reroll logic could be simple: always reroll its lowest dice values (1s, then 2s) first, with a slight preference to try and get a Dice 5 or 6 if it doesn't have one.  
* **AI Decision-Making (Priority List):** The AI will activate its units one by one, following a simple priority list:  
  1. **Threat Elimination:** If a visible enemy unit is within attack range and the AI can win the combat (Attacker.Attack ≥ Defender.Armor), it will attack. It prioritizes attacking weaker units or units that pose a significant threat (e.g., Dice 5/6).  
  2. **Objective Advance:** If no immediate threats, the AI will move its units (especially stronger ones or those needed for merging) towards the player's last known Base location or towards the center of the map to gain central control. If the player's Base has not yet been revealed, it moves towards a predetermined general direction from its starting corner.  
  3. **Exploration:** If a unit has no clear attack or objective path, it will move into adjacent fogged hexes to reveal new areas, prioritizing hexes that open up new lines of sight or reveal potential enemy positions.  
  4. **Merging:** If two friendly units are adjacent and can merge to create a more powerful or tactically advantageous unit (especially if the sum is \> 6 to choose a Dice 5 or 6), the AI will perform a Merge action. It might have a simple preference for creating Dice 5 or Dice 6 units.  
  5. **Guard:** If a valuable AI unit is exposed, visible to an enemy, and cannot attack, the AI will activate Guard Mode for that unit.  
  6. **Reroll (Situational):** If a unit is in a safe position (not visible to enemies, or well-defended) and is a low value (e.g., Dice 1 or 2), the AI may use its action to Reroll, aiming for a higher-value unit.

### **3\. Integration with Existing Gameplay**

* **Movement:** Units can move into fogged hexes. Upon entering a fogged hex, that hex and all hexes within the unit's vision range become revealed.  
* **Attacks (Ranged & Special):** Units (Dice 5, Dice 6, or Melee) can *only* target enemy units that are currently *visible* within their attack range. Attacking into the fog is impossible. This emphasizes the importance of scouting and revelation.  
* **Merging:** Merging units must be controlled by the same player/AI and be visible to each other. The FoW mechanic does not prevent merging.  
* **Winning Conditions:** The single-player winning conditions for the player remain as defined for 2-player games: Annihilation of all AI units, or successfully moving onto and occupying the AI's Base cell. The AI wins if it achieves the same against the player.

### **4\. Enhancing Excitement & Replayability:**

* **Exploration:** The FoW adds a strong element of exploration and discovery, making each game feel different as players uncover the map and locate the AI's forces.  
* **Surprise Encounters:** Moving into the fog and suddenly revealing an enemy unit creates tactical tension and requires on-the-fly decision-making.  
* **AI Personality:** While the AI is simple, its predictable logic allows players to learn its "habits" and strategize against them, adding a layer of meta-gameplay.  
* **Terrain Impact:** The random terrain generation (even with its current flaws) becomes more impactful, as players won't know the full layout until they explore, creating varied strategic challenges.

---

## **\[v1.4\] Terraform Ability**

### **Dice 6 (Legion/Division)**

* **Armor:** 6  
* **Attack:** 6  
* **Range:** 0 (No Ranged Attack)  
* **Movement:** 0 (Cannot move *normally*)  
* **Notes:** Special Combat Mobility; Terraform Ability; Adjacent units gain \+1 Armor.

On a player's turn, when a Dice 6 unit is activated, it can perform **one** of the following actions:

1. #### **Special Attack (Melee Attack with Conditional Movement as v1.0)**

     
   * **Action:** The Dice 6 unit targets a single enemy unit located exactly **1 hex away** (adjacent) along any of the 6 radial axes.  
   * **Combat:** Combat occurs as normal (see Section 6: Combat).  
   * **Conditional Movement:** If the Dice 6 unit **wins** the combat (Attacker.Attack ≥ Defender.Armor), the defending unit is removed, and the Dice 6 unit **immediately moves into the vacated hex**.  
   * **Failure:** If the Dice 6 unit fails the combat (Attacker.Attack \< Defender.Armor), the defending unit remains on its hex with armor reduction, and the Dice 6 unit remains in its original hex.  
   * **Note:** This action allows the Dice 6 to advance only by actively defeating an adjacent enemy.

   

2. #### **Terraform**

     
* **Action:** The Dice 6 unit initiates a terrain alteration on an adjacent hex.  
* **Target:** An adjacent hex (1 step away) that contains **no unit**. It cannot target a Base hex.  
* **Effect (Initiation):**  
  * The player declares which operation they are performing:  
    * **If the target hex is a Clear hex:** It will become a **Forest** hex.  
    * **If the target hex is a Forest, Lake, or Tower hex:** It will become a **Clear** hex.  
  * Place an **"Under Construction" token** (or marker) on the target hex.  
  * The target hex retains its **current terrain properties** for the remainder of this turn and the opponent's turn.  
* **Completion (After one full round):**  
  * At the **start of Player A's *next* turn** (the turn immediately following the opponent's turn), the "Under Construction" token is removed.  
  * The terrain of the hex **permanently changes** to the new type (Forest or Clear) as declared during the initiation phase.  
  * The Dice 6 unit is **fully active** on this turn and can take any action.  
* **Restriction:** The Dice 6 unit **cannot change Mountain hexes** with this ability.

---

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAksAAAKvCAMAAABNtnukAAADAFBMVEUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACzMPSIAAAAPHRSTlMAGuWGanhSRMwmNDgqFaRu0nPFSZW9Zbj5qFYHCsERgVnqHdicTQ2gsJh8jTxgiuDvkrT03CGtXS4xP/32q8BgAABCxUlEQVR4Xu2d+1cTWdb3K4EASQgXERQNEGJzkRZbsWkB///Vzpq1Zr2r+xnfaZ3HdsTpt9sbIiJgvLy5FFB1cqry3XtXHUjYnx+6q3agClOnztlnXz1PURRFURRFURRFURRFURRFURRFURRFURRFURRFURRFURRFURRFURRFURRFURRFURRFURRFURRFURQOGVOgeN6s97zxP/+7+db8r3HS+r8SJGsKFM/7kG/+bzbT4GZLFjqpjPs/qQTQeamdH389MkUm6wOf/m7KLjx9pkCZ+/qXKWrjj+yXN6bswqNrnMl6ecQUWfhPadAUXXj6TcGF5/3hf0yRjf6O66CiKIqiKIqiKEmxYAoU5YQJUxDHtSFTcrFRW2WQoaMvpiiGvYHvB3ZN4QVGbZUBRiufTFEsHzOkeazX0bF0yuw81WX75lvBFClKneW7pqQjozOm5AKjPpRThujKz656UhQbraglGmoWUBLjqkaAKQnRN2xKFEVRlHOC2r1b3Bp4b4oUhcOq2onkqN27SfalKVHI6FhqciiyOU6ZgouJjqUG+ZopIfFSc1KUY5AspjgumQJFYVLMlk3RBeRCrHHNUgAZ39mR2QwcBz8QsL80Ods6Ct0pfNL6fw9zIcbSdPOZXm2dZF6cHoc+kPD067XWwe3A8Gkdz/snP7T+ryjxLI+akjYy6rhTAAaQLIJpU9BrXIg1rhMby6aESAExmx9orFNXszBmSqyUi6aEhC5fF4GhAVNi54opICEbiT1Db69xcJJS7b4pobBvCi4mPZ07MHsJDeHep+RYKnZ6On6pWvuHKYrgS2Fsx5Qpyrmml3Mze1tfOn90tml2Lz29xrlgaXDPFMUii2451+i8JKT0hymJ5YPULHqO0bF0ynVTgECd2H+7ZUqU807le1PSkat08/V1+rs4850p6RXo30WXsE/vfvOmZEo68ueSKenIe7WSdxmsJKUbZO9rjhHhtjRnSnqEXp2XspyxdLBtSjpRo89+3kgZtcYr54E5+trTYM2J+WdFmqqguORB1ZRAFCqmJBVypkBRFEVRzhUFP41JUaSsmQJF4aEdLEx60L70U8WUkOjze313IPft0BRRgLKglDNmAEs9iaScRbyvGYbzLsQytcfB+af34r0LH00JjRdTnduAe17+lTBCfHxIg4LPPfIAoUuipBQUehzDeaf79KVmwYeMX6OmVbTk+KTBhnCJ81pJKa27WAqWhD6QUPMLgMXdyf9RpWu576Q0V76zm2dUzQ7dzo9OSgYipSqG/Eo83UH3rXGdmJNuJ+b2gEKoq7xAhFMmkOymYldFp3TVWIJiq1/PLJoiEutlJCTk15Jw8oIyhd8I96Ru6aqxBKnV+3uykI73L/5uimz0yQox9688M0U2aPlSCgw4Rkp3Nk0RgTI0+dWZFA2mfmSJU9LiO/Qpw5VyZGC+FuUcspWF89cGyDkAHNT607VMiNYURVG6p9uK1BijpM36wN6BKVPOP46U9tumJJ4bpuCc0lX2pbSBy1uKKB6+NUXxIFZNJT0GGXm7s2TD1OwIw0x0haxXkH/hbOiSeemuKejE0e6KKerIROZnU9SB5xl6tFSl9tkUdWKGXjTjLOiOsdRPK5jVoDa+boo68e2NKenI7iNT0pHL9ArOfX5/HkXO95dNCYKbxkigY0fG+E+m5DzSDfPSxhAQBNLOV1OQChMuzN87j51sMC8APzFTNmSxJyB9wnwUjIEJU6KwgH26iqIoChE40qEr6Qbd2wGs8pZkhr+4UNTPDB1LTbIvTUkalN4wylt2Dz0+lvrAApSHLKvDMWBUyMKBqIGFk6w9Ced9LFWIPnWDwXmo4FYeST2J5iWWk7LNcN4F+Ez3CrnlvI+lvv+aEhIfM5ArKwelnkQDlX8fXaF7goLU3nbO9FUiqT4QJxuCi5yMYtYvaZAuP2yZknPFGc9L4cIMzUITwQ8OXohDCncHzLu0Hcs3V/tLl2IunNRdvK//aq3Y0VdP4i5szngsTTS/B9+wPfF/T7+U1gcz/zn9US71r3+6ebGrrfPgcegDCU93Zv0r+4LmsfVEwK/vWhcpNa/nt8IInzDdTQpCGanyJmbZyVIKNCyYWTUl7jjjeSl9Lv2PKUmBgWe7pigFqm872xRmev6B2rgCbX6k79lPUHyRzPBQv4spsCEtvLsFBWRVr4q3K1zObBj3laD4QuF7tvC486tc5y00riPJQNGVf1RkC+ETKCDraUG8Xek28ldBY4msC2QFjCG7YgpIgCNx8w5kOI1C6xdEMIIacatOpmxH5U7JKRBdhWwJ4TMJLQt1nkIKjxSospaYvW8yL4piA/JsKIpyxpQ2TIkTzmqNU1KkH9rxKQTA7ZWMJSdlk/tpWuMYuH1Nlh6el3KQAUtKSRZIgrE4QxtLH89Ex+/dsVQlp5SxIvudJFzl9mjFmT9dvSA+3j562Q5GHy9CectjGG28rtPfRYZXiNEf7Ht60Yxu5B4W0RoCcniFYJRMziFtJcKAjQuDDEJutRAMR15m3pSkD/29ElNjxOlnqQap0jd6ZkmtQK6/m/2XKenI0aEfa4TD2JZ92zYl6eN+LBU5vUUfUueyvdemBOCA/ABqjCSlkTLVLcSpVve5Ykp6EJ4bdd7JBn9N5skHAULaEqBbqlwKGKDOMIqiKIqinED0ODApiCLbULBQZiUlFh0p6qYgDdzo6cng3ibAB3RYbpReCzxxw2tgItsNUZ/Ay6Apa/+9KaGQc+LhORMmhblqmCmbW97SBzRlM4zkQQYwW7Zw01tNII30nCLLA6hPooiLjeG7C1HOIiM+w3DehcB8bNISY04Ux7NgGFw9IoE6Ww6AS2EkU5OmxEIB+VPi2LxjSiyUWIXNg5CDJboE2argNaZs4WSA4SgpxRSkAraUJkOSunerBENr8sm0Fy25Lw7QevqmdHwxv0aN5eT0x7k0klJa17KUEgl9IKFWsN4leJzAXVb8pfR6+9VPPmgdXDTuOnmZ7zup5pcHk01lAB3xikmFpyQ5L6VO4R2U0S3li8CkgDP21JSkAdARb19k3AiQ0FiCyqLNShe55e3HpqidOXrYZpi5PSDAanXJlBCZQL6MLek+DqrHdHQ2KVBRYGuP1FIMKZLFeVkflPUHULOwH4Wmn6GKKbEh3a5gSecJxfMmMy9tYnaMR8L8H8g1sr+H/TFRvH8BFULtwwynUfSvPDNFNvZkinHhnSmxQg8OTQ/QiFt/zWSPGWQ8ofcsnlvJvIYdyJ7vcqfJMwY6l/BKOTKAzUsCYL4WIZDhtIcgdF3sc6LmDaBjW4Rs+UG5LdP+uo0pJwNEUZSuQLgtbeBEgUwAsdUIYkHqsYUoOYlvm6SNjgQ8nd0ylspOAmK3nYylcsWUpAGx4fUbtOhjNN0ylnZceBxGAY+DnOLhW1OUBlST+biTLXbCcGZ4chjOIPWrrDN7Z9MUdWB2BPGEGFwhL9fkX6hDTjSfk3qFxPPS5hI109+bJA8MzyOnWh/t0ufsiczPpqgDzzN0s2il9tkUdWIGcneGyNNWuDr/GUJ8d3FIx9LbfrKX+Qt5YHCSlGrjkFstyLc3pqQju2g54FMu06MQ9uhBMDn6r9QSUL8lMIoJyb2vIPTaNBzoo5wBwRosgFGyKkGYFv7LWFiBEM4wp3PVifnbTQFKKJ4+LaCUjXZKHGWSjpPZr8/JyjDA0DHpVN08FzvSJCVFUZR2znKFxJhmlUWjMpl30Sqrr49RLpDMgJPmLu1IbQLpc+mDKUmB1SG6PYDO8KSTp8ywnybCuR9LRSepJ1l6pVQGpTd00xqdcSd7Dgv8sST7ixdHoODt+rsMpJ5E0wcWoDwkm4mDgKHfCwei9wK0Ppaq/Gfa8ApR/Uin8O9bFG0gH3/E9tIV0dfvDc5D8QV5jo/wlJdYeMe2bPH5jHmFBg8fmiICzzM7pih9xF3UJ5BCr+uyh9zw15oSG9IdCOSunZINpfpfiZhgBpE/JY4FYZ0YBmjqSTRwm1QR0iEPUczSva8MfnCSlML210SucaHqCJn1tsoGjJgOg9pb8y5txwn4J3YHHNxlf+lSzIWTuov3dTvmyond5ZFfyj7uTv6PgoxlG/hKTeikeRw5BgnUp7bLzWv503LrJHgsna8b1BeGa82L+TmwwePQBxIGZ2a9TODPbx3bTkT8WPRuNK/lP+7gSegDEb6Tdap5QT9zK3gyNX+JHGiUMltOHPllnsuQiFh7hHBTCBXYSNy21hjjvy1iDeGJCxuwd+l/TEkKDDzbNUUpUH0r29SCAMaawxLwQ01uIsMkcw/b1EeCKZKsAKkAP0HxRbdNARFIXb0m3K5g83j1qmyZK2ehYQIau0DTWw76AiOBNrjoFxgJuMEtQ99fJBnstRIuhJPYayVcCG9jqe2g5oBWa4SrCFjJgWkP2JCLogLGkPGaRx0DjsTNO5DhNArsIdeVcFGsU464R4vnR1MQAVzdRERVNmWDOCp3ipVDElJB15+kade9V1AH2KeKbM7GeAopPFIa5U7TZ++b1PSN8MzJN4ZQICdWKYqiiMD2aIrSkVtnmgJ1zMZNJzZ4cHslY0lYgxODkWzKoGA1Z0dipkC1694OePcnOdmXQY6eIMug9IcpSYHFGSdjaZlmV//fScyuBjK8zDBH0BMH75J/o/2t6Qz5FzyGzjDASE/dvEedxzfWqL/hcQxTcSFo5Iuh5usgjIRmRh8vRkIzo3PPdfq8zvAKYf3BQnxPW64aMDrixazvDEP2dXrq7j1GeUv68JskzxicLxNsXBhkkO4VYhiFF+dNSSdYjrzoVYnxNzNKCnAcqRvUKZvVee0G+WXieByWyBY8xgpPr9lU5CzxkYyyekzIAywROEODjNSTj7H+gDEB0KmYApfM3mFZ+IHQqQRw1NrbhVdI6skHidOLU2dc5MVWFEVRlHNB7sSMSrePiFiqmJI0cORxcKITXHGiKI7EWIo6MMjZlycAw7bCYNGRom4K0sCNng7lUEeRqC2hrrZjY5NuiwoBmlk2yB6HIMNroMmIbowKchn8bbItKkQOe879shBl46neortCgpTumRIrdBt5GMyU/RPd4xAENGUzjORBwABnocGletWUWBHO40aAM8PjEAJ7fLIBWx+LiIuN4bsLUYZGfIbhvAuB+dikhmBMcRQaggdDytaq9G/G1h9w9YgEcv0PQH9KDNBKXED+lDg2kQIsLE9QCMhbL9EJ2pA2tea58shUpZMBhqOkFFOQCk6eS4DyFemrXFffluvvarN+QeuvDx6HTyTMjuX90hh+arHl5PSn2WSveVea1/Lf6uBJ6AMR9Zkt17yYP8UFj0MfSGgE+NxqXqx13jr2s55CJwnRD6VjxzJUMSVpcNfJy3w/2W83gjyYbCrDTRvrZHFibCm4aaQiX/ERZPtAFHofKT5JLAl1Fv9lSizMsuIQAixvA3mg4m6qc3tAIdRVabe1CeTL2JLuiUrIbrHECE4MMZno5IetPdLJC9K4pF2g1h9AzcKkkxemFEgnLyzpXDh5HesEycxLm5gd4xHf69MEMqnt72F/TBTvX/zdFNnok1nk+leemSIbezIzSuGdKbHyp2xe+eIk4cdkWvaYQcaF7xnGrWReww5k5dsiAJGrYL1tHpeuzBD5qz20ecF8LUIgw6kYkQvzRHM8ebkOZXM2xsErF3fxvso8oiDIdkPMy2mZ9ofxsCZortFuBTsf2eFKT3CzfXwpCg9uFEUS/oSOiK1GEAtO3qeSk/i2SaHRgk5gM1LjKfP3XXRe88pOAmK3nYylcsWUpMEQYHFNluDG9lHgGMdJdT5v56kpSYHRiosWmsXDt6YoDcgb87PXl+kByeRf8Bjr6CD5q2wkm1J7p82OIJ4QA6ipUwjyL3iM4N4pjlcoZFeXGtzWx2k1e+pMkgeG55G3rEe79C5QE5mfTVEHnmfoZtFK7bMp6sQMUrw/TJ68wr0cYihY/zQFAq5zFAz6izkFeU/CzJHfM04COJgCcAqn7WGJXBqG9VzIgdpYc75UkXpfQZzkT4ER1UIYJasYkEtWGeFkxvi9m3VQ/a/WP/LKlKXAlJN+zFMuHJuH+18dbHG2b7wg6RKF/sO4lkJg/xAhJfIix8LJ7NfnJAR9gKFj0qnSnkuxg1LgxpOv9CJtOtqYizlb6UVMm8CHvgySathkAcv8FjLtZBHhGCro9NEWESZOIm4g8P33kDBMEgML/xUiTzZFGL4qC5MEcaLzWjDnJc97iS5yoyt/mKIUKJJtoRyyTvZ8pTekfRKTcSd7DgvtYwlldl4SDLY4Ak5/w0DqSTR9HbYaxxySzcRBQBvfwoHovQCz9kpV/jNteIVAP5JlTeLfdyLz0RQRePwRU4Mqoq/fG5yH4gs4xugALzHvwzbDeRfgM+YVGjx8aIoIPM/smCIrq0muSYPgGx8JVD9qXfaQUTN/226WCOQVmpINJbDHwyDyp8QBmRjpDqp0GcHeMyHSIQ9RPC5pkC5Y63QpgL8mb80htI7ia4dvj+vbtJRFy4lci6y9jblw6AMJuwOf0r/L/s3ci+gLJ3UX7+t2zJUTu8ujzDfbXYLHqzu2WDervvRHdcsbzTTwFeTQSfPYv5mEg3cNpauBv8S0ToLH0rWnQV1hmm5ezK+RFjwOfSDh6c6sf2Vf0Dy2ngj49UrRqzav5WcwB09CH0j4UNcrbjQv5udTBf/85geVo+3TH++AI7e0E0d+GTa9Slh2spTS4w45ABuJ23CNsZuIPXsU+aE4IPPggjTVcBippLlBj2gLM4aEMd1FfigOqCze+JwpIQIVQrX+kG2N+w2JR36fwzb1kWSRsfRkiN5tLcTKL6bEwkOp12HxiSmx8Be+MFjZKiJxJ+NHss495a8fTJGFz6ipBjO95WQLIbTBFS+E0Aa3/gWChtMIMthrJVwIJ7HXSrgQ3sZS20HNAU0thyb2SHJgZQFsyEVRAWcc25SNA47EzTuQ4TQK7CFzWp0G4XTEkwOWqBZSlU3ZII7KnWLlkIRUQGdL4tj0JZBPFdmcjfHUSXDePqKKiNn7JjV9Izxz8o0piqKcQ7A9mqJ0pFOVpSkna+3GTXSvKALcXslYsgTyJI+jjniwObtJvO30OtRXRgzWV0aKk6/f+9EUpMHivAulndq6Or6/EDkeeXiZ+ht1xkCjzyl3yb/R6a2xQf4Fj6EzDDC8QpvkcpIba9Tf8DiGqbgQNPqrDJqvgzA8x4w+XuSE5vqbFPea2blOt6nMYObrIIx5/HvactWAUcstZn1nGLIZqyK50IIHxWcZkAstsL5MsHFhEEafWIZReHHelHSiepVhFY5elRgrCaNoMCfAYIM6ZbM6r9HbnnI8DktkTz7nuViDHOMocpb4hEHc/XI4Q4PMNcYEQGf9AWMCoFMxBd0A6KSV0U9eSjkUKqYkFehqKYObjClTURRFUZRTcicr9ol9ZNKJQrJUMSVp4MjjIIpsQ7nixBM0EmMp6sBg+76cblthwLCtMFicd/L9SzsrQggjbkGgHOoo2mwJdJtbkPH2sWmDbosKAZpZRA2svOE1cP9DN0YFuQz+NtkWFSLX9pytWLNKcIynKmysV0Iyh+oLqnAdxUzZosZ6sCmbYSQPAgY4A7lqcVSxNFLhPG4EODM8DiGwx0f33YWBXGwM312IMjTi433kAJiPTWoIxhRHoSF4MKRszYqD2qH1B1w9IoFc/wPQnxIDtBIXkD8ljk2kAAvLExQCcv1LdIIUwKZsIVXpZIDhKCnFFKSCk+eSMP3L9Xc126D11wePwycSZsfyXvNaxzVqLCenP80me8270ryW/1YHT0IfiKjPbLnmxfwpLngc+kBCI8DnVvNirfPWsZ/1FDo5PwxVTEkaGE0TUuK+k28378SP6aaNdYskXuMGK89MSQoU3qFp7CK+oNVfRYy56IjnOemI55PQWFpE6qDOSoOWl7eBQqjibqpze0Ah1FVpkb0J5MvYku7jSshuscQITgwxGZr8RmU2MVCRlFqKIY1L2gVq3Vo/r40fhaYfTCmQGbGMXoGRCEsGmTqBbCwNIsNfaKqvaximwE6J3J4ySBlVeGUmuX5kWvKkJrkJbI4WmuTapmjha4bhpnPPuPA9wxC6CkCybsqdYnOBnfW2eVy6MkPkr/bQ5gXztQiBDKdiRC7Mk2np5OU6FE3ZIAevXNzF+ypbsUGQ7YaYl9My7Q/jYU1QfrddKbjlxNirKIrigiT8CR0RW40gFtrn6xQoOYlvm3Symwoi34zcf2NK0qDsJCB228lYKldMSRoMARbXZJGPJSfV+bwdFx6HUSceh+IhUvNaDHljjgSHpQs9IJn8Cx5jHR0kf5WNnk5UI+fsCGhyDAI1dQpB/gWPYXyeajM5AoTs6qF5qUoPVlsfJ7tbOa1tyVvWo116F6iJzM+mqAPPM3SzaKX22RR1YobeBSpPXuFeDjEUrH+aglPuUF+z6xwFg/5i4j2AT6G3OKNVsmoBpgCcwml7WCKXhmE9F7JXKLY536jU+woh9b6COMmfAiOqhTBKVjEgl6yKDydz09r7cuzfkBT0mlkcyKX0WNBL6XGA4ulPKcQ3oJ2QeYxBSuRFjoWT2a/PSQj6AEPHpFOlPZdiB6XgOyevmaIoMoj6yAViAcv8FjLtZBHhGCro9NEWESZOdCsLErv39mtTkgaXkN54UlaHXHiChiedOAmohp2kEIyl0ZU/TFEKFMm2UA7Zl6YkDUpvyDZXBuNO9hwW+GNpdl4SDLY4Apofh4HUk2j6Omw1jjkkm4mDgDa+hQPRewFm7ZWq/Gfa8AqBfiSL8ch2X8yVM5H5aIoIPP6IqUEV0dfvDcabQI7hGKMDvMS8D9uyxecz5hUaPHxoigg8z+yYIiur4JoEuWsHwTc+EigpZR35U+KINfOfQLPRtQN5haZkQwns8TCI/ClxQC2KcQeVNPcLYwR7z4RIhzxE8bikQbr84CYpxRS0k7fmEFpH8evi0XF9m5ayaDmRa5G1tzEXDn0gYXfgU/p32b+ZexF94aTu4n3djrlyYnd5lPlmu0vweHXnUesHQtj0Je9ZdcsbzTTwFeTQSfPYv5mEg3cNpauBv8S0ToLH0rWnQV1hmm5ezK+RFjwOfSDh6c6sf2Vf0Dy2ngj49UrRqzav5WcwB09CH0j4UNcrbjQv5udTBf/85geVo+3TH++AI7e0E0d+GanyJmbZyVIKKbJiAAXnNlxj7CZizx5FfiiOVSTycUGaajiMVNLcoEe0hRlDwpjuIj8UB+TGH58zJUSgQqjWH7Ktcb8h8cjvc9imPpIsMpaeDAkjR1Z+MSUWHkq9DotPTImFv/CFwcpWEbGajx+BZRciKH9F/AyfUVMNZnrLyRZCaIMrXgihDW79CwQNpxFksNdKuBBOYq+VcCG8jaW2g5oDmloOTeyR5MDKAtiQi6ICzji2KRsHHImbdyDDaRTYQ+a0Og3C6YgnByxRLaQqm7JBHJU7xcohCamAzpZzxaaTB+DEoul9B06TMkbBpUEGOE0qiqL0HNgeTVE6cqtDCtSUk3SvjZvoXlGEE71hyRLIkzyOOuLB5uwm8bbT61BfGTFYXxkpTr5+70dTkAaL89J4FYg1mgEsvr8QOXFweJn6Gx4ncfAu+Tc6vTU2yL/gMXSGAYZXaJNcTnJjjfobHscwFReCRn+VQfN1EIbnmFE0mJzQXH+T4l4zO9dtPqh4ZjDzdRDGPP49bblqwOiIF7O+MwzZjFWRXGjBg+KzDMiFFlhfJti4MAijTyzDKLw4b0o6Ub3KsApHr0qMlYRRNJgTYLBBnbJZndfobU85Hoclsief81ysQY5xFDlLfMIg7n45nKFB5hpjAqCz/oAxAdCpmIJuwIn3oZ+8lHIoVExJKtDVUgY3GVOmoiiKoiin5E5W7BP7yKQThWSpYkrSwJHHQRTZhnLFiSdoJMZS1IHBtn05GGYaBZhqyLDTMWDY6Ri42fQJ93ygvfZSxZQQaMv0odvcgoy3jU0rdFtUCNDMImpg5Q2vgfsfujEqyGXwt8m2qBA5zGZkzSrBMZ6qsLFeCckcqi+o5ggmgpmyRY31YFM2w0geBAxwBnLV4qhiaaTzsnXUCHBmeBxCYI+P7rsLA7nYGL67EGVoxMf7yAEwH5vUEIwpjkKdYDCkbM2Kg9qh9QdcPSKBXP8D0J8SA7QSF5A/JY5NpAALyxMUAnL9S3SCFMCmbCFV6WSA4SgpxRSkgpPnkjD9y/V3Ndug9dcHj8MnEmbH8l7zWsc1aiwnpz/NJnvNu9K8lv9WB09CH4ioz2y55sX8KS54HPpAQiPA51bzYq3z1rGf9RQ6OT8MVUxJGsQ3TUiK+06+3bwTP6abNtYtkniNG6w8MyUpUHiHprGL+LJvStJgzEVHPM9JRzyfhMbSIlIHdVYatLy8DRRCFXdTndsDCqGuwkX2IphAvowt6T6uhOwWS4zgxBCToclvVGYTAxVJaRcoSOOSdoFat9bPa0NahxFTCmRGLKNXYCTCkkGmTiAbS4PI8AfLnUYDuhNK5PaUQcqowiszyfUj05InNclNYHO00CTXNkULXzOMacx2JmRc+J5hCF0FIFk35U6xucDOets8Ll2ZIfJXe2jzgvlahECGUzEiF+bJtHTych2KpmyQg1cu7uJ9la3YIMh2Q8zLaZn2h/GwJii/264U3HJi7FUURXFBEv6EjoitRhAL7fN1CpRkFSVBJp3spoLINyP3XXRe88pOAmK3nYylcsWUpMEQYHFNFvlYQgoFy9lx4XEYdeJxKB4iNa/FkDfmSHBYutBLAJN/wWOso4Pkr7LR04lq5JwdAU2OQaCmTiHIv+AxjM9TbSZHgJBdPTQvVenBauvjZHcrp7Utect6tEuvmTqR+dkUdeB5hm4WrdQ+m6JOzICpGQHy5BXu5RBDwfqnKTjlDvU1u85RMOgv5hQjIBlvcXYMrZJVCzAF4BRO28MSuTQM67mQvUKxzflGpd5XCKn3FYRem4aDG68QvWYQA3LJqvhwsiF+zh2By7F/Q1I4ycWjl9JjQS+lxwGKpz+lEN+AdkLmMQYpkRc5Fk5mvz4nIegDDB2TTpX2XIodlILvnLxmiqLIIOojF4gFLPNbyLSTRYRjqKDTR1tEmDjRrSxI7N7br01JGlxCeuNJWR1y4QkannTiJKAadpJCMJZGV/4wRSlQJNtCOWRfmpI0KL0h21wZjDvZc1jgj6XZeUkw2OIIaH4cBlJPounrsNU45pBsJg4C2vgWDkTvBZi1V6ryn2nDKwT6kUDjEVTzpyBr0ojW/KHXwg8Tb047hmGLDgE9ZqkhGAtwFhuCsQBnmyHYNoZ3EFvul9+fmyIaGcQwtv5KqMe8Qf4tnjS5Mofo1IOSedxrBDjbHpbJZySHMI4ZRN2aOzQlUUhzvzBG6N5XBuAiJ6N4XNIgXX5wk5RiCtrJW3MIrS/U6+LRcX2blrJoOZFrkbW3MRcOfSBhd+BT+nfZv5l7EX3hpO7ifd2OuXJid3mU+Wa7S/B4dedR6wdCWKfNZ9UtbzTTwFeQQyfNY/9mEg7eNcI8GvirXeskeIwsg52oq3XTzYv5NdKCx6EPJDzdmfWv7Auax9YTAb9eKXrV5rX8DObgSegDCR/q2uON5sX8fKrgn9/8oHK0ffrj8WTuIeZB8aw+6cT56sSeClYMFMLqfkMH2EgsWqsS2ual5RpgHhwFbhnL6tCvpqidBWmq4TCie2/QI9rCFJAozrvkWCeD7KsDU9TO+JwpIYIUtH68bZttbGPpNyQe+X3OdjkCWeT7fzIknLxWfjElFh5C2+AYFp+YEgt/wQuDna0iYjUfP5JNXuWvwETifUYtZZjpLQfo+zGATQy3bIYMnAUshqZsm7JxwOLoy7I9JagT0APwQ9zGUtuR+rAeXglzTDRn5xDDmyct9FEBZxxZgWtwJG7KzLvYQ5aadzkd8eQ4UjhlUzaIo3KnWDkkIRWpJnsWbDp5AE4smt534DQpYxRcGmSA06SiKErPge3RFKUjtzqkQE0Bhio5GzfRvaIIJ3rDEhjIIwMxIMop0FpmxKdAgT2KhAhLbYKAPYoCxL9mETjZf7jpiFehbsyNXlVhu/ckNcRmeJlhjih8NCWduAuaiYJkX5mSTvxpCgCm/mZKOjDA8AptkuvfbKwxZv4+6kReiwt1os+koPk6CCOhmTGTkROaPY/Ruee6zQcVD6O3J9YfLARjJmN0xItZ3xmG7OtQt7UQ5EILHhSfZUAutMD6MhlKwSDdK0Rde7yGJ9+UdIIVhRC9KjFWEkbRYE4UyAZ1ymZ1XqO3PeV4HJbInnzOc7EGOcZRjNWk3eAknlfaxhNkTeZ9BRF6X0FkPR7OCCfeh37yUsqhUDElqUBXSxncZEyZiqIoiqKckjtZsU/sI5NOFJKliilJA0ceB1FkG8oVJ5uOkRhLUQcG2/blYJhpFGBSCsNOx4Bhp2NwjWH1oQPl40cD2muxfPwIyuYsRLe5BRlvG5tW6LaoEKCZRdTAyhteA/c/dGNUkMvgb5NtUSFymM2oXxaibDxVYWO90j1TYoVuIw+DmbJFjfVgUzbDSB4EDHAWGu9A/7bQeGcEODM8DiGwx0f33YWBXGwM312IMjTiMwznXQjMx4bkfcWBKY5CnWAwpGzNioPaofUHXD0iiQ+Y8RmA/pQYoJW4gPwpcWzG1Vk/huUJCgHlpEh0ghRovGatvPPWgAkeh08kNBaW1rV8Zd9ycvrTXAZ/jPn7Qx9IWCxY7xI8TuAua/0xF07sLi1ketIp/66rb/nmX9Za4oPH4RMJ0wf58IiJPhFw9I9r3lTzWn52UPAk9IGEx0d1pbd5Mf8ZBI9DH0j4fa2+r21erHXeOvbX19DJ+WGoYkrSAKvyJuV+AiOlM3knfkysylsyJDD0m6w8MyUpUHiHprGL+CItEwcx5qIjnuekI55PQmNpEQnunY0L6URYRurnibupzu0BEbGr5C5QBhPIl7El3ceVkAWsxAhODDEZmvzWHwTPyECbEnnnHmhTIu3cA4aq3Zc95n6sEOqwTP0rzJsSK8LOPWZJSuwLjGIQGf71sSCLzwLdCSVye8ogZXSzLzPJ9SPTkic1yU1gc7TQJNc2RSewy+rMNGY7EzIuLc0FIXQVgGTdlDvF5gI76211UGVTNghWolqMm80L5msRAhlOxYhcmCfT0snLdSiaskEOXrm4i/dVtmKDINsNMS+nhaXfIR7WBOV325WCW04SUBVFUVyA7dSFiK1GEAvt83UKlJzkNE062U0FkW9G7gs7lmCUnQTEbjsZS+WKKUkDcg0CMfKxhBQKlrPjwuMw6sTjUDxEal6LIW/MkeCwdKEnoZJ/wWOso4Pkr9LzZslGztkR0OQY5Ap5uSb/gscwPk+1mRwBYuLeYj6KAPQ4BGHUeWUEJNtbCcXCKZmMhdoGMT0OAJexcPogjCZYq/TXLy5l/g71NbvOUTDoL+YUIyB5jvyexX0zUYApAKfkGdNyiVwahvVcyF6h2Tg3rLT1Ioa49SIGvTYNBzdeIXrNIAbkklXx4WRSTz6G0JMP4iQXz7sq8+SDCD35IFA8/SmF+VilYELmMQYpkRc5Fk5mvz5hPgrGAHnzwaFKey5FjlKgKMo5g6iPXCAW6FtVBtNOFpFJJ4tIH20RYeJEt7IgsXtvvzYlaXAJ6Y0nZXXIhSdoeNKJk4Bq2EkKwVgaXfnDFKVA0UnqSfalKUmD0htBmBDMuJM9hwX+WJqdlwSDLY6A5sdhIPUkmj5wq3EocoSCNr6FA9F7AboLSlX+M214hUA/Emg8gmr+FDgehyBYzR9Zk8ZO5rRjGLboENBjlhqCsQBnsSEYC3C2GYJtY3gHseV++f25KaKRQQxj66+Eeswb5N/iSZMrc4hOPSiZx71GgLPtYZl8RnII45hB1K25Q1MSBcP9yIDhfmQALnIyilmwMJ6MH9wkpZiCduyOc+sL9bp4dFzfpqUsWk7kWmTtbcyFQx9I2B34lP5d9m/mXkRfOKm7eF+3Y66c2F0eZb7Z7hI8Xt151PqBENZp81l1yxtt1sDwFeTQSfPYv5mEg3eeN9G8lr/atU6Cx8gy2Im6WjfdvJhfIy14HPpAwtOdWf/KvqB5bD0R8OuVoldtXssPdQmehD6Q8KGuPd5oXszPpwr++c0PKkfbpz8eT+YeYh4Uz+qTTpyvTuypYMVAIazuN3SAjcSitSqhbV5argHmwVHglrGsDv1qitpZkKYaDiO694Y00beAhJHdJcc6GWRfHZiidsbnTAkRpKD1423bbGMbS78h8cjvc7bLEcgi3/+TIeHktfKLKbHwENoGx7D4xJRY+AteGOxsFRGr+fiRbPIqfwUmEu8zainDTG85QN+PAWxiuGUzZOAsYDE0ZduUjQMWR1+W7SlBnYAegB/iNpbajtSH9fBKmGOiOTuHGN48aaGPCjjj0OPJg4AjcVNm3sUestS8y+mIlwDC9wxE9pqBNMqdps8sOZ6ehezF4GPTl1Dc1KYR7xcRjt6B06SI57+7uIuHKDyKoii9CLZHU5SO3OqQAjUFGKrkbNxE94oiwO2VjCUwkEcGYkCUU6C1zIhPgQJ7FAkRltoEAXsUBYh/zSJwUgLNTUe8CtUTZPSqCu/jJqkhNsPLDHNE4aMp6cRd0EwUJPvKlHTiT1MAMPU3U9KBAYZXaJNc/2ZjjTHz91En8lqciYM+k4Lm6yCMhGbGTEZOaPY8Rhuv63SbCqO3J9YfLARjJmN0xItZ3xmG7OtQt7UQ5EILHhSfZUAutMD6MhlKwSDdK0Rde7yGJ9+UdIIVhRC9KjFWEkbRYE4UyAZ1ymZ1XqO3PeV4HJbInnzOc7EGOcZRjNWk3eAknlfaxhNkzYlXSOh9BZH1eDgjnPgF+slLKYdCxZSkAl0tZXCTMWUqiqIoinJKrn3Fpu+HGTD2wwzske2JI0zDxXCjp4uasZ3s/45tbZm9YwkLMMho6qspSYPcnjQPF+GaLUUsccbRwGo7oL32GxJJHsW0uS2i29yCjGM2I7otKgRoZhE1sPKG18D9D90YFeQy+NtkW1SIHGYzYpS8DmI8VWFjvdI9U2KFbiMPg5myRY31YFM2w0geBMyoExrvQP+2UCe4FPZvMzwOIbDHR/fdhYFcbAzfXYgyNOIzDOddCMzHhuR9xdGuF9vg+AgCDIbccrP0hgMG0PoDrh6RxAfM+AxAf0oM0EpcQP6UOKB21yxPUAgoJ0WiE6RA4zVr5Z23BkzwOHwiobGwtK7lK/uWk9Of5tJISmldy/L3hz6QsFiw3iV4nMBd1vpjLpzYXVrI9KRT/l1X3/LNv6y1xAePwycSpg/y4RETfSLg6B/XvKnmtfw89+BJ6AMJj4/qSm/zYv4zCB6HPpDw+5rnfd+8WOu8deyvr6GT88NQxZSkAVblTcr9BEZKZ/JO/JhYlbdkSGDoN1l5ZkpSoPBOZm0B+eLCPOWNueiI5znpiOeT0FhaRIJ7Z+NCOhGWkfp54m6qc3tAROwquQuUwQTyZWxJ93ElZAErMYITQ0yGJr/1B8EzMtCmRN65B9qUSDv3gKFq92WPuR/zwAzL1L/CvCmxIuzcY5akxL7AKAaR4S90+9Q1DFNgp0RuTxmkjG72ZSa5fmRa8qQmuQlsjhaa5Nqm6AR2WZ2ZxmxnQtzUORC6CkCybsqdYnOBnfW2OqiyKRsEK1Etxs3mBfO1CIEMp2JELsyTaenk5ToUTdkgB69c3MX7KluxQZDthpiX08LS7xAPa4Lyu6hSoCiK0o1gO3UhYqsRxIKT+brkJFZy0sluKoh8M3Jf2LEEoywq9Yiy7WQslSumJA3INQjEyMeSJLwTZ8eFx2HUiceheIjUvBZD3pgjwWHpQg9uJ/+Cx1hHB8lfZaM0KdXIOTsCmhyDXCEv1+Rf8BjG56k2kyNATNxbzEcRgB6HIBW6G54RkGxvJRQLp2QyFmobxPQ4AFzGwumDMJpgrdJfv7iUeXLN4OscBYP+Yk4xApLnyO9Z3DcTBZgCcEqeMS2XyKVhWM+F7BWajXPDSlsvYohbL2I4ycUDI6qFMEpWMSCXrIoPJ5N68jGEnnwQes0sDldlnnwQoScfBIqnP6UwH6sUTMg8xiAl8iLHwsns1yfMR8EYIG8+OFRpz6XIUQoURTlnEPWRC8QCfavKYNrJIjLpZBHpoy0iTJzoVhYkdu/t16YkDS65aBWzOuTCEzQ86cRJQDXsJIVgLI2u/GGKUqDoJPUk+9KUpEHpjSBMCGbcyZ4DBDNl36UbyYOApmyGkTxIAbNl58k28jCYKVtocAFN2UKDyygW4GwzuNjmpTISpF/4JlsVPtcqpshGn8x88zEDBZ/m/m5KaEBmeek8XnuLBDgXS7KJfPcZpG7Zxo1NtoPYcr/8/twU0cgghrH1V7IR671B/i2eNLkyh+jUg8Kg3oNXtodl8hnJIYxjBlG35g5NSRQM9yMDcM4W4sSeVsyChfFk/OAmKcUUtGN3nFtfqNfFo+P6Ni1l0XIi1yJrb2MuHPpAwu7Ap/Tvsn8z9yL6wkndxfu6HXPlxO7yKPPNdpfg8eqOrcCiddp8Vt3yRps1MHxFIHTSPPZvJuHgnedNNK/lr3atk+Axsgx2oq58Tzcv5tdICx6HPpDwdGfWv7IvaB5bTwT8eqXoVZvX8kNdgiehDyR8GPG8G82L+flUwT+/+UHlaPv0x+PJ3EPMg+JZfdK2F0gcJ/ZUsGKgEFb3GzrAztleqdg2Ly3XAPPgKHDLWFaHfjVF7SxIUw2HEd17A9sHR1NAwsjukmOdDLKvDkxRO+NzpoQI0kLz8bZttrGNpd+QeOT3OdvlCGSR7//JkHDyWvnFlFh4CG2DY1h8Ykos/AUvDHa2iojVfPxINnmVvwITifcZNTxg4XU5QN+PAWxiuCWLaFvAYmjKtikbJ4O9VsuyPSWoE9AD8EPcxlLbkfqwHl4Jc0w0Z+cQw5snLfRRAWcczAgfBTgSNzEjfBTYQ66rxyI3NacjXgII3zMQ2WsG0ih3mj6z5Hh6FrIXg49NX0JxU5tGvF9EOHoHTpMinv/u4i4eovAoiqL0ItgeTVE6cis+BYrRIZ4D1gtECmBzSwAnSvvivBOlndi6Or4nDNijSIiw1CYI2KMoQOxrFkW4R1FKfC/ui4JQoXqCjF5V4X3cJDXEZniZYY4ofDQlnbgLmomCZF+Zkk78aQoApv5mSjowwPAKbZLr32ysoVbCAH2gneyEWtxsSV8WQPN1EEZCM2MmIyc0e17slG3nOt2mMoOZr4MwdALGTMboiBcTdMwwZDM0LHKhBQ+KzzIgF1pgfZkMpYDRc5i69ngNDcuUdCLhKATGSsIoGsyJAtmgTtmszmv0tqccj8MS2ZPPeS7WIMc4ikkEiwlxEs8rbeMJQtzIMBF6X0FkPR5AZi9Ty5/F48Qv0E9eSjkUKqYkFehqKYObjCmTDpgCpSidCST90fchihJghmzgUZQILP2S6PthBoz9MAN7ZHviOKnH6EZPFzVjO9n/Ha9xmb1jCQswyGjqqylJg9yeNA8X4ZotRSxxxtHAajugvfYbEkkexcnvHo+lZVEA1TiWlDJ1CKSeRAOaWTbIHocgw2vg/ieP5D5Echk0Zb0AUk+iyWFuof7cM1MkQNhYr3TPlFih28jDYKZsUWM92JTNMJIHATPqhMY70L+drE7A8DiEwB4f3XcXBnKxMXx3IcrQiI+PtwDAfGyiuc9DLVkcH0GKYK+ZkKr0AWJcchNHYgpSwclz8ZGtbadUxo/zzlvqRvA4fCLg6ZvS8cV8Zd9ycvrjXPa/xPz9oQ8kNAI2LHcJHidwl5X+mAsndpdr5B4PcfQve14h26D1JgSPwycSZsfyXvNaxzVqLCenP80me8270ryWn2kWPAl9IKK+l841L+ZvqoPHoQ8kNAJ8bjUv1jpvHftbpdCJhMyQrYYOl6GKKUmD+KYJSXE/gW+3M3knfkxHbaybsR9JvMYNVp6ZkhQovJNZW0C+uDBPeWMuOuJ5Tjri3YIqUKAsxkVrHjOL/FAca0hQjribKtTgaRX5oTggU/OWdB9XQkJCSozgxBBhK8D6g+AZmc245k+nCAvJgh0JhYVkwVC1+7LH3I95YIZlinFh3pRYEXbuuW9YwbAvMIpByFiCvYvRgDGkJXJ7yiBlVOGVmeT6wTlaZpKbwOZoqUnORGhhxbD4lFPATZ0DoasAJOum3Ck2F6DIpmyQ/NVe2ryYgjSgh9Nz2LhHjaePRTZlo/RJ1TyIAdBxKkOmyqDcdtKR4rYTh4KigKCapqLYKF/7eGLzS0CBxHbqQsRWI4gFJ69WyUms5KST3dSlzGm8t3ws3Rd2LMEoi0o9omw7GUvliilJA1FEIMpwLlCBQj6WJOGdODsuPA6jTjwOxcMkPQ6RkDfmSHCYycovUT0zqvStyfoD0IJ4CqfOK93byujcw+iIN4qZr4MwOuLNg+H0AfJYRGWQHxiLYsj4EpqXnmKukCDv6QHJX6KGcjRILXyD2jg5DILREW+XnkBwme453qMPvxz9V77SrUKZmHmcXDP4OkfBuELWo6cYAcmQizYEp5gA2ZKVZyjeJXJpGNZzSdbEyJiyGRTnndjfnOTigRHVQhglqxgwSlbFIfXkYwg9+SD0mlkcrtJ1TAZCTz7Id5zZLJKJhD3GdkrkRY6Fk9mvz4n3YYCxX6FTdfNcFEU5TySqj5wxubY4FckKuVD+yxSlwLQXs/FMjMk82bbB4GOfi4IKAy7Mx9XcoflcJHbv7demJA0uiSodgKwO0W1LdIYnXTxlj2rYYZF91fZcBGNpdOUPU5QCRSepJ9mXpiQNSm/oZlo64072HE8xwzoW+83wOATpx7qcMTwOQQpY+7882UYeBvM+CA0uoFdIaHABC1DaDC62eamMuNgKDI9DkM+1iimy0Scz33zMQMGnub+bEhqQWV46j9feIgHOxZJsIt99Bpmy0HJdUC2yQY7HIQiUlLKO/ClxzEIuRskOpAHkFZqS6jFQj4dB5E+JA2xRjPIjNmcLAedsIdIhD1E8LmmQLj+4SUoxBSi2Nc57bSu9MRs+af1fQu2ttexG8DiBu+wOOLjL/tKlmAsndRfv63bMlRO7y6PNwIWuNw43gydJ3MJA7lMWtosHKSOVucS4aWMNKR9inCxKIeSz+qRtL5A4nO4rZMCKgUIS7n4TBXvnbF3jEJb+nykhsjoEFEJdkKYaDiMxIRvYPjiaAhIQe5cc62SQfQXY5scxi040U8g3ZoU9lv51R+ggzyLf/5Mh4eS18ospsfAQ2gbHsPjElFj4a9uU0NgqIlbz8SPZ5FV+LX19GeTY+n4TaIMrVqrADW4ZMhBFksFeK6FSBeoEQqVqw0lqu8n3Ilt9DjG8edJCHxVwxsGM8FGAI3ETM8JHgT5kTm7GBUH2moEMOmnnPUuOp2chezF6GScWTe87cJqUMerEQAFOk4qiKF2ALO6TbRNQehC5M4MP5OtvB+sFIoVtcyPhRGlfnHeitAtbV8vmpTcfOQ9s4M8dU5QCVfLWmDXDS8NVIHJ7p5Vp0uPao11TREI2lry9Ccb+p0D+Yu6CZqIg2VempBNYs7UwU38zJR0YYJiVN8n1bzbWoBjAMPkz3gD20bPGGQnNjKLBjIRmRheo6/R3cQYzXwdh6ATf0/t4Lck64onnJe/G/yGbTKr0e36im9ifXP6vKepEowsUkT/JBTC8l/R//jO6TlCj/1v+l6wUdCn014zBNSehI4ySVRwqpiB16C/J2VBysZb/sSLbyGD8fYezYSHjZFPQlfSTl1IOhYopSQUnY+lm8rG0iqIoitJ95EcYdsJUgFINGwzKoiRBFuddKOoe3bLGQBglCcL0hRkkso/7MAMmpUy5KBnj5fbopWrpXKOX0GUwLsvoBu2135BI8o4kMpb2waLBU4dA6kk0oCNlg+xxCDK8Bu5/8kjuQySXwaQUesnrIDnMLdSfe2aKzo7SPVNiJSvc2GMhEcLGen1YXHVO5nEAM+qEeY9VrLCNG50ABXt8sjyA+lhEpmyG7y5EGRrxGYbzLgTmYxPNfR5qyXLiVDhnVKUPEOPSfVOSBrIySSjY9JcMiehLx5QDpQvK+eBJMjUNnja8r636CL6ybzk5/XEu+19clICoFax3CR4ncJeVFfOym0n/Q05IdCy1/j7/eDh40ji8LXd2TR/kwyMm+kTA0T+ueVPNa/lbiuBJ6AMJj+s7hP7mxfxnEDwOfSDh91zzSn5ieKl++MI/aRyffNBtbEJltWK562RhuJ/ASOlM3ol10E0b6xYJDH2Un2WmkjqFd+JLIHxxYZ7yxlx0xPOcdMQ7C6SWYkiRlHbuWX8AFUKV1s4bqpgSGzLDQ30iNwVp4nBe8rxHskKyWELq/h62EY7i/QuoEGofZuyKon/lmSmysSdU/yRW2/PNhGyzDYYjlu5smiICZTSGTNZtrR9MUpKa5BQZ49LSXBC3nEzpWSflTpVI3GxeMF+LkClGCpSSIAOg41SGUJUBuS3bSShKN4Jqmkq3sXW5D2000a1s8hTjOTR0U8SCk1er5CRWUrbP5OBkMxLkZ17bq7Ko1CPKtpOxVK6YkjQYctLGLIjzseTVQDNRmB0XHodRJx6H4uFbU5QG0tCnruAGwy5N97YyOvcwOuKN0t1CjI5482A4fYAiFlGZKO7nJe85vWxCP3341cYht1oQRke8XXoCwWW65xgMpw9xQexS35EtM1OQJy7MHLkECSe+imzJyjMU79K9DVOkOMVJLh4YUS2EUbLqDDiDNc4VTnLxvAnyJMtg57ETr5CiKIqisEHy+xJAGHLYbUCZhk2mneTETTop1tjnxBN0VrrVWeneVdjIdOmDKUmB1SG6bYnO8GQiNSA6AYZsJs5ZjaW9y6DJ6Mo/TQmFPtBm9EnUcxL0oi70/8lzRrYADZalezzveRfTj3U5Y3gcghSw9n95so08DJaTMiTTY0Cv0GUn3aptnNW85H2uVUyRjT6Z+eZjBlpLc1DqSTTQHDu68ocpIlF7C2Vn7h6aElec2VjCQlzXXwn1mDeQXZruIguTQ3TqwX+ZEhoHr6CHVXtsSpSEABUmGcUs3ZPP4IfznZSCvFBp4s9OLZ0035yeW8etDyS6aovdgU/hmwQvHPpAwP7N3IvoCyd1F+/rv8x7DB0mfIveBWw8H0cZqcwlRtguHsRNIdQe5bp8VneyqwErBgqpXmWFpDrjrNe4eP5bk87aw4juvfFOqBYXJp+YonbufgB+KI7sKyemzp6F0W0txE/IWBJPXlB4kbQL1NYPjtx5XJwkXgi49fkvU0RhYRvqoZn7IirslNlFcg72vquJyo4M9f3bFCnnEEflTunJCd0EZP7qfRrlTtNn79tZuV2dcN7XOEd8KYzR+5CS2T2oOE+AVBRFUc41U8xKzJD3XsqSLJAEpJ+eH+yebtC9D4ZYqYY5qfcfoiQLJMFYnPnNFJ1DumEs7T3lpLpVyRHcLFOgk82Lm454F4MxRjj8d+SnTP4FDw7PPWWAkei/eQeK6FMQBug9PLegBmEhGF2grtPndYZXaAbP2jlL6N/FWfCJvF55Ty7/1xR1otEFisif5AIY3kv6V551YPtSkkXqfcVYf3C+Q0eURFjTkDYlIQoVU5IKUByMoiiKcnHIj0Cphg0Y5S0ZFKCUYCk3sJzg8wB9g3pWHIyjI2RxhmHapLP83JSkwMorUSymU7pnLHn/QXfsbjwO1+gldBmMi4KH3dJFYwktQLkxJHmVh9eg5PT6misqxn4ZLMD74sCUKImAOb9+knkc+rC+cDlZK1wwo657lKVu4zvEYDwgVZag9n8FjiM4yOYdU6L0II6SUkxB19NN+pJPpkXrJB88CRxKaCSlhG4SPAl9IKE2Yd5iM3y/0x9V0mIo28DPDloKnjQOk1g6ste8K83r+uEJwZPQByLuNK/kG81+qB9eCp5ku/At7znkj/m+rK4hSB42vXYLvTf6pdUsPO+LC/OUN+aiI55Tem8sHc3LOmevP8gg9qkfhdv1IeHvn0N6byzt76G+FjvvX0CFUPswY1cUmfIzU6ScP0pY7eIIyqjhyH1vZKVXudV7U7pyVmC+FkVRFEW5SMgCGc4tPapA3uXVOFlAN3EiMj1n8W7h5Mtzz+sxlu36Y8ZFrcGbnqieq+KYCXoFAm/2zqYp6sDsCKMA5ZXzXVNdaWOEHvd4l17mdpReY2vOief4LOhRfcnzjqrk/oLf6P3FdukJBBnNAO865shNdTjFBMAUAEXpjMyR3FP07BrnigmNpVUURTmv9Kit8pxyfWG3i3K6qfS0vnQNtzFNylMOAP48gFqQKeeQG+gIWRUVB0AZvqqKeveCFqCkl8MNAkbrLoyZEqWLKNyBCm7lyTbyMFhOyZCT1ilnR0/rSw3HP1SzOwelnkQDRbiU5l20TlFSYxayS0t3s+r6V5KimC2bogtIj69xPsOBYg/DM41jXw1ufsDp3BNmPzfRvIOfmTdXPxzyb9c4PvlA6XUG5PurBXC/qPQ6wqqESouLscZ14LjukaKIuW0KFAbS3XBvkPvSwy5XRVEuIFcwF0rPo7q3mPs1pI7cBUDHkhg35S2VC8Cc5rv56Lx0zCAvHG7Je2+KLio6lo45OjQlEIP/MSWKcuu6KVEUJmq3laFr3CmTWhxAhL6Lp3wo51SPVhSlu3FT3lK5CPR6kpLijNFlU6IoPO4wCp/2MmoTMMCXrcJbLTShxIHnpKB1L5SLyjSU6KtY0DXOYO+21rVREqJP+8IxUWubybfs0IEpUxRFOQdkWrROZgPHzcMZ3cS1o7p3BKvNMeNbCEqBsdT84DO9dYqiKIqiKIpy0fn/vYZqnC/jZVMAAAAASUVORK5CYII=>