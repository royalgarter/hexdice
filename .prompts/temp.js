// --- Helper functions assumed to be available ---

// Deep clone function: IMPORTANT! This needs to correctly deep clone your entire game state.
// A simple example, but for complex Vue objects or specific custom classes,
// you might need a more robust solution or a library.
function clone(obj) {
	if (obj === null || typeof obj !== 'object') {
		return obj;
	}
	if (obj instanceof Date) {
		return new Date(obj.getTime());
	}
	if (obj instanceof Array) {
		return obj.map(item => clone(item));
	}
	const newObj = {};
	for (const key in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, key)) {
			newObj[key] = clone(obj[key]);
		}
	}
	return newObj;
}

// Example EVALUATION_WEIGHT constants (adjust these based on your game balance)
const EVALUATION_WEIGHT = {
	UNIT_COUNT: 100,      // Value for each deployed AI unit
	UNIT_FACTOR: 10,      // Multiplier for unit's dice value
	GUARD: 50,            // Bonus for guarding units
	DISTANCE: 5,          // Points per hex closer to opponent's base
	THREAT: 20,           // Penalty for AI units being threatened (multiplied by opponent's attack)
	VULNERABLE: 30,       // Reward for opponent units being vulnerable (multiplied by AI's attack)
	MERGE_GT_6: 150,      // Bonus for merging into a unit with value > 6 (e.g., reaching 6)
	BRAVE_CHARGE: 70      // Reward for potential Brave Charge (multiplied by target's value)
};

// Example R constant (radius of hex grid, used in distance calculation)
const R = 5; // Adjust to your actual game board's maximum hex distance

// --- Your existing functions (modified slightly for state passing and win condition) ---

boardEvaluation(state) {
	// `state` is guaranteed to be passed by minimax
	// `state = state || this;` was for legacy/direct calls, minimax will pass it.

	// For evaluation, the `state.currentPlayerIndex` refers to the player whose turn it was
	// to reach this state. `boardEvaluation` evaluates from THIS player's perspective.
	// The `minimax` function will handle negating the score if it's the opponent's perspective.
	const aiPlayerIndex = state.currentPlayerIndex;
	const opponentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;

	const aiPlayer = state.players[aiPlayerIndex];
	const opponentPlayer = state.players[opponentPlayerIndex];

	const aiUnits = aiPlayer.dice.filter(d => d.isDeployed && !d.isDeath);
	const opponentUnits = opponentPlayer.dice.filter(d => d.isDeployed && !d.isDeath);

	let score = 0;

	// 1. Unit Count and Value
	score += (aiUnits.length * EVALUATION_WEIGHT.UNIT_COUNT);
	score -= (opponentUnits.length * EVALUATION_WEIGHT.UNIT_COUNT);

	aiUnits.forEach(unit => {
		score += (unit.value * EVALUATION_WEIGHT.UNIT_FACTOR);
		if (unit.isGuarding) score += EVALUATION_WEIGHT.GUARD;
	});

	opponentUnits.forEach(unit => {
		score -= (unit.value * EVALUATION_WEIGHT.UNIT_FACTOR);
	});

	// 2. Positional Scoring (towards opponent's base)
	const opponentBaseHex = this.getHex(opponentPlayer.baseHexId, state);
	if (opponentBaseHex) {
		aiUnits.forEach(unit => {
			const unitHex = this.getHex(unit.hexId, state);
			if (unitHex) {
				const distanceToOpponentBase = this.axialDistance(unitHex.q, unitHex.r, opponentBaseHex.q, opponentBaseHex.r);
				score += ((R * 2 - distanceToOpponentBase) * EVALUATION_WEIGHT.DISTANCE);
			}
		});
	}

	// 3. Threat and Vulnerability (simplified)
	let totalThreatScore = 0;
	let totalVulnerabilityScore = 0;

	aiUnits.forEach(aiUnit => {
		let aiUnitThreat = 0;
		opponentUnits.forEach(opponentUnit => {
			// Check if opponentUnit can attack aiUnit
			if (this.canUnitAttackTarget(opponentUnit, aiUnit, state)) {
				aiUnitThreat += opponentUnit.attack; // Assuming opponentUnit has an 'attack' property
			}
		});
		totalThreatScore += aiUnitThreat;
	});

	opponentUnits.forEach(opponentUnit => {
		let opponentUnitVulnerability = 0;
		aiUnits.forEach(aiUnit => {
			// Check if aiUnit can attack opponentUnit
			if (this.canUnitAttackTarget(aiUnit, opponentUnit, state)) {
				opponentUnitVulnerability += aiUnit.attack; // Assuming aiUnit has an 'attack' property
			}
		});
		totalVulnerabilityScore += opponentUnitVulnerability;
	});

	score -= (totalThreatScore * EVALUATION_WEIGHT.THREAT);
	score += (totalVulnerabilityScore * EVALUATION_WEIGHT.VULNERABLE);

	// Consider merges
	aiUnits.forEach(aiUnit => {
		// `calcValidMoves` needs to handle the `isForMerge` parameter to identify friendly units
		const validMerges = this.calcValidMoves(aiUnit.hexId, true, state);
		validMerges.forEach(mergeTargetHexId => {
			const targetUnit = this.getUnitOnHex(mergeTargetHexId, state);
			if (targetUnit && targetUnit.playerId === aiPlayerIndex && aiUnit.hexId !== targetUnit.hexId) {
				score -= (aiUnit.value + targetUnit.value); // Penalize for the combined value that's "lost" or condensed
				score += (aiUnit.value + targetUnit.value) > 6 ? EVALUATION_WEIGHT.MERGE_GT_6 : (aiUnit.value + targetUnit.value);
			}
		});
	});

	// Brave Charge opportunities
	aiUnits.forEach(aiUnit => {
		if (aiUnit.value === 1) {
			const opponentUnitsForBC = opponentPlayer.dice.filter(d => d.isDeployed && !d.isDeath);
			opponentUnitsForBC.forEach(opponentUnit => {
				// If this unit 1 can brave charge this specific opponent unit
				if (this.canUnitAttackTarget(aiUnit, opponentUnit, state) && opponentUnit.value >= 6) { // Brave Charge targets high armor value (e.g., >=6)
					score += (opponentUnit.value * EVALUATION_WEIGHT.BRAVE_CHARGE);
				}
			});
		}
	});

	// 4. Check Win/Loss conditions (Highest priority)
	// The `this.checkWinConditions()` method MUST have been called on the `state`
	// within `applyMove` to update `state.phase` and `state.winnerPlayerIndex`.
	if (state.phase === 'GAME_OVER') {
		// The `aiPlayerIndex` here refers to `state.currentPlayerIndex` at the time of evaluation.
		// We need to compare it against the *original* AI player index for the whole minimax search.
		// This `boardEvaluation` function is called *within* the minimax for a specific `state`.
		// The `minimax` function itself will handle the final sign based on `isMaximizingPlayer`.
		// So here, just return Infinity/Negative Infinity based on `state.winnerPlayerIndex`.
		if (state.winnerPlayerIndex === aiPlayerIndex) return Infinity; // The current player in this state won
		else if (state.winnerPlayerIndex !== -1) return -Infinity; // The current player in this state lost
		else return 0; // Draw
	}

	return score;
},

