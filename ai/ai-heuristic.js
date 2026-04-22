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
const DEFAULT_PROFILE = heuristicProfiles.baseline;

/**
 * Adjust AI weights based on the current game phase
 */
function calculatePhaseWeights(GAME, state, profile) {
    const dynamicProfile = JSON.parse(JSON.stringify(profile));
    const w = dynamicProfile.weights;
    
    const currentPlayer = state.players[state.currentPlayerIndex];
    const deployedUnits = currentPlayer.dice.filter(d => d.isDeployed && !d.isDeath).length;
    const totalPossibleUnits = currentPlayer.dice.length;
    
    // Estimate game phase
    let phase = 'mid';
    if (deployedUnits < totalPossibleUnits * 0.4) {
        phase = 'early';
    } else if (deployedUnits < totalPossibleUnits * 0.2 || state.turnCount > 100) {
        // Very few units left or very long game
        phase = 'late';
    }

    // Weight adjustments per phase
    if (phase === 'early') {
        w.advanceBonus *= 2.0;       // Aggressive expansion
        w.killBonus *= 0.5;          // Position over blood
        w.teamPositionWeight *= 0.8; // Formations less critical than speed
    } else if (phase === 'late') {
        w.captureBonus *= 5.0;       // Focus on the win
        w.killBonus *= 1.5;          // Finish them off
        dynamicProfile.riskTolerance = Math.min(1.0, dynamicProfile.riskTolerance + 0.3); // More reckless
    }

    return dynamicProfile;
}

/**
 * Calculate the Pressure Map for the entire board.
 * Positive values = Friendly influence/safety.
 * Negative values = Enemy influence/danger.
 */
function calculatePressureMap(GAME, state, myPlayerIndex) {
    const pressureMap = {};
    
    // Initialize map
    for (const hex of state.hexes) {
        pressureMap[hex.id] = 0;
    }

    // Each unit exerts pressure around its location
    for (const player of state.players) {
        const isFriendly = player.id === myPlayerIndex;
        const multiplier = isFriendly ? 1 : -1;

        for (const unit of player.dice) {
            if (!unit.isDeployed || unit.isDeath) continue;

            const unitHex = GAME.getHex(unit.hexId, state);
            if (!unitHex) continue;

            // Pressure radius: Base radius + Range
            // Dice 2 (Archer) has Range 2, Dice 6 (Legate) has Range 1
            const baseRadius = 2; // Immediate area of influence
            const totalRadius = baseRadius + (unit.range || 0);

            // Iterate through hexes in radius to apply pressure
            for (const hex of state.hexes) {
                const dist = GAME.axialDistance(unitHex.q, unitHex.r, hex.q, hex.r);
                if (dist <= totalRadius) {
                    // Pressure decreases with distance
                    // Strongest at dist 0 (unit location)
                    const pressureValue = (totalRadius - dist + 1) * unit.value * 10;
                    pressureMap[hex.id] += pressureValue * multiplier;
                }
            }
        }
    }

    return pressureMap;
}

