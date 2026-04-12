✦ I've updated calcValidMoves, calcValidRangedTargets, calcDefenderEffectiveArmor, and calcValidBraveChargeMoves to correctly
  handle terrain rules. Specifically, LAKE is now impassable and blocks movement, MOUNTAIN has proper movement costs and
  reduces distance for certain units, and TOWER and MOUNTAIN provide correct range buffs and defensive bonuses. My review
  confirms that these changes are thorough and correctly applied. I'm now ready to provide the final summary.

  Summary of changes:
   1. Impassable LAKE: Units cannot move onto or through LAKE hexes.
   2. Impassable MOUNTAIN for Dice 6: AI and movement logic now correctly block Dice 6 (Oracle/Legate) from entering MOUNTAIN
      hexes.
   3. Corrected MOUNTAIN costs: MOUNTAIN costs 2 movement steps for most units (except Dice 5).
   4. Dice 1, 2, 4 Movement Reduction: These units have their maximum movement distance reduced by 1 when calculating moves
      that involve MOUNTAIN hexes.
   5. Fixed Range Buffs:
       * TOWER: Range 1-3.
       * MOUNTAIN: Range 2-4.
   6. Fixed Defense Bonuses:
       * FOREST: +1 Armor.
       * TOWER: +1 Armor.
       * MOUNTAIN: +2 Armor.
   7. Consistency: Updated bfsValidMoves (used by Dice 2, 3, 5) and calcValidBraveChargeMoves (used by Dice 1) to ensure all
      movement patterns respect these rules.

  All requested fixes have been implemented.
