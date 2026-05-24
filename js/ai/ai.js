/**
 * Core AI Utilities and Dispatcher for Hex Dice
 */

function performAIByWeight(GAME) {
	return performAIByHeuristic(GAME);
}

const performAI = performAIByWeight;

/**
 * Shared Utilities
 */

function generateAllPossibleMoves(GAME, state, specificUnit = null) {
	const moves = [];
	const currentPlayer = state.players[state.currentPlayerIndex];
	
	let unitsThatCanAct = [];
	
	if (specificUnit) {
		unitsThatCanAct = [specificUnit];
	} else if (GAME.gameplayVersion === 2) {
		if (GAME.turnPhase === 'FATE_CALL') {
			unitsThatCanAct = currentPlayer.dice.filter(d => d.isDeployed && !d.isDeath && d.canMoveInFatePhase);
		} else {
			unitsThatCanAct = currentPlayer.dice.filter(d => d.isDeployed && !d.isDeath && !d.hasMovedOrAttackedThisTurn);
		}
	} else {
		unitsThatCanAct = currentPlayer.dice.filter(d => d.isDeployed && !d.isDeath && !d.hasMovedOrAttackedThisTurn);
	}

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

		// Skip complex actions during Fate's Call
		if (!specificUnit && GAME.gameplayVersion === 2 && GAME.turnPhase === 'FATE_CALL') return;

		// 2. Ranged Attack (Dice 2)
		if (unitValue === 2) {
			const validRangedTargets = GAME.calcValidRangedTargets(unitHexId, state);
			validRangedTargets.forEach(targetHexId => {
				moves.push({ actionType: 'RANGED_ATTACK', unitHexId, targetHexId });
			});
		}

		// 3. Spellcast (Dice 6 Oracle)
		if (unitValue === 6) {
			if (GAME.gameplayVersion === 2) {
				// In V2, spell is already selected (except in Autochess evaluation)
				const spellsToTry = (GAME.autochess && specificUnit) 
					? ['SHIELD', 'SWAP', 'SKIRMISH'] 
					: (GAME.oracleSelectedSpell ? [GAME.oracleSelectedSpell] : []);

				spellsToTry.forEach(spell => {
					const validSpellTargets = GAME.calcValidSpecialAttackTargets(unitHexId, state);
					validSpellTargets.forEach(targetHexId => {
						const targetUnit = GAME.getUnitOnHex(targetHexId, state);
						if (targetUnit && targetUnit.playerId === unit.playerId) {
							moves.push({ actionType: `SPELLCAST_${spell}`, unitHexId, targetHexId });
						}
					});
				});
			} else {
				const validSpellTargets = GAME.calcValidSpecialAttackTargets(unitHexId, state);
				validSpellTargets.forEach(targetHexId => {
					const targetUnit = GAME.getUnitOnHex(targetHexId, state);
					if (targetUnit && targetUnit.playerId === unit.playerId) {
						moves.push({ actionType: 'SPELLCAST_SHIELD', unitHexId, targetHexId });
						moves.push({ actionType: 'SPELLCAST_SWAP', unitHexId, targetHexId });
						moves.push({ actionType: 'SPELLCAST_SKIRMISH', unitHexId, targetHexId });
					}
				});
			}

			// Oracle Sacrifice: Check if this is the last unit and can sacrifice
			if (GAME.canPerformAction(unitHexId, 'SPELLCAST_SACRIFICE', state)) {
				const validSacrificeTargets = GAME.calcValidSacrificeTargets(unitHexId, state);
				validSacrificeTargets.forEach(targetHexId => {
					moves.push({ actionType: 'SPELLCAST_SACRIFICE', unitHexId, targetHexId });
				});
			}
		}
		
		// // 5. Merges
		// const validMerges = GAME.calcValidMoves(unitHexId, true, state);
		// validMerges.forEach(targetHexId => {
		// 	moves.push({ actionType: 'MERGE', unitHexId, targetHexId });
		// });

		// // 7. Guard
		// if (!unit.isGuarding) {
		// 	moves.push({ actionType: 'GUARD', unitHexId });
		// }
	});

	return moves;
}

