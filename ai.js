function performAI_Greedy(GAME) {
	if (GAME.phase !== 'PLAYER_TURN' || !GAME.players[GAME.currentPlayerIndex].isAI) return;

	const currentState = GAME.cloneState();

	console.time('generateAllPossibleMoves')
	const possibleMoves = generateAllPossibleMoves(GAME, currentState);
	console.timeEnd('generateAllPossibleMoves')

	let bestScore = -Infinity;
	let bestMove = null;

	// Evaluate all possible moves
	possibleMoves.forEach((move, i) => {
		console.time('move' + i)
		let nextState = structuredClone(currentState);

		nextState = applyMove(GAME, move, nextState);

		const evaluation = boardEvaluation(GAME, nextState);
		move.evaluation = evaluation;
		move.nextState = nextState;

		if (evaluation > bestScore) {
			bestScore = evaluation;
			bestMove = move;
		}
		console.timeEnd('move' + i)
	});

	// Execute best move if found
	if (bestMove) applyMove(GAME, bestMove);
}

function boardEvaluation(GAME, state) {
	state = state || GAME;

	if (state.phase === 'GAME_OVER') {
		if (state.winnerPlayerIndex === aiPlayerIndex) return Infinity;
		if (state.winnerPlayerIndex === opponentPlayerIndex) return -Infinity;
		return 0; // Draw
	}

	const aiPlayerIndex = state.currentPlayerIndex; // Assuming the AI is the current player for evaluation
	const opponentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;

	const aiPlayer = state.players[aiPlayerIndex];
	const opponentPlayer = state.players[opponentPlayerIndex];

	const aiUnits = aiPlayer.dice.filter(d => d.isDeployed && !d.isDeath);
	const opponentUnits = opponentPlayer.dice.filter(d => d.isDeployed && !d.isDeath);

	let score = 0;

	// 1. Unit Count and Value
	score += (aiUnits.length * EVALUATION_WEIGHT.UNIT_COUNT); // Award points for each AI unit
	score -= (opponentUnits.length * EVALUATION_WEIGHT.UNIT_COUNT); // Penalize for each opponent unit

	aiUnits.forEach(unit => {
		score += Math.round(Math.log(unit.attack) * EVALUATION_WEIGHT.UNIT_FACTOR); // Add unit value to score
		if (unit.isGuarding) score += EVALUATION_WEIGHT.GUARD; // Bonus for guarding units
		if (unit.value === 6) {
			GAME.getNeighbors(GAME.getHex(unit.hexId, state), state).forEach(neighbor => {
				const neighborUnit = GAME.getUnitOnHex(neighbor.id, state);
				if (neighborUnit && neighborUnit.playerId === aiPlayerIndex) {
					score += (EVALUATION_WEIGHT.GUARD >> 1); // Add a "synergy" bonus for each unit it buffs
				}
			});
		}
	});

	opponentUnits.forEach(unit => {
		score -= Math.round(Math.log(unit.attack) * EVALUATION_WEIGHT.UNIT_FACTOR); // Penalize for opponent unit value
	});

	// 2. Positional Scoring (towards opponent's base)
	const opponentBaseHex = GAME.getHex(opponentPlayer.baseHexId, state);
	if (opponentBaseHex) {
		aiUnits.forEach(unit => {
			const unitHex = GAME.getHex(unit.hexId, state);
			if (unitHex) {
				const distanceToOpponentBase = GAME.axialDistance(unitHex.q, unitHex.r, opponentBaseHex.q, opponentBaseHex.r);
				// The closer to the opponent's base, the higher the score
				score += ((R * 2 - distanceToOpponentBase) * EVALUATION_WEIGHT.DISTANCE); // R*2 is roughly max distance
			}
		});
	}

	// defende base
	const aiBaseHex = GAME.getHex(aiPlayer.baseHexId, state);
	if (aiBaseHex) {
		opponentUnits.forEach(unit => {
			const unitHex = GAME.getHex(unit.hexId, state);
			if (unitHex) {
				const distanceToAIBase = GAME.axialDistance(unitHex.q, unitHex.r, aiBaseHex.q, aiBaseHex.r);
				// The closer an enemy is, the bigger the penalty
				score -= ((R * 2 - distanceToAIBase) * EVALUATION_WEIGHT.DISTANCE); // Reuse the distance weight
			}
		});
	}

	// 3. Threat and Vulnerability (simplified)
	let totalThreatScore = 0;
	let totalVulnerabilityScore = 0;
	let opponentThreats = new Set();

	// Calculate threat score for each AI unit
	aiUnits.forEach(aiUnit => {
		let aiUnitThreat = 0;
		opponentUnits.forEach(opponentUnit => {
			if (GAME.canUnitAttackTarget(opponentUnit, aiUnit, state)) {
				opponentThreats.add(opponentUnit.hexId)
				aiUnitThreat += (aiUnit.value + opponentUnit.value);
			}
		});
		totalThreatScore += aiUnitThreat;
	});

	// Calculate vulnerability score for each opponent unit
	opponentUnits.forEach(opponentUnit => {
		let opponentUnitVulnerability = 0;
		aiUnits.forEach(aiUnit => {
			if (GAME.canUnitAttackTarget(aiUnit, opponentUnit, state)) {
				opponentUnitVulnerability += (aiUnit.value + opponentUnit.value) * (opponentThreats.has(opponentUnit.hexId) ? 2 : 1);
			}
		});
		totalVulnerabilityScore += opponentUnitVulnerability;
	});

	score -= (totalThreatScore * EVALUATION_WEIGHT.THREAT); // Penalize for AI units being threatened
	score += (totalVulnerabilityScore * EVALUATION_WEIGHT.VULNERABLE); // Reward for opponent units being vulnerable

	// Consider merges
	aiUnits.forEach(aiUnit => {
		const validMerges = GAME.calcValidMoves(aiUnit.hexId, true, state);
		validMerges.forEach(mergeTargetHexId => {
			const targetUnit = GAME.getUnitOnHex(mergeTargetHexId, state);
			if (targetUnit) {
				score -= (aiUnit.value + targetUnit.value);
				score += (aiUnit.value + targetUnit.value) > 6 ? EVALUATION_WEIGHT.MERGE_GT_6 : (aiUnit.value + targetUnit.value);
			}
		});
	});

	// Brave Charge opportunities
	aiUnits.forEach(aiUnit => {
		if (aiUnit.value === 1) {
			const braveChargeMoves = GAME.calcValidBraveChargeMoves(aiUnit.hexId);
			braveChargeMoves.forEach(moveHexId => {
				// Check neighbors of the potential move hex for high armor enemy targets
				const moveHex = GAME.getHex(moveHexId, state);
				GAME.getNeighbors(moveHex, state).forEach(neighborHex => {
					const targetUnit = GAME.getUnitOnHex(neighborHex.id, state);
					if (targetUnit && targetUnit.playerId !== aiPlayerIndex && GAME.calcDefenderEffectiveArmor(neighborHex.id, state) >= 6) {
						score += (targetUnit.value * EVALUATION_WEIGHT.BRAVE_CHARGE); // Reward for potential Brave Charge on high-value enemy
					}
				});
			});
		}
	});

	// 4. Check Win/Loss conditions (Highest priority)
	if (state.phase === 'GAME_OVER') {
		if (state.winnerPlayerIndex === aiPlayerIndex) score = Infinity; // AI wins
		else if (state.winnerPlayerIndex === opponentPlayerIndex) score = -Infinity; // AI loses
		else score = 0; // Draw
	}

	return score;
}

