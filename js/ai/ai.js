/**
 * Core AI Utilities and Dispatcher for Hex Dice
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AI ADJUSTMENT & TESTING GUIDE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ## Overview
 * The AI system has two layers:
 *   1. heuristic-profiles.js — Profile weights (what to value) and priority order (what to do first)
 *   2. ai-heuristic.js     — Scoring logic (how moves get evaluated)
 *
 * Adjusting AI quality = tuning profiles first, then fixing logic bugs in ai-heuristic.js.
 *
 * ## Running Simulated Battles (tournament.ts)
 *
 *   # Quick 1-game verbose playback (move-by-move):
 *   deno run --allow-all js/tournament.ts -g=1 --profiles=baseline,turtle -v
 *
 *   # Small balance check (N games per matchup, all profile pairs):
 *   deno run --allow-all js/tournament.ts -g=5 --profiles=baseline,berserker,turtle,assassin,tactician -q
 *
 *   # Full tournament (slow):
 *   deno run --allow-all js/tournament.ts -g=10 --profiles=baseline,berserker,turtle,assassin,tactician
 *
 *   Output: Win%, P1/P2 split per profile. Target: no profile above ~70% win rate.
 *   Note: E_21 preset has a mild P2 structural advantage (Knight placement). Run each
 *         profile as both P1 and P2 before concluding dominance.
 *
 * ## Diagnosing Problems
 *
 *   "No good moves. Ending turn." spam:
 *     → Check that unit.hexId matches state.hexes placement (see CRITICAL BUG note below).
 *     → Inspect which priority fires: position, dodge, kill?
 *     → If position fires but scores all < -10000: advanceBonus too low or penalties too high.
 *
 *   Guard spam / oscillation:
 *     → Check lastActionWasGuard persistence (cleared only on MOVE or RANGED_ATTACK).
 *     → Check backAndForthPenalty and prevHexId tracking in game.js.
 *     → Reduce pressureWeight in the profile to break attractor loops.
 *
 *   One profile always wins:
 *     → Compare advanceBonus across profiles. Large gap (e.g. 1800 vs 50) = structural dominance.
 *     → Check if profile priorityOrder gives it capture/kill before position.
 *
 *   Infinite loops in Oracle spells (Shield/Skirmish/Swap):
 *     → SHIELD: skip if targetUnit.isGuarding >= 2 (already fully shielded).
 *     → SKIRMISH: skip if targetUnit.skirmishBuff > 0 (already buffed).
 *     → SWAP: penalise if move.targetHexId === oracleUnit.lastHexId (swap-back loop).
 *
 * ## CRITICAL BUG (fixed): unit.hexId Stale After Simulation
 *   The save/restore snapshot (_saveHeuristicSnapshot/_restoreHeuristicSnapshot) correctly
 *   restores unit.hexId after each simulation. However, the GAME's Alpine.js reactive
 *   state means unit.hexId can diverge from state.hexes over multiple AI turns.
 *   FIX: use aiGetUnitHexId(unit, state) everywhere a unit's position is needed.
 *   For bulk lookups, call aiBuildHexIdMap(state) once and index into the result.
 *   NEVER read unit.hexId directly in AI simulation code.
 *
 * ## Tuning Workflow
 *   1. Run -g=1 verbose for one matchup to understand what moves AI makes.
 *   2. Find the first "wrong" decision (bad position, repeated guard, ignoring kill).
 *   3. Trace which priority fired and why that move scored highest.
 *   4. Adjust the relevant weight in heuristic-profiles.js.
 *   5. Re-run -g=5 and check that win% moved in the expected direction.
 *   6. Repeat for each profile until satisfied.
 *
 * ## Profile Balance Targets (E_21 preset, 2-player)
 *   berserker  — aggressive rushdown, wins ~60% (not 100%)
 *   assassin   — kills first, wins ~55%
 *   baseline   — well-rounded, wins ~45%
 *   tactician  — control/zone, wins ~45%
 *   turtle     — defensive, wins ~40%
 *   ranger     — kiting, wins ~45%
 */

function performAIByWeight(GAME) {
	return performAIByHeuristic(GAME);
}

const performAI = performAIByWeight;

/**
 * Shared Utilities
 */

// Authoritative hex position for a unit in simulation.
// unit.hexId diverges from state.hexes after applyMove with noClone — never trust it directly in AI code.
function aiGetUnitHexId(unit, state) {
	if (!state) return unit.hexId;
	const hex = state.hexes.find(h => h.unit && h.unit.id === unit.id);
	return hex ? hex.id : unit.hexId;
}

// Build id→hexId map for all units in state (O(n) one-time cost, reuse when checking many units).
function aiBuildHexIdMap(state) {
	const map = {};
	state.hexes.forEach(h => { if (h.unit) map[h.unit.id] = h.id; });
	return map;
}

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
		const unitHexId = aiGetUnitHexId(unit, state || GAME);
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
						// Skip spells that would have no effect (prevent spam)
						if (targetUnit.isGuarding < 2) moves.push({ actionType: 'SPELLCAST_SHIELD', unitHexId, targetHexId });
						// SKIRMISH only useful if target has an adjacent enemy to strike
						const targetHexObj = (state || GAME).hexes[targetHexId];
						const hasAdjacentEnemy = targetHexObj && (state || GAME).hexes.some(h => {
							if (!h.unit || h.unit.playerId === unit.playerId) return false;
							const th = (state || GAME).hexes[targetHexId];
							return th && GAME.axialDistance(th.q, th.r, h.q, h.r) === 1;
						});
						if (!targetUnit.skirmishBuff && hasAdjacentEnemy) moves.push({ actionType: 'SPELLCAST_SKIRMISH', unitHexId, targetHexId });
						// SWAP: skip if would swap back to Oracle's own last position
						if (targetHexId !== unit.lastHexId) moves.push({ actionType: 'SPELLCAST_SWAP', unitHexId, targetHexId });
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

		// 7. Guard — only if not already guarding and didn't guard last action (anti-spam)
		if (!unit.isGuarding && !unit.lastActionWasGuard) {
			moves.push({ actionType: 'GUARD', unitHexId });
		}
	});

	return moves;
}

function applyMove(GAME, move, state, options) {
	const applyState = (state && !(options && options.noClone)) ? structuredClone(state) : state;

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
		case 'GUARD': {
			GAME.performGuard(move.unitHexId, applyState);
			// Mark unit so it cannot guard again next turn (anti-spam)
			const guardedUnit = GAME.getUnitOnHex(move.unitHexId, applyState || undefined);
			if (guardedUnit) guardedUnit.lastActionWasGuard = true;
			break;
		}
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
						// lastActionWasGuard NOT cleared — persists until unit moves/attacks
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
