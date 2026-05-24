# Autochess AI Veteran Scaling Plan

## Overview
In Autochess mode, when the human player (Player 0) merges units, their units become veterans (starred status) with increased attack and maximum HP. However, the AI opponents (Player 1, etc.) do not recruit or merge units during the preparation phase. Consequently, in later rounds, the AI opponents are left with their base units, making the player significantly stronger and causing a late-round balance issue.

We will balance this by dynamically giving AI players a random, identical set of veteran levels matching Player 0's active/deployed units before combat begins.

## Proposed Changes

### [js/autochess.js](file:///home/royalgarter/git/hexdice/js/autochess.js)
1. Add a new helper method `adjustAIVeterans(GAME)` to:
   - Identify the veteran levels of Player 0's top 6 (deployed) units.
   - For all other AI players, reset their units to base stats.
   - Assign the matched veteran levels randomly across the AI player's units.
2. Update `prepareCombat(GAME)` to invoke `GAME.Autochess.adjustAIVeterans(GAME)` at the beginning of the setup phase.

## Verification
- Start Autochess mode.
- Play a few rounds, merge units to upgrade them to veteran status (e.g., Fencer ★ or Archer ★★).
- Start battle and verify that AI units now also have corresponding veteran levels (e.g., stars on their names and matched stat increases).
