 Strategy Proposal - Hex Dice v1.2: Extended Terrain

  1. Core Architecture Changes
   * Dynamic Map Scaling: Modify generateHexGrid and determineBaseLocations to handle the
     new R=8 size if has params `?R=8`. Otherwise R=5 as default.
   * Terrain Data Model: Add a terrainType property to the hex object (e.g., 'FOREST',
     'LAKE', 'TOWER', 'MOUNTAIN').
   * UI/Visuals: Update hexColor to reflect terrain types and ensure the larger grid fits
     the container.

  2. Terrain Setup Logic
   * Terrain Generation: Implement a new setupTerrain method that handles:
       * Preset: (Future-proofing) Placeholder for pre-designed layouts.
       * Roulette: Implementation of the sum-of-6-dice and clockwise placement logic.
       * Generation (R=8): Implementation of the 4-roll algorithm (Direction, Distance,
         Scatter, Terrain Type).

  3. Terrain Rules Implementation
   * Movement:
       * Update bfsValidMoves to check for LAKE (impassable) and MOUNTAIN (reduced range
         for some dice).
       * Modify movement cost logic to handle MOUNTAIN (2 steps/reduced max distance).
   * Combat & Defense:
       * Update calcDefenderEffectiveArmor to include bonuses from FOREST (+1), TOWER
         (+1), and MOUNTAIN (+2).
   * Ranged Attacks (Dice 5):
       * Update calcValidRangedTargets for TOWER (range 1-3) and MOUNTAIN (range 2-4).
       * Update hasLineOfSight to block LoS for FOREST, TOWER, and MOUNTAIN, while LAKE
         remains transparent.

  4. Initialization & Activation
   * Detect ?v=1.2 in the URL to activate these rules.
   * If v=1.2 is present, default to R=8 and trigger the terrain setup phase before
     deployment.

  Questions for the User:
   1. Terrain Generation UI: Should the terrain generation rolls (the 4-roll steps) be
      animated/visible in the log, or should the terrain just "appear" during the setup
      phase?
   2. Terrain Roulette Placement: For the "Roulette" mode, do you want a specific UI to
      handle the clockwise placement turn-by-turn, or should I implement a simpler "click
      to place" mode that cycles through players?
   3. Impassable Terrain for Dice 6: The rules say "Dice 6 is still able to move on
      Mountain hex by winning a combat." Does this mean it can enter a mountain hex only
      through combat, or is it immune to the 2-step cost?

  I'll wait for your feedback on these points before drafting the full plan.

  ---
  Plan Filename: v1.2-extended-terrain.md (to be drafted after agreement)

  Proposed Objective: Implement v1.2 Extended Terrain rules including R=8 map, terrain
  generation algorithms, and terrain-specific movement/combat modifiers.

  Key Files: game.js, index.html.

  Verification: New test scenarios for terrain-specific range bonuses, defensive bonuses,
  and LoS blocking. Manual verification of terrain generation steps.

  Consultation Level: Standard (Multiple viable approaches for terrain generation UI).

  Informal Agreement: I will wait for your confirmation before drafting the plan in the
  next turn.

  ---
  Next Step: Discuss the proposed strategy and answer the questions above. I will stop
  and wait for your feedback.
  I will now ask the user for clarification on the terrain generation UI, terrain
  roulette placement, and Dice 6 mountain movement to ensure the implementation aligns
  with their expectations.


╭───────────────────────────────────────────────────────────────────────────────────╮
│ ✓  Ask User                                                                       │
│                                                                                   │
│ User answered:                                                                    │
│   Terrain Gen UI → Instant Setup                                                  │
│   Roulette UI → Auto-Placement (Simple)                                           │
│   Dice 6 Mountain → Dice 6 cannot enter Mountain                                  │
╰───────────────────────────────────────────────────────────────────────────────────╯