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
const AUTOCHESS_WEIGHT_MULTIPLIER = 3;

/**
 * Lightweight save/restore for heuristic evaluation.
 * Avoids structuredClone — captures only fields that change during simulation.
 */
function _saveHeuristicSnapshot(state) {
	const units = [];
	state.players.forEach(p => {
		p.dice.forEach(u => {
			units.push({
				ref: u,
				hexId: u.hexId, isDeath: u.isDeath, isDeployed: u.isDeployed,
				isGuarding: u.isGuarding, skirmishBuff: u.skirmishBuff,
				currentArmor: u.currentArmor, armorReduction: u.armorReduction,
				effectiveArmor: u.effectiveArmor,
				hasMovedOrAttackedThisTurn: u.hasMovedOrAttackedThisTurn,
				actionsTakenThisTurn: u.actionsTakenThisTurn,
				lastActionWasGuard: u.lastActionWasGuard,
				lastHexId: u.lastHexId, stepsMoved: u.stepsMoved,
			});
		});
	});
	const hexes = state.hexes.map(h => ({ ref: h, unit: h.unit, unitId: h.unitId }));
	return { units, hexes, phase: state.phase };
}

function _restoreHeuristicSnapshot(state, snap) {
	for (const us of snap.units) {
		us.ref.hexId = us.hexId;
		us.ref.isDeath = us.isDeath;
		us.ref.isDeployed = us.isDeployed;
		us.ref.isGuarding = us.isGuarding;
		us.ref.skirmishBuff = us.skirmishBuff;
		us.ref.currentArmor = us.currentArmor;
		us.ref.armorReduction = us.armorReduction;
		us.ref.effectiveArmor = us.effectiveArmor;
		us.ref.hasMovedOrAttackedThisTurn = us.hasMovedOrAttackedThisTurn;
		us.ref.actionsTakenThisTurn = us.actionsTakenThisTurn;
		us.ref.lastActionWasGuard = us.lastActionWasGuard;
		us.ref.lastHexId = us.lastHexId;
		us.ref.stepsMoved = us.stepsMoved;
	}
	for (const hs of snap.hexes) {
		hs.ref.unit = hs.unit;
		hs.ref.unitId = hs.unitId;
	}
	state.phase = snap.phase;
}

/**
 * Adjust AI weights based on the current game phase
 */
