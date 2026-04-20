<reasoning>

1.  **Richard Garfield (Game Mechanics & Systems):** Essential for dissecting how FoW impacts information flow, unit interactions, and strategic decision-making. He'll also be key in defining how the AI "sees" the board and processes information.
2.  **Eric Lang (Tactical Game Design):** Perfect for considering the player's tactical experience under FoW, how unit movement and attacks change, and how to design an engaging AI opponent for a tactical game.
3.  **Aza Raskin (UX/Game AI Design):** Brings a valuable perspective on user experience, how AI interacts with players, and designing AI that feels "smart" without being overly complex, especially given the "casual board game" context. He can help simplify AI decision-making and ensure the FoW feels intuitive.

**Dialogue Plan:**

*   **Phase 1: Initial Brainstorm & FoW Core Mechanics:**
    *   Experts discuss the core challenges and opportunities of FoW in Hex Dice Tactics.
    *   Define how FoW works: vision range, what's hidden, how discovery happens.
    *   Consider interactions with existing terrain rules (LoS blocking).
*   **Phase 2: AI Design & Interaction:**
    *   Discuss the AI's "knowledge" under FoW (full visibility vs. player-like limited vision).
    *   Propose simple AI decision-making heuristics/priorities for a "casual" game.
    *   How AI handles setup, army generation, and actions under FoW.
*   **Phase 3: Integration & Balancing:**
    *   How does FoW affect existing actions (Move, Ranged Attack, Special Attack, Merging, Guard)?
    *   How does FoW affect winning conditions?
    *   Overall single-player experience and replayability.
    *   Address complexity for a "casual" game.

---
<expert name="Jamey Stegmaier" field="Board Game Design">Alright, a single-player mode with AI and Fog of War. That's a significant shift from the current multiplayer focus. Fog of War in a deterministic, tactical game like Hex Dice Tactics could be very interesting, adding an exploration and surprise element. The AI is the bigger challenge – how complex do we want it for a "casual" game?</expert>

<expert name="Richard Garfield" field="Game Mechanics & Systems">Fog of War is a fascinating addition. For a board game, FoW usually means hiding information about opponent units, sometimes even terrain or empty hexes, until they enter a unit's line of sight. First, we need to define a 'vision range' for each unit. Does every unit have the same vision? Does it relate to movement or attack range? I'd lean towards making the vision range fairly consistent to simplify rules, maybe 2 or 3 hexes for all units, with special units like Dice 5 (Archer) having extended vision. Terrain that blocks line of sight (Forest, Tower, Mountain) would naturally block vision as well.</expert>

<expert name="Eric Lang" field="Tactical Game Design">I agree with Richard. A uniform vision range, perhaps extending 2 hexes, for all unit types, with Dice 5 getting 3 or 4, seems sensible. This forces cautious exploration. What does 'hidden' mean? Units become invisible, and their exact type/value is unknown until revealed. Empty hexes might initially be 'unknown territory' and reveal their terrain type when explored. The map should probably be revealed gradually as units move into unexplored hexes. This creates a sense of discovery. For the AI, we need to decide if it plays with full knowledge of the board (simulating a perfect player in a physical game) or if it also operates under FoW rules, which would be more challenging to program but feel fairer to the player.</expert>

<expert name="Aza Raskin" field="UX/Game AI Design">From a user experience perspective, the AI playing with the same FoW rules as the player feels more immersive and fair, even if it's harder to design. A "casual" AI shouldn't feel like it's cheating. For AI, we want a simple, predictable logic, not a deep learning model. A priority list for actions is usually effective:
1.  **Threat Assessment:** Identify immediate threats within its revealed area.
2.  **Objective Focus:** Move towards the player's known base, or towards any revealed enemy units.
3.  **Exploration:** If there are no immediate threats or objectives, move units into unexplored areas.
4.  **Optimization:** Use Merging to create ideal units based on revealed threats or terrain. Guard if a key unit is exposed.

For FoW, vision should radiate from each of a player's units. Any hex *not* currently in vision range of *any* of a player's units is 'fogged'. When a unit moves, new hexes come into vision, revealing hidden units or terrain. If a unit moves *out* of vision, those hexes become fogged again, but revealed units (if still in their spot) might remain visible for a turn or two before fading back into the fog. Or simply, once revealed, they remain visible *as long as they are in vision range*. Once they leave vision range, they become unseen again. The latter is simpler.</expert>

<expert name="Richard Garfield" field="Game Mechanics & Systems">Aza's point about AI vision is key. If the AI shares the FoW, it adds a layer of emergent complexity that feels more natural. For Hex Dice Tactics, where units are dice, maybe the AI's "knowledge" of specific unit types only occurs when it's within vision range. It might know *an enemy unit is there* but not its value until seen. This makes Merging for the AI a strategic decision based on *its* visible board state.