function applyMove(GAME, move, state) {
	const applyState = state ? structuredClone(state) : undefined;

	// Autochess Hook: Redirect combat actions to Autochess.handleCombat
	if (GAME.autochess) {
		const attacker = GAME.getUnitOnHex(move.unitHexId, applyState);
		if (attacker) {
			const attackerHex = GAME.getHex(move.unitHexId, applyState);
			const targetHex = GAME.getHex(move.targetHexId, applyState);
			const distance = (attackerHex && targetHex) ? GAME.axialDistance(attackerHex.q, attackerHex.r, targetHex.q, targetHex.r) : 1;
			
			if (move.actionType === 'MOVE') {
				const defender = GAME.getUnitOnHex(move.targetHexId, applyState);
				if (defender && defender.playerId !== attacker.playerId) {
					GAME.Autochess.handleCombat(GAME, attacker, defender, GAME.rollDice(), GAME.calcDefenderEffectiveArmor(move.targetHexId, applyState), applyState, 'MELEE', distance);
					return applyState;
				}
			} else if (move.actionType === 'RANGED_ATTACK') {
				const defender = GAME.getUnitOnHex(move.targetHexId, applyState);
				if (defender) {
					GAME.Autochess.handleCombat(GAME, attacker, defender, GAME.rollDice(), GAME.calcDefenderEffectiveArmor(move.targetHexId, applyState), applyState, 'RANGED_ATTACK', distance);
					return applyState;
				}
			} else if (move.actionType === 'COMMAND_CONQUER') {
				const defender = GAME.getUnitOnHex(move.targetHexId, applyState);
				if (defender) {
					GAME.Autochess.handleCombat(GAME, attacker, defender, GAME.rollDice(), GAME.calcDefenderEffectiveArmor(move.targetHexId, applyState), applyState, 'COMMAND_CONQUER', distance);
					return applyState;
				}
			}
		}
	}

	switch (move.actionType) {
		case 'MOVE':
			GAME.performMove(move.unitHexId, move.targetHexId, applyState);
			if (GAME.gameplayVersion === 2 && GAME.turnPhase === 'FATE_CALL') {
				const unit = GAME.getUnitOnHex(move.targetHexId, applyState || undefined);
				if (unit) unit.canMoveInFatePhase = false;
			}
			break;
		case 'RANGED_ATTACK':
			GAME.performRangedAttack(move.unitHexId, move.targetHexId, applyState);
			break;
		case 'COMMAND_CONQUER':
			GAME.performComandConquer(move.unitHexId, move.targetHexId, applyState);
			break;
		case 'SPELLCAST_SHIELD':
			GAME.performSpellCast(move.unitHexId, move.targetHexId, 'SHIELD', applyState);
			break;
		case 'SPELLCAST_SWAP':
			GAME.performSpellCast(move.unitHexId, move.targetHexId, 'SWAP', applyState);
			break;
		case 'SPELLCAST_SKIRMISH':
			GAME.performSpellCast(move.unitHexId, move.targetHexId, 'SKIRMISH', applyState);
			break;
		case 'SPELLCAST_SACRIFICE':
			GAME.performOracleTransmute(move.unitHexId, move.targetHexId, applyState);
			break;
		case 'MERGE':
			GAME.performMerge(move.unitHexId, move.targetHexId, true, applyState);
			break;
		case 'GUARD':
			GAME.performGuard(move.unitHexId, applyState);
			break;
		case 'END_TURN':
			// When analyzing (state provided), just advance turn in cloned state
			// When executing (no state), actually end the turn
			if (applyState) {
				let nextPlayerIndex = (applyState.currentPlayerIndex + 1) % applyState.players.length;
				// Skip eliminated players (same as real endTurn logic)
				while (applyState.players[nextPlayerIndex].isEliminated && nextPlayerIndex !== applyState.currentPlayerIndex) {
					nextPlayerIndex = (nextPlayerIndex + 1) % applyState.players.length;
				}
				applyState.currentPlayerIndex = nextPlayerIndex;
				// Reset turn actions for the next player in cloned state
				applyState.players[nextPlayerIndex].dice.forEach(die => {
					if (die.isDeployed) {
						die.hasMovedOrAttackedThisTurn = false;
						die.actionsTakenThisTurn = 0;
					}
				});
			} else {
				if (GAME.gameplayVersion === 2 && GAME.turnPhase === 'FATE_CALL') {
					GAME.startTacticalCommand();
				} else {
					GAME.endTurn();
				}
			}
			return applyState; // Already handled endTurn
	}

	// For all other actions (MOVE, ATTACK, etc.), if we are executing on real GAME, end the turn
	if (!state) {
		if (GAME.gameplayVersion === 2 && GAME.turnPhase === 'FATE_CALL') {
			// Phase 1 moves don't end the turn
		} else if (GAME.actionMode === 'SKIRMISH_POST_MOVE') {
			// Skirmish post-move doesn't end the turn yet
		} else {
			GAME.endTurn();
		}
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
