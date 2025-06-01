Implement function performBraveryCharge() for Dice 1 only

* ##### **Dice 1: Bravery Charge**

  * Action: Choose one of your Dice 1 units, must **declare "Bravery Charge"** action. Otherwise, it's a normal move.  
    * Movement: The Dice 1 unit must **move forward** up to its full movement distance (3 steps) during this action.  
    * Target: The Dice 1 unit must end its movement **adjacent to at least a single enemy unit** that has an **Effective Armor** value of **6 or higher**. An enemy unit's Effective Armor is its base Armor value plus any bonuses from Guard Mode or terrain, minus any Armor Reduction tokens.  
    * Effect: If the target condition is met:  
      - The attacking **Dice 1** unit is **immediately removed** from the board.  
      - The targeted enemy unit has its **Armor value reduced by 6**. If the enemy unit's Armor value is **reduced to 0 or less** by this effect, that enemy unit is also **immediately removed** from the board. Otherwise, the enemy unit survives with its reduced Armor.  
    * Note: This action bypasses all standard combat rules (e.g., no Attack vs. Armor comparison, no Armor reduction based on failed attacks). It is a direct, specified effect.  
    * Action Complete: After executing a Bravery Charge, the player's turn ends.

---
Please change the code below in the following way: "Improve the AI Strategy. make it thinking more about overall context (friendly unit, threat, friendly units formation ...)"

Okay, I understand. I will try to improve the AI's strategy by considering the game state more comprehensively. Here's how I'll approach it:

Analyze Threats: Identify immediate threats to AI units and the AI base. This includes nearby enemy units that can attack and enemy units that are close to the base.

Evaluate Friendly Units: Assess the position and strength of AI units. Determine which units are in good positions to attack, defend, or merge.

Consider Formations: While the game doesn't have explicit formations, I can look for clusters of friendly units that could benefit from merging or supporting each other.

Prioritize Actions: Based on the analysis, I will prioritize actions in a more nuanced way than the current simple list. The new priority will roughly be:

Defend Base: If the AI base is under immediate threat, prioritize moving units to defend it or attacking threatening units.
Eliminate High-Value Threats: Attack enemy units that pose a significant threat (e.g., high-value dice, units in key positions).
Strengthen Units: If opportunities exist to merge units into stronger ones, consider doing so, especially if it creates a unit that can immediately impact the board.
Attack Weaker Enemies: If no major threats or good merge opportunities exist, attack weaker enemy units to gain an advantage.
Advance Towards Opponent Base: If the situation is relatively safe, move units towards the opponent's base in a coordinated manner.
Guard Vulnerable Units: If a unit is in an exposed position, consider guarding it.
Reroll (Conditional): Reroll low-value dice if no better option is available.
Simulate Outcomes (Simplified): For attacks and merges, I will try to a simple evaluation of the potential outcome (e.g., will the attack likely succeed, will the merge create a stronger unit).

This is a more complex strategy and will require significant changes to the performAITurn function. I will now attempt to implement this improved AI logic in the game.js file.

---

Implement the AI Opponent Bot (as Player 2) if user (Player 1) choose single player mode in `game.js` following below <REQUIREMENTS>:

<REQUIREMENTS>
## **Fog of War (FoW) / Single Player Mode**

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
</REQUIREMENTS>