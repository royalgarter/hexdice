/**
 * Random-Greedy AI Strategy for Hex Dice
 * Picks a random unit that can act, then picks its most greedy move.
 */

function performAIByRandom(GAME) {
    if (GAME.phase !== 'PLAYER_TURN' || !GAME.players[GAME.currentPlayerIndex].isAI) {
        console.log("AI stupid. Ending turn.");
        return;
    }

    // console.log("AI (Random Greedy) thinking...");
    const state = GAME.cloneState();
    const currentPlayer = state.players[state.currentPlayerIndex];
    
    // Identify AI Units that can act
    const availableUnits = currentPlayer.dice.filter(d => d.isDeployed && !d.isDeath && !d.hasMovedOrAttackedThisTurn);

    if (availableUnits.length === 0) {
        console.log("AI has no units to act. Ending turn.");
        applyMove(GAME, { actionType: 'END_TURN' });
        return;
    }

    // 1. Pick a random unit from available units
    const randomUnitIndex = Math.floor(Math.random() * availableUnits.length);
    const unit = availableUnits[randomUnitIndex];

    // 2. Find all moves for this unit
    const allMoves = generateAllPossibleMoves(GAME, state);
    const unitMoves = allMoves.filter(m => m.unitHexId === unit.hexId);

    if (unitMoves.length === 0) {
        // This specific unit has no moves (shouldn't happen if generateAllPossibleMoves is correct)
        // Fallback to End Turn or pick another unit
        console.log("AI ending turn.");
        applyMove(GAME, { actionType: 'END_TURN' });
        return;
    }

    // 3. Score moves to find the "greediest"
    // Calculate distances to all opponent bases
    const opponentBaseHexes = [];
    for (let pIdx = 0; pIdx < state.players.length; pIdx++) {
        if (pIdx !== state.currentPlayerIndex && !state.players[pIdx].isEliminated) {
            const baseHex = GAME.getHex(state.players[pIdx].baseHexId, state);
            if (baseHex) {
                opponentBaseHexes.push(baseHex);
            }
        }
    }

    unitMoves.forEach(move => {
        let score = 0;

        // Attack that kills
        const targetUnit = GAME.getUnitOnHex(move.targetHexId, state);
        if (targetUnit && targetUnit.playerId !== state.currentPlayerIndex) {
            const defenderArmor = GAME.calcDefenderEffectiveArmor(move.targetHexId, state);
            let attackValue = unit.attack;

            if (move.actionType === 'RANGED_ATTACK') attackValue = 2; // Fixed for Dice 2
            if (move.actionType === 'COMMAND_CONQUER') attackValue = 6; // Fixed for Dice 6

            if (attackValue >= defenderArmor) {
                score += 1000 + targetUnit.value;
            } else {
                score += 100 + targetUnit.value; // Regular attack
            }
        }

        // Advancement towards enemy bases (closest one)
        if (move.actionType === 'MOVE' && !targetUnit && opponentBaseHexes.length > 0) {
            const targetHex = GAME.getHex(move.targetHexId, state);
            let minDist = Infinity;
            for (const baseHex of opponentBaseHexes) {
                const dist = GAME.axialDistance(targetHex.q, targetHex.r, baseHex.q, baseHex.r);
                if (dist < minDist) minDist = dist;
            }
            score += (50 - minDist); // Higher score for being closer
        }

        // Merge bonus
        if (move.actionType === 'MERGE') {
            const targetUnitForMerge = GAME.getUnitOnHex(move.targetHexId, state);
            if (targetUnitForMerge) {
                const sumValue = unit.value + targetUnitForMerge.value;
                score -= (sumValue > 6) ? 500 : 200;
            }
        }

        // Guard
        if (move.actionType === 'GUARD') {
            score -= 500;
        }

        // --- Threat Assessment ---
        // Evaluate the safety of the destination hex
        const nextState = applyMove(GAME, move, state);
        if (nextState) {
            const aiUnitNext = nextState.players[state.currentPlayerIndex].dice.find(d => d.id === unit.id);

            if (aiUnitNext && !aiUnitNext.isDeath) {
                let isThreatened = false;
                let canBeKilled = false;

                // Check all opponents
                for (let pIdx = 0; pIdx < nextState.players.length; pIdx++) {
                    if (pIdx === state.currentPlayerIndex) continue;

                    const opponents = nextState.players[pIdx].dice.filter(d => d.isDeployed && !d.isDeath);
                    for (const opp of opponents) {
                        if (GAME.canUnitAttackTarget(opp, aiUnitNext, nextState)) {
                            isThreatened = true;

                            const defenderArmor = GAME.calcDefenderEffectiveArmor(aiUnitNext.hexId, nextState);
                            const oppAttack = opp.attack;

                            if (oppAttack >= defenderArmor) {
                                canBeKilled = true;
                                break; 
                            }
                        }
                    }
                    if (canBeKilled) break;
                }

                if (canBeKilled) {
                    score -= 1000; // Large penalty for potentially being killed
                } else if (isThreatened) {
                    score -= 250; // Moderate penalty for being attackable
                }
            }
        }

        move.greedyScore = score;
    });

    // 4. Sort and pick the best (most greedy)
    unitMoves.sort((a, b) => b.greedyScore - a.greedyScore);
    const bestMove = unitMoves[0];

    console.log("AI Random Greedy selected unit at", unit.hexId, "and move:", bestMove);
    applyMove(GAME, bestMove);
}