canUnitAttackTarget(attackerUnit, targetUnit, state) {
	if (!attackerUnit || !targetUnit || attackerUnit.playerId === targetUnit.playerId) return false;

	const attackerHex = this.getHex(attackerUnit.hexId, state);
	const targetHex = this.getHex(targetUnit.hexId, state);

	if (!attackerHex || !targetHex) return false;

	const distance = this.axialDistance(attackerHex.q, attackerHex.r, targetHex.q, targetHex.r);

	// Melee attack (implicitly part of move)
	// Ensure calcValidMoves correctly handles passing the state object and the `isForMerge` flag.
	const validMeleeMoves = this.calcValidMoves(attackerUnit.hexId, false, state);
	if (validMeleeMoves.includes(targetHex.id)) return true;

	// Ranged attack (Dice 5)
	if (attackerUnit.value === 5) {
		const validRangedTargets = this.calcValidRangedTargets(attackerUnit.hexId, state);
		if (validRangedTargets.includes(targetHex.id)) return true;
	}

	// Special attack (Dice 6) - Command Conquer (assuming this is it)
	if (attackerUnit.value === 6) {
		const validSpecialTargets = this.calcValidSpecialAttackTargets(attackerUnit.hexId, state);
		if (validSpecialTargets.includes(targetHex.id)) return true;
	}

	// Brave Charge (Dice 1)
	if (attackerUnit.value === 1 && distance === 1) { // Brave charge only happens if adjacent
		const defenderEffectiveArmor = this.calcDefenderEffectiveArmor(targetHex.id, state);
		if (defenderEffectiveArmor >= 6) return true; // Brave Charge targets units with effective armor >= 6
	}

	return false;
},

// --- NEW Helper functions for Minimax ---

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

