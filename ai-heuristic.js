/**
 * Heuristic-Priority AI Strategy for Hex Dice
 * 
 * Priority Order:
 * 1. Scan all units
 * 2. If unit can be killed or attacked, dodge (prioritize safety)
 * 3. If unit can kill or attack enemy, do it (prioritize kills)
 * 4. Pick least moved or farthest away unit, choose best move
 *    - Prefer moves in protected range of friendly units
 *    - Prefer moves near friendly Dice 6 (for armor buff)
 */

function performAIByHeuristic(GAME) {
    if (GAME.phase !== 'PLAYER_TURN' || !GAME.players[GAME.currentPlayerIndex].isAI) {
        console.log("AI stupid. Ending turn.");
        return;
    }

    console.log("AI (Heuristic Priority) thinking...");
    const state = GAME.cloneState();
    const currentPlayer = state.players[state.currentPlayerIndex];
    const opponentIndex = (state.currentPlayerIndex + 1) % state.players.length;

    // Identify AI Units that can act
    const availableUnits = currentPlayer.dice.filter(d => d.isDeployed && !d.isDeath && !d.hasMovedOrAttackedThisTurn);

    if (availableUnits.length === 0) {
        console.log("AI has no units to act. Ending turn.");
        applyMove(GAME, { actionType: 'END_TURN' });
        return;
    }

    // Get opponent base for positioning
    const opponentBaseHexId = state.players[opponentIndex].baseHexId;
    const opponentBaseHex = GAME.getHex(opponentBaseHexId, state);

    // Generate all possible moves for all units
    const allMoves = generateAllPossibleMoves(GAME, state);

    // Score and categorize all moves
    const scoredMoves = [];

    for (const move of allMoves) {
        const unit = currentPlayer.dice.find(d => d.hexId === move.unitHexId);
        if (!unit) continue;

        const moveAnalysis = heuristicMove(GAME, state, move, unit, opponentIndex, opponentBaseHex);
        scoredMoves.push({
            move,
            unit,
            ...moveAnalysis
        });
    }

    // Priority 1: Find moves that kill enemies (offensive opportunity)
    const killMoves = scoredMoves.filter(m => m.canKillEnemy);
    if (killMoves.length > 0) {
        // Pick the best kill move (highest value target or safest)
        killMoves.sort((a, b) => {
            if (b.isSafe !== a.isSafe) return b.isSafe - a.isSafe; // Prefer safe moves
            return b.targetValue - a.targetValue; // Then by target value
        });
        const bestKillMove = killMoves[0];
        console.log("AI Heuristic: Found kill opportunity!", bestKillMove.move);
        applyMove(GAME, bestKillMove.move);
        return;
    }

    // Priority 2: Find moves that attack enemies (aggressive opportunity)
    const attackMoves = scoredMoves.filter(m => m.canAttackEnemy && !m.canKillEnemy);
    if (attackMoves.length > 0) {
        // Pick the best attack move (safest first)
        attackMoves.sort((a, b) => {
            if (b.isSafe !== a.isSafe) return b.isSafe - a.isSafe;
            return b.targetValue - a.targetValue;
        });
        const bestAttackMove = attackMoves[0];
        console.log("AI Heuristic: Found attack opportunity!", bestAttackMove.move);
        applyMove(GAME, bestAttackMove.move);
        return;
    }

    // Priority 3: Dodge dangerous positions (defensive maneuver)
    const threatenedUnits = scoredMoves.filter(m => m.isThreatened || m.canBeKilled);
    if (threatenedUnits.length > 0) {
        // Group by unit to find safest move for each threatened unit
        const unitEscapeMoves = new Map();
        threatenedUnits.forEach(m => {
            if (!unitEscapeMoves.has(m.unit.id)) {
                unitEscapeMoves.set(m.unit.id, []);
            }
            unitEscapeMoves.get(m.unit.id).push(m);
        });

        // Find the unit in most danger that can escape
        let bestEscape = null;
        let bestEscapeScore = -Infinity;

        for (const [unitId, moves] of unitEscapeMoves) {
            // Sort moves by safety and protection
            moves.sort((a, b) => {
                // Prefer moves that escape kill threat
                if (a.canBeKilled && !b.canBeKilled) return 1;
                if (!a.canBeKilled && b.canBeKilled) return -1;
                
                // Prefer safer positions
                if (b.isSafe !== a.isSafe) return b.isSafe - a.isSafe;
                
                // Prefer protected positions
                if (b.isInProtectedRange !== a.isInProtectedRange) return b.isInProtectedRange - a.isInProtectedRange;
                
                // Prefer near Dice 6
                if (b.nearFriendlySix !== a.nearFriendlySix) return b.nearFriendlySix - a.nearFriendlySix;
                
                return b.score - a.score;
            });

            const bestMoveForUnit = moves[0];
            if (bestMoveForUnit.isSafe && !bestMoveForUnit.canBeKilled) {
                // This is a good escape
                if (!bestEscape || bestMoveForUnit.score > bestEscapeScore) {
                    bestEscape = bestMoveForUnit;
                    bestEscapeScore = bestMoveForUnit.score;
                }
            }
        }

        if (bestEscape) {
            console.log("AI Heuristic: Dodging to safety!", bestEscape.move);
            applyMove(GAME, bestEscape.move);
            return;
        }
    }

    // Priority 4: Strategic positioning (select unit and move)
    // Pick unit that has moved least or is farthest from enemy base
    const strategicMoves = scoredMoves.filter(m => !m.isThreatened);
    
    if (strategicMoves.length > 0) {
        // Score based on positioning preferences
        strategicMoves.forEach(m => {
            let positionScore = m.score;

            // Bonus for being in protected range
            if (m.isInProtectedRange) positionScore += 200;

            // Bonus for being near friendly Dice 6
            if (m.nearFriendlySix) positionScore += 150;

            // Bonus for advancing toward enemy base (for moves)
            if (m.move.actionType === 'MOVE' && opponentBaseHex) {
                const targetHex = GAME.getHex(m.move.targetHexId, state);
                const dist = GAME.axialDistance(targetHex.q, targetHex.r, opponentBaseHex.q, opponentBaseHex.r);
                positionScore += (50 - dist);
            }

            // Penalty for merging into dangerous sums
            if (m.move.actionType === 'MERGE') {
                const targetUnit = GAME.getUnitOnHex(m.move.targetHexId, state);
                if (targetUnit) {
                    const sumValue = m.unit.value + targetUnit.value;
                    if (sumValue > 6) positionScore -= 500;
                }
            }

            m.positionScore = positionScore;
        });

        // Sort by position score
        strategicMoves.sort((a, b) => b.positionScore - a.positionScore);

        const bestStrategicMove = strategicMoves[0];
        console.log("AI Heuristic: Strategic positioning", bestStrategicMove.move);
        applyMove(GAME, bestStrategicMove.move);
        return;
    }

    // Fallback: End turn
    console.log("AI Heuristic: No good moves. Ending turn.");
    applyMove(GAME, { actionType: 'END_TURN' });
}

