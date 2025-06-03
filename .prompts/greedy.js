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
performAI_Greedy() { // Greedy AI
	if (this.phase !== 'PLAYER_TURN' || !this.players[this.currentPlayerIndex].isAI) return;

	// this.addLog("AI is greedy...");

	const aiPlayer = this.players[this.currentPlayerIndex];
	const otherPlayer = this.players[(this.currentPlayerIndex + 1) % this.players.length];
	const aiUnits = aiPlayer.dice.filter(d => d.isDeployed && !d.isDeath);
	const opponentUnits = otherPlayer.dice.filter(d => d.isDeployed && !d.isDeath);
	const aiBaseHexId = aiPlayer.baseHexId;
	const opponentBaseHexId = otherPlayer.baseHexId;

	const currentGameStateCopy = clone(this.$data);
	const initScore = this.boardEvaluation(currentGameStateCopy);
	let bestScore = -Infinity;
	let bestMove = null;

	// Iterate through all possible actions for all active AI units
	for (const unit of aiUnits) {
		if (unit.hasMovedOrAttackedThisTurn) continue;

		// Simulate Move actions
		const validMoves = this.calcValidMoves(unit.hexId, false, currentGameStateCopy);
		for (const targetHexId of validMoves) {
			const nextGameState = clone(currentGameStateCopy);
			this.performMove(unit.hexId, targetHexId, nextGameState);

			const evaluation = this.boardEvaluation(nextGameState);
			console.log('MOVE', unit.hexId, targetHexId, evaluation);
			if (evaluation > bestScore) {
				bestScore = evaluation;
				bestMove = { actionType: 'MOVE', unit: unit.value, unitHexId: unit.hexId, targetHexId: targetHexId };
			}
		}

		// Simulate Ranged Attack (Dice 5)
		if (unit.value === 5) {
			const validRangedTargets = this.calcValidRangedTargets(unit.hexId, currentGameStateCopy);
			for (const targetHexId of validRangedTargets) {
				const nextGameState = clone(currentGameStateCopy);
				this.performRangedAttack(unit.hexId, targetHexId, nextGameState);

				const evaluation = this.boardEvaluation(nextGameState);
				console.log('RANGED_ATTACK', unit.hexId, targetHexId, evaluation);
				if (evaluation > bestScore) {
					bestScore = evaluation;
					bestMove = { actionType: 'RANGED_ATTACK', unit: unit.value, unitHexId: unit.hexId, targetHexId: targetHexId };
				}
			}
		}

		// Simulate Command & Conquer (Dice 6)
		if (unit.value === 6) {
			const validSpecialTargets = this.calcValidSpecialAttackTargets(unit.hexId, currentGameStateCopy);
			for (const targetHexId of validSpecialTargets) {
				const nextGameState = clone(currentGameStateCopy);
				this.performComandConquer(unit.hexId, targetHexId, nextGameState);

				const evaluation = this.boardEvaluation(nextGameState);
				console.log('COMMAND_CONQUER', unit.hexId, targetHexId, evaluation);
				if (evaluation > bestScore) {
					bestScore = evaluation;
					bestMove = { actionType: 'COMMAND_CONQUER', unit: unit.value, unitHexId: unit.hexId, targetHexId: targetHexId };
				}
			}
		}

		// Simulate Brave Charge (Dice 1) - Simulate move and then attack logic
		if (unit.value === 1) {
			const validBraveChargeMoves = this.calcValidBraveChargeMoves(unit.hexId, currentGameStateCopy);
			for (const moveHexId of validBraveChargeMoves) {
				const nextGameStateAfterMove = clone(currentGameStateCopy);
				this.performMove(unit.hexId, moveHexId, nextGameStateAfterMove);

				// After moving, simulate the Brave Charge attack on eligible adjacent targets
				const potentialTargets = this.calcValidSpecialAttackTargets(moveHexId, nextGameStateAfterMove); // Special attack targets are adjacent
				for (const targetHexId of potentialTargets) {
					const targetUnit = this.getUnitOnHex(targetHexId, nextGameStateAfterMove);
					if (targetUnit && targetUnit.playerId !== unit.playerId && this.calcDefenderEffectiveArmor(targetHexId, nextGameStateAfterMove) >= 6) {
						const nextGameStateAfterCharge = clone(nextGameStateAfterMove);
						this.performBraveCharge(moveHexId, targetHexId, nextGameStateAfterCharge); // Needs to be implemented

						const evaluation = this.boardEvaluation(nextGameStateAfterCharge);
						console.log('BRAVE_CHARGE', unit.hexId, targetHexId, evaluation);
						if (evaluation > bestScore) {
							bestScore = evaluation;
							bestMove = { actionType: 'BRAVE_CHARGE', unit: unit.value, unitHexId: unit.hexId, targetHexId: targetHexId }; // Record the initial unit and final target
						}
					}
				}
			}
		}

		// Simulate Merge
		const validMerges = this.calcValidMoves(unit.hexId, true, currentGameStateCopy);
		for (const targetHexId of validMerges) {
			const nextGameState = clone(currentGameStateCopy);
			this.performMerge(unit.hexId, targetHexId, true, nextGameState);

			const evaluation = (initScore - 1) || this.boardEvaluation(nextGameState);// Merge is so random, score is unpredictable
			if (evaluation > bestScore) {
				bestScore = evaluation;
				bestMove = { actionType: 'MERGE', unit: unit.value, unitHexId: unit.hexId, targetHexId: targetHexId };
			}
		}

		// Simulate Reroll
		if (this.canPerformAction(unit.hexId, 'REROLL', currentGameStateCopy)) {
			const nextGameState = clone(currentGameStateCopy);
			this.performUnitReroll(unit.hexId, nextGameState);

			const evaluation = (initScore + 1) || this.boardEvaluation(nextGameState); // Reroll is so random, score is unpredictable
			if (evaluation > bestScore) {
				bestScore = evaluation;
				bestMove = { actionType: 'REROLL', unit: unit.value, unitHexId: unit.hexId };
			}
		}

		// Simulate Guard
		if (this.canPerformAction(unit.hexId, 'GUARD', currentGameStateCopy)) { 
			const nextGameState = clone(currentGameStateCopy);
			this.performGuard(unit.hexId, nextGameState);

			const evaluation = this.boardEvaluation(nextGameState);
			if (evaluation > bestScore) {
				bestScore = evaluation;
				bestMove = { actionType: 'GUARD', unit: unit.value, unitHexId: unit.hexId };
			}
		}
	}

	// If no action found improves the board state, consider a default action like Guarding or skipping turn
	if (bestMove === null) {
		const unitsToGuard = aiUnits.filter(unit => !unit.hasMovedOrAttackedThisTurn && this.canPerformAction(unit.hexId, 'GUARD', currentGameStateCopy));
		if (unitsToGuard.length > 0) {
			const unitToActWith = unitsToGuard.random();
			// Simple: if no better move, Guard a random unit
			bestMove = { unitHexId: unitToActWith.hexId, actionType: 'GUARD' }; // No target hex for Guard
		}
	}

	console.log('bestMove:', bestMove, ', evaluation:', initScore, '->', bestScore);

	if (!bestMove) return this.endTurn();

	switch (bestMove.actionType) {
		case 'MOVE': this.performMove(bestMove.unitHexId, bestMove.targetHexId); break;
		case 'RANGED_ATTACK': this.performRangedAttack(bestMove.unitHexId, bestMove.targetHexId); break;
		case 'COMMAND_CONQUER': this.performComandConquer(bestMove.unitHexId, bestMove.targetHexId); break;
		case 'BRAVE_CHARGE': this.performBraveCharge(bestMove.unitHexId, bestMove.targetHexId); break;
		case 'MERGE': this.performMerge(bestMove.unitHexId, bestMove.targetHexId, true); break;
		case 'REROLL': this.performUnitReroll(bestMove.unitHexId); break;
		case 'GUARD': this.performGuard(bestMove.unitHexId); break;
	}

	this.deselectUnit();
	this.endTurn();
},