function performAIByHeuristic(GAME, profileName = 'baseline', verbose = true) {
    if (GAME.phase !== 'PLAYER_TURN' || !GAME.players[GAME.currentPlayerIndex].isAI) {
        console.log("AI stupid. Ending turn.");
        return;
    }

    // GAME.players[GAME.currentPlayerIndex].profileName = GAME.players[GAME.currentPlayerIndex].profileName
    //     || Object.keys(heuristicProfiles).random()
    //     || profileName;

    // profileName = GAME.players[GAME.currentPlayerIndex].profileName;

    // Load profile (use inline definition if heuristic-profiles.js not loaded)
    let profile = DEFAULT_PROFILE;
    if (typeof getProfile === 'function') {
        profile = getProfile(profileName);
    } else if (typeof heuristicProfiles !== 'undefined' && heuristicProfiles[profileName]) {
        profile = heuristicProfiles[profileName];
    }

    if (verbose) {
        // console.log(`AI (Heuristic: ${profile.name}) thinking...`);
    }

    const state = GAME.cloneState();
    const currentPlayer = state.players[state.currentPlayerIndex];
    
    // Identify all active opponents
    const opponentIndices = state.players
        .filter(p => p.id !== state.currentPlayerIndex && !p.isEliminated)
        .map(p => p.id);

    // Adjust weights based on game phase
    const dynamicProfile = calculatePhaseWeights(GAME, state, profile);
    profile = dynamicProfile;

    // Calculate Pressure Map for this turn (already handles all players)
    const pressureMap = calculatePressureMap(GAME, state, state.currentPlayerIndex);

    // PRE-CALCULATE THREATS: For Oracle spell evaluation
    const predictedThreats = predictEnemyThreats(GAME, state, state.currentPlayerIndex);

    // Identify AI Units that can act
    const availableUnits = currentPlayer.dice.filter(d => d.isDeployed && !d.isDeath && !d.hasMovedOrAttackedThisTurn);

    if (availableUnits.length === 0) {
        GAME.addLog(`P${GAME.currentPlayerIndex+1} AI Heuristic: No units to act. Ending turn.`);
        applyMove(GAME, { actionType: 'END_TURN' });
        return;
    }

    // Get all opponent bases
    const opponentBases = opponentIndices
        .filter(idx => !state.players[idx].isEliminated)
        .map(idx => ({
            id: idx,
            baseHexId: state.players[idx].baseHexId,
            baseHex: GAME.getHex(state.players[idx].baseHexId, state)
        }))
        .filter(b => b.baseHex);

    // Generate all possible moves for all units
    const allMoves = generateAllPossibleMoves(GAME, state);

    // Score and categorize all moves
    const scoredMoves = [];

    for (const move of allMoves) {
        const unit = currentPlayer.dice.find(d => d.hexId === move.unitHexId);
        if (!unit) continue;

        const moveAnalysis = heuristicMove(GAME, state, move, unit, opponentIndices, opponentBases, profile, pressureMap, predictedThreats);
        scoredMoves.push({
            move,
            unit,
            ...moveAnalysis
        });
    }


    // Execute moves by priority order from profile
    for (const priority of profile.priorityOrder) {
        const result = executePriority(GAME, scoredMoves, priority, profile, state, opponentBases, verbose);
        if (result) return;
    }

    // Fallback: End turn
    GAME.addLog(`P${GAME.currentPlayerIndex+1} AI Heuristic: No good moves. Ending turn.`);
    applyMove(GAME, { actionType: 'END_TURN' });
}

/**
 * Predict which enemy units can attack next turn and calculate likely targets.
 * Used for tactical evaluation of support actions like Shielding or Skirmishing.
 */
function predictEnemyThreats(GAME, state, myPlayerIndex) {
    const threats = [];
    const myUnits = state.players[myPlayerIndex].dice.filter(d => d.isDeployed && !d.isDeath);
    const enemies = state.players.flatMap((p, idx) =>
        (idx === myPlayerIndex || p.isEliminated) ? [] : p.dice.filter(d => d.isDeployed && !d.isDeath)
    );

    for (const enemy of enemies) {
        const enemyHex = GAME.getHex(enemy.hexId, state);
        if (!enemyHex) continue;

        // Calculate units this enemy can attack (Melee)
        const neighbors = GAME.getNeighbors(enemyHex, state);
        for (const neighbor of neighbors) {
            const targetUnit = GAME.getUnitOnHex(neighbor.id, state);
            if (targetUnit && targetUnit.playerId === myPlayerIndex) {
                const defenderArmor = GAME.calcDefenderEffectiveArmor(neighbor.id, state);
                const canKill = enemy.attack >= defenderArmor;
                threats.push({
                    attacker: enemy,
                    target: targetUnit,
                    targetHexId: neighbor.id,
                    canKill,
                    attackValue: enemy.attack,
                    defenderArmor: defenderArmor
                });
            }
        }

        // Ranged threats (Dice 2)
        if (enemy.value === 2) {
            const validRanged = GAME.calcValidRangedTargets(enemy.hexId, state);
            for (const targetHexId of validRanged) {
                const targetUnit = GAME.getUnitOnHex(targetHexId, state);
                if (targetUnit && targetUnit.playerId === myPlayerIndex) {
                    const defenderArmor = GAME.calcDefenderEffectiveArmor(targetHexId, state);
                    threats.push({
                        attacker: enemy,
                        target: targetUnit,
                        targetHexId,
                        canKill: enemy.attack >= defenderArmor,
                        attackValue: enemy.attack,
                        defenderArmor,
                        isRanged: true
                    });
                }
            }
        }
    }
    return threats;
}