Let's nail down FoW mechanics:
*   **Vision Range:** All units have a base vision range of 2 hexes (adjacent hexes + hexes 2 steps away). Dice 5 units have an extended vision range of 3 hexes.
*   **Line of Sight:** Vision is blocked by any hex containing a Forest, Tower, or Mountain terrain type, consistent with existing LoS rules for Ranged Attacks.
*   **Hidden Information:**
    *   **Unexplored Hexes:** Initially unknown. When a unit moves onto or adjacent to an unexplored hex, its terrain type (or lack thereof) is revealed.
    *   **Hidden Units:** Units outside a player's vision range are hidden. Their exact type and location are unknown. When a unit comes into vision range, it becomes visible, showing its type and location.
    *   **Ghosting:** When a unit moves *out* of vision range, its last known position might be marked with a "ghost" token, indicating an enemy *was* there, but its current presence or type is unknown. This adds a layer of tactical guesswork without being too complex. The ghost token would disappear if the hex is later confirmed empty or if a unit of a different type is revealed there.
*   **Initial Map:** The map is fully fogged except for each player's starting deployment area.

This makes exploration a core part of the single-player game.</expert>

<expert name="Eric Lang" field="Tactical Game Design">Perfect, Richard. That FoW system is solid. Now for the AI. Since it's a "casual" game, the AI shouldn't need a complex pathfinding algorithm through fog. It should prioritize:
1.  **Respond to Threats:** If an enemy unit is within its *revealed* vision, attack it if favorable, or retreat/guard if overmatched.
2.  **Advance on Objective:** If no immediate threats, move units (especially stronger ones or those needed for merging) towards the player's last known base location or the center of the map for general exploration.
3.  **Explore:** Send weaker or already-acted-upon units into unexplored areas.
4.  **Merge for Power:** If units are adjacent and can merge to create a more powerful unit (especially sum > 6 to choose a 5 or 6), do so. The AI could have a simple preference for Dice 5 (for ranged poke) or Dice 6 (for defense/anchor).
5.  **Guard if Vulnerable:** If a key unit (e.g., a high-value Dice 6 or a lone 5) is revealed and can't attack, guard it.

The AI should *not* have perfect knowledge of the fog. It should act on its visible board state, similar to the player, which makes its actions understandable, even if occasionally suboptimal. This is crucial for a casual experience – players understand *why* the AI made a move. Its army generation would still be random (like the player's) to maintain that core game element, perhaps with a slight bias towards re-rolling low values if it gets that option.</expert>

<expert name="Aza Raskin" field="UX/Game AI Design">To enhance the single-player experience, we can leverage the FoW. When the AI moves a unit into a hex that was previously fogged, it reveals the hex and any units there. If it reveals an enemy unit, perhaps there's a small UI flourish or sound effect. The winning condition for the AI could be the same as the player in a 2-player game: annihilation of the player's units or capture of the player's Base. The AI should prioritize its revealed objective, whether it's an enemy unit or the player's base location.

One important detail for AI: how does it handle its own units that leave vision range? They should *always* be visible to the AI player. FoW is about revealing the *opponent's* and *map* state.

**Refinements for Actions under FoW:**
*   **Move:** Units can move into fogged hexes. If they do, those hexes and anything in their vision range are revealed.
*   **Reroll:** Unaffected by FoW.
*   **Guard:** Unaffected by FoW.
*   **Ranged Attack (Dice 5) / Special Attack (Dice 6):** Can only target units that are currently *visible* within their attack range. They cannot attack into the fog. This means players (and AI) might need to move units to reveal targets before attacking.
*   **Merging:** Units must be adjacent and visible to each other (or at least, both controlled by the same player/AI). Unaffected by FoW if both units are player-controlled.

This feels like a comprehensive set of additions that maintain the core game's integrity while adding exciting new layers for single-player.</expert>

<expert name="Richard Garfield" field="Game Mechanics & Systems">That covers it well. The AI's army generation could be identical to the player's (initial roll + 1/3 reroll) for fairness. The AI's decisions about which dice to reroll could be simple: always reroll 1s and 2s first, or prioritize getting a Dice 5 or 6 if it doesn't have one. This simplicity keeps it "casual." The main appeal of the single-player mode will be the exploration and the tactical puzzle of uncovering the map while dealing with an AI that, while simple, responds logically to its revealed information.</expert>

<expert name="Eric Lang" field="Tactical Game Design">Agreed. The core game logic remains, but now there's an exploration meta-game. The AI's simple priority list ensures it's not a pushover but also not unfairly difficult. The random terrain generation (as reviewed before) becomes even more impactful in FoW, as players won't know the full map until they explore. This could be either good (more surprise) or bad (still potentially unbalanced maps) depending on how that terrain generation system is ultimately refined. But for the FoW implementation, it works.</expert>

</reasoning>