function calculatePhaseWeights(GAME, state, profile) {
    const dynamicProfile = JSON.parse(JSON.stringify(profile));
    const w = dynamicProfile.weights;

    const currentPlayer = state.players[state.currentPlayerIndex];
    const deployedUnits = currentPlayer.dice.filter(d => d.isDeployed && !d.isDeath).length;
    const totalPossibleUnits = currentPlayer.dice.length;
    const shouldExcludeBases = GAME.options && GAME.options.includes('a');

    // Autochess mode weight adjustment (Berserker aggression focus)
    if (GAME.autochess) {
        w.advanceBonus *= 10.0;
        w.attackBonus *= 15.0;
        w.killBonus *= 20.0;
        w.safeBonus = 0; // Don't care about safety
        w.threatPenalty = 0; // Don't fear death
        w.guardPenalty *= 5; // Extreme penalty for being passive
        w.fatigueWeight = 5; // Units will keep acting relentlessly
        
        w.teamPositionWeight = 0;
        w.pressureWeight = 0; 
        
        dynamicProfile.riskTolerance = 1.0; // Maximum aggression

        // Autochess: Remove all non-offensive priorities
        if (dynamicProfile.priorityOrder) {
            dynamicProfile.priorityOrder = dynamicProfile.priorityOrder.filter(p => !['position', 'dodge'].includes(p));
        }
    }

    // Estimate game phase
    let phase = 'mid';
    if (deployedUnits < totalPossibleUnits * 0.4) {
        phase = 'early';
    } else if (deployedUnits < totalPossibleUnits * 0.2) {
        // Very few units left — end game
        phase = 'late';
    }

    // Weight adjustments per phase
    if (phase === 'early') {
        w.advanceBonus *= 2.0;       // Aggressive expansion
        w.killBonus *= 0.5;          // Position over blood
        w.teamPositionWeight *= 0.8; // Formations less critical than speed
    } else if (phase === 'late') {
        if (shouldExcludeBases) {
            w.killBonus *= 2.5;      // Aggressively hunt remaining units
            w.attackBonus *= 1.5;
        } else {
            w.captureBonus *= 5.0;   // Focus on the win (base capture)
            w.killBonus *= 1.5;      // Finish them off
        }
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
            // Dice 2 (Archer) has Range 2, Dice 6 (Oracle) has Range 2
            const baseRadius = 2; // Immediate area of influence

            // Get actual range considering terrain
            let actualRange = (unit.range || 0);
            if (unit.value === 2 || unit.value === 6) {
                if (unitHex.terrainType === 'TOWER') actualRange = 2;
                else if (unitHex.terrainType === 'MOUNTAIN') actualRange = 3;
            }

            const totalRadius = baseRadius + actualRange;

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

    GAME.players[GAME.currentPlayerIndex].profileName = GAME.players[GAME.currentPlayerIndex].profileName
        || Object.keys(heuristicProfiles).random();

    profileName = GAME.players[GAME.currentPlayerIndex].profileName;

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

    // Handle SKIRMISH_POST_MOVE: AI must pick a destination for the successful skirmisher
    if (GAME.actionMode === 'SKIRMISH_POST_MOVE') {
        const targetHexId = GAME.validMoves.cosmic_random();
        if (verbose) GAME.addLog(`P${GAME.currentPlayerIndex+1} AI [SKIRMISH_POST_MOVE]: Choosing hex [${targetHexId}]`);
        GAME.completeAction(targetHexId);
        return;
    }

    const state = GAME.cloneState();
    const currentPlayer = state.players[state.currentPlayerIndex];
    
    // Identify all active opponents
    const opponentIndices = state.players
        .map((p, idx) => ({p, idx}))
        .filter(({p, idx}) => idx !== state.currentPlayerIndex && !p.isEliminated)
        .map(({idx}) => idx);

    const shouldExcludeBases = GAME.options && GAME.options.includes('a');

    // Adjust weights based on game phase
    const dynamicProfile = calculatePhaseWeights(GAME, state, profile);

    // Annihilation Mode specific adjustments
    if (shouldExcludeBases) {
        // 1. Remove capture from priorities and move lethal actions to top
        dynamicProfile.priorityOrder = dynamicProfile.priorityOrder.filter(p => p !== 'capture');
        if (dynamicProfile.priorityOrder[0] !== 'kill') {
            const killIdx = dynamicProfile.priorityOrder.indexOf('kill');
            if (killIdx > -1) {
                dynamicProfile.priorityOrder.splice(killIdx, 1);
                dynamicProfile.priorityOrder.unshift('kill');
            }
        }

        // 2. Reduce pressure weight (fear) to encourage closing the gap
        // Original logic: targetPressure * pressureWeight (negative value = penalty)
        // Lowering it makes the penalty for being near enemies smaller.
        dynamicProfile.weights.pressureWeight *= 0.5;
    }

    profile = dynamicProfile;

    // Calculate Pressure Map for this turn (already handles all players)
    const pressureMap = calculatePressureMap(GAME, state, state.currentPlayerIndex);

    // PRE-CALCULATE THREATS: For Oracle spell evaluation
    const predictedThreats = predictEnemyThreats(GAME, state, state.currentPlayerIndex);

    // Identify AI Units that can act
    const availableUnits = (GAME.gameplayVersion === 2 && GAME.turnPhase === 'FATE_CALL')
        ? currentPlayer.dice.filter(d => d.isDeployed && !d.isDeath && d.canMoveInFatePhase)
        : currentPlayer.dice.filter(d => d.isDeployed && !d.isDeath && !d.hasMovedOrAttackedThisTurn);

    if (availableUnits.length === 0) {
        if (verbose) GAME.addLog(`P${GAME.currentPlayerIndex+1} AI Heuristic: No units to act. Ending phase/turn.`);
        
        if (GAME.gameplayVersion === 2 && GAME.turnPhase === 'FATE_CALL') {
            GAME.startTacticalCommand();
        } else {
            applyMove(GAME, { actionType: 'END_TURN' });
        }
        return;
    }

    // Get all opponent bases (empty in annihilation mode 'a')
    const opponentBases = shouldExcludeBases ? [] : opponentIndices
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

        const moveAnalysis = heuristicMove(GAME, state, move, unit, opponentIndices, opponentBases, profile, pressureMap, predictedThreats, shouldExcludeBases);
        scoredMoves.push({
            move,
            unit,
            ...moveAnalysis
        });
    }

    // Point 6: Selective Minimax Refinement (Slow) for top candidates
    if (profile.minimax && profile.minimaxDepth > 0) {
        // Sort by basic score and take top candidates for strategic refinement
        // Only refine moves that are MOVE or POSITION (tactical/strategic)
        const candidates = scoredMoves
            .filter(m => m.move.actionType === 'MOVE' || m.move.actionType === 'RANGED_ATTACK')
            .sort((a, b) => b.score - a.score)
            .slice(0, 8); // Refine top 8 candidates

        if (candidates.length > 0) {
            const transpositionTable = new Map();
            for (const candidate of candidates) {
                const nextState = applyMove(GAME, candidate.move, state);
                if (nextState) {
                    const lookAheadScore = minimaxSearch(GAME, nextState, profile.minimaxDepth - 1, -Infinity, Infinity, false, state.currentPlayerIndex, profile, opponentIndices, opponentBases, shouldExcludeBases, transpositionTable);
                    candidate.score += (lookAheadScore * 0.1); // Blend minimax insight into heuristic score
                }
            }
        }
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
 * Evaluate and return the best move for a specific unit (used in Autochess).
 */
function evaluateBestMoveForUnit(GAME, state, unit, profileName = 'baseline', cachedData) {
    // Load profile
    let profile = DEFAULT_PROFILE;
    if (typeof getProfile === 'function') {
        profile = getProfile(profileName);
    } else if (typeof heuristicProfiles !== 'undefined' && heuristicProfiles[profileName]) {
        profile = heuristicProfiles[profileName];
    }

    const opponentIndices = state.players
        .map((p, idx) => ({p, idx}))
        .filter(({p, idx}) => idx !== state.currentPlayerIndex && !p.isEliminated)
        .map(({idx}) => idx);

    const shouldExcludeBases = GAME.options && GAME.options.includes('a');
    const dynamicProfile = calculatePhaseWeights(GAME, state, profile);
    profile = dynamicProfile;

    const pressureMap = cachedData?.pressureMap || calculatePressureMap(GAME, state, state.currentPlayerIndex);
    const predictedThreats = cachedData?.predictedThreats || predictEnemyThreats(GAME, state, state.currentPlayerIndex);

    const opponentBases = shouldExcludeBases ? [] : opponentIndices
        .filter(idx => !state.players[idx].isEliminated)
        .map(idx => ({
            id: idx,
            baseHexId: state.players[idx].baseHexId,
            baseHex: GAME.getHex(state.players[idx].baseHexId, state)
        }))
        .filter(b => b.baseHex);

    // Generate moves specifically for this unit
    const unitInState = state.players[state.currentPlayerIndex].dice.find(d => d.id === unit.id);
    const moves = generateAllPossibleMoves(GAME, state, unitInState);
    
    const scoredMoves = [];
    for (const move of moves) {
        // Temporary set spell for Oracle evaluation
        let originalSpell = GAME.oracleSelectedSpell;
        if (move.actionType.startsWith('SPELLCAST_') && move.actionType !== 'SPELLCAST_SACRIFICE') {
            GAME.oracleSelectedSpell = move.actionType.replace('SPELLCAST_', '');
        }

        const moveAnalysis = heuristicMove(GAME, state, move, unitInState, opponentIndices, opponentBases, profile, pressureMap, predictedThreats, shouldExcludeBases);
        
        // Restore spell
        GAME.oracleSelectedSpell = originalSpell;

        scoredMoves.push({
            move,
            unit: unitInState,
            ...moveAnalysis
        });
    }

    if (scoredMoves.length === 0) return null;

    // Sort by priority order from profile
    for (const priority of profile.priorityOrder) {
        const priorityMoves = filterByPriority(scoredMoves, priority, opponentBases);
        if (priorityMoves.length > 0) {
            // Sort priority moves by score
            priorityMoves.sort((a, b) => b.score - a.score);
            return priorityMoves[0].move;
        }
    }

    // Fallback: highest score
    scoredMoves.sort((a, b) => b.score - a.score);
    return scoredMoves[0].move;
}

/**
 * Helper to filter moves by priority category (logic extracted from executePriority)
 */
function filterByPriority(scoredMoves, priority, opponentBases) {
    switch (priority) {
        case 'capture': return opponentBases?.length ? scoredMoves.filter(m => m.canCapture) : [];
        case 'kill': return scoredMoves.filter(m => m.canKillEnemy);
        case 'attack': return scoredMoves.filter(m => m.canAttackEnemy && !m.canKillEnemy);
        case 'spell': return scoredMoves.filter(m => m.move.actionType.includes('SPELLCAST_'));
        case 'dodge': return scoredMoves.filter(m => m.isCurrentlyThreatened || m.canBeKilledCurrently);
        case 'position': return scoredMoves.filter(m => !m.isThreatened && !m.move.actionType.includes('SPELLCAST_'));
        default: return [];
    }
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
                let canKill = false;
                if (GAME.gameplayVersion === 2) {
                    const { winProb } = calculateV2CombatSuccessProbability(enemy.attack, defenderArmor);
                    canKill = winProb > 0.5;
                } else {
                    canKill = enemy.attack >= defenderArmor;
                }
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
                    let canKill = false;
                    if (GAME.gameplayVersion === 2) {
                        const { winProb } = calculateV2CombatSuccessProbability(enemy.attack, defenderArmor);
                        canKill = winProb > 0.5;
                    } else {
                        canKill = enemy.attack >= defenderArmor;
                    }
                    threats.push({
                        attacker: enemy,
                        target: targetUnit,
                        targetHexId,
                        canKill,
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
 * Sort moves based on the profile's target selection strategy
 */
function sortMovesByStrategy(moves, strategy, riskTolerance) {
    return moves.sort((a, b) => {
        // Primary sort: Safety (if cautious)
        const safetyWeight = (1 - riskTolerance) * 2;
        if (b.isSafe !== a.isSafe) return (b.isSafe - a.isSafe) * safetyWeight;

        // Secondary sort: Strategy
        switch (strategy) {
            case 'threatRemoval':
                if (b.isTargetThreat !== a.isTargetThreat) return (b.isTargetThreat ? 1 : -1);
                return (b.targetValue || 0) - (a.targetValue || 0);

            case 'lowArmor':
                if (a.targetArmor !== b.targetArmor) return (a.targetArmor || 0) - (b.targetArmor || 0);
                return (b.targetValue || 0) - (a.targetValue || 0);

            case 'highestValue':
            default:
                return (b.targetValue || 0) - (a.targetValue || 0);
        }
    });
}

/**
 * Execute moves for a given priority category
 */
function executePriority(GAME, scoredMoves, priority, profile, state, opponentBases, verbose = true) {
    const w = profile.weights;
    const selectionStrategy = profile.unitSelection || 'leastMoved';

    scoredMoves.sort((a, b) => {
        // Primary sort: Heuristic Score
        if (Math.abs(b.score - a.score) > 0.001) return b.score - a.score;

        // Secondary sort: unitSelection Strategy (Point 1 Fix)
        switch (selectionStrategy) {
            case 'highestValue': return b.unit.value - a.unit.value;
            case 'lowestValue': return a.unit.value - b.unit.value;
            case 'mostThreatened': {
                const aThreat = a.isCurrentlyThreatened ? 1 : 0;
                const bThreat = b.isCurrentlyThreatened ? 1 : 0;
                return bThreat - aThreat;
            }
            case 'leastMoved':
            default:
                return (a.unit.activationCount || 0) - (b.unit.activationCount || 0);
        }
    });
    // if (verbose) console.log('Scores:', scoredMoves.map(x => [x.move.actionType, x.score].join(':')).join(', ') );

    switch (priority) {
        case 'capture': {
            // Skip capture in annihilation mode
            if (!opponentBases?.length) break;

            // Find moves that capture any enemy base (win condition)
            const captureMoves = scoredMoves.filter(m => m.canCapture);
            if (captureMoves.length > 0) {
                captureMoves.sort((a, b) => b.captureScore - a.captureScore);
                if (verbose) console.log(`AI Heuristic (${profile.name}): Capturing base!`, captureMoves[0].move);
                const appliedMove = captureMoves[0].move;
                const activeUnit = GAME.players[GAME.currentPlayerIndex].dice.find(d => d.hexId === appliedMove.unitHexId);
                if (activeUnit) activeUnit.activationCount = (activeUnit.activationCount || 0) + 1;
                applyMove(GAME, appliedMove);
                return true;
            }
            break;
        }

        case 'kill': {
            // Find moves that kill enemies
            const killMoves = scoredMoves.filter(m => m.canKillEnemy);
            if (killMoves.length > 0) {
                sortMovesByStrategy(killMoves, profile.targetSelection, profile.riskTolerance);
                if (verbose) console.log(`AI Heuristic (${profile.name}): Found kill opportunity (${profile.targetSelection})!`, killMoves[0].move);
                const appliedMove = killMoves[0].move;
                const activeUnit = GAME.players[GAME.currentPlayerIndex].dice.find(d => d.hexId === appliedMove.unitHexId);
                if (activeUnit) activeUnit.activationCount = (activeUnit.activationCount || 0) + 1;
                applyMove(GAME, appliedMove);
                return true;
            }
            break;
        }

        case 'attack': {
            const attackMoves = scoredMoves.filter(m => m.canAttackEnemy && !m.canKillEnemy);
            if (attackMoves.length > 0) {
                sortMovesByStrategy(attackMoves, profile.targetSelection, profile.riskTolerance);
                if (verbose) console.log(`AI Heuristic (${profile.name}): Found attack opportunity (${profile.targetSelection})!`, attackMoves[0].move);
                const appliedMove = attackMoves[0].move;
                const activeUnit = GAME.players[GAME.currentPlayerIndex].dice.find(d => d.hexId === appliedMove.unitHexId);
                if (activeUnit) activeUnit.activationCount = (activeUnit.activationCount || 0) + 1;
                applyMove(GAME, appliedMove);
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

                let hasSacrifice = viableSpells.find(m => m.move.actionType == 'SPELLCAST_SACRIFICE');

                // Cast if the best spell has positive value (or sacrifice is available).
                // Old: random() < ratio caused Oracle to randomly skip good spells.
                viableSpells.sort((a, b) => b.score - a.score);
                const bestSpellScore = viableSpells.length > 0 ? viableSpells[0].score : -Infinity;
                if (viableSpells.length > 0 && (hasSacrifice || bestSpellScore > 0)) {
                    if (verbose) console.log(`AI Heuristic (${profile.name}): Casting spell!`, viableSpells[0].move, viableSpells[0].score);
                    const appliedMove = viableSpells[0].move;
                    const activeUnit = GAME.players[GAME.currentPlayerIndex].dice.find(d => d.hexId === appliedMove.unitHexId);
                    if (activeUnit) activeUnit.activationCount = (activeUnit.activationCount || 0) + 1;
                    applyMove(GAME, appliedMove);
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
                    const appliedMove = bestEscape.move;
                    const activeUnit = GAME.players[GAME.currentPlayerIndex].dice.find(d => d.hexId === appliedMove.unitHexId);
                    if (activeUnit) activeUnit.activationCount = (activeUnit.activationCount || 0) + 1;
                    applyMove(GAME, appliedMove);
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

                    // Advancement bonus (hunting or base capture)
                    if (m.move.actionType === 'MOVE') {
                        const targetHex = GAME.getHex(m.move.targetHexId, state);
                        const maxDist = (GAME.getRadius ? GAME.getRadius() : 5) * 2;

                        if (opponentBases.length > 0) {
                            // Distance to nearest opponent base
                            let minBaseDist = Infinity;
                            opponentBases.forEach(base => {
                                const dist = GAME.axialDistance(targetHex.q, targetHex.r, base.baseHex.q, base.baseHex.r);
                                if (dist < minBaseDist) minBaseDist = dist;
                            });
                            positionScore += (w.advanceBonus * (maxDist - minBaseDist));
                        } else {
                            // Hunting: Distance to nearest enemy unit
                            const nearest = findNearestEnemyUnit(GAME, state, state.currentPlayerIndex, targetHex);
                            if (nearest.unit) {
                                positionScore += (w.advanceBonus * 0.8 * (maxDist - nearest.distance));
                            }
                        }
                    }

                    // Skip base capture scoring in annihilation mode
                    if (opponentBases.length) {
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
                const appliedMove = strategicMoves[0].move;
                const activeUnit = GAME.players[GAME.currentPlayerIndex].dice.find(d => d.hexId === appliedMove.unitHexId);
                if (activeUnit) activeUnit.activationCount = (activeUnit.activationCount || 0) + 1;
                applyMove(GAME, appliedMove);
                return true;
            }
            break;
        }
    }

    return false;
}

/**
 * Calculate role-based bonuses to give units persistent strategic identities (Point 4)
 */
function calculateRoleBonus(unit, targetHex, GAME, state, w) {
    let bonus = 0;
    const value = unit.value;

    // Assign role if not present
    if (!unit.role) {
        if (value === 3) unit.role = 'FLANKER';
        else if (value === 5 || value === 1) unit.role = 'FRONTLINE';
        else if (value === 6) unit.role = 'SUPPORT';
        else if (value === 2) unit.role = 'SNIPER';
        else unit.role = 'GENERALIST';
    }

    const mapRadius = GAME.getRadius ? GAME.getRadius() : 5;

    switch (unit.role) {
        case 'FLANKER': {
            // Bonus for being away from the center axis (flanking geography)
            const distFromCenter = Math.max(Math.abs(targetHex.q), Math.abs(targetHex.r), Math.abs(-targetHex.q - targetHex.r));
            bonus += distFromCenter * 20;
            // Extra bonus for landing adjacent to a killable high-value enemy
            const flankNeighbors = GAME.getNeighbors(targetHex, state);
            for (const fn of flankNeighbors) {
                const fnu = GAME.getUnitOnHex(fn.id, state);
                if (fnu && fnu.playerId !== unit.playerId && fnu.value >= 3) {
                    const defArm = GAME.calcDefenderEffectiveArmor(fn.id, state);
                    if (unit.attack >= defArm) bonus += 200; // Can kill this next turn
                }
            }
            break;
        }
        case 'FRONTLINE':
            // Bonus for being near the center vertical axis or advancing
            bonus += (mapRadius - Math.abs(targetHex.q)) * 15;
            break;
        case 'SUPPORT':
            // Bonus for being near teammates
            const neighbors = GAME.getNeighbors(targetHex, state);
            neighbors.forEach(n => {
                const nu = GAME.getUnitOnHex(n.id, state);
                if (nu && nu.playerId === unit.playerId) bonus += 30;
            });
            break;
        case 'SNIPER':
            // Already handled by Archer kiting, but can add more here
            break;
    }

    return bonus;
}

/**
 * Evaluate a board state from a heuristic perspective (Point 6 integration)
 */
function evaluateState(GAME, state, playerIndex, profile, opponentIndices, opponentBases, shouldExcludeBases) {
    const w = profile.weights;
    let score = calculateTeamScore(GAME, state, playerIndex, opponentBases, shouldExcludeBases);

    const player = state.players[playerIndex];
    const units = player.dice.filter(d => d.isDeployed && !d.isDeath);

    // Add unit values and roles
    units.forEach(unit => {
        score += unit.value * 100;
        const hex = GAME.getHex(unit.hexId, state);
        if (hex) score += calculateRoleBonus(unit, hex, GAME, state, w);
    });

    // Subtract opponent strength
    opponentIndices.forEach(idx => {
        const opp = state.players[idx];
        const oppUnits = opp.dice.filter(d => d.isDeployed && !d.isDeath);
        oppUnits.forEach(unit => {
            score -= unit.value * 110; // Slightly weight opponent loss higher
        });
    });

    return score;
}

/**
 * Generate a unique key for the game state (for transposition table)
 */
function generateStateKey(state) {
    // Basic key using unit positions and values
    let key = `p${state.currentPlayerIndex}`;
    for (const player of state.players) {
        if (player.isEliminated) continue;
        key += `|${player.id}:`;
        player.dice.forEach(d => {
            if (d.isDeployed && !d.isDeath) {
                key += `${d.hexId},${d.value},${d.currentArmor},${d.hasMovedOrAttackedThisTurn ? 1 : 0};`;
            }
        });
    }
    return key;
}

/**
 * Lightweight move ordering for minimax
 */
function orderMoves(GAME, state, moves, myPlayerIndex) {
    return moves.map(move => {
        let priority = 0;
        
        // Priority 1: Captures
        const targetHex = GAME.getHex(move.targetHexId, state);
        const opponentBases = state.players
            .map((p, idx) => ({p, idx}))
            .filter(({p, idx}) => idx !== myPlayerIndex && !p.isEliminated)
            .map(({p}) => p.baseHexId);
            
        if (opponentBases.includes(move.targetHexId)) {
            priority += 10000;
        }

        // Priority 2: Kills
        const targetUnit = GAME.getUnitOnHex(move.targetHexId, state);
        if (targetUnit && targetUnit.playerId !== myPlayerIndex) {
            const defenderArmor = GAME.calcDefenderEffectiveArmor(move.targetHexId, state);
            const unit = state.players[myPlayerIndex].dice.find(d => d.hexId === move.unitHexId);
            let canKill = false;
            if (unit) {
                if (GAME.gameplayVersion === 2) {
                    const { winProb } = calculateV2CombatSuccessProbability(unit.attack, defenderArmor);
                    canKill = winProb > 0.5;
                } else {
                    canKill = unit.attack >= defenderArmor;
                }
            }

            if (canKill) {
                priority += 5000 + targetUnit.value * 100;
            } else {
                priority += 1000 + targetUnit.value * 10;
            }
        }

        // Priority 3: Support actions
        if (move.actionType.startsWith('SPELLCAST')) priority += 500;
        
        // Priority 4: Movement towards center/bases
        if (move.actionType === 'MOVE') priority += 100;

        return { move, priority };
    })
    .sort((a, b) => b.priority - a.priority)
    .map(x => x.move);
}

/**
 * Minimax search with heuristic evaluation and optimizations
 */
function minimaxSearch(GAME, state, depth, alpha, beta, isMaximizing, myPlayerIndex, profile, opponentIndices, opponentBases, shouldExcludeBases, transpositionTable = new Map()) {
    // Check transposition table
    const stateKey = generateStateKey(state);
    if (transpositionTable.has(stateKey)) {
        const entry = transpositionTable.get(stateKey);
        if (entry.depth >= depth) return entry.score;
    }

    if (depth === 0 || state.phase === 'GAME_OVER') {
        const score = evaluateState(GAME, state, myPlayerIndex, profile, opponentIndices, opponentBases, shouldExcludeBases);
        transpositionTable.set(stateKey, { score, depth });
        return score;
    }

    let possibleMoves = generateAllPossibleMoves(GAME, state);
    possibleMoves.push({ actionType: 'END_TURN' });

    // Move Ordering
    possibleMoves = orderMoves(GAME, state, possibleMoves, state.currentPlayerIndex);
    
    // Branching factor reduction: Only consider top M moves at each depth
    // More aggressive pruning at deeper levels
    const branchingLimit = depth > 1 ? 8 : 12;
    const movesToSearch = possibleMoves.slice(0, branchingLimit);

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (const move of movesToSearch) {
            const nextState = applyMove(GAME, move, state);
            if (!nextState) continue;
            const eval = minimaxSearch(GAME, nextState, depth - 1, alpha, beta, false, myPlayerIndex, profile, opponentIndices, opponentBases, shouldExcludeBases, transpositionTable);
            maxEval = Math.max(maxEval, eval);
            alpha = Math.max(alpha, eval);
            if (beta <= alpha) break;
        }
        transpositionTable.set(stateKey, { score: maxEval, depth });
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of movesToSearch) {
            const nextState = applyMove(GAME, move, state);
            if (!nextState) continue;
            const eval = minimaxSearch(GAME, nextState, depth - 1, alpha, beta, true, myPlayerIndex, profile, opponentIndices, opponentBases, shouldExcludeBases, transpositionTable);
            minEval = Math.min(minEval, eval);
            beta = Math.min(beta, eval);
            if (beta <= alpha) break;
        }
        transpositionTable.set(stateKey, { score: minEval, depth });
        return minEval;
    }
}

/**
 * Calculate the probability of a successful attack in Version 2 (Destiny Dice).
 * Total ATK = ceil((Base ATK + Roll) / 2)
 * Success if Total ATK > Defender Armor
 */
function calculateV2CombatSuccessProbability(baseAtk, defenderArmor) {
    let successes = 0;
    let fumbles = 0;
    for (let roll = 1; roll <= 6; roll++) {
        const totalAtk = Math.ceil((baseAtk + roll) / 2);
        if (totalAtk > defenderArmor) {
            successes++;
        } else if (roll === 1) {
            fumbles++;
        }
    }
    return {
        winProb: successes / 6,
        fumbleProb: fumbles / 6,
        failProb: (6 - successes - fumbles) / 6
    };
}

/**
 * Analyze a single move for tactical value
 */
function heuristicMove(GAME, state, move, unit, opponentIndices, opponentBases, profile = DEFAULT_PROFILE, pressureMap = {}, predictedThreats = [], shouldExcludeBases = false) {
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

    // Point 3: Fatigue Penalty - reduce score for units that act too often
    // This helps break fixation on a single "lead" unit
    const fatigueWeight = w.fatigueWeight || 150;
    analysis.score -= (unit.activationCount || 0) * fatigueWeight;

    analysis.isCurrentlyThreatened = predictedThreats.some(t => t.target.id === unit.id);
    analysis.canBeKilledCurrently = predictedThreats.some(t => t.target.id === unit.id && t.canKill);

    // Simulate the move using save/restore to avoid structuredClone on every candidate.
    // Autochess uses its own snapshot; tactical mode uses _saveHeuristicSnapshot.
    let snapshot = null;
    try {
    if (GAME.autochess && state._autochessEval && GAME.Autochess?._saveEvalSnapshot) {
        snapshot = GAME.Autochess._saveEvalSnapshot(state);
    } else if (!GAME.autochess) {
        snapshot = _saveHeuristicSnapshot(state);
    }
    const nextState = applyMove(GAME, move, state, snapshot ? { noClone: true } : undefined);
    if (!nextState) return analysis;

    // Get unit's position after move
    const aiUnitNext = nextState.players[state.currentPlayerIndex].dice.find(d => d.id === unit.id);
    if (!aiUnitNext || aiUnitNext.isDeath) {
        analysis.isSafe = false;
        analysis.canBeKilled = true;
        return analysis;
    }

    // Point 4: Apply Role-based positioning bonus
    const targetHexObj = GAME.getHex(move.targetHexId, state);
    if (targetHexObj) {
        analysis.score += calculateRoleBonus(unit, targetHexObj, GAME, state, w);
    }

    // Zone of Control (Pressure Map) bonus/penalty
    const targetPressure = pressureMap[move.targetHexId] || 0;
    analysis.score += targetPressure * (w.pressureWeight || 0.3);

    // Team Position Score calculation
    if (typeof calculateTeamScore === 'function') {
        const currentTeamScore = calculateTeamScore(GAME, state, state.currentPlayerIndex, opponentBases, shouldExcludeBases);
        const nextTeamScore = calculateTeamScore(GAME, nextState, state.currentPlayerIndex, opponentBases, shouldExcludeBases);
        analysis.score += (nextTeamScore - currentTeamScore) * (w.teamPositionWeight || 0.5);
    }

    // Penalty for back-and-forth movement (avoiding repetitive patterns)
    if (unit.lastHexId && move.targetHexId === unit.lastHexId && move.actionType === 'MOVE') {
        analysis.score += (w.backAndForthPenalty || -300);
    }

    // Autochess Aggression: Reward proximity to enemies
    if (GAME.autochess) {
        const nearest = findNearestEnemyUnit(GAME, nextState, state.currentPlayerIndex, targetHexObj);
        if (nearest.unit) {
            const maxDist = (GAME.getRadius ? GAME.getRadius() : 5) * 2;
            // Reward moves that get closer to any enemy
            analysis.score += (maxDist - nearest.distance) * 100;
            
            // Extra bonus for being adjacent (combat engagement)
            if (nearest.distance === 1) {
                analysis.score += 500;
            }
        }
    }

    // Check if unit is already on an enemy base (base already captured) - skip in annihilation mode
    const unitCurrentHexId = unit.hexId;
    const isTargetOnEnemyBase = shouldExcludeBases ? false : opponentBases.some(b => b.baseHexId === move.targetHexId);

    // Check for capture (moving to any enemy base) - skip in annihilation mode
    if (!shouldExcludeBases && isTargetOnEnemyBase) {
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
        analysis.targetArmor = defenderArmor;
        analysis.isTargetThreat = predictedThreats.some(t => t.attacker.id === targetUnit.id);

        const isSkirmishing = !!unit.skirmishBuff;

        if (GAME.gameplayVersion === 2) {
            const { winProb, fumbleProb } = calculateV2CombatSuccessProbability(attackValue, defenderArmor);
            
            // In Skirmish V2, any failure results in elimination (not just fumble)
            let riskProb = fumbleProb;
            if (isSkirmishing) riskProb = 1 - winProb;

            // Expected Value scoring
            // Bonus for winning * target value
            // Penalty for risking self-destruction
            const winValue = (w.killBonus + targetUnit.value * 15) * winProb;
            const lossPenalty = (unit.value * 25) * riskProb;
            
            analysis.score += (winValue - lossPenalty);
            
            if (winProb > 0.5) analysis.canKillEnemy = true; // Heuristic "can kill" if >50%
        } else {
            if (attackValue >= defenderArmor) {
                analysis.canKillEnemy = true;
                analysis.score += w.killBonus + targetUnit.value;
            } else {
                analysis.score += w.attackBonus + targetUnit.value;
            }
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

                if (GAME.gameplayVersion === 2) {
                    const { winProb, fumbleProb } = calculateV2CombatSuccessProbability(oppAttack, defenderArmor);
                    
                    // Penalty for enemy winning
                    // Bonus for enemy fumbling (making this spot safer)
                    analysis.score -= winProb * (unit.value * 20 + Math.abs(w.threatPenalty));
                    analysis.score += fumbleProb * (opp.value * 10);
                    
                    if (winProb > 0.5) {
                        canBeKilledByAny = true;
                        break;
                    }
                } else {
                    if (oppAttack >= defenderArmor) {
                        canBeKilledByAny = true;
                        break;
                    }
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
        const myHex = GAME.getHex(aiUnitNext.hexId, nextState);
        const nearest = findNearestEnemyUnit(GAME, nextState, state.currentPlayerIndex, myHex);

        if (nearest.distance === 2) {
            analysis.score += 200; // Optimal kiting range
            // Extra bonus: destination sets up a ranged shot next turn
            const rangedTargets = GAME.calcValidRangedTargets(aiUnitNext.hexId, nextState);
            if (rangedTargets.length > 0) analysis.score += 300;
        } else if (nearest.distance === 1) {
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

                // COMBO BONUS: Shield enables a strong unit to advance safely next turn.
                // If the target is a frontline (value 4/5) and has a killable enemy adjacent, shielding sets up an attack.
                if (!GAME.autochess && targetUnit.value >= 4) {
                    const targetHexNeighbors = GAME.getNeighbors(targetHex, nextState);
                    for (const tn of targetHexNeighbors) {
                        const enemy = GAME.getUnitOnHex(tn.id, nextState);
                        if (enemy && enemy.playerId !== state.currentPlayerIndex) {
                            const enemyArmor = GAME.calcDefenderEffectiveArmor(tn.id, nextState);
                            if (targetUnit.attack >= enemyArmor) {
                                analysis.score += 80 + targetUnit.value * 10; // Advance setup bonus
                                break;
                            }
                        }
                    }
                }

                // Score shielding based on urgency and unit value
                if (willBeKilled) {
                    analysis.score += (GAME.autochess ? 250 : 150) + (targetUnit.value * (GAME.autochess ? 25 : 15));
                    analysis.isSupportAction = true;
                } else if (willBeAttacked) {
                    analysis.score += (GAME.autochess ? 150 : 60) + (targetUnit.value * (GAME.autochess ? 15 : 8));
                    analysis.isSupportAction = true;
                } else if (isCurrentlyThreatened && targetUnit.value >= 3) {
                    analysis.score += (GAME.autochess ? 80 : 50) + (targetUnit.value * (GAME.autochess ? 10 : 6));
                    analysis.isSupportAction = true;
                } else if (targetUnit.value >= 5) {
                    analysis.score += (GAME.autochess ? 60 : 30) + (targetUnit.value * (GAME.autochess ? 5 : 3));
                    analysis.isSupportAction = true;
                } else {
                    // Base value for shielding healthy units in Autochess (preventative)
                    analysis.score += GAME.autochess ? 40 : 5;
                    analysis.isSupportAction = true;
                }

                // Autochess-specific tuning: Shield priority and targets
                if (GAME.autochess) {
                    // 1. Discourage shielding other backline units (Oracle/Archer) unless they are in real danger
                    if (!willBeKilled && !willBeAttacked && (targetUnit.value === 6 || targetUnit.value === 2)) {
                        analysis.score -= 200; // Big penalty for stationary backline support
                    }

                    // 2. HP-based bonus: Shield units with lower HP
                    if (targetUnit.hp < targetUnit.maxHP) {
                        const hpMissingRatio = 1 - (targetUnit.hp / targetUnit.maxHP);
                        analysis.score += hpMissingRatio * 150;
                    }

                    // 3. Proximity check: If Oracle is far from any enemy, favor advancing over stationary support
                    const nearestEnemy = findNearestEnemyUnit(GAME, state, state.currentPlayerIndex, GAME.getHex(unit.hexId, state));
                    if (nearestEnemy.distance > 3) {
                        analysis.score -= 300; // Penalize casting while far from action
                    }
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
                    const escapeScore = oracleWillBeKilled ? (GAME.autochess ? 300 : 200) : (GAME.autochess ? 150 : 120);
                    analysis.score += escapeScore;
                    analysis.isEscapeAction = true;
                    analysis.isSupportAction = true;
                }

                // TACTICAL REPOSITIONING: Swap valuable unit to advantageous position
                if (!oracleThreatened && !oracleWillBeKilled) {
                    const targetNeighbors = GAME.getNeighbors(targetHex, state);
                    let targetThreatCount = 0;
                    let targetNearEnemy = false;
                    for (const neighbor of targetNeighbors) {
                        const neighborUnit = GAME.getUnitOnHex(neighbor.id, state);
                        if (neighborUnit && neighborUnit.playerId !== state.currentPlayerIndex) {
                            targetThreatCount++;
                            targetNearEnemy = true;
                        }
                    }

                    const oracleThreatCount = oracleNeighbors.filter(n => {
                        const nu = GAME.getUnitOnHex(n.id, state);
                        return nu && nu.playerId !== state.currentPlayerIndex;
                    }).length;

                    // Offensive Swap (Autochess only): Move a fighter (value 1,3,4,5) closer to enemies
                    if (GAME.autochess && targetUnit.value !== 2 && targetUnit.value !== 6) {
                        const oracleNearEnemy = oracleNeighbors.some(n => {
                            const nu = GAME.getUnitOnHex(n.id, state);
                            return nu && nu.playerId !== state.currentPlayerIndex;
                        });

                        if (oracleNearEnemy && !targetNearEnemy) {
                            analysis.score += 150 + (targetUnit.attack * 20);
                            analysis.isSupportAction = true;
                        }
                    }

                    if (targetUnit.value >= 4) {
                        let repositionScore = 0;
                        const opponentBasesList = opponentBases.length > 0 ? opponentBases :
                            state.players.filter((p, idx) => idx !== state.currentPlayerIndex && !p.isEliminated)
                                .map(p => ({ baseHex: GAME.getHex(p.baseHexId, state) })).filter(b => b.baseHex);

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

                        if (repositionScore > 0) {
                            analysis.score += repositionScore;
                            analysis.isSupportAction = true;
                        }
                    }

                    // Rescue operation: Pull wounded unit out of danger
                    const isWounded = GAME.autochess ? (targetUnit.hp < targetUnit.maxHP) : (targetUnit.armorReduction > 0 || targetUnit.currentArmor <= 2);
                    if (isWounded || targetUnit.currentArmor <= 2) {
                        const targetInDanger = targetNeighbors.some(n => {
                            const nu = GAME.getUnitOnHex(n.id, state);
                            return nu && nu.playerId !== state.currentPlayerIndex;
                        });

                        if (targetInDanger) {
                            analysis.score += (GAME.autochess ? 100 : 80) + (targetUnit.value * (GAME.autochess ? 20 : 15));
                            analysis.isSupportAction = true;
                        }
                    }

                    // Penalty: Oracle lands in a threatened position after swap (swapping into danger)
                    const oracleLandsAtTargetHex = oracleNeighbors; // After swap, Oracle is at targetHex
                    const oracleAtTargetNeighbors = GAME.getNeighbors(targetHex, state);
                    let oracleLandsThreatened = false;
                    for (const n of oracleAtTargetNeighbors) {
                        const nu = GAME.getUnitOnHex(n.id, state);
                        if (nu && nu.playerId !== state.currentPlayerIndex) {
                            oracleLandsThreatened = true;
                            break;
                        }
                    }
                    if (oracleLandsThreatened) analysis.score -= 300;
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
            
            // Explicitly check calcValidSacrificeTargets as requested
            const validSacrificeTargets = GAME.calcValidSacrificeTargets(move.unitHexId, state);
            const isValidSacrifice = validSacrificeTargets.includes(move.targetHexId);

            if (targetUnit && oracleUnit && isValidSacrifice) {
                const player = state.players[state.currentPlayerIndex];
                const activeUnits = player.dice.filter(d => d.isDeployed && !d.isDeath);
                const hasReserve = player.dice.some(d => !d.isDeployed && !d.isDeath);

                // Substantially increased score to prioritize Transmute
                analysis.score += (targetUnit.value * 200);
                if (hasReserve) analysis.score += 300;

                // Mark as kill so it gets prioritized by the kill loop
                analysis.canKillEnemy = true;
                analysis.targetValue = targetUnit.value;

                // Stalemate break bonus
                if (targetUnit.value === 6 && activeUnits.length === 1) {
                    const enemyPlayer = state.players[targetUnit.playerId];
                    const enemyActiveUnits = enemyPlayer.dice.filter(d => d.isDeployed && !d.isDeath);
                    analysis.score += 500;
                    if (enemyActiveUnits.length > 1) analysis.score += 200;
                    if (enemyActiveUnits.length === 1) analysis.score += 2000;
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
    } finally {
        if (snapshot) {
            if (GAME.autochess && GAME.Autochess?._restoreEvalSnapshot) {
                GAME.Autochess._restoreEvalSnapshot(state, snapshot);
            } else {
                _restoreHeuristicSnapshot(state, snapshot);
            }
        }
    }
}

/**
 * Find the nearest enemy unit for a given hex
 */
function findNearestEnemyUnit(GAME, state, myPlayerIndex, currentHex) {
    let minEnemyDist = Infinity;
    let nearestEnemy = null;

    for (const player of state.players) {
        if (player.id === myPlayerIndex || player.isEliminated) continue;

        for (const unit of player.dice) {
            if (!unit.isDeployed || unit.isDeath) continue;

            const enemyHex = GAME.getHex(unit.hexId, state);
            if (!enemyHex) continue;

            const dist = GAME.axialDistance(currentHex.q, currentHex.r, enemyHex.q, enemyHex.r);
            if (dist < minEnemyDist) {
                minEnemyDist = dist;
                nearestEnemy = unit;
            }
        }
    }
    return { unit: nearestEnemy, distance: minEnemyDist };
}

/**
 * Calculate the overall strategic score for a player's team position.
 * This encourages units to move towards the nearest enemy base (or nearest enemy unit in annihilation mode).
 */
function calculateTeamScore(GAME, state, playerIndex, opponentBases=[], shouldExcludeBases=false) {
    const player = state.players[playerIndex];
    let score = 0;
    for (const unit of player.dice) {
        if (!unit.isDeployed || unit.isDeath) continue;
        const hex = GAME.getHex(unit.hexId, state);
        if (!hex) continue;

        // 1. Advancement: Bonus for being closer to the nearest objective
        const maxDist = (GAME.getRadius ? GAME.getRadius() : 5) * 2;

        if (!shouldExcludeBases && opponentBases.length > 0) {
            // Target: Bases
            let minBaseDist = Infinity;
            opponentBases.forEach(base => {
                const dist = GAME.axialDistance(hex.q, hex.r, base.baseHex.q, base.baseHex.r);
                if (dist < minBaseDist) minBaseDist = dist;
            });
            score += (maxDist - minBaseDist) * 50;
        } else if (shouldExcludeBases) {
            // Target: Nearest Enemy Unit (Hunting mode)
            const nearest = findNearestEnemyUnit(GAME, state, playerIndex, hex);
            if (nearest.unit) {
                score += (maxDist - nearest.distance) * 40; // Slightly lower weight than base-rushing
            }
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
