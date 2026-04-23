# AI Implementation Context & Guidelines

## 1. Overview
This document outlines the requirements and logic for implementing the Single Player AI Opponent for HexDice, specifically adhering to the **v1.3 Fog of War (FoW)** and **Single Player Mode** rules. 

The goal is to create an engaging, "casual" opponent that plays fairly (restricted by Fog of War) and follows a predictable but tactical priority system, rather than a perfect-information Minimax solver.

## 2. Core Design Principles
- **Fairness:** The AI must operate under the same Fog of War constraints as the player. It only knows what its units can currently see.
- **Simplicity:** The AI uses a distinct **Priority List** for decision-making, avoiding complex lookahead trees which can result in "analysis paralysis" or "cheating" behavior.
- **Personality:** The AI should feel like it's exploring and reacting, utilizing the specific strengths of its dice army.

## 3. Mechanics & Constraints

### 3.1. Fog of War (FoW)
The AI does **not** have access to the full board state.
- **Vision Range:**
  - **Dice 1, 2, 3, 4, 6:** 2 Hexes.
  - **Dice 5:** 3 Hexes.
  - **Terrain Modifiers:**
    - **Forest:** -1 Vision.
    - **Mountain:** +1 Vision.
    - **Line of Sight (LoS):** Blocked by Forest, Tower, and Mountain.
- **State Knowledge:** The AI acts based on a filtered `GameState` containing only:
  - Its own units (always visible).
  - Enemy units currently within the combined vision of its army.
  - Terrain revealed by its units (or permanently revealed once explored).

### 3.2. Army Generation
- Standard Setup: Roll all dice -> 1/3 Reroll allowance.
- **Reroll Logic:** 
  - Prioritize rerolling lowest values (1s, then 2s).
  - Aim to secure at least one Dice 5 (Ranged) or Dice 6 (Special/Terraform).

## 4. Decision-Making Logic (The Priority List)
The AI evaluates its available units one by one and selects the highest-priority valid action.

1.  **Threat Elimination (Attack)**
    *   **Condition:** An enemy unit is **Visible**, within **Range**, and the combat is **Winnable** (`AI_Attack >= Enemy_Armor`).
    *   **Targeting Priority:** 
        1.  High Threat units (Dice 5, Dice 6).
        2.  Weakest units (guaranteed kill).
    
2.  **Objective Advance (Move)**
    *   **Condition:** No immediate winnable attacks.
    *   **Goal:** Move towards the Player's Base (if location known/revealed) OR towards the Map Center (to gain control).
    *   **Units:** Prioritize moving stronger units or "merger" candidates.

3.  **Exploration (Scout)**
    *   **Condition:** No clear attack or objective path.
    *   **Action:** Move into adjacent **Fogged/Unexplored** hexes.
    *   **Goal:** Reveal terrain and locate enemy forces.

4.  **Merging (Consolidate)**
    *   **Condition:** Two friendly units are adjacent and can merge.
    *   **Preference:** 
        *   Sum > 6 (allows choosing specific unit type).
        *   Priority Choices: Dice 5 (Ranged) or Dice 6 (Special/Terraform).

5.  **Guard (Defend)**
    *   **Condition:** Unit is valuable (High Value), exposed to a visible enemy, and cannot attack this turn.
    *   **Action:** Activate Guard Mode (+Armor).

6.  **Reroll (Improve)**
    *   **Condition:** Unit is safe (no visible enemies), has Low Value (1 or 2).
    *   **Action:** Reroll to attempt an upgrade.

## 5. Implementation Roadmap

### Phase 1: Visibility System
- Implement `calculateVisibility(gameState, playerIndex)`: Returns a set of visible Hex IDs.
- Implement `filterStateForAI(gameState, playerIndex)`: Returns a sanitized Game State where non-visible enemy units are hidden (or "ghosted").

### Phase 2: Priority Bot Logic
- Create a `SimpleAI` class/module that replaces the complex Minimax logic in `ai.js`.
- Implement the **Priority List** evaluation function.
- Ensure `Dice 5` (Ranged) and `Dice 6` (Special) usage adheres to visibility (cannot target enemies in Fog).

### Phase 3: Terrain & Pathfinding
- Update pathfinding to account for **Unexplored** hexes (treat as traversable but unknown risk).
- Integrate **Terraform** usage (Dice 6 v1.4) into the decision tree (e.g., clear Forest to improve LoS, or build Forest to defend).

## 6. Technical Notes
- **File:** `ai.js` currently contains a Minimax implementation. This should be refactored or branched to support the "Simple Bot" mode.
- **Integration:** The `game.js` loop needs to pause for AI "thinking" time (visual delay) and then execute the chosen action via `initiateAction` / `completeAction`.
