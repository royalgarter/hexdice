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