/**
 * Applies a given move to a copied game state and returns the new state.
 * This is crucial for Minimax to explore hypothetical game states.
 * @param {object} state - The current game state (must be a deep copy).
 * @param {object} move - The move object to apply.
 * @returns {object} The new game state after applying the move.
 */
applyMove(state, move) {
	const newState = clone(state); // Deep copy the state to modify

	// Create a temporary context object. When `performX.call(tempContext, ...)` is used,
	// `this` inside `performX` will refer to `tempContext`.
	// Ensure `tempContext` has all necessary properties and methods that `performX` might access.
	// This is the most delicate part; if your `performX` methods rely on global scope or
	// other Vue reactivity (like `this.$data` directly, or `this.$set`), this might fail.
	const tempContext = {
		...newState, // Copy all state properties
		// Include any game methods that your `performX` functions might call internally.
		// Example: `getHex`, `getUnitOnHex`, `checkWinConditions`.
		// Ensure these methods are also suitable for being called on a `tempContext`.
		getHex: this.getHex,
		getUnitOnHex: this.getUnitOnHex,
		axialDistance: this.axialDistance, // From canUnitAttackTarget, which might be called internally
		getNeighbors: this.getNeighbors, // From canUnitAttackTarget
		calcDefenderEffectiveArmor: this.calcDefenderEffectiveArmor, // From canUnitAttackTarget
		canUnitAttackTarget: this.canUnitAttackTarget, // If your performX methods call this
		checkWinConditions: this.checkWinConditions, // CRITICAL: This updates game.phase and winnerPlayerIndex
		// Suppress any logging or other side-effects during AI simulation
		addLog: () => {},
		// ... add any other methods that your performX functions rely on `this.` for
	};

	// Mark the unit as having acted, unless it's an 'END_TURN' action.
	// The `hasMovedOrAttackedThisTurn` flag is reset by the `END_TURN` logic.
	if (move.actionType !== 'END_TURN') {
		const unitPerformingAction = tempContext.players[tempContext.currentPlayerIndex].dice.find(d => d.hexId === move.unitHexId);
		if (unitPerformingAction) {
			unitPerformingAction.hasMovedOrAttackedThisTurn = true;
		}
	}

	// Apply the chosen move by calling the corresponding game logic function.
	// We bind the `this` context of these functions to our `tempContext` (which is `newState`).
	switch (move.actionType) {
		case 'MOVE':
			this.performMove.call(tempContext, move.unitHexId, move.targetHexId);
			break;
		case 'RANGED_ATTACK':
			this.performRangedAttack.call(tempContext, move.unitHexId, move.targetHexId);
			break;
		case 'COMMAND_CONQUER':
			this.performComandConquer.call(tempContext, move.unitHexId, move.targetHexId);
			break;
		case 'BRAVE_CHARGE':
			this.performBraveCharge.call(tempContext, move.unitHexId, move.targetHexId);
			break;
		case 'MERGE':
			this.performMerge.call(tempContext, move.unitHexId, move.targetHexId, true);
			break;
		case 'REROLL':
			this.performUnitReroll.call(tempContext, move.unitHexId);
			break;
		case 'GUARD':
			this.performGuard.call(tempContext, move.unitHexId);
			break;
		case 'END_TURN':
			// Manually simulate the effects of ending a turn.
			tempContext.currentPlayerIndex = (tempContext.currentPlayerIndex + 1) % tempContext.players.length;
			// Reset `hasMovedOrAttackedThisTurn` for all units of the NEW current player.
			tempContext.players[tempContext.currentPlayerIndex].dice.forEach(d => {
				d.hasMovedOrAttackedThisTurn = false;
			});
			// Crucial: check for win conditions after end of turn to update phase/winner.
			this.checkWinConditions.call(tempContext);
			break;
	}

	// Clean up transient state properties
	delete tempContext.validMoves;
	delete tempContext.validTargets;
	delete tempContext.selectedUnitHexId;
	
	return tempContext;
},

/*
 * Performs the minimax algorithm to choose the best move.
 * Recursively explores all possible moves up to a given depth, and evaluates the game board at the leaves.
 *
 * Inputs:
 *  - state:                the current game state object (a deep copy).
 *  - depth:                the depth of the recursive tree (number of full turns to look ahead).
 *  - alpha:                alpha value for pruning.
 *  - beta:                 beta value for pruning.
 *  - isMaximizingPlayer:   true if the current layer is maximizing (AI's turn), false otherwise (opponent's turn).
 *  - aiPlayerIndex:        the index of the AI player (fixed throughout the search, who we are maximizing for).
 *
 * Output:
 *  the evaluation score for the current state from the AI's perspective.
 */