function generateAllPossibleMoves(GAME, state) {
	const moves = [];
	const currentPlayer = state.players[state.currentPlayerIndex];
	// Units that are deployed, not dead, and haven't acted this turn
	const unitsThatCanAct = currentPlayer.dice.filter(d => d.isDeployed && !d.isDeath && !d.hasMovedOrAttackedThisTurn);

	// If no units can act, the only possible move is to end the turn.
	if (unitsThatCanAct.length === 0) {
		moves.push({ actionType: 'END_TURN' });
		return moves;
	}

	unitsThatCanAct.forEach(unit => {
		const unitHexId = unit.hexId;
		const unitValue = unit.value;

		// 1. Basic Moves (and implied melee attacks on occupied hexes)
		// `calcValidMoves(unitHexId, isForMerge, state)` - assuming this signature
		const validMoves = GAME.calcValidMoves(unitHexId, false, state);
		validMoves.forEach(targetHexId => {
			moves.push({ actionType: 'MOVE', unitHexId, targetHexId });
		});

		// 2. Ranged Attack (Dice 5)
		if (unitValue === 5) {
			const validRangedTargets = GAME.calcValidRangedTargets(unitHexId, state);
			validRangedTargets.forEach(targetHexId => {
				moves.push({ actionType: 'RANGED_ATTACK', unitHexId, targetHexId });
			});
		}

		// 3. Command Conquer (Dice 6)
		if (unitValue === 6) {
			const validSpecialTargets = GAME.calcValidSpecialAttackTargets(unitHexId, state);
			validSpecialTargets.forEach(targetHexId => {
				moves.push({ actionType: 'COMMAND_CONQUER', unitHexId, targetHexId });
			});
		}

		// 4. Brave Charge (Dice 1) - move to front for better move ordering
		if (unitValue === 1) {
			const opponentUnits = state.players[(state.currentPlayerIndex + 1) % state.players.length].dice.filter(d => d.isDeployed && !d.isDeath);
			opponentUnits.forEach(opponentUnit => {
				if (GAME.canUnitAttackTarget(unit, opponentUnit, state)) {
					// Prioritize high-value targets first for better pruning
					moves.unshift({
						actionType: 'BRAVE_CHARGE',
						unitHexId,
						targetHexId: opponentUnit.hexId,
						_priority: opponentUnit.value // Add heuristic for move ordering
					});
				}
			});
		}

		// // 5. Merges
		// const validMerges = GAME.calcValidMoves(unitHexId, true, state); // `true` indicates searching for merge targets
		// validMerges.forEach(mergeTargetHexId => {
		// 	const targetUnit = GAME.getUnitOnHex(mergeTargetHexId, state);
		// 	// Ensure it's another friendly unit and not the unit itself
		// 	if (targetUnit && targetUnit.playerId === state.currentPlayerIndex && targetUnit.hexId !== unitHexId) {
		// 		moves.push({ actionType: 'MERGE', unitHexId, targetHexId: mergeTargetHexId });
		// 	}
		// });

		// // 6. Reroll
		// moves.push({ actionType: 'REROLL', unitHexId });

		// // 7. Guard
		// if (!unit.isGuarding) { // Only allow if unit is not already guarding
		// 	moves.push({ actionType: 'GUARD', unitHexId });
		// }
	});

	// moves.push({ actionType: 'END_TURN' });

	return moves;
}

function applyMove(GAME, move, state) {
	const applyState = state ? structuredClone(state) : undefined; // Deep copy the state to modify

	switch (move.actionType) {
		case 'MOVE': GAME.performMove(move.unitHexId, move.targetHexId, applyState);break;
		case 'RANGED_ATTACK': GAME.performRangedAttack(move.unitHexId, move.targetHexId, applyState);break;
		case 'COMMAND_CONQUER': GAME.performComandConquer(move.unitHexId, move.targetHexId, applyState);break;
		case 'BRAVE_CHARGE': GAME.performBraveCharge(move.unitHexId, move.targetHexId, applyState);break;
		case 'MERGE': GAME.performMerge(move.unitHexId, move.targetHexId, true, applyState);break;
		case 'REROLL': GAME.performUnitReroll(move.unitHexId, applyState);break;
		case 'GUARD': GAME.performGuard(move.unitHexId, applyState);break;
		// case 'END_TURN': GAME.endTurn(applyState); break;
	}

	// GAME.checkWinConditions(applyState);

	if (applyState) {
		// Clean up transient state properties
		delete applyState.validMoves;
		delete applyState.validTargets;
		delete applyState.selectedUnitHexId;
	}

	return applyState;
}
