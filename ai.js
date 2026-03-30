/**
 * Core AI Utilities and Dispatcher for Hex Dice
 */

function performAIByWeight(GAME) {
	return performAIByRandom(GAME);
	
	// Priority order: Priority Bot -> Random Greedy -> Minimax (Fallback)
	if (typeof performAIByPriority === 'function') {
		return performAIByPriority(GAME);
	} else if (typeof performAIByRandom === 'function') {
		return performAIByRandom(GAME);
	} else if (typeof performAIByMinimax === 'function') {
		return performAIByMinimax(GAME);
	} else {
		console.error("No AI strategies loaded!");
	}
}

const performAI = performAIByWeight;

/**
 * Shared Utilities
 */

function generateAllPossibleMoves(GAME, state) {
	const moves = [];
	const currentPlayer = state.players[state.currentPlayerIndex];
	const unitsThatCanAct = currentPlayer.dice.filter(d => d.isDeployed && !d.isDeath && !d.hasMovedOrAttackedThisTurn);

	if (unitsThatCanAct.length === 0) {
		moves.push({ actionType: 'END_TURN' });
		return moves;
	}

	unitsThatCanAct.forEach(unit => {
		const unitHexId = unit.hexId;
		const unitValue = unit.value;

		// 1. Basic Moves
		const validMoves = GAME.calcValidMoves(unitHexId, false, state);
		validMoves.forEach(targetHexId => {
			moves.push({ actionType: 'MOVE', unitHexId, targetHexId });
		});

		// 2. Ranged Attack (Dice 2)
		if (unitValue === 2) {
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
		
		// 5. Merges
		const validMerges = GAME.calcValidMoves(unitHexId, true, state);
		validMerges.forEach(targetHexId => {
			moves.push({ actionType: 'MERGE', unitHexId, targetHexId });
		});

		// 7. Guard
		if (!unit.isGuarding) {
			moves.push({ actionType: 'GUARD', unitHexId });
		}
	});

	return moves;
}

function applyMove(GAME, move, state) {
	const applyState = state ? structuredClone(state) : undefined;

	switch (move.actionType) {
		case 'MOVE':
			GAME.performMove(move.unitHexId, move.targetHexId, applyState);
			break;
		case 'RANGED_ATTACK':
			GAME.performRangedAttack(move.unitHexId, move.targetHexId, applyState);
			break;
		case 'COMMAND_CONQUER':
			GAME.performComandConquer(move.unitHexId, move.targetHexId, applyState);
			break;
		case 'MERGE':
			GAME.performMerge(move.unitHexId, move.targetHexId, true, applyState);
			break;
		case 'GUARD':
			GAME.performGuard(move.unitHexId, applyState);
			break;
		case 'END_TURN':
			break;
	}

	if (applyState) {
		delete applyState.validMoves;
		delete applyState.validTargets;
		delete applyState.selectedUnitHexId;
		delete applyState.hovering;
		delete applyState.messageLog;
	}

	return applyState;
}
