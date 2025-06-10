function alpineHexDiceTacticGame() { return {
	/* --- AI OPPONENT --- */
	performAITurn() {
		let choice = ['Simple', 'Analyze', 'Random', 'Minimax', 'Greedy'].random();
		choice = 'Greedy';
		this.addLog(`AI persona: ${choice}`);
		this['performAI_' + choice]();
	},
	performAI_Simple() { // Simple AI
		if (this.phase !== 'PLAYER_TURN' || !this.players[this.currentPlayerIndex].isAI) return;

		// this.addLog("AI is thinking...");

		const aiPlayer = this.players[this.currentPlayerIndex];
		const otherPlayer = this.players[(this.currentPlayerIndex + 1) % this.players.length];
		const aiUnits = aiPlayer.dice.filter(d => d.isDeployed && !d.isDeath);
		const opponentUnits = otherPlayer.dice.filter(d => d.isDeployed && !d.isDeath);
		const aiBaseHexId = aiPlayer.baseHexId;
		const opponentBaseHexId = otherPlayer.baseHexId;

		// Simple AI Strategy:
		// 1. If any unit can attack an enemy and win, do it. Prioritize units closer to opponent base?
		// 2. If no winning attacks, check for merges to create stronger units.
		// 3. If no moves possible, Guard or Reroll (very basic - Guard nearby vulnerable units?)

		let actionTaken = false;

		// Prioritize Attacks
		for (const unit of aiUnits) {
			if (unit.hasMovedOrAttackedThisTurn) continue;

			this.selectedUnitHexId = unit.hexId; // Select the unit for calculation

			// Check for ranged attacks (Dice 5)
			if (unit.value === 5) {
				const targets = this.calcValidRangedTargets(unit.hexId);
				if (targets.length > 0) {
					// Simple: attack the first valid target
					const targetHexId = targets[0];
					this.addLog(`AI (Dice 5) performs Ranged Attack on hex ${targetHexId}`);
					this.performRangedAttack(unit.hexId, targetHexId);
					actionTaken = true;
					break; // AI performs one action per turn for now
				}
			}

			// Check for special attacks (Dice 6)
			if (unit.value === 6) {
				const targets = this.calcValidSpecialAttackTargets(unit.hexId);
				if (targets.length > 0) {
					// Simple: attack the first valid target
					const targetHexId = targets[0];
					this.addLog(`AI (Dice 6) performs Special Attack on hex ${targetHexId}`);
					this.performComandConquer(unit.hexId, targetHexId);
					actionTaken = true;
					break; // AI performs one action per turn for now
				}
			}

			// Check for Melee attacks (implicitly part of move)
			const validMoves = this.calcValidMoves(unit.hexId);
			for (const targetHexId of validMoves) {
				const targetUnit = this.getUnitOnHex(targetHexId);
				if (targetUnit && targetUnit.playerId !== aiPlayer.id) { // It's an enemy
					// Simple: Attack if possible. More complex AI would simulate combat outcome.
					this.addLog(`AI (Dice ${unit.value}) moves to attack unit at hex ${targetHexId}`);
					this.performMove(unit.hexId, targetHexId); // Move action triggers combat
					actionTaken = true;
					break; // AI performs one action per turn for now
				}
			}
			if(actionTaken) break;
		}

		// If no attack or merge, move towards opponent base
		if (!actionTaken) {
			// Basic movement: find unit that hasn't moved, find a valid empty move target closest to opponent base.
			let bestMove = null;
			let closestDistance = Infinity;

			for (const unit of aiUnits) {
				if (unit.hasMovedOrAttackedThisTurn || unit.distance <= 0) continue;
				this.selectedUnitHexId = unit.hexId;
				const validMoves = this.calcValidMoves(unit.hexId); // Get moves to empty hexes

				for (const targetHexId of validMoves) {
					const targetHex = this.getHex(targetHexId);
					const opponentBaseHex = this.getHex(opponentBaseHexId);
					if (targetHex && opponentBaseHex) {
						const distanceToOpponentBase = this.axialDistance(targetHex.q, targetHex.r, opponentBaseHex.q, opponentBaseHex.r);
						if (distanceToOpponentBase < closestDistance) {
							closestDistance = distanceToOpponentBase;
							bestMove = { unitHexId: unit.hexId, targetHexId: targetHexId };
						}
					}
				}
			}

			if (bestMove) {
				this.addLog(`AI (Dice ${this.getUnitOnHex(bestMove.unitHexId).value}) moves towards opponent base.`);
				this.performMove(bestMove.unitHexId, bestMove.targetHexId);
				actionTaken = true;
			}
		}

		// If no action taken (no attacks, merges, or moves), Guard a unit or reroll (basic - just guard a random unit)
		if (!actionTaken) {
			const unitsToGuardOrReroll = aiUnits.filter(unit => !unit.hasMovedOrAttackedThisTurn);
			if (unitsToGuardOrReroll.length > 0) {
				const unitToActWith = unitsToGuardOrReroll.random();
				// For simplicity, AI always Guards if it can't move/attack/merge
				if (this.canPerformAction(unitToActWith.hexId, 'GUARD')) {
					this.addLog(`AI (Dice ${unitToActWith.value}) decides to Guard.`);
					this.performGuard(unitToActWith.hexId);
					actionTaken = true;
				}
				// Add Reroll logic here if desired (e.g., Reroll low value dice)
			}
		}

		// If no unit could perform any action, or all active units have acted, end turn.
		this.deselectUnit(); // Ensure unit is deselected before ending turn
		this.endTurn();
	},
	performAI_Greedy() {
		if (this.phase !== 'PLAYER_TURN' || !this.players[this.currentPlayerIndex].isAI) return;

		const currentGameStateCopy = clone(this.$data);
		const possibleMoves = this.generateAllPossibleMoves(currentGameStateCopy);
		let bestScore = -Infinity;
		let bestMove = null;

		// Evaluate all possible moves
		possibleMoves.forEach(move => {
			let nextGameState = clone(currentGameStateCopy);

			nextGameState = this.applyMove(move, nextGameState);

			const evaluation = this.boardEvaluation(nextGameState);
			move.evaluation = evaluation;
			move.nextGameState = nextGameState;

			if (evaluation > bestScore) {
				bestScore = evaluation;
				bestMove = move;
			}
		});

		// Execute best move if found
		if (bestMove) this.applyMove(bestMove);

		this.deselectUnit();
		this.endTurn();
	},
	performAI_Random() { // Random AI
		if (this.phase !== 'PLAYER_TURN' || !this.players[this.currentPlayerIndex].isAI) return;

		// this.addLog("AI is acting randomly...");

		const aiPlayer = this.players[this.currentPlayerIndex];
		const aiUnits = aiPlayer.dice.filter(d => d.isDeployed && !d.isDeath && !d.hasMovedOrAttackedThisTurn);

		if (aiUnits.length === 0) {
			this.addLog("AI has no units that can act. Ending turn.");
			this.endTurn();
			return;
		}

		const unitToActWith = aiUnits.random();
		this.selectedUnitHexId = unitToActWith.hexId;

		const possibleActions = ['MOVE', 'REROLL', /*'GUARD',*/ 'MERGE'];
		if (unitToActWith.value === 5) possibleActions.push('RANGED_ATTACK');
		if (unitToActWith.value === 6) possibleActions.push('SPECIAL_ATTACK');
		// if (unitToActWith.value === 1) possibleActions.push('BRAVE_CHARGE');

		// Filter actions the unit *can* perform based on game rules (not just strategy)
		const validActions = possibleActions.filter(action => this.canPerformAction(unitToActWith.hexId, action));

		if (validActions.length === 0) {
			this.addLog(`AI (Dice ${unitToActWith.value}) at hex ${unitToActWith.hexId} has no valid actions. Ending turn.`);
			this.deselectUnit();
			this.endTurn();
			return;
		}

		const chosenAction = validActions.random();
		this.addLog(`AI (Dice ${unitToActWith.value}) at hex ${unitToActWith.hexId} chooses action: ${chosenAction}`);

		this.initiateAction(chosenAction); // This calculates valid targets/moves

		let targetHexId = null;
		if (this.validMoves.length > 0 && ['MOVE', 'MERGE', 'BRAVE_CHARGE'].includes(chosenAction)) {
			targetHexId = this.validMoves.random();
		} else if (this.validTargets.length > 0 && ['RANGED_ATTACK', 'SPECIAL_ATTACK'].includes(chosenAction)) {
			targetHexId = this.validTargets.random();
		}

		if (['REROLL', 'GUARD'].includes(chosenAction)) {
			this.performAction(chosenAction, this.selectedUnitHexId);
		}

		if (targetHexId !== null) {
			this.completeAction(targetHexId); // Perform the action with the chosen target
		}
		// If no target found for a target-based action, the action fails gracefully, and the turn ends.
	},
	performAI_Analyze() { // Analyst AI
		if (this.phase !== 'PLAYER_TURN' || !this.players[this.currentPlayerIndex].isAI) return;

		// this.addLog("AI is planning its turn...");

		const aiPlayer = this.players[this.currentPlayerIndex];
		const otherPlayer = this.players[(this.currentPlayerIndex + 1) % this.players.length];
		const aiUnits = aiPlayer.dice.filter(d => d.isDeployed && !d.isDeath);
		const opponentUnits = otherPlayer.dice.filter(d => d.isDeployed && !d.isDeath);
		const aiBaseHexId = aiPlayer.baseHexId;
		const opponentBaseHexId = otherPlayer.baseHexId;

		/* --- Improved AI Strategy --- */
		// Evaluate the board state
		const threats = this.analyzeThreats(aiUnits, opponentUnits, aiBaseHexId);
		const opportunities = this.analyzeOpportunities(aiUnits, opponentUnits, opponentBaseHexId);

		// Prioritize actions based on analysis
		let actionExecuted = false;

		// 1. Defend Base or Eliminate High-Value Threats
		for (const threat of threats) {
			// Prioritize threats to the base
			if (threat.type === 'baseThreat') {
				const defendingUnit = this.getUnitOnHex(threat.defendingUnitHexId);
				const attackingUnit = this.getUnitOnHex(threat.attackingUnitHexId);
				if (defendingUnit && !defendingUnit.hasMovedOrAttackedThisTurn) {
					// Try to attack the threatening unit
					this.selectedUnitHexId = defendingUnit.hexId;
					const validAttacks = this.calcValidMoves(defendingUnit.hexId).filter(hexId => this.getUnitOnHex(hexId)?.id === attackingUnit.id);
					if (validAttacks.length > 0) {
						this.addLog(`AI: Defending base - attacking threatening unit at hex ${threat.attackingUnitHexId}.`);
						this.performMove(defendingUnit.hexId, threat.attackingUnitHexId); // Melee attack by moving
						actionExecuted = true;
						break;
					}
					// If no direct attack, consider moving a unit to block or guard
					// (More complex: find nearest unit that can move to intercept)
				}
			}

			// Prioritize eliminating high-value opponent units if possible
			if (!actionExecuted && threat.type === 'unitThreat' && threat.attackerValue >= 4) { // Consider Dice 4, 5, 6 high-value
				const defendingUnit = this.getUnitOnHex(threat.defendingUnitHexId);
				const attackingUnit = this.getUnitOnHex(threat.attackingUnitHexId);
				if (defendingUnit && !defendingUnit.hasMovedOrAttackedThisTurn) {
					this.selectedUnitHexId = defendingUnit.hexId;
					// Check for direct attacks (melee, ranged, special)
					if (defendingUnit.value === 5) {
						const rangedTargets = this.calcValidRangedTargets(defendingUnit.hexId);
						if (rangedTargets.includes(attackingUnit.hexId)) {
							this.addLog(`AI: Eliminating high-value threat - performing Ranged Attack on hex ${attackingUnit.hexId}.`);
							this.performRangedAttack(defendingUnit.hexId, attackingUnit.hexId);
							actionExecuted = true;
							break;
						}
					}
					if (!actionExecuted && defendingUnit.value === 6) {
						const specialTargets = this.calcValidSpecialAttackTargets(defendingUnit.hexId);
						if (specialTargets.includes(attackingUnit.hexId)) {
							this.addLog(`AI: Eliminating high-value threat - performing Special Attack on hex ${attackingUnit.hexId}.`);
							this.performComandConquer(defendingUnit.hexId, attackingUnit.hexId);
							actionExecuted = true;
							break;
						}
					}
					if (!actionExecuted) {
						const validMoves = this.calcValidMoves(defendingUnit.hexId);
						if (validMoves.includes(attackingUnit.hexId)) {
							this.addLog(`AI: Eliminating high-value threat - moving to attack unit at hex ${attackingUnit.hexId}.`);
							this.performMove(defendingUnit.hexId, attackingUnit.hexId); // Melee attack by moving
							actionExecuted = true;
							break;
						}
					}
				}
			}
			if(actionExecuted) break;
		}

		// 2. Take the good opportunity from opportunities
		for (const opportunity of opportunities) {
			if (actionExecuted) break;
			const unit = this.getUnitOnHex(opportunity.unitHexId);
			// Ensure the unit exists, is not dead, and has not acted yet this turn
			if (!unit || unit.isDeath || unit.hasMovedOrAttackedThisTurn) {
				continue;
			}

			this.selectedUnitHexId = opportunity.unitHexId; // Select the unit before performing the action

			// Perform the action based on the opportunity type and action
			if (opportunity.type === 'attackBase' || opportunity.type === 'attackUnit') {
				if (opportunity.action === 'MOVE') { // Melee attack or move to base
					this.performMove(opportunity.unitHexId, opportunity.targetHexId);
					this.addLog(`AI: Opportunity - ${opportunity.type === 'attackBase' ? 'attacking base' : 'attacking unit'} at hex ${opportunity.targetHexId} with melee unit from hex ${opportunity.unitHexId}.`);
					actionExecuted = true;
					break;
				} else if (opportunity.action === 'RANGED_ATTACK') {
					this.performRangedAttack(opportunity.unitHexId, opportunity.targetHexId);
					this.addLog(`AI: Opportunity - ${opportunity.type === 'attackBase' ? 'attacking base' : 'attacking unit'} at hex ${opportunity.targetHexId} with ranged unit from hex ${opportunity.unitHexId}.`);
					actionExecuted = true;
					break;
				} else if (opportunity.action === 'SPECIAL_ATTACK') {
					this.performComandConquer(opportunity.unitHexId, opportunity.targetHexId); // Assuming ComandConquer is the special attack
					this.addLog(`AI: Opportunity - ${opportunity.type === 'attackBase' ? 'attacking base' : 'attacking unit'} at hex ${opportunity.targetHexId} with special unit from hex ${opportunity.unitHexId}.`);
					actionExecuted = true;
					break;
				}
			} else if (opportunity.type === 'merge') {
				// Merging is performed via a move action
				this.performMove(opportunity.unitHexId, opportunity.targetHexId);
				this.addLog(`AI: Opportunity - Merging unit from hex ${opportunity.unitHexId} to hex ${opportunity.targetHexId}. Resulting value: ${opportunity.resultingValue}.`);
				actionExecuted = true;
				break;
			} else if (opportunity.type === 'advance') {
				// Advancing is performed via a move action
				this.performMove(opportunity.unitHexId, opportunity.targetHexId);
				this.addLog(`AI: Opportunity - Advancing unit from hex ${opportunity.unitHexId} to hex ${opportunity.targetHexId} (distance to base: ${opportunity.distanceToOpponentBase}).`);
				actionExecuted = true;
				break;
			}
			// If we reach here, either the opportunity type was not handled, or the action was not valid for some reason.
			// Continue to the next opportunity.
		}

		// 3. Attack Weaker Enemies or Advance (This block will only execute if no higher priority action was taken)
		if (!actionExecuted) {
			// Prioritize attacking any enemy unit within reach
			let bestAttackOrMove = null;

			for (const unit of aiUnits) {
				if (unit.hasMovedOrAttackedThisTurn) continue;
				this.selectedUnitHexId = unit.hexId;

				// Check for direct attacks (ranged, special, melee)
				const rangedTargets = (unit.value === 5) ? this.calcValidRangedTargets(unit.hexId) : [];
				const specialTargets = (unit.value === 6) ? this.calcValidSpecialAttackTargets(unit.hexId) : [];
				const meleeTargets = this.calcValidMoves(unit.hexId).filter(hexId => this.getUnitOnHex(hexId)?.playerId !== aiPlayer.id);

				if (rangedTargets.length > 0) {
					bestAttackOrMove = { type: 'RANGED_ATTACK', unitHexId: unit.hexId, targetHexId: rangedTargets[0] };
					break;
				}
				if (specialTargets.length > 0) {
					bestAttackOrMove = { type: 'SPECIAL_ATTACK', unitHexId: unit.hexId, targetHexId: specialTargets[0] };
					break;
				}
				if (meleeTargets.length > 0) {
					bestAttackOrMove = { type: 'MELEE_ATTACK', unitHexId: unit.hexId, targetHexId: meleeTargets[0] };
					break;
				}

				// If no attack, find the best move towards the opponent's base
				const validMoves = this.calcValidMoves(unit.hexId);
				let closestDistance = Infinity;
				let bestMoveTarget = null;
				const opponentBaseHex = this.getHex(opponentBaseHexId);

				for (const targetHexId of validMoves) {
					const targetHex = this.getHex(targetHexId);
					if (targetHex && opponentBaseHex) {
						const distanceToOpponentBase = this.axialDistance(targetHex.q, targetHex.r, opponentBaseHex.q, opponentBaseHex.r);
						if (distanceToOpponentBase < closestDistance) {
							closestDistance = distanceToOpponentBase;
							bestMoveTarget = targetHexId;
						}
					}
				}
				if (bestMoveTarget) {
					// Simple: Take the first unit that can move towards the base
					bestAttackOrMove = { type: 'MOVE', unitHexId: unit.hexId, targetHexId: bestMoveTarget };
					break;
				}
			}

			if (bestAttackOrMove) {
				if (bestAttackOrMove.type === 'MOVE') {
					this.addLog(`AI: Moving unit at hex ${bestAttackOrMove.unitHexId} towards opponent base.`);
					this.performMove(bestAttackOrMove.unitHexId, bestAttackOrMove.targetHexId);
				} else if (bestAttackOrMove.type === 'MELEE_ATTACK') {
					this.addLog(`AI: Attacking unit at hex ${bestAttackOrMove.targetHexId} with unit at hex ${bestAttackOrMove.unitHexId}.`);
					this.performMove(bestAttackOrMove.unitHexId, bestAttackOrMove.targetHexId); // Melee is a move
				} else if (bestAttackOrMove.type === 'RANGED_ATTACK') {
					this.addLog(`AI: Performing Ranged Attack on unit at hex ${bestAttackOrMove.targetHexId} with unit at hex ${bestAttackOrMove.unitHexId}.`);
					this.performRangedAttack(bestAttackOrMove.unitHexId, bestAttackOrMove.targetHexId);
				} else if (bestAttackOrMove.type === 'SPECIAL_ATTACK') {
					this.addLog(`AI: Performing Special Attack on unit at hex ${bestAttackOrMove.targetHexId} with unit at hex ${bestAttackOrMove.unitHexId}.`);
					this.performComandConquer(bestAttackOrMove.unitHexId, bestAttackOrMove.targetHexId);
				}
				actionExecuted = true;
			}
		}

		// 4. Guard Vulnerable Units or Reroll
		if (!actionExecuted) {
			// Identify vulnerable units (e.g., low armor, exposed position)
			const vulnerableUnits = aiUnits.filter(unit => !unit.hasMovedOrAttackedThisTurn && this.analyzeUnitVulnerable(unit.hexId, opponentUnits));
			if (vulnerableUnits.length > 0) {
				// Simple: Guard the first vulnerable unit
				const unitToGuard = vulnerableUnits[0];
				if (this.canPerformAction(unitToGuard.hexId, 'GUARD')) {
					this.addLog(`AI: Guarding vulnerable unit at hex ${unitToGuard.hexId}.`);
					this.performGuard(unitToGuard.hexId);
					actionExecuted = true;
				}
			}
		}

		// 5. Reroll Low-Value Dice (as a last resort)
		if (!actionExecuted) {
			const unitsToReroll = aiUnits.filter(unit => !unit.hasMovedOrAttackedThisTurn && unit.value < 4); // Reroll Dice 1, 2, 3
			if (unitsToReroll.length > 0) {
				const unitToReroll = unitsToReroll[0];
				if (this.canPerformAction(unitToReroll.hexId, 'REROLL')) {
					this.addLog(`AI: Rerolling low-value dice at hex ${unitToReroll.hexId}.`);
					this.performUnitReroll(unitToReroll.hexId);
					actionExecuted = true;
				}
			}
		}

		// If no action was taken, end the turn.
		this.deselectUnit(); // Ensure unit is deselected before ending turn
		this.endTurn();
	},
	performAI_Minimax() { // Minimax AI
		if (this.phase !== 'PLAYER_TURN' || !this.players[this.currentPlayerIndex].isAI) {
			return; // Only proceed if it's the AI's turn
		}

		this.addLog("Minimax AI is thinking...");

		const DEPTH = 1;

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
		const bestMove = this.minimaxBestMove(currentGameStateCopy, DEPTH); // Search depth

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

		this.deselectUnit();
		this.endTurn();
	},

	/* --- AI HELPER FUNCTIONS --- */
	boardEvaluation(state) {
		state = state || this;

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
		});

		opponentUnits.forEach(unit => {
			score -= Math.round(Math.log(unit.attack) * EVALUATION_WEIGHT.UNIT_FACTOR); // Penalize for opponent unit value
		});

		// 2. Positional Scoring (towards opponent's base)
		const opponentBaseHex = this.getHex(opponentPlayer.baseHexId, state);
		if (opponentBaseHex) {
			aiUnits.forEach(unit => {
				const unitHex = this.getHex(unit.hexId, state);
				if (unitHex) {
					const distanceToOpponentBase = this.axialDistance(unitHex.q, unitHex.r, opponentBaseHex.q, opponentBaseHex.r);
					// The closer to the opponent's base, the higher the score
					score += ((R * 2 - distanceToOpponentBase) * EVALUATION_WEIGHT.DISTANCE); // R*2 is roughly max distance
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
				if (this.canUnitAttackTarget(opponentUnit, aiUnit, state)) {
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
				if (this.canUnitAttackTarget(aiUnit, opponentUnit, state)) {
					opponentUnitVulnerability += (aiUnit.value + opponentUnit.value) * (opponentThreats.has(opponentUnit.hexId) ? 2 : 1);
				}
			});
			totalVulnerabilityScore += opponentUnitVulnerability;
		});

		score -= (totalThreatScore * EVALUATION_WEIGHT.THREAT); // Penalize for AI units being threatened
		score += (totalVulnerabilityScore * EVALUATION_WEIGHT.VULNERABLE); // Reward for opponent units being vulnerable

		// Consider merges
		aiUnits.forEach(aiUnit => {
			const validMerges = this.calcValidMoves(aiUnit.hexId, true, state);
			validMerges.forEach(mergeTargetHexId => {
				const targetUnit = this.getUnitOnHex(mergeTargetHexId, state);
				if (targetUnit) {
					score -= (aiUnit.value + targetUnit.value);
					score += (aiUnit.value + targetUnit.value) > 6 ? EVALUATION_WEIGHT.MERGE_GT_6 : (aiUnit.value + targetUnit.value);
				}
			});
		});

		// Brave Charge opportunities
		aiUnits.forEach(aiUnit => {
			if (aiUnit.value === 1) {
				const braveChargeMoves = this.calcValidBraveChargeMoves(aiUnit.hexId);
				braveChargeMoves.forEach(moveHexId => {
					// Check neighbors of the potential move hex for high armor enemy targets
					const moveHex = this.getHex(moveHexId, state);
					this.getNeighbors(moveHex, state).forEach(neighborHex => {
						const targetUnit = this.getUnitOnHex(neighborHex.id, state);
						if (targetUnit && targetUnit.playerId !== aiPlayerIndex && this.calcDefenderEffectiveArmor(neighborHex.id, state) >= 6) {
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
	},
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

			// // 5. Merges
			// const validMerges = this.calcValidMoves(unitHexId, true, state); // `true` indicates searching for merge targets
			// validMerges.forEach(mergeTargetHexId => {
			// 	const targetUnit = this.getUnitOnHex(mergeTargetHexId, state);
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

		// Always include the option to end the turn, as it might be the best strategic choice
		// (e.g., no good moves, or to force opponent into a bad position)
		// moves.push({ actionType: 'END_TURN' });

		return moves;
	},
	applyMove(move, state) {
		const applyState = state ? clone(state) : undefined; // Deep copy the state to modify

		switch (move.actionType) {
			case 'MOVE': this.performMove(move.unitHexId, move.targetHexId, applyState);break;
			case 'RANGED_ATTACK': this.performRangedAttack(move.unitHexId, move.targetHexId, applyState);break;
			case 'COMMAND_CONQUER': this.performComandConquer(move.unitHexId, move.targetHexId, applyState);break;
			case 'BRAVE_CHARGE': this.performBraveCharge(move.unitHexId, move.targetHexId, applyState);break;
			case 'MERGE': this.performMerge(move.unitHexId, move.targetHexId, true, applyState);break;
			case 'REROLL': this.performUnitReroll(move.unitHexId, applyState);break;
			case 'GUARD': this.performGuard(move.unitHexId, applyState);break;
			// case 'END_TURN': this.endTurn(applyState); break;
		}

		// this.checkWinConditions(applyState);

		if (applyState) {
			// Clean up transient state properties
			delete applyState.validMoves;
			delete applyState.validTargets;
			delete applyState.selectedUnitHexId;
		}

		return applyState;
	},
	canUnitAttackTarget(attackerUnit, targetUnit, state) {
		if (!attackerUnit || !targetUnit || attackerUnit.playerId === targetUnit.playerId) return false;

		const attackerHex = this.getHex(attackerUnit.hexId, state);
		const targetHex = this.getHex(targetUnit.hexId, state);

		if (!attackerHex || !targetHex) return false;

		const distance = this.axialDistance(attackerHex.q, attackerHex.r, targetHex.q, targetHex.r);

		// Melee attack (implicitly part of move)
		const validMeleeMoves = this.calcValidMoves(attackerUnit.hexId, state); // Need to make calcValidMoves work with passed gameState
		if (validMeleeMoves.includes(targetHex.id)) return true;

		// Ranged attack (Dice 5)
		if (attackerUnit.value === 5) {
			const validRangedTargets = this.calcValidRangedTargets(attackerUnit.hexId, state); // Need to make calcValidRangedTargets work with passed gameState
			if (validRangedTargets.includes(targetHex.id)) return true;
		}

		// Special attack (Dice 6)
		if (attackerUnit.value === 6) {
			const validSpecialTargets = this.calcValidSpecialAttackTargets(attackerUnit.hexId, state); // Need to make calcValidSpecialAttackTargets work with passed gameState
			if (validSpecialTargets.includes(targetHex.id)) return true;
		}

		// Brave Charge (Dice 1)
		if (attackerUnit.value === 1 && distance === 1) {
			// Check if target has effective armor >= 6
			const defenderEffectiveArmor = this.calcDefenderEffectiveArmor(targetHex.id, state); // Need to make calcDefenderEffectiveArmor work with passed gameState
			if (defenderEffectiveArmor >= 6) return true;
		}

		return false;
	},

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
			const newState = this.applyMove(move, initialGameState);

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
				const newState = this.applyMove(move, state); // Apply move to get new state

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
				const newState = this.applyMove(move, state);

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

	analyzeThreats(aiUnits, opponentUnits, aiBaseHexId) {
		const threats = [];
		const aiBaseHex = this.getHex(aiBaseHexId);

		// Check for threats to the AI base
		opponentUnits.forEach(enemyUnit => {
			if (!enemyUnit.isDeath) {
				this.selectedUnitHexId = enemyUnit.hexId; // Select enemy unit to calculate its potential moves/targets
				const enemyMoves = this.calcValidMoves(enemyUnit.hexId);
				const enemyRangedTargets = (enemyUnit.value === 5) ? this.calcValidRangedTargets(enemyUnit.hexId) : [];
				const enemySpecialTargets = (enemyUnit.value === 6) ? this.calcValidSpecialAttackTargets(enemyUnit.hexId) : [];

				if (enemyMoves.includes(aiBaseHexId) || enemyRangedTargets.includes(aiBaseHexId) || enemySpecialTargets.includes(aiBaseHexId)) {
					threats.push({
						type: 'baseThreat',
						attackingUnitHexId: enemyUnit.hexId,
						defendingUnitHexId: aiBaseHexId, // The base itself
						distance: this.axialDistance(this.getHex(enemyUnit.hexId).q, this.getHex(enemyUnit.hexId).r, aiBaseHex.q, aiBaseHex.r),
						attackerValue: enemyUnit.value
					});
				}

				// Check for threats to individual AI units
				aiUnits.forEach(aiUnit => {
					if (!aiUnit.isDeath) {
						if (enemyMoves.includes(aiUnit.hexId) || enemyRangedTargets.includes(aiUnit.hexId) || enemySpecialTargets.includes(aiUnit.hexId)) {
							threats.push({
								type: 'unitThreat',
								attackingUnitHexId: enemyUnit.hexId,
								defendingUnitHexId: aiUnit.hexId,
								distance: this.axialDistance(this.getHex(enemyUnit.hexId).q, this.getHex(enemyUnit.hexId).r, this.getHex(aiUnit.hexId).q, this.getHex(aiUnit.hexId).r),
								attackerValue: enemyUnit.value,
								defenderValue: aiUnit.value,
								// More advanced: assess combat outcome likelihood
							});
						}
					}
				});
			}
		});

		// Sort threats (e.g., base threats first, then closer, then higher value attackers)
		threats.sort((a, b) => {
			if (a.type === 'baseThreat' && b.type !== 'baseThreat') return -1;
			if (a.type !== 'baseThreat' && b.type === 'baseThreat') return 1;
			if (a.distance !== b.distance) return a.distance - b.distance;
			return b.attackerValue - a.attackerValue;
		});

		this.deselectUnit(); // Clean up selection used for calculation
		return threats;
	},
	analyzeOpportunities(aiUnits, opponentUnits, opponentBaseHexId) {
		const opportunities = [];
		const opponentBaseHex = this.getHex(opponentBaseHexId);

		// Look for attack opportunities on opponent units or base
		aiUnits.forEach(aiUnit => {
			if (!aiUnit.hasMovedOrAttackedThisTurn && !aiUnit.isDeath) {
				this.selectedUnitHexId = aiUnit.hexId;
				const validMoves = this.calcValidMoves(aiUnit.hexId);
				const validRangedTargets = (aiUnit.value === 5) ? this.calcValidRangedTargets(aiUnit.hexId) : [];
				const validSpecialTargets = (aiUnit.value === 6) ? this.calcValidSpecialAttackTargets(aiUnit.hexId) : [];

				// Check for attacks on opponent base
				if (validMoves.includes(opponentBaseHexId) || validRangedTargets.includes(opponentBaseHexId) || validSpecialTargets.includes(opponentBaseHexId)) {
					opportunities.push({
						type: 'attackBase',
						unitHexId: aiUnit.hexId,
						targetHexId: opponentBaseHexId,
						unitValue: aiUnit.value,
						distance: this.axialDistance(this.getHex(aiUnit.hexId).q, this.getHex(aiUnit.hexId).r, opponentBaseHex.q, opponentBaseHex.r),
						action: validMoves.includes(opponentBaseHexId) ? 'MOVE' : (aiUnit.value === 5 ? 'RANGED_ATTACK' : 'SPECIAL_ATTACK')
					});
				}

				// Check for attacks on opponent units
				opponentUnits.forEach(enemyUnit => {
					if (!enemyUnit.isDeath) {
						if (validMoves.includes(enemyUnit.hexId)) {
							opportunities.push({
								type: 'attackUnit',
								unitHexId: aiUnit.hexId,
								targetHexId: enemyUnit.hexId,
								unitValue: aiUnit.value,
								targetValue: enemyUnit.value,
								distance: this.axialDistance(this.getHex(aiUnit.hexId).q, this.getHex(aiUnit.hexId).r, this.getHex(enemyUnit.hexId).q, this.getHex(enemyUnit.hexId).r),
								action: 'MOVE' // Melee attack
								// More advanced: include combat outcome prediction
							});
						} else if (validRangedTargets.includes(enemyUnit.hexId)) {
							opportunities.push({
								type: 'attackUnit',
								unitHexId: aiUnit.hexId,
								targetHexId: enemyUnit.hexId,
								unitValue: aiUnit.value,
								targetValue: enemyUnit.value,
								distance: this.axialDistance(this.getHex(aiUnit.hexId).q, this.getHex(aiUnit.hexId).r, this.getHex(enemyUnit.hexId).q, this.getHex(enemyUnit.hexId).r),
								action: 'RANGED_ATTACK'
							});
						} else if (validSpecialTargets.includes(enemyUnit.hexId)) {
							opportunities.push({
								type: 'attackUnit',
								unitHexId: aiUnit.hexId,
								targetHexId: enemyUnit.hexId,
								unitValue: aiUnit.value,
								targetValue: enemyUnit.value,
								distance: this.axialDistance(this.getHex(aiUnit.hexId).q, this.getHex(aiUnit.hexId).r, this.getHex(enemyUnit.hexId).q, this.getHex(enemyUnit.hexId).r),
								action: 'SPECIAL_ATTACK'
							});
						}
					}
				});

				// Look for merge opportunities
				const validMerges = this.calcValidMoves(aiUnit.hexId, true);
				validMerges.forEach(mergeTargetHexId => {
					const targetUnit = this.getUnitOnHex(mergeTargetHexId);
					if (targetUnit) {
						opportunities.push({
							type: 'merge',
							unitHexId: aiUnit.hexId,
							targetHexId: mergeTargetHexId,
							unitValue: aiUnit.value,
							targetValue: targetUnit.value,
							resultingValue: aiUnit.value + targetUnit.value > 6 ? 6 : aiUnit.value + targetUnit.value, // Simplified
							canResultUnitAct: targetUnit.actionsTakenThisTurn === 0,
							distance: this.axialDistance(this.getHex(aiUnit.hexId).q, this.getHex(aiUnit.hexId).r, this.getHex(targetUnit.hexId).q, this.getHex(targetUnit.hexId).r)
						});
					}
				});

				// Look for safe movement options towards opponent base
				validMoves.forEach(moveTargetHexId => {
					// Simple check: Is this move towards the opponent base and is the hex empty?
					const moveTargetHex = this.getHex(moveTargetHexId);
					if (!this.getUnitOnHex(moveTargetHexId) && this.axialDistance(moveTargetHex.q, moveTargetHex.r, opponentBaseHex.q, opponentBaseHex.r) < this.axialDistance(this.getHex(aiUnit.hexId).q, this.getHex(aiUnit.hexId).r, opponentBaseHex.q, opponentBaseHex.r)) {
						opportunities.push({
							type: 'advance',
							unitHexId: aiUnit.hexId,
							targetHexId: moveTargetHexId,
							unitValue: aiUnit.value,
							distanceToOpponentBase: this.axialDistance(moveTargetHex.q, moveTargetHex.r, opponentBaseHex.q, opponentBaseHex.r),
						});
					}
				});
			}
		});

		// Sort opportunities (e.g., attack base, then strong attacks, then good merges, then advances)
		opportunities.sort((a, b) => {
			if (a.type === 'attackBase' && b.type !== 'attackBase') return -1;
			if (a.type !== 'attackBase' && b.type === 'attackBase') return 1;
			if (a.type === 'attackUnit' && b.type !== 'attackUnit') return -1;
			if (a.type !== 'attackUnit' && b.type === 'attackUnit') return 1;
			// For attackUnit, prioritize by target value (high to low) then attacker value (high to low)
			if (a.type === 'attackUnit' && b.type === 'attackUnit') {
				if (a.targetValue !== b.targetValue) return b.targetValue - a.targetValue;
				return b.unitValue - a.unitValue;
			}
			if (a.type === 'merge' && b.type !== 'merge') return -1;
			if (a.type !== 'merge' && b.type === 'merge') return 1;
			// For merge, prioritize creating higher value units, then those that can act
			if (a.type === 'merge' && b.type === 'merge') {
				if (a.resultingValue !== b.resultingValue) return b.resultingValue - a.resultingValue;
				if (a.canResultUnitAct !== b.canResultUnitAct) return a.canResultUnitAct ? -1 : 1; // Prioritize able to act
			}
			if (a.type === 'advance' && b.type !== 'advance') return -1;
			if (a.type !== 'advance' && b.type === 'advance') return 1;
			// For advance, prioritize units closer to the base
			if (a.type === 'advance' && b.type === 'advance') {
				return a.distanceToOpponentBase - b.distanceToOpponentBase;
			}
			return 0; // Default
		});

		this.deselectUnit(); // Clean up selection used for calculation
		return opportunities;
	},
	analyzeUnitVulnerable(unitHexId, opponentUnits) {
		const unit = this.getUnitOnHex(unitHexId);
		if (!unit || unit.isDeath) return false;

		// Simple vulnerability check: Is any enemy unit in range to attack this unit?
		this.selectedUnitHexId = unitHexId; // Select for calculating potential threats
		let isThreatened = false;
		opponentUnits.forEach(enemyUnit => {
			if (!enemyUnit.isDeath) {
				const enemyHex = this.getHex(enemyUnit.hexId);
				if (!enemyHex) return;

				// Check if enemy can reach this unit's hex
				const enemyPotentialMoves = this.calcValidMoves(enemyUnit.hexId);
				if (enemyPotentialMoves.includes(unitHexId)) {
					isThreatened = true;
					return;
				}

				// Check if enemy ranged/special can target this unit
				const enemyRangedTargets = (enemyUnit.value === 5) ? this.calcValidRangedTargets(enemyUnit.hexId) : [];
				if (enemyRangedTargets.includes(unitHexId)) {
					isThreatened = true;
					return;
				}
				const enemySpecialTargets = (enemyUnit.value === 6) ? this.calcValidSpecialAttackTargets(enemyUnit.hexId) : [];
				if (enemySpecialTargets.includes(unitHexId)) {
					isThreatened = true;
					return;
				}
			}
		});

		this.deselectUnit(); // Clean up selection
		return isThreatened; // Basic vulnerability: is any enemy unit able to attack it?
		// More complex: consider unit's armor, value, number of threatening enemies, friendly support
	},
};}