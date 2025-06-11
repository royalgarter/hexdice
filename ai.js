function performAI_Greedy(GAME) {
	if (GAME.phase !== 'PLAYER_TURN' || !GAME.players[GAME.currentPlayerIndex].isAI) return;

	const currentState = GAME.cloneState();

	console.time('generateAllPossibleMoves')
	const possibleMoves = generateAllPossibleMoves(GAME, currentState);
	console.timeEnd('generateAllPossibleMoves')

	let bestScore = -Infinity;
	let bestMove = null;

	console.log('currentScore', boardEvaluation(GAME, currentState), currentState);

	// Evaluate all possible moves
	possibleMoves.forEach((move, i) => {
		let nextState = structuredClone(currentState);

		nextState = applyMove(GAME, move, nextState);

		console.time('boardEvaluation-' + i)
		const evaluation = boardEvaluation(GAME, nextState);
		console.timeEnd('boardEvaluation-' + i)
		move.evaluation = evaluation;
		console.log(move);
		move.nextState = nextState;

		if (evaluation > bestScore) {
			bestScore = evaluation;
			bestMove = move;
		}
	});

	// Execute best move if found
	if (bestMove) applyMove(GAME, bestMove);

	console.log('bestMove', bestMove);
}

const ATTACK_LOG_LOOKUP = [0]; // ATTACK_LOG_LOOKUP[attack] = Math.round(Math.log(attack) * EVALUATION_WEIGHT.UNIT_FACTOR)
for (let i = 1; i < 100; i++) { // Assuming max attack value is less than 100
	ATTACK_LOG_LOOKUP.push(Math.round(Math.log(i) * EVALUATION_WEIGHT.UNIT_FACTOR));
}

