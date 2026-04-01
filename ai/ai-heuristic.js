/**
 * Heuristic-Priority AI Strategy for Hex Dice (Profile-Driven)
 *
 * Priority Order (configurable per profile):
 * 1. capture - Move to enemy base (win condition)
 * 2. kill - Move that destroys enemy unit
 * 3. attack - Move that damages enemy (not lethal)
 * 4. dodge - Escape threatened position
 * 5. position - Strategic positioning (advancement, merging, guarding)
 *
 * Usage:
 *   performAIByHeuristic(GAME) - Uses baseline profile
 *   performAIByHeuristic(GAME, 'berserker') - Uses specified profile
 */

// Default profile if none specified
const DEFAULT_PROFILE = {
    name: "Baseline",
    priorityOrder: ['capture', 'kill', 'attack', 'dodge', 'position'],
    weights: {
        captureBonus: 10000,
        killBonus: 1000,
        attackBonus: 100,
        safeBonus: 500,
        threatPenalty: -250,
        protectedRangeBonus: 50,
        friendlySixBonus: 100,
        advanceBonus: 50,
        guardPenalty: -500,
        mergeOver6Penalty: -500
    },
    riskTolerance: 0.5,
    targetSelection: 'highestValue',
    positioningStyle: 'balanced',
    unitSelection: 'leastMoved'
};

function performAIByHeuristic(GAME, profileName = 'baseline') {
    if (GAME.phase !== 'PLAYER_TURN' || !GAME.players[GAME.currentPlayerIndex].isAI) {
        console.log("AI stupid. Ending turn.");
        return;
    }

    // Load profile (use inline definition if heuristic-profiles.js not loaded)
    let profile = DEFAULT_PROFILE;
    if (typeof getProfile === 'function') {
        profile = getProfile(profileName);
    } else if (typeof heuristicProfiles !== 'undefined' && heuristicProfiles[profileName]) {
        profile = heuristicProfiles[profileName];
    }

    console.log(`AI (Heuristic: ${profile.name}) thinking...`);
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

    // Get opponent base for capture/positioning
    const opponentBaseHexId = state.players[opponentIndex].baseHexId;
    const opponentBaseHex = GAME.getHex(opponentBaseHexId, state);

    // Generate all possible moves for all units
    const allMoves = generateAllPossibleMoves(GAME, state);

    // Score and categorize all moves
    const scoredMoves = [];

    for (const move of allMoves) {
        const unit = currentPlayer.dice.find(d => d.hexId === move.unitHexId);
        if (!unit) continue;

        const moveAnalysis = heuristicMove(GAME, state, move, unit, opponentIndex, opponentBaseHex, opponentBaseHexId, profile);
        scoredMoves.push({
            move,
            unit,
            ...moveAnalysis
        });
    }

    // Execute moves by priority order from profile
    for (const priority of profile.priorityOrder) {
        const result = executePriority(GAME, scoredMoves, priority, profile, state, opponentIndex, opponentBaseHex, opponentBaseHexId);
        if (result) return;
    }

    // Fallback: End turn
    console.log("AI Heuristic: No good moves. Ending turn.");
    applyMove(GAME, { actionType: 'END_TURN' });
}

/**
 * Execute moves for a given priority category
 */