/**
 * Execute moves for a given priority category
 */
function executePriority(GAME, scoredMoves, priority, profile, state, opponentBases, verbose = true) {
    const w = profile.weights;

    scoredMoves.sort((a, b) => b.score - a.score);
    // if (verbose) console.log('Scores:', scoredMoves.map(x => [x.move.actionType, x.score].join(':')).join(', ') );

    switch (priority) {
        case 'capture': {
            // Find moves that capture any enemy base (win condition)
            const captureMoves = scoredMoves.filter(m => m.canCapture);
            if (captureMoves.length > 0) {
                captureMoves.sort((a, b) => b.captureScore - a.captureScore);
                if (verbose) console.log(`AI Heuristic (${profile.name}): Capturing base!`, captureMoves[0].move);
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
                    const safetyWeight = (1 - profile.riskTolerance) * 2;
                    if (b.isSafe !== a.isSafe) return (b.isSafe - a.isSafe) * safetyWeight;
                    return (b.targetValue || 0) - (a.targetValue || 0);
                });
                if (verbose) console.log(`AI Heuristic (${profile.name}): Found kill opportunity!`, killMoves[0].move);
                applyMove(GAME, killMoves[0].move);
                return true;
            }
            break;
        }

        case 'attack': {
            const attackMoves = scoredMoves.filter(m => m.canAttackEnemy && !m.canKillEnemy);
            if (attackMoves.length > 0) {
                attackMoves.sort((a, b) => {
                    const safetyWeight = (1 - profile.riskTolerance) * 2;
                    if (b.isSafe !== a.isSafe) return (b.isSafe - a.isSafe) * safetyWeight;
                    return (b.targetValue || 0) - (a.targetValue || 0);
                });
                if (verbose) console.log(`AI Heuristic (${profile.name}): Found attack opportunity!`, attackMoves[0].move);
                applyMove(GAME, attackMoves[0].move);
                return true;
            }
            break;
        }

        case 'spell': {
            // Support and utility actions (mostly Oracle)
            const spellMoves = scoredMoves.filter(m => m.move.actionType.includes('SPELLCAST_'));
            if (spellMoves.length > 0) {
                // Filter out spells that are currently unsafe unless they are escape actions
                const viableSpells = spellMoves.filter(m => m.isSafe || m.isEscapeAction || profile.riskTolerance > 0.7);

                const ratio = viableSpells.length / 3/*Oracle have 3 spells*/ / scoredMoves.length; 

                if (viableSpells.length > 0 && (random() < ratio)) {
                    if (verbose) console.log('Spellcast Ratio:', ratio);
                    
                    viableSpells.sort((a, b) => b.score - a.score);
                    if (verbose) console.log(`AI Heuristic (${profile.name}): Casting spell!`, viableSpells[0].move, viableSpells[0].score);
                    applyMove(GAME, viableSpells[0].move);
                    return true;
                }
            }
            break;
        }

        case 'dodge': {
            const threatenedMoves = scoredMoves.filter(m => m.isCurrentlyThreatened || m.canBeKilledCurrently);
            if (threatenedMoves.length > 0) {
                const unitEscapeMoves = new Map();
                threatenedMoves.forEach(m => {
                    if (!unitEscapeMoves.has(m.unit.id)) {
                        unitEscapeMoves.set(m.unit.id, []);
                    }
                    unitEscapeMoves.get(m.unit.id).push(m);
                });

                let bestEscape = null;
                let bestEscapeScore = -Infinity;

                for (const [unitId, moves] of unitEscapeMoves) {
                    moves.sort((a, b) => {
                        if (a.canBeKilled && !b.canBeKilled) return 1;
                        if (!a.canBeKilled && b.canBeKilled) return -1;
                        if (b.isSafe !== a.isSafe) return (b.isSafe ? 1 : 0) - (a.isSafe ? 1 : 0);
                        if (b.isInProtectedRange !== a.isInProtectedRange) return (b.isInProtectedRange ? 1 : 0) - (a.isInProtectedRange ? 1 : 0);
                        if (b.nearFriendlySix !== a.nearFriendlySix) return (b.nearFriendlySix ? 1 : 0) - (a.nearFriendlySix ? 1 : 0);
                        return b.score - a.score;
                    });

                    const bestMoveForUnit = moves[0];
                    if (bestMoveForUnit.isSafe || !bestMoveForUnit.canBeKilled) {
                        if (!bestEscape || bestMoveForUnit.score > bestEscapeScore) {
                            bestEscape = bestMoveForUnit;
                            bestEscapeScore = bestMoveForUnit.score;
                        }
                    }
                }

                if (bestEscape) {
                    if (verbose) console.log(`AI Heuristic (${profile.name}): Dodging to safety!`, bestEscape.move);
                    applyMove(GAME, bestEscape.move);
                    return true;
                }
            }
            break;
        }

        case 'position': {
            const strategicMoves = scoredMoves.filter(m => !m.isThreatened)
                                            .filter(m => !m.move.actionType.includes('SPELLCAST_'));
                
            if (strategicMoves.length > 0) {
                strategicMoves.forEach(m => {
                    let positionScore = m.score;
                    const w = profile.weights;

                    if (m.isInProtectedRange) positionScore += w.protectedRangeBonus;
                    if (m.nearFriendlySix) positionScore += w.friendlySixBonus;

                    if (m.move.actionType === 'MOVE' && opponentBases.length > 0) {
                        const targetHex = GAME.getHex(m.move.targetHexId, state);

                        // Distance to nearest opponent base
                        let minBaseDist = Infinity;
                        opponentBases.forEach(base => {
                            const dist = GAME.axialDistance(targetHex.q, targetHex.r, base.baseHex.q, base.baseHex.r);
                            if (dist < minBaseDist) minBaseDist = dist;
                        });

                        const maxDist = (GAME.getRadius ? GAME.getRadius() : 5) * 2;
                        positionScore += (w.advanceBonus * (maxDist - minBaseDist));
                    }

                    // Check if unit is already on a captured base
                    const unitCurrentHexId = m.unit.hexId;
                    const isUnitOnCapturedBase = opponentBases.some(b => b.baseHexId === unitCurrentHexId);
                    const isTargetOnEnemyBase = opponentBases.some(b => b.baseHexId === m.move.targetHexId);

                    if (isTargetOnEnemyBase) {
                        // If unit is already on a captured base, reduce capture bonus to encourage movement
                        if (isUnitOnCapturedBase && m.move.actionType === 'MOVE') {
                            positionScore += w.captureBonus * 0.1; // Only 10% to encourage advancement
                        } else {
                            positionScore += w.captureBonus;
                        }
                    }

                    if (m.move.actionType === 'MERGE') {
                        const targetUnit = GAME.getUnitOnHex(m.move.targetHexId, state);
                        if (targetUnit) {
                            const sumValue = m.unit.value + targetUnit.value;
                            if (sumValue > 6) {
                                positionScore += w.mergeOver6Penalty;
                            }
                        }
                    }

                    if (m.move.actionType === 'GUARD') {
                        positionScore += w.guardPenalty;
                    }

                    if (m.move.actionType.includes('SPELLCAST_')) {
                        positionScore = positionScore * (w.spells[m.move.actionType] || 1)
                    }

                    m.positionScore = Math.floor(positionScore);
                });

                strategicMoves.sort((a, b) => b.positionScore - a.positionScore);
                if (verbose) console.log(`AI Heuristic (${profile.name}): Strategic positioning`, strategicMoves[0].move, strategicMoves[0].positionScore);
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
function heuristicMove(GAME, state, move, unit, opponentIndices, opponentBases, profile = DEFAULT_PROFILE, pressureMap = {}, predictedThreats = []) {
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
        score: 0,
        isSupportAction: false,
        isEscapeAction: false
    };

    analysis.isCurrentlyThreatened = predictedThreats.some(t => t.target.id === unit.id);
    analysis.canBeKilledCurrently = predictedThreats.some(t => t.target.id === unit.id && t.canKill);

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

    // Zone of Control (Pressure Map) bonus/penalty
    const targetPressure = pressureMap[move.targetHexId] || 0;
    analysis.score += targetPressure * (w.pressureWeight || 0.3);

    // Team Position Score calculation
    if (typeof calculateTeamScore === 'function') {
        const currentTeamScore = calculateTeamScore(GAME, state, state.currentPlayerIndex, opponentBases);
        const nextTeamScore = calculateTeamScore(GAME, nextState, state.currentPlayerIndex, opponentBases);
        analysis.score += (nextTeamScore - currentTeamScore) * (w.teamPositionWeight || 0.5);
    }

    // Penalty for back-and-forth movement (avoiding repetitive patterns)
    if (unit.lastHexId && move.targetHexId === unit.lastHexId && move.actionType === 'MOVE') {
        analysis.score += (w.backAndForthPenalty || -300);
    }

    // Check if unit is already on an enemy base (base already captured)
    const unitCurrentHexId = unit.hexId;
    const isTargetOnEnemyBase = opponentBases.some(b => b.baseHexId === move.targetHexId);

    // Check for capture (moving to any enemy base)
    if (isTargetOnEnemyBase) {
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
            analysis.score += w.killBonus + targetUnit.value;
        } else {
            analysis.score += w.attackBonus + targetUnit.value;
        }
    }

    // Check threat level at destination (from ALL opponents)
    let threatCount = 0;
    let canBeKilledByAny = false;

    for (const pIdx of opponentIndices) {
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
        analysis.isSafe = false;
        analysis.score += w.threatPenalty * threatCount;
    }

    // --- TERRAIN-SPECIFIC HEURISTICS ---
    const targetHex = nextState.hexes.find(h => h.id === move.targetHexId);
    if (targetHex && targetHex.terrainType !== 'PLAIN') {
        const tw = w.terrainWeights || {
            defenseBonusWeight: 50,
            archerTowerBonus: 100,
            archerMountainBonus: 150,
            mountainMovePenalty: -100,
            losBlockBonus: 100
        };

        // 1. Defensive Bonus: Value Armor from Forest (+1), Tower (+1), Mountain (+2)
        if (targetHex.terrainType === 'FOREST' || targetHex.terrainType === 'TOWER') {
            analysis.score += tw.defenseBonusWeight;
        } else if (targetHex.terrainType === 'MOUNTAIN') {
            analysis.score += tw.defenseBonusWeight * 2;
            
            // Mountain Move Penalty (Cost 2, reduced distance) - Tankers (Dice 5) ignore this
            if (unit.value !== 5) {
                analysis.score += tw.mountainMovePenalty;
            }

            // Hussars (Dice 3) cannot enter Mountains
            if (unit.value === 3) {
                analysis.score -= 5000; 
            }
        }

        // 2. Archer/Oracle Specialization
        if (unit.value === 2 || unit.value === 6) {
            if (targetHex.terrainType === 'TOWER') {
                analysis.score += tw.archerTowerBonus;
            } else if (targetHex.terrainType === 'MOUNTAIN') {
                analysis.score += tw.archerMountainBonus;
            }
        }

        // 3. Line of Sight (LoS) Hiding
        // If unit was threatened before move, and target terrain blocks LoS
        if (analysis.isCurrentlyThreatened && ['FOREST', 'TOWER', 'MOUNTAIN'].includes(targetHex.terrainType)) {
            analysis.score += tw.losBlockBonus;
        }
    }

    // --- ROLE-SPECIFIC HEURISTICS ---
    // Archer (Dice 2) Kiting logic
    if (unit.value === 2) {
        // Find nearest enemy from any opponent
        let nearestEnemyDist = Infinity;
        const allEnemies = nextState.players.flatMap((p, idx) =>
            (idx === state.currentPlayerIndex || p.isEliminated) ? [] : p.dice.filter(d => d.isDeployed && !d.isDeath)
        );

        const myHex = GAME.getHex(aiUnitNext.hexId, nextState);
        allEnemies.forEach(opp => {
            const oppHex = GAME.getHex(opp.hexId, nextState);
            const dist = GAME.axialDistance(myHex.q, myHex.r, oppHex.q, oppHex.r);
            if (dist < nearestEnemyDist) nearestEnemyDist = dist;
        });

        if (nearestEnemyDist === 2) {
            analysis.score += 200; // Optimal kiting range
        } else if (nearestEnemyDist === 1) {
            analysis.score -= 500; // Too close!
        }
    }

    // Tanker (Dice 5) frontline logic
    if (unit.value === 5) {
        const myHex = GAME.getHex(aiUnitNext.hexId, nextState);
        const neighbors = GAME.getNeighbors(myHex, nextState);
        neighbors.forEach(n => {
            const neighborUnit = GAME.getUnitOnHex(n.id, nextState);
            if (neighborUnit && neighborUnit.playerId === state.currentPlayerIndex && neighborUnit.id !== unit.id) {
                if (neighborUnit.value <= 3) { // Protecting "squishy" units (Archer, Knight, Infantry)
                    analysis.score += 150;
                }
            }
        });
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
                break;
            }
        }
    }

    // --- ORACLE (Dice 6) SPELL HEURISTICS ---
    // Oracle is a support unit - evaluate spell casting opportunities with tactical prediction
    if (unit.value === 6) {
        const spellType = move.actionType;

        if (spellType === 'SPELLCAST_SHIELD') {
            const targetUnit = GAME.getUnitOnHex(move.targetHexId, state);
            if (targetUnit) {
                const targetHex = GAME.getHex(move.targetHexId, nextState);
                const neighbors = GAME.getNeighbors(targetHex, nextState);
                let isCurrentlyThreatened = false;

                // Check immediate threats
                for (const neighbor of neighbors) {
                    const neighborUnit = GAME.getUnitOnHex(neighbor.id, nextState);
                    if (neighborUnit && neighborUnit.playerId !== state.currentPlayerIndex) {
                        isCurrentlyThreatened = true;
                        break;
                    }
                }

                // PREDICTIVE SHIELDING: Check if unit will be attacked next turn (using pre-calculated threats)
                const futureThreats = predictedThreats.filter(t => t.target.id === targetUnit.id);
                const willBeKilled = futureThreats.some(t => t.canKill);
                const willBeAttacked = futureThreats.length > 0;

                // Score shielding based on urgency and unit value
                if (willBeKilled) {
                    analysis.score += 150 + (targetUnit.value * 15);
                    analysis.isSupportAction = true;
                } else if (willBeAttacked) {
                    analysis.score += 60 + (targetUnit.value * 8);
                    analysis.isSupportAction = true;
                } else if (isCurrentlyThreatened && targetUnit.value >= 3) {
                    analysis.score += 50 + (targetUnit.value * 6);
                    analysis.isSupportAction = true;
                } else if (targetUnit.value >= 5) {
                    analysis.score += 30 + (targetUnit.value * 3);
                    analysis.isSupportAction = true;
                } else {
                    analysis.score += 5;
                    analysis.isSupportAction = true;
                }
            }
        }

        if (spellType === 'SPELLCAST_SWAP') {
            const targetUnit = GAME.getUnitOnHex(move.targetHexId, state);
            const oracleUnit = GAME.getUnitOnHex(move.unitHexId, state);

            if (targetUnit && oracleUnit) {
                const oracleHex = GAME.getHex(move.unitHexId, state);
                const targetHex = GAME.getHex(move.targetHexId, state);
                const oracleNeighbors = GAME.getNeighbors(oracleHex, state);
                let oracleThreatened = false;

                // Check if Oracle is in immediate danger
                for (const neighbor of oracleNeighbors) {
                    const neighborUnit = GAME.getUnitOnHex(neighbor.id, state);
                    if (neighborUnit && neighborUnit.playerId !== state.currentPlayerIndex) {
                        const defenderArmor = GAME.calcDefenderEffectiveArmor(move.unitHexId, state);
                        if (neighborUnit.attack >= defenderArmor) {
                            oracleThreatened = true;
                            break;
                        }
                    }
                }

                // PREDICTIVE: Check if Oracle will be threatened next turn
                const oracleFutureThreats = predictedThreats.filter(t => t.target.id === oracleUnit.id);
                const oracleWillBeKilled = oracleFutureThreats.some(t => t.canKill);

                // EMERGENCY ESCAPE: Save Oracle from death
                if (oracleThreatened || oracleWillBeKilled) {
                    const escapeScore = oracleWillBeKilled ? 200 : 120;
                    analysis.score += escapeScore;
                    analysis.isEscapeAction = true;
                    analysis.isSupportAction = true;
                }

                // TACTICAL REPOSITIONING: Swap valuable unit to advantageous position
                if (!oracleThreatened && !oracleWillBeKilled) {
                    const opponentBasesList = opponentBases.length > 0 ? opponentBases : 
                        state.players.filter((p, idx) => idx !== state.currentPlayerIndex && !p.isEliminated)
                            .map(p => ({ baseHex: GAME.getHex(p.baseHexId, state) })).filter(b => b.baseHex);

                    const targetNeighbors = GAME.getNeighbors(targetHex, state);
                    let targetThreatCount = 0;
                    for (const neighbor of targetNeighbors) {
                        const neighborUnit = GAME.getUnitOnHex(neighbor.id, state);
                        if (neighborUnit && neighborUnit.playerId !== state.currentPlayerIndex) {
                            targetThreatCount++;
                        }
                    }

                    const oracleThreatCount = oracleNeighbors.filter(n => {
                        const nu = GAME.getUnitOnHex(n.id, state);
                        return nu && nu.playerId !== state.currentPlayerIndex;
                    }).length;

                    if (targetUnit.value >= 4) {
                        let repositionScore = 0;
                        if (opponentBasesList.length > 0) {
                            const currentDist = GAME.axialDistance(targetHex.q, targetHex.r, 
                                opponentBasesList[0].baseHex.q, opponentBasesList[0].baseHex.r);
                            const newDist = GAME.axialDistance(oracleHex.q, oracleHex.r, 
                                opponentBasesList[0].baseHex.q, opponentBasesList[0].baseHex.r);

                            if (newDist < currentDist) {
                                repositionScore += (currentDist - newDist) * 15;
                            }
                        }

                        if (targetThreatCount < oracleThreatCount) {
                            repositionScore += (oracleThreatCount - targetThreatCount) * 30;
                        }

                        const targetAdjacentToBase = opponentBasesList.some(base => {
                            const baseNeighbors = GAME.getNeighbors(base.baseHex, state);
                            return baseNeighbors.some(n => n.id === oracleHex.id);
                        });

                        if (targetAdjacentToBase && targetUnit.value >= 2) {
                            repositionScore += 150;
                        }

                        if (repositionScore > 0) {
                            analysis.score += repositionScore;
                            analysis.isSupportAction = true;
                        }
                    }

                    // Rescue operation: Pull wounded unit out of danger
                    if (targetUnit.armorReduction > 0 || targetUnit.currentArmor <= 2) {
                        const targetInDanger = targetNeighbors.some(n => {
                            const nu = GAME.getUnitOnHex(n.id, state);
                            return nu && nu.playerId !== state.currentPlayerIndex && 
                                   nu.attack >= GAME.calcDefenderEffectiveArmor(move.targetHexId, state);
                        });

                        if (targetInDanger) {
                            analysis.score += 80 + (targetUnit.value * 15);
                            analysis.isSupportAction = true;
                        }
                    }
                }
            }
        }

        if (spellType === 'SPELLCAST_SKIRMISH') {
            const targetUnit = GAME.getUnitOnHex(move.targetHexId, state);
            if (targetUnit) {
                const targetHex = GAME.getHex(move.targetHexId, state);
                const neighbors = GAME.getNeighbors(targetHex, state);
                
                // High bonus for high attack units (Hussar/Knight)
                if (targetUnit.attack >= 3) {
                    analysis.score += 150 + (targetUnit.attack * 30);
                } else {
                    analysis.score += 50;
                }

                // Check if target is near enemies to actually use the skirmish
                let nearEnemy = false;
                for (const neighbor of neighbors) {
                    const neighborUnit = GAME.getUnitOnHex(neighbor.id, state);
                    if (neighborUnit && neighborUnit.playerId !== state.currentPlayerIndex) {
                        nearEnemy = true;
                        // Extra bonus if it can actually kill someone with -1 attack
                        const effectiveAtk = targetUnit.attack - 1;
                        const defArmor = GAME.calcDefenderEffectiveArmor(neighbor.id, state);
                        if (effectiveAtk >= defArmor) {
                            analysis.score += 100;
                        }
                    }
                }
                
                if (nearEnemy) analysis.score += 50;
                analysis.isSupportAction = true;
            }
        }

        if (move.actionType === 'SPELLCAST_SACRIFICE') {
            const targetUnit = GAME.getUnitOnHex(move.targetHexId, state);
            const oracleUnit = GAME.getUnitOnHex(move.unitHexId, state);
            
            if (targetUnit && oracleUnit) {
                const player = state.players[state.currentPlayerIndex];
                const activeUnits = player.dice.filter(d => d.isDeployed && !d.isDeath);
                const hasReserve = player.dice.some(d => !d.isDeployed && !d.isDeath);

                // Base score for removal
                analysis.score += (targetUnit.value * 20);
                if (hasReserve) analysis.score += 50;

                // Stalemate break bonus
                if (targetUnit.value === 6 && activeUnits.length === 1) {
                    const enemyPlayer = state.players[targetUnit.playerId];
                    const enemyActiveUnits = enemyPlayer.dice.filter(d => d.isDeployed && !d.isDeath);
                    analysis.score += 100;
                    if (enemyActiveUnits.length > 1) analysis.score += 50;
                    if (enemyActiveUnits.length === 1) analysis.score += 500;
                }
                analysis.isSupportAction = true;
            }
        }

        const oracleHex = GAME.getHex(aiUnitNext.hexId, nextState);
        const oracleNeighbors = GAME.getNeighbors(oracleHex, nextState);
        let hasFriendlyNeighbor = false;

        for (const neighbor of oracleNeighbors) {
            const neighborUnit = GAME.getUnitOnHex(neighbor.id, nextState);
            if (neighborUnit && neighborUnit.playerId === state.currentPlayerIndex) {
                hasFriendlyNeighbor = true;
                break;
            }
        }

        if (!hasFriendlyNeighbor) analysis.score -= 50;
    }


    // Guard action penalty
    if (move.actionType === 'GUARD') {
        analysis.score += w.guardPenalty;
    }

    return analysis;
}

