{
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
	performAI_Analyze() { // Strategic AI
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

		// 3. Attack Weaker Enemies or Advance
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
							closestDistance = distanceToOppanceBase;
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
};