function boardEvaluation(GAME, state) {
	state = state || GAME;

	if (state.phase === 'GAME_OVER') {
		if (state.winnerPlayerIndex === aiPlayerIndex) return Infinity;
		if (state.winnerPlayerIndex === opponentPlayerIndex) return -Infinity;
		return 0; // Draw
	}

	const aiPlayerIndex = state.currentPlayerIndex;
	const opponentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
	const aiPlayer = state.players[aiPlayerIndex];
	const opponentPlayer = state.players[opponentPlayerIndex];

	const aiUnits = aiPlayer.dice.filter(d => d.isDeployed && !d.isDeath);
	const opponentUnits = opponentPlayer.dice.filter(d => d.isDeployed && !d.isDeath);

	let score = 0;

	// 1. Unit Count and Value
	const aiUnitCount = aiUnits.length;
	const opponentUnitCount = opponentUnits.length;
	score += (aiUnitCount * EVALUATION_WEIGHT.UNIT_COUNT);
	score -= (opponentUnitCount * EVALUATION_WEIGHT.UNIT_COUNT);

	for (let i = 0; i < aiUnitCount; i++) {
		const unit = aiUnits[i];
		score += Math.round(Math.log(unit.attack) * EVALUATION_WEIGHT.UNIT_FACTOR);
		if (unit.isGuarding) score += EVALUATION_WEIGHT.GUARD;

		if (unit.value === 6) {
			const neighbors = GAME.getNeighbors(GAME.getHex(unit.hexId, state), state);
			for (let j = 0; j < neighbors.length; j++) {
				const neighbor = neighbors[j];
				const neighborUnit = GAME.getUnitOnHex(neighbor.id, state);
				if (neighborUnit && neighborUnit.playerId === aiPlayerIndex) {
					score += (EVALUATION_WEIGHT.GUARD >> 3);
				}
			}
		}
	}

	for (let i = 0; i < opponentUnitCount; i++) {
		const unit = opponentUnits[i];
		score -= Math.round(Math.log(unit.attack) * EVALUATION_WEIGHT.UNIT_FACTOR);
	}

	// 2. Positional Scoring
	const opponentBaseHex = GAME.getHex(opponentPlayer.baseHexId, state);
	if (opponentBaseHex) {
		for (let i = 0; i < aiUnitCount; i++) {
			const unit = aiUnits[i];
			const unitHex = GAME.getHex(unit.hexId, state);
			if (unitHex) {
				const distanceToOpponentBase = GAME.axialDistance(unitHex.q, unitHex.r, opponentBaseHex.q, opponentBaseHex.r);
				score += ((R * 2 - distanceToOpponentBase) * EVALUATION_WEIGHT.DISTANCE);
			}
		}
	}

	// 3. Threat and Vulnerability
	let totalThreatScore = 0;
	let totalVulnerabilityScore = 0;
	let opponentThreats = new Set();

	for (let i = 0; i < aiUnitCount; i++) {
		const aiUnit = aiUnits[i];
		let aiUnitThreat = 0;
		for (let j = 0; j < opponentUnitCount; j++) {
			const opponentUnit = opponentUnits[j];
			if (GAME.canUnitAttackTarget(opponentUnit, aiUnit, state)) {
				opponentThreats.add(opponentUnit.hexId);
				aiUnitThreat += (aiUnit.value + opponentUnit.value);
			}
		}
		totalThreatScore += aiUnitThreat;
	}

	for (let i = 0; i < opponentUnitCount; i++) {
		const opponentUnit = opponentUnits[i];
		let opponentUnitVulnerability = 0;
		for (let j = 0; j < aiUnitCount; j++) {
			const aiUnit = aiUnits[j];
			if (GAME.canUnitAttackTarget(aiUnit, opponentUnit, state)) {
				opponentUnitVulnerability += (aiUnit.value + opponentUnit.value) * (opponentThreats.has(opponentUnit.hexId) ? 2 : 1);
			}
		}
		totalVulnerabilityScore += opponentUnitVulnerability;
	}

	score -= (totalThreatScore * EVALUATION_WEIGHT.THREAT);
	score += (totalVulnerabilityScore * EVALUATION_WEIGHT.VULNERABLE);

	// Consider merges
	for (let i = 0; i < aiUnitCount; i++) {
		const aiUnit = aiUnits[i];
		const validMerges = GAME.calcValidMoves(aiUnit.hexId, true, state);
		for (let j = 0; j < validMerges.length; j++) {
			const mergeTargetHexId = validMerges[j];
			const targetUnit = GAME.getUnitOnHex(mergeTargetHexId, state);
			if (targetUnit) {
				const mergeValue = aiUnit.value + targetUnit.value;
				score -= mergeValue;
				score += mergeValue > 6 ? EVALUATION_WEIGHT.MERGE_GT_6 : mergeValue;
			}
		}
	}

	// Brave Charge opportunities
	for (let i = 0; i < aiUnitCount; i++) {
		const aiUnit = aiUnits[i];
		if (aiUnit.value === 1) {
			const braveChargeMoves = GAME.calcValidBraveChargeMoves(aiUnit.hexId);
			for (let j = 0; j < braveChargeMoves.length; j++) {
				const moveHexId = braveChargeMoves[j];
				const moveHex = GAME.getHex(moveHexId, state);
				const neighbors = GAME.getNeighbors(moveHex, state);
				for (let k = 0; k < neighbors.length; k++) {
					const neighborHex = neighbors[k];
					const targetUnit = GAME.getUnitOnHex(neighborHex.id, state);
					if (targetUnit && targetUnit.playerId !== aiPlayerIndex && GAME.calcDefenderEffectiveArmor(neighborHex.id, state) >= 6) {
						score += (targetUnit.value * EVALUATION_WEIGHT.BRAVE_CHARGE);
					}
				}
			}
		}
	}

	// 4. Check Win/Loss conditions
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

		// 5. Merges (Temporary disable as merging need to is complicated to evaluation)
		// const validMerges = GAME.calcValidMoves(unitHexId, true, state); // `true` indicates searching for merge targets
		// validMerges.forEach(mergeTargetHexId => {
		// 	const targetUnit = GAME.getUnitOnHex(mergeTargetHexId, state);
		// 	// Ensure it's another friendly unit and not the unit itself
		// 	if (targetUnit && targetUnit.playerId === state.currentPlayerIndex && targetUnit.hexId !== unitHexId) {
		// 		moves.push({ actionType: 'MERGE', unitHexId, targetHexId: mergeTargetHexId });
		// 	}
		// });

		// 6. Reroll (Temporary disable as reroll give a random evaluation based on luck)
		// moves.push({ actionType: 'REROLL', unitHexId });

		// 7. Guard
		if (!unit.isGuarding) { // Only allow if unit is not already guarding
			moves.push({ actionType: 'GUARD', unitHexId });
		}
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
