/**
 * Autochess - Handles the state and logic for Autochess mode.
 */
const Autochess = {
	state: {
		enabled: new URLSearchParams(location.search).get('autochess') === 'true',
		round: 1,
		inventories: {}, // playerId -> array of units
		rerolls: {},    // playerId -> number
		lastResult: null,
		phase: 'PREPARATION', // PREPARATION, COMBAT, RECAP
		selectedProfile: 'baseline',
		roundTimer: 0,
		selectedUnitId: null, // For merging
	},

	init(GAME) {
		GAME.showLog = true;
		GAME.gameplayVersion = 2;
		GAME.options = GAME.options || '';
		if (!GAME.options.includes('a')) GAME.options += 'a';

		GAME.Autochess.state.round = 1;

		GAME.players.forEach(p => {
			GAME.Autochess.state.rerolls[p.id] = 1;
			GAME.Autochess.state.inventories[p.id] = [];
			p.wins = 0;
		});

		GAME.generateHexGrid(GAME.getRadius());
		GAME.Autochess.generateInitialArmy(GAME);
		GAME.Autochess.deployPlayerUnits(GAME);
		// GAME.Autochess.generateRecruits(GAME);
	},

	generateInitialArmy(GAME) {
		GAME.players.forEach(p => {
			p.dice = [];
			for (let i = 0; i < 6; i++) {
				const value = Math.floor(Math.random() * 6) + 1;
				const unit = GAME.Autochess.createUnit(GAME, value, p.id);
				p.dice.push(unit);
			}
		});
	},

	deployPlayerUnits(GAME, playerIdx = 0) {
		const player = GAME.players[playerIdx];
		
		// Clear existing player units from board
		GAME.hexes.forEach(h => {
			if (h.unit && h.unit.playerId === playerIdx) {
				h.unit = null;
				h.unitId = null;
			}
		});

		// Deploy first 6 units to valid base hexes
		const unitsToDeploy = player.dice.slice(0, 6);
		const validHexes = GAME.calcValidDeploymentHexes(playerIdx);
		
		unitsToDeploy.forEach((unit, i) => {
			unit.isDeath = false;
			unit.hp = unit.maxHp;
			unit.isDeployed = false;
			unit.hexId = null;

			if (i < validHexes.length) {
				const hexId = validHexes[i];
				const targetHex = GAME.getHex(hexId);
				if (targetHex) {
					targetHex.unit = unit;
					targetHex.unitId = unit.id;
					unit.hexId = hexId;
					unit.isDeployed = true;
				}
			}
		});
	},

	generateRecruits(GAME, playerId = null) {
		const targetPlayerIds = (playerId !== null) ? [playerId] : GAME.players.map(p => p.id);

		targetPlayerIds.forEach(id => {
			GAME.Autochess.state.inventories[id] = [];
			// Each round rewarded with 1 unit option
			for (let i = 0; i < 1; i++) {
				const value = Math.floor(Math.random() * 6) + 1;
				GAME.Autochess.state.inventories[id].push(GAME.Autochess.createUnit(GAME, value, id));
			}
		});
	},

	recruitUnit(GAME, playerId, index) {
		const unit = GAME.Autochess.state.inventories[playerId].splice(index, 1)[0];
		if (unit) {
			GAME.players[playerId].dice.push(unit);

			// Surgical board update for human player:
			// If we have fewer than 6 units on board, find an empty valid hex and place it.
			if (playerId === 0) {
				const deployedCount = GAME.players[0].dice.filter(u => u.hexId).length;
				if (deployedCount < 6) {
					const validHexes = GAME.calcValidDeploymentHexes(0).filter(hexId => !GAME.getUnitOnHex(hexId));
					if (validHexes.length > 0) {
						const hexId = validHexes[0];
						const targetHex = GAME.getHex(hexId);
						targetHex.unit = unit;
						targetHex.unitId = unit.id;
						unit.hexId = hexId;
						unit.isDeployed = true;
					}
				}
			}
		}
	},

	rerollRecruits(GAME, playerId) {
		if (GAME.Autochess.state.rerolls[playerId] > 0) {
			GAME.Autochess.state.rerolls[playerId]--;
			GAME.Autochess.generateRecruits(GAME, playerId);
		}
	},

	moveUnit(GAME, playerId, fromIndex, toIndex) {
		const player = GAME.players[playerId];
		if (fromIndex < 0 || fromIndex >= player.dice.length || toIndex < 0 || toIndex >= player.dice.length) return;

		const unit = player.dice.splice(fromIndex, 1)[0];
		player.dice.splice(toIndex, 0, unit);

		// If the "top 6" list changed, we might need a full refresh,
		// but since the user is manually reordering, we'll respect their current board positions for now.
		// A full refresh would be GAME.Autochess.deployPlayerUnits(GAME);
	},

	mergeUnits(GAME, playerId, unitId1, unitId2) {
		const player = GAME.players[playerId];
		const u1Index = player.dice.findIndex(u => u.id === unitId1);
		const u2Index = player.dice.findIndex(u => u.id === unitId2);

		if (u1Index === -1 || u2Index === -1 || u1Index === u2Index) return;

		const u1 = player.dice[u1Index];
		const u2 = player.dice[u2Index];

		if (u1.value !== u2.value || u1.veteranLevel !== u2.veteranLevel) {
			GAME.addLog("Cannot merge: Units must be of the same type and level.");
			return;
		}

		// Surgical board update: If u2 (consumed) was on board, clear its hex
		if (u2.hexId) {
			const hex = GAME.getHex(u2.hexId);
			if (hex) {
				hex.unit = null;
				hex.unitId = null;
			}
		}

		// Merge u2 into u1
		u1.veteranLevel = (u1.veteranLevel || 0) + 1;
		u1.attack += Math.min(AUTOCHESS_CONFIG.VETERAN_ATK_BONUS, u1.attack);
		u1.maxHp += AUTOCHESS_CONFIG.VETERAN_HP_BONUS;
		u1.hp = u1.maxHp;

		// Update display name with stars, keep internal 'class' unchanged for logic
		u1.displayName = `${u1.name} ${'★'.repeat(u1.veteranLevel)}`;

		// Remove u2
		player.dice.splice(u2Index, 1);

		GAME.Autochess.state.selectedUnitId = null;
		GAME.addLog(`Merged! ${u1.displayName} leveled up!`);

		GAME.Autochess.deployPlayerUnits(GAME, playerId);

		// If u1 is on board, its reference is already updated, but we might want to refresh its hexId just in case
		// No full deployPlayerUnits here to preserve other units' positions.
	},

	createUnit(GAME, value, playerId) {
		const stats = UNIT_STATS[value];
		const unit = {
			...stats,
			value: value,
			displayName: stats.name,
			playerId: playerId,
			hp: AUTOCHESS_CONFIG.BASE_HP,
			maxHp: AUTOCHESS_CONFIG.BASE_HP,
			currentArmor: stats.armor,
			speed: (6 + stats.distance) || (10 - stats.distance) || Math.floor(20 / stats.distance) || { 1: 10, 2: 12, 3: 15, 4: 8, 5: 5, 6: 10 }[value] || 10,
			actionGauge: 0,
			isDeath: false,
			veteranLevel: 0,
		};
		unit.spriteUrl = GAME.getUnitSpriteUrl(unit);
		unit.iconUrl = '/assets/sprites/icons/' + value + '.png';
		unit.id = `unit_${Math.random().toString(36).substr(2, 9)}`;

		return unit;
	},

	startCombat(GAME) {
		GAME.Autochess.state.phase = 'COMBAT';
		GAME.Autochess.state.roundTimer = 0;
		GAME.messageLog = [];

		// For single-player mode, ensure Player 0 profile is set
		if (GAME.players[0] && !GAME.players[0].isAI) {
			GAME.players[0].profileName = GAME.Autochess.state.selectedProfile;
		}

		GAME.Autochess.prepareCombat(GAME);
		GAME.Autochess.runSimulation(GAME);
	},

	prepareCombat(GAME) {
		// Clear AI units only (Player 0 units are already placed and can be moved manually)
		GAME.hexes.forEach(h => {
			if (h.unit && h.unit.playerId !== 0) {
				h.unit = null;
				h.unitId = null;
			}
		});

		GAME.players.forEach((player, playerIdx) => {
			if (playerIdx === 0) return; // Human player already positioned

			player.dice.forEach((u, i) => {
				u.isDeath = false;
				u.hp = u.maxHp;
				u.actionGauge = 0;
				u.hexId = null;
				u.isDeployed = false;
				u.hasMovedOrAttackedThisTurn = false;
				u.actionsTakenThisTurn = 0;
			});

			// Only deploy first 6 units
			const unitsToDeploy = player.dice.slice(0, 6);
			unitsToDeploy.forEach(unit => {
				const validHexes = GAME.calcValidDeploymentHexes(playerIdx).filter(hexId => !GAME.getUnitOnHex(hexId));
				if (validHexes.length > 0) {
					const hexId = validHexes.random();
					const targetHex = GAME.getHex(hexId);
					targetHex.unit = unit;
					targetHex.unitId = unit.id;
					unit.hexId = hexId;
					unit.isDeployed = true;
				}
			});
		});
	},

	runSimulation(GAME) {
		const combatInterval = setInterval(() => {
			if (GAME.Autochess.state.phase !== 'COMBAT') {
				clearInterval(combatInterval);
				return;
			}

			GAME.Autochess.state.roundTimer += 0.1;
			if (GAME.Autochess.state.roundTimer >= AUTOCHESS_CONFIG.ROUND_TIME_LIMIT) {
				GAME.Autochess.resolveTimeout(GAME);
				clearInterval(combatInterval);
				return;
			}

			GAME.Autochess.simulateStep(GAME);

			const alivePlayers = GAME.players.filter(p => p.dice.some(u => u.isDeployed && !u.isDeath));

			if (alivePlayers.length > 1) return;

			clearInterval(combatInterval);
			const winner = alivePlayers[0];

			GAME.players.forEach(p => {
				const isWinner = winner && p.id === winner.id;
				if (isWinner) {
					GAME.Autochess.state.rerolls[p.id] = AUTOCHESS_CONFIG.WIN_REROLLS;
					p.wins++;
				} else {
					GAME.Autochess.state.rerolls[p.id] = AUTOCHESS_CONFIG.LOSS_REROLLS;
				}
			});

			GAME.Autochess.state.lastResult = (winner && !winner.isAI) ? 'WIN' : 'LOSS';
			GAME.Autochess.state.phase = 'RECAP';
		}, 100);
	},

	resolveTimeout(GAME) {
		const aliveUnits = GAME.players.map(p => p.dice.filter(u => u.isDeployed && !u.isDeath));
		const p0HP = aliveUnits[0].reduce((sum, u) => sum + u.hp, 0);
		const p1HP = aliveUnits[1].reduce((sum, u) => sum + u.hp, 0);

		let winner = null;
		if (p0HP > p1HP) winner = GAME.players[0];
		else if (p1HP > p0HP) winner = GAME.players[1];

		GAME.addLog("TIME UP! Resolving by total HP...");

		GAME.players.forEach(p => {
			const isWinner = winner && p.id === winner.id;
			if (isWinner) {
				GAME.Autochess.state.rerolls[p.id] = AUTOCHESS_CONFIG.WIN_REROLLS;
			} else {
				GAME.Autochess.state.rerolls[p.id] = AUTOCHESS_CONFIG.LOSS_REROLLS;
			}
		});

		GAME.Autochess.state.lastResult = (winner && !winner.isAI) ? 'WIN' : (winner ? 'LOSS' : 'DRAW');
		GAME.Autochess.state.phase = 'RECAP';
	},

	simulateStep(GAME) {
		const allUnits = GAME.players.flatMap(p => p.dice)
			.filter(u => !u.isDeath)
			.sort((a, b) => (b.actionGauge - a.actionGauge) || (Math.random() - 0.5));

		allUnits.forEach(unit => {
			if (unit.isDeath) return;
			unit.actionGauge += unit.speed;
			if (unit.actionGauge >= 100) {
				GAME.Autochess.executeAction(GAME, unit);
				unit.actionGauge -= 100;
			}
		});
	},

	executeAction(GAME, unit) {
		// Store original turn index to restore after action
		const originalPlayerIndex = GAME.currentPlayerIndex;

		// Context setup for AI
		GAME.currentPlayerIndex = unit.playerId;
		GAME.resetUnitTurnState(unit);

		// Fixed strategies for each unit class
		const classProfiles = {
			1: 'baseline',
			2: 'ranger',
			3: 'assassin',
			4: 'berserker',
			5: 'turtle',
			6: 'tactician',
		};
		const profileName = GAME.players[unit.playerId].profileName || classProfiles[unit.value] || 'baseline';

		const state = GAME.cloneState();
		const move = evaluateBestMoveForUnit(GAME, state, unit, profileName);

		if (move && move.actionType !== 'END_TURN') {
			// If it's a spell, we need to set oracleSelectedSpell
			if (move.actionType.startsWith('SPELLCAST_')) {
				GAME.oracleSelectedSpell = move.actionType.replace('SPELLCAST_', '');
			}
			applyMove(GAME, move);
		}

		// Restore original turn index
		GAME.currentPlayerIndex = originalPlayerIndex;
	},

	handleCombat(GAME, attackerUnit, defenderUnit, combatRoll, defenderEffectiveArmor, state) {
		const isSuccess = Math.ceil((attackerUnit.attack + combatRoll) / 2) > defenderEffectiveArmor;
		
		let damage = 10 + 6 * attackerUnit.attack;
		if (isSuccess) {
			GAME.addLog(`⚔️ ${GAME.logUnit(attackerUnit)} dealt ${damage} damage to ${GAME.logUnit(defenderUnit)}!`, state);
			defenderUnit.hp -= damage;
		} else {
			damage = damage >> 1;
			GAME.addLog(`🍌 ${GAME.logUnit(attackerUnit)}'s attack deflected, minor ${damage} damage to ${GAME.logUnit(defenderUnit)}!`, state);
			defenderUnit.hp -= damage;
		}

		if (defenderUnit.hp <= 0) {
			defenderUnit.isDeath = true;
			GAME.addLog(`💀 ${GAME.logUnit(defenderUnit)} has been defeated!`, state);
			const hex = GAME.getHex(defenderUnit.hexId, state);
			if (hex) {
				hex.unit = null;
				hex.unitId = null;
			}
		}
	},

	nextRound(GAME) {
		GAME.Autochess.state.round++;
		if (GAME.Autochess.state.round > AUTOCHESS_CONFIG.MAX_ROUND) {
			const winner = GAME.players.reduce((prev, current) => (prev.wins > current.wins) ? prev : current);
			let text = `🏆 Tournament Complete! Winner: Player ${winner.id + 1}! 🏆`;
			GAME.addLog(text);
			alert(text);
			location.reload();
		} else {
			GAME.generateRouletteTerrain();
			GAME.Autochess.generateRecruits(GAME);
			GAME.Autochess.deployPlayerUnits(GAME);
			GAME.Autochess.state.phase = 'PREPARATION';
		}
	},

};
