Enhance the AI's heuristic logic:

  1. Unit-Specific Behavior (Role-Based AI)
  Currently, the AI treats all units (Dice 1-6) with the same general logic. We could add
  specialized heuristics based on the unit type:
   * Archers (Dice 2): Add a "Kiting" heuristic. Instead of just moving closer, Archers
     should receive a bonus for being exactly at their maximum range (Range 2) from an
     enemy, and a penalty for being adjacent.
   * Tankers (Dice 5) & Legates (Dice 6): Add a "Bodyguard" heuristic. They should
     receive a bonus for being positioned between the enemy's strongest units and the
     AI's own high-value/low-armor units (like Archers).
   * Knights (Dice 3): Add a "Flanking" bonus for positioning themselves behind enemy
     lines or near the enemy base using their 'L' movement.

  2. Multi-Turn "Kill Zone" Setup
  The current AI is "greedy"—it only acts if it can kill now. We can add a Collaboration
  Score:
   * Bonus for moving a unit to a hex where it "threatens" an enemy that is already
     threatened by another friendly unit.
   * This encourages the AI to "gang up" on high-armor targets (like a Dice 5) that
     cannot be killed by a single unit in one turn.

  3. Dynamic Strategy (Phase-Based Weights)
  The AI's weights are currently static. We could implement Weight Scaling:
   * Early Game: Increase advanceBonus and positioningWeight to capture the center.
   * Mid Game: Increase killBonus and protectedRangeBonus to win the attrition war.
   * Late Game (Base nearby): Dramatically increase captureBonus and riskTolerance to
     force a win, even if it means sacrificing units.

  4. Zone of Control (Pressure Map)
  Instead of just checking if a unit is threatened, we can calculate a Pressure Map for
  the entire board:
   * Each unit exerts "influence" on its reachable hexes.
   * The AI should prefer moving into hexes where it has high friendly influence and low
     enemy influence.
   * This would naturally lead to better "front lines" and prevent the AI from sending
     isolated units on suicide missions.

  5. Pathing and Obstruction Awareness
  A common issue with simpler AIs is "Self-Blocking":
   * Add a penalty for moves that block the path of a higher-value unit. For example, a
     Dice 1 shouldn't stand in a bottleneck if a Dice 4 is right behind it and needs to
     pass through to kill an enemy.

  6. 1-Ply "Counter-Move" Simulation
  While true Minimax is slow, the Heuristic AI could perform a "Mini-Lookahead":
   1. For each potential move, calculate the score.
   2. Then, for the top 3 moves, simulate the opponent's best single response.
   3. Subtract the opponent's best response score from the AI's move score.
   * This would prevent the AI from making a "great" move that immediately leaves it
     vulnerable to a devastating counter-attack.