minimax(state, depth, alpha, beta, isMaximizingPlayer, aiPlayerIndex) {
	// Base case: depth is 0 OR game is over
	if (depth === 0 || state.phase === 'GAME_OVER') {
		const score = this.boardEvaluation(state);
		// If it's the AI's turn (maximizing player) in the current hypothetical state, use the score directly.
		// If it's the opponent's turn (minimizing player), negate the score because `boardEvaluation`
		// calculates it for the `state.currentPlayerIndex` (who is the opponent in this case).
		return isMaximizingPlayer ? score : -score;
	}

	// Generate and order moves - put promising moves first for better pruning
	const moves = this.generateAllPossibleMoves(state)
		.sort((a, b) => (b._priority || 0) - (a._priority || 0)); 

	if (isMaximizingPlayer) { // AI's turn: maximize
		let maxEval = -Infinity;
		for (const move of moves) {
			const newState = this.applyMove(state, move); // Apply move to get new state

			let evalValue;
			if (move.actionType === 'END_TURN') {
				// If an END_TURN action is taken, the player flips, and a full turn has passed.
				evalValue = this.minimax(newState, depth - 1, alpha, beta, false, aiPlayerIndex); // Next is opponent's turn, depth decrements
			} else {
				// If it's not an END_TURN, the same player's turn continues.
				// AI is still maximizing. Depth does NOT decrement as a full turn hasn't passed.
				// The `newState` will reflect that one unit has acted, so `generateAllPossibleMoves` for `newState`
				// will produce fewer options for the *same* player.
				evalValue = this.minimax(newState, depth, alpha, beta, true, aiPlayerIndex); // Still AI's turn, depth remains
			}

			maxEval = Math.max(maxEval, evalValue);
			alpha = Math.max(alpha, evalValue);

			if (beta <= alpha) { // Alpha-beta pruning
				break; // Cut off this branch
			}
		}
		return maxEval;
	} else { // Opponent's turn: minimize
		let minEval = Infinity;
		for (const move of moves) {
			const newState = this.applyMove(state, move);

			let evalValue;
			if (move.actionType === 'END_TURN') {
				// If an END_TURN action is taken, player flips and depth decrements.
				evalValue = this.minimax(newState, depth - 1, alpha, beta, true, aiPlayerIndex); // Next is AI's turn, depth decrements
			} else {
				// If not END_TURN, same player's turn continues.
				evalValue = this.minimax(newState, depth, alpha, beta, false, aiPlayerIndex); // Still opponent's turn, depth remains
			}

			minEval = Math.min(minEval, evalValue);
			beta = Math.min(beta, evalValue);

			if (beta <= alpha) { // Alpha-beta pruning
				break; // Cut off this branch
			}
		}
		return minEval;
	}
},

/*
 * Calculates the best legal move for the AI player at the root of the search tree.
 *
 * Inputs:
 *  - initialGameState: The current game state object (a deep copy from this.$data).
 *  - depth:            The search depth (number of full turns to look ahead).
 *
 * Output:
 *  the best move object { actionType, unitHexId, targetHexId }.
 */
minimaxBestMove(initialGameState, depth) {
	let bestMove = null;
	let bestValue = -Infinity;
	const alpha = -Infinity; // Initial alpha for the root
	const beta = Infinity;   // Initial beta for the root

	// The AI is the current player whose turn it is in the `initialGameState`.
	const aiPlayerIndex = initialGameState.currentPlayerIndex;

	// Generate all possible first moves for the AI player from the current state.
	const possibleMoves = this.generateAllPossibleMoves(initialGameState);

	// Safety fallback: This ensures that even if no units can act, an 'END_TURN' is chosen.
	// `generateAllPossibleMoves` should already ensure this by always including 'END_TURN'.
	if (possibleMoves.length === 0) {
		console.warn("minimaxBestMove: No possible moves generated, defaulting to END_TURN.");
		return { actionType: 'END_TURN' };
	}

	for (const move of possibleMoves) {
		// Create a new state by applying the current move
		const newState = this.applyMove(initialGameState, move);

		let moveValue;
		if (move.actionType === 'END_TURN') {
			// After END_TURN, it's the opponent's turn (minimizing player), and depth decrements.
			moveValue = this.minimax(newState, depth - 1, alpha, beta, false, aiPlayerIndex);
		} else {
			// If not END_TURN, it's still the AI's turn (maximizing player), and depth does not decrement.
			moveValue = this.minimax(newState, depth, alpha, beta, true, aiPlayerIndex);
		}

		// We want to maximize the AI's score
		if (moveValue > bestValue) {
			bestValue = moveValue;
			bestMove = move;
		}
	}

	// If no best move was found (e.g., all moves led to -Infinity or some error)
	if (!bestMove) {
		console.error("MinimaxBestMove: Failed to find any best move, returning first possible move as fallback.");
		return possibleMoves[0] || { actionType: 'END_TURN' };
	}

	return bestMove;
},

