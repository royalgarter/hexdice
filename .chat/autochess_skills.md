# Plan: Autochess Skill Trees

Introduce branching skill trees to Autochess mode, allowing units to pick a skill at each level of veteran upgrade (max Veteran Level 3).

## Proposed Changes

1. **`js/autochess.js`**:
   - Initialize `perks` object for each unit in `createUnit`.
   - Implement `selectUnitSkill(GAME, unitId, tier, option)` to assign perks to units.
   - Update `mergeUnits(GAME, playerId, unitId1, unitId2)` to cap veteran level at 3, keep the merged unit selected, and ensure perks are initialized.
   - Update `adjustAIVeterans(GAME)` to randomly assign perks (`A` or `B`) to AI units when they are scaled up.

2. **`js/game.js`**:
   - Expose `selectAutochessUnitSkill(unitId, tier, option)` to the Alpine / HTML interface.
   - Modify `hasPerk(unit, tier, option)` to check `unit.perks` in Autochess mode.

3. **`index.html`**:
   - Add a premium, responsive details & skill-picking UI for the selected Autochess unit in the preparation phase.
   - Format: Tabs, 1TBS, Semicolons as per `GEMINI.md`.

## Verification Plan

### Manual Verification
- Start Autochess mode.
- Purchase matching units and merge them to level them up.
- Select the leveled-up unit to verify the details panel appears.
- Select a skill from the skill tree and check if it is correctly assigned and logged.
- Verify that combat mechanics evaluate the chosen skill.