/**
 * Analyze a single move for tactical value
 */
function heuristicMove(GAME, state, move, unit, opponentIndex, opponentBaseHex) {
    const analysis = {
        canKillEnemy: false,
        canAttackEnemy: false,
        isThreatened: false,
        canBeKilled: false,
        isSafe: true,
        isInProtectedRange: false,
        nearFriendlySix: false,
        targetValue: 0,
        score: 0
    };

    // Simulate the move
    const nextState = applyMove(GAME, move, state);
    if (!nextState) return analysis;

    // Get unit's position after move
    const aiUnitNext = nextState.players[state.currentPlayerIndex].dice.find(d => d.id === unit.id);
    if (!aiUnitNext || aiUnitNext.isDeath) {
        analysis.isSafe = false;
        analysis.canBeKilled = true;
        return analysis;
    }

    // Check if this move kills or attacks an enemy
    const targetUnit = GAME.getUnitOnHex(move.targetHexId, state);
    if (targetUnit && targetUnit.playerId !== state.currentPlayerIndex) {
        const defenderArmor = GAME.calcDefenderEffectiveArmor(move.targetHexId, state);
        let attackValue = unit.attack;

        if (move.actionType === 'RANGED_ATTACK') attackValue = 2;
        if (move.actionType === 'COMMAND_CONQUER') attackValue = 6;

        analysis.canAttackEnemy = true;
        analysis.targetValue = targetUnit.value;

        if (attackValue >= defenderArmor) {
            analysis.canKillEnemy = true;
            analysis.score += 1000 + targetUnit.value;
        } else {
            analysis.score += 100 + targetUnit.value;
        }
    }

    // Check threat level at destination
    let threatCount = 0;
    let canBeKilledByAny = false;

    for (let pIdx = 0; pIdx < nextState.players.length; pIdx++) {
        if (pIdx === state.currentPlayerIndex) continue;

        const opponents = nextState.players[pIdx].dice.filter(d => d.isDeployed && !d.isDeath && !d.hasMovedOrAttackedThisTurn);
        for (const opp of opponents) {
            if (GAME.canUnitAttackTarget(opp, aiUnitNext, nextState)) {
                analysis.isThreatened = true;
                threatCount++;

                const defenderArmor = GAME.calcDefenderEffectiveArmor(aiUnitNext.hexId, nextState);
                const oppAttack = opp.attack;

                if (oppAttack >= defenderArmor) {
                    canBeKilledByAny = true;
                    break;
                }
            }
        }
        if (canBeKilledByAny) break;
    }

    analysis.canBeKilled = canBeKilledByAny;
    if (canBeKilledByAny) {
        analysis.isSafe = false;
        analysis.score -= 1000;
    } else if (analysis.isThreatened) {
        analysis.score -= 250 * threatCount;
    }

    // Check if position is protected by friendly units
    if (aiUnitNext && !analysis.canBeKilled) {
        const unitHex = GAME.getHex(aiUnitNext.hexId, nextState);
        const neighbors = GAME.getNeighbors(unitHex, nextState);

        // Check for friendly units that can protect this position
        for (const neighbor of neighbors) {
            const neighborUnit = GAME.getUnitOnHex(neighbor.id, nextState);
            if (neighborUnit && neighborUnit.playerId === state.currentPlayerIndex) {
                // Friendly unit adjacent - provides some protection
                analysis.isInProtectedRange = true;
                analysis.score += 50;

                // Check if it's a Dice 6 (provides armor buff)
                if (neighborUnit.value === 6) {
                    analysis.nearFriendlySix = true;
                    analysis.score += 100;
                    break;
                }
            }
        }
    }

    // Guard action penalty
    if (move.actionType === 'GUARD') {
        analysis.score -= 500;
    }

    return analysis;
}