function executePriority(GAME, scoredMoves, priority, profile, state, opponentIndex, opponentBaseHex, opponentBaseHexId) {
    const w = profile.weights;

    switch (priority) {
        case 'capture': {
            // Find moves that capture enemy base (win condition)
            const captureMoves = scoredMoves.filter(m => m.canCapture);
            if (captureMoves.length > 0) {
                captureMoves.sort((a, b) => b.captureScore - a.captureScore);
                console.log(`AI Heuristic (${profile.name}): Capturing base!`, captureMoves[0].move);
                applyMove(GAME, captureMoves[0].move);
                return true;
            }
            break;
        }

        case 'kill': {
            // Find moves that kill enemies
            const killMoves = scoredMoves.filter(m => m.canKillEnemy);
            if (killMoves.length > 0) {
                killMoves.sort((a, b) => {
                    // Apply risk tolerance: berserker ignores safety more
                    const safetyWeight = (1 - profile.riskTolerance) * 2;
                    if (b.isSafe !== a.isSafe) return (b.isSafe - a.isSafe) * safetyWeight;
                    return (b.targetValue || 0) - (a.targetValue || 0);
                });
                console.log(`AI Heuristic (${profile.name}): Found kill opportunity!`, killMoves[0].move);
                applyMove(GAME, killMoves[0].move);
                return true;
            }
            break;
        }

        case 'attack': {
            // Find moves that attack but don't kill
            const attackMoves = scoredMoves.filter(m => m.canAttackEnemy && !m.canKillEnemy);
            if (attackMoves.length > 0) {
                attackMoves.sort((a, b) => {
                    const safetyWeight = (1 - profile.riskTolerance) * 2;
                    if (b.isSafe !== a.isSafe) return (b.isSafe - a.isSafe) * safetyWeight;
                    return (b.targetValue || 0) - (a.targetValue || 0);
                });
                console.log(`AI Heuristic (${profile.name}): Found attack opportunity!`, attackMoves[0].move);
                applyMove(GAME, attackMoves[0].move);
                return true;
            }
            break;
        }

        case 'dodge': {
            // Find moves that escape danger
            const threatenedMoves = scoredMoves.filter(m => m.isThreatened || m.canBeKilled);
            if (threatenedMoves.length > 0) {
                // Group by unit
                const unitEscapeMoves = new Map();
                threatenedMoves.forEach(m => {
                    if (!unitEscapeMoves.has(m.unit.id)) {
                        unitEscapeMoves.set(m.unit.id, []);
                    }
                    unitEscapeMoves.get(m.unit.id).push(m);
                });

                // Find best escape move
                let bestEscape = null;
                let bestEscapeScore = -Infinity;

                for (const [unitId, moves] of unitEscapeMoves) {
                    moves.sort((a, b) => {
                        if (a.canBeKilled && !b.canBeKilled) return 1;
                        if (!a.canBeKilled && b.canBeKilled) return -1;
                        if (b.isSafe !== a.isSafe) return b.isSafe - a.isSafe;
                        if (b.isInProtectedRange !== a.isInProtectedRange) return b.isInProtectedRange - a.isInProtectedRange;
                        if (b.nearFriendlySix !== a.nearFriendlySix) return b.nearFriendlySix - a.nearFriendlySix;
                        return b.score - a.score;
                    });

                    const bestMoveForUnit = moves[0];
                    if (bestMoveForUnit.isSafe && !bestMoveForUnit.canBeKilled) {
                        if (!bestEscape || bestMoveForUnit.score > bestEscapeScore) {
                            bestEscape = bestMoveForUnit;
                            bestEscapeScore = bestMoveForUnit.score;
                        }
                    }
                }

                if (bestEscape) {
                    console.log(`AI Heuristic (${profile.name}): Dodging to safety!`, bestEscape.move);
                    applyMove(GAME, bestEscape.move);
                    return true;
                }
            }
            break;
        }

        case 'position': {
            // Strategic positioning moves
            const strategicMoves = scoredMoves.filter(m => !m.isThreatened);
            if (strategicMoves.length > 0) {
                strategicMoves.forEach(m => {
                    let positionScore = m.score;
                    const w = profile.weights;

                    // Apply profile weights
                    if (m.isInProtectedRange) positionScore += w.protectedRangeBonus;
                    if (m.nearFriendlySix) positionScore += w.friendlySixBonus;

                    // Advance toward enemy base
                    if (m.move.actionType === 'MOVE' && opponentBaseHex) {
                        const targetHex = GAME.getHex(m.move.targetHexId, state);
                        const dist = GAME.axialDistance(targetHex.q, targetHex.r, opponentBaseHex.q, opponentBaseHex.r);
                        positionScore += (w.advanceBonus * (5 - Math.min(dist, 5)));
                    }

                    // Capture bonus (moving to enemy base)
                    if (m.move.targetHexId === opponentBaseHexId) {
                        positionScore += w.captureBonus;
                    }

                    // Merge penalty/bonus
                    if (m.move.actionType === 'MERGE') {
                        const targetUnit = GAME.getUnitOnHex(m.move.targetHexId, state);
                        if (targetUnit) {
                            const sumValue = m.unit.value + targetUnit.value;
                            if (sumValue > 6) {
                                positionScore += w.mergeOver6Penalty; // Can be positive for swarmer
                            }
                        }
                    }

                    // Guard penalty
                    if (m.move.actionType === 'GUARD') {
                        positionScore += w.guardPenalty;
                    }

                    m.positionScore = positionScore;
                });

                strategicMoves.sort((a, b) => b.positionScore - a.positionScore);
                console.log(`AI Heuristic (${profile.name}): Strategic positioning`, strategicMoves[0].move);
                applyMove(GAME, strategicMoves[0].move);
                return true;
            }
            break;
        }
    }

    return false;
}

/**
 * Analyze a single move for tactical value
 */
function heuristicMove(GAME, state, move, unit, opponentIndex, opponentBaseHex, opponentBaseHexId, profile = DEFAULT_PROFILE) {
    const w = profile.weights;
    const analysis = {
        canKillEnemy: false,
        canAttackEnemy: false,
        canCapture: false,
        isThreatened: false,
        canBeKilled: false,
        isSafe: true,
        isInProtectedRange: false,
        nearFriendlySix: false,
        targetValue: 0,
        captureScore: 0,
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

    // Check for capture (moving to enemy base)
    if (move.targetHexId === opponentBaseHexId) {
        analysis.canCapture = true;
        analysis.captureScore = w.captureBonus;
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
            analysis.score += w.killBonus + targetValue;
        } else {
            analysis.score += w.attackBonus + targetValue;
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
        analysis.score -= Math.abs(w.safeBonus); // Penalty equal to safe bonus
    } else if (analysis.isThreatened) {
        analysis.score += w.threatPenalty * threatCount;
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
                analysis.score += w.protectedRangeBonus;

                // Check if it's a Dice 6 (provides armor buff)
                if (neighborUnit.value === 6) {
                    analysis.nearFriendlySix = true;
                    analysis.score += w.friendlySixBonus;
                    break;
                }
            }
        }
    }

    // Guard action penalty
    if (move.actionType === 'GUARD') {
        analysis.score += w.guardPenalty;
    }

    return analysis;
}
