/**
 * Generates all possible legal moves for the current player in the given state.
 * @param {object} state - The current game state.
 * @returns {Array<object>} An array of move objects.
 */
generateAllPossibleMoves(state) {
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
		const validMoves = this.calcValidMoves(unitHexId, false, state);
		validMoves.forEach(targetHexId => {
			moves.push({ actionType: 'MOVE', unitHexId, targetHexId });
		});

		// 2. Ranged Attack (Dice 5)
		if (unitValue === 5) {
			const validRangedTargets = this.calcValidRangedTargets(unitHexId, state);
			validRangedTargets.forEach(targetHexId => {
				moves.push({ actionType: 'RANGED_ATTACK', unitHexId, targetHexId });
			});
		}

		// 3. Command Conquer (Dice 6)
		if (unitValue === 6) {
			const validSpecialTargets = this.calcValidSpecialAttackTargets(unitHexId, state);
			validSpecialTargets.forEach(targetHexId => {
				moves.push({ actionType: 'COMMAND_CONQUER', unitHexId, targetHexId });
			});
		}

		// 4. Brave Charge (Dice 1) - move to front for better move ordering
		if (unitValue === 1) {
			const opponentUnits = state.players[(state.currentPlayerIndex + 1) % state.players.length].dice.filter(d => d.isDeployed && !d.isDeath);
			opponentUnits.forEach(opponentUnit => {
				if (this.canUnitAttackTarget(unit, opponentUnit, state)) {
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

		// 5. Merges
		const validMerges = this.calcValidMoves(unitHexId, true, state); // `true` indicates searching for merge targets
		validMerges.forEach(mergeTargetHexId => {
			const targetUnit = this.getUnitOnHex(mergeTargetHexId, state);
			// Ensure it's another friendly unit and not the unit itself
			if (targetUnit && targetUnit.playerId === state.currentPlayerIndex && targetUnit.hexId !== unitHexId) {
				moves.push({ actionType: 'MERGE', unitHexId, targetHexId: mergeTargetHexId });
			}
		});

		// 6. Reroll
		moves.push({ actionType: 'REROLL', unitHexId });

		// 7. Guard
		if (!unit.isGuarding) { // Only allow if unit is not already guarding
			moves.push({ actionType: 'GUARD', unitHexId });
		}
	});

	// Always include the option to end the turn, as it might be the best strategic choice
	// (e.g., no good moves, or to force opponent into a bad position)
	moves.push({ actionType: 'END_TURN' });

	return moves;
},
performAI_Greedy() {
	if (this.phase !== 'PLAYER_TURN' || !this.players[this.currentPlayerIndex].isAI) return;

	const currentGameStateCopy = clone(this.$data);
	const possibleMoves = this.generateAllPossibleMoves(currentGameStateCopy);
	let bestScore = -Infinity;
	let bestMove = null;

	// Evaluate all possible moves
	possibleMoves.forEach(move => {
		const nextGameState = clone(currentGameStateCopy);
		switch (move.actionType) {
			case 'MOVE':
				this.performMove(move.unitHexId, move.targetHexId, nextGameState);
				break;
			case 'RANGED_ATTACK':
				this.performRangedAttack(move.unitHexId, move.targetHexId, nextGameState);
				break;
			case 'COMMAND_CONQUER':
				this.performComandConquer(move.unitHexId, move.targetHexId, nextGameState);
				break;
			case 'BRAVE_CHARGE':
				this.performBraveCharge(move.unitHexId, move.targetHexId, nextGameState);
				break;
			case 'MERGE':
				this.performMerge(move.unitHexId, move.targetHexId, true, nextGameState);
				break;
			case 'REROLL':
				this.performUnitReroll(move.unitHexId, nextGameState);
				break;
			case 'GUARD':
				this.performGuard(move.unitHexId, nextGameState);
				break;
		}
		const evaluation = this.boardEvaluation(nextGameState);
		if (evaluation > bestScore) {
			bestScore = evaluation;
			bestMove = move;
		}
	});

	// Execute best move if found
	if (bestMove) {
		switch (bestMove.actionType) {
			case 'MOVE':
				this.performMove(bestMove.unitHexId, bestMove.targetHexId);
				break;
			case 'RANGED_ATTACK':
				this.performRangedAttack(bestMove.unitHexId, bestMove.targetHexId);
				break;
			case 'COMMAND_CONQUER':
				this.performComandConquer(bestMove.unitHexId, bestMove.targetHexId);
				break;
			case 'BRAVE_CHARGE':
				this.performBraveCharge(bestMove.unitHexId, bestMove.targetHexId);
				break;
			case 'MERGE':
				this.performMerge(bestMove.unitHexId, bestMove.targetHexId, true);
				break;
			case 'REROLL':
				this.performUnitReroll(bestMove.unitHexId);
				break;
			case 'GUARD':
				this.performGuard(bestMove.unitHexId);
				break;
		}
	}

	this.deselectUnit();
	this.endTurn();
},