/**
 * Calculate the overall strategic score for a player's team position.
 * This encourages units to move towards the nearest enemy base while remaining grouped.
 */
function calculateTeamScore(GAME, state, playerIndex, opponentBases=[]) {
    const player = state.players[playerIndex];
    let score = 0;
    for (const unit of player.dice) {
        if (!unit.isDeployed || unit.isDeath) continue;
        const hex = GAME.getHex(unit.hexId, state);
        if (!hex) continue;

        // 1. Advancement: Bonus for being closer to the nearest opponent base
        if (opponentBases.length > 0) {
            let minBaseDist = Infinity;
            opponentBases.forEach(base => {
                const dist = GAME.axialDistance(hex.q, hex.r, base.baseHex.q, base.baseHex.r);
                if (dist < minBaseDist) minBaseDist = dist;
            });
            const maxDist = (GAME.getRadius ? GAME.getRadius() : 5) * 2;
            score += (maxDist - minBaseDist) * 50;
        }

        // 2. Grouping/Support: Bonus for being near teammates
        const neighbors = GAME.getNeighbors(hex, state);
        for (const neighbor of neighbors) {
            const neighborUnit = GAME.getUnitOnHex(neighbor.id, state);
            if (neighborUnit && neighborUnit.playerId === playerIndex && neighborUnit.id !== unit.id) {
                score += 5; // Basic grouping/cohesion bonus
                if (neighborUnit.value === 6) score += 15; // Extra bonus for proximity to protective "6"
            }
        }
    }
    return score;
}