// The original performAI_Minimax function that calls minimaxBestMove
performAI_Minimax() { // Minimax AI
	if (this.phase !== 'PLAYER_TURN' || !this.players[this.currentPlayerIndex].isAI) {
		return; // Only proceed if it's the AI's turn
	}

	this.addLog("Minimax AI is thinking...");

	// Check if the AI has any units that can act. If not, and only END_TURN is possible, end turn.
	// This pre-check is largely redundant if `generateAllPossibleMoves` correctly handles it,
	// but acts as a quick exit.
	const unitsThatCanAct = this.players[this.currentPlayerIndex].dice.filter(d => d.isDeployed && !d.isDeath && !d.hasMovedOrAttackedThisTurn);
	if (unitsThatCanAct.length === 0 && this.generateAllPossibleMoves(this.$data).length === 1) { // If only END_TURN is the sole option
		this.addLog("Minimax AI has no units that can act. Ending turn.");
		this.endTurn();
		return;
	}

	// Find the best move using the Minimax algorithm
	const currentGameStateCopy = clone(this.$data); // Deep Copy the current live game state
	// Choose an appropriate depth. A depth of 3 usually means 3 full turns ahead (AI turn -> Opponent turn -> AI turn -> Opponent turn -> AI turn).
	// Be mindful of performance, as search space grows exponentially with depth.
	const bestMove = this.minimaxBestMove(currentGameStateCopy, 3); // Search depth

	// Perform the chosen best move on the *actual* game state.
	// These methods automatically use `this.$data` which is the live state.
	switch (bestMove.actionType) {
		case 'MOVE': this.performMove(bestMove.unitHexId, bestMove.targetHexId); break;
		case 'RANGED_ATTACK': this.performRangedAttack(bestMove.unitHexId, bestMove.targetHexId); break;
		case 'COMMAND_CONQUER': this.performComandConquer(bestMove.unitHexId, bestMove.targetHexId); break;
		case 'BRAVE_CHARGE': this.performBraveCharge(bestMove.unitHexId, bestMove.targetHexId); break;
		case 'MERGE': this.performMerge(bestMove.unitHexId, bestMove.targetHexId, true); break;
		case 'REROLL': this.performUnitReroll(bestMove.unitHexId); break;
		case 'GUARD': this.performGuard(bestMove.unitHexId); break;
		case 'END_TURN':
			// If the best move is to END_TURN, the AI explicitly chooses to pass.
			// The `this.endTurn()` call below will handle this.
			this.addLog("Minimax AI chose to end turn.");
			break;
		default:
			console.warn("Minimax AI chose an unrecognized action type:", bestMove.actionType);
			break;
	}

	// Loop to perform multiple actions per turn
	let shouldEndTurn = false;
	while (!shouldEndTurn) {
		// Get fresh state copy each iteration
		const currentStateCopy = clone(this.$data);
		const nextMove = this.minimaxBestMove(currentStateCopy, 3);
		
		if (nextMove.actionType === 'END_TURN' || 
			!this.generateAllPossibleMoves(this.$data).some(m => m.actionType !== 'END_TURN')) {
			shouldEndTurn = true;
			break;
		}
		
		// Perform the move on actual game state
		switch (nextMove.actionType) {
			case 'MOVE': this.performMove(nextMove.unitHexId, nextMove.targetHexId); break;
			case 'RANGED_ATTACK': this.performRangedAttack(nextMove.unitHexId, nextMove.targetHexId); break;
			case 'COMMAND_CONQUER': this.performComandConquer(nextMove.unitHexId, nextMove.targetHexId); break;
			case 'BRAVE_CHARGE': this.performBraveCharge(nextMove.unitHexId, nextMove.targetHexId); break;
			case 'MERGE': this.performMerge(nextMove.unitHexId, nextMove.targetHexId, true); break;
			case 'REROLL': this.performUnitReroll(nextMove.unitHexId); break;
			case 'GUARD': this.performGuard(nextMove.unitHexId); break;
			case 'END_TURN': shouldEndTurn = true; break;
			default: break;
		}
		
		if (nextMove.actionType === 'END_TURN') break;
	}
	
	this.deselectUnit();
	if (shouldEndTurn) {
		this.endTurn();
	}
}
