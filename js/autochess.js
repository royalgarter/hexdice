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
		});

		GAME.generateHexGrid(GAME.getRadius());
		GAME.Autochess.generateInitialArmy(GAME);
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

	generateRecruits(GAME, playerId = null) {
		const targetPlayerIds = (playerId !== null) ? [playerId] : GAME.players.map(p => p.id);

		targetPlayerIds.forEach(id => {
			GAME.Autochess.state.inventories[id] = [];
			// Default 5 options per shop refresh
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
		}
	},

	rerollRecruits(GAME, playerId) {
		if (GAME.Autochess.state.rerolls[playerId] > 0) {
			GAME.Autochess.state.rerolls[playerId]--;
			GAME.Autochess.generateRecruits(GAME, playerId);
		}
	},

	createUnit(GAME, value, playerId) {
		const stats = UNIT_STATS[value];
		const unit = {
			...stats,
			value: value,
			playerId: playerId,
			hp: AUTOCHESS_CONFIG.BASE_HP,
			maxHp: AUTOCHESS_CONFIG.BASE_HP,
			currentArmor: stats.armor,
			speed: (6 + stats.distance) || { 1: 10, 2: 12, 3: 15, 4: 8, 5: 5, 6: 10 }[value] || 10,
			actionGauge: 0,
			isDeath: false,
			veteranLevel: 0, // Track round survivals for session-only bonuses
		};
		unit.spriteUrl = GAME.getUnitSpriteUrl(unit);

		// TODO: In the future, we could add Autochess-specific upgrades here
		// that apply to all players equally (e.g., from a shared tech tree or shop).

		return unit;
	},

	startCombat(GAME) {
		GAME.Autochess.state.phase = 'COMBAT';
		GAME.messageLog = [];

		// For single-player mode, ensure Player 0 profile is set
		if (GAME.players[0] && !GAME.players[0].isAI) {
			GAME.players[0].profileName = GAME.Autochess.state.selectedProfile;
		}

		GAME.Autochess.prepareCombat(GAME);
		GAME.Autochess.runSimulation(GAME);
	},

	prepareCombat(GAME) {
		GAME.hexes.forEach(h => {
			h.unit = null;
			h.unitId = null;
		});

		GAME.players.forEach((player, playerIdx) => {
			player.dice.forEach((u, i) => {
				u.id = `${playerIdx}_${i}`; // Ensure unique ID string for compatibility
				u.isDeath = false;
				u.hp = u.maxHp;
				u.actionGauge = 0;
				u.hexId = null;
				u.isDeployed = false;
				u.hasMovedOrAttackedThisTurn = false;
				u.actionsTakenThisTurn = 0;
			});
		});

		// Deploy units randomly in valid deployment hexes for all players
		const playerOrder = Array.from({length: GAME.playerCount}, (_, i) => i).sort(() => Math.random() - 0.5);
		playerOrder.forEach(playerIdx => {
			const player = GAME.players[playerIdx];
			player.dice.forEach((unit) => {
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

			GAME.Autochess.simulateStep(GAME);

			const alivePlayers = GAME.players.filter(p => p.dice.some(u => !u.isDeath));

			if (alivePlayers.length > 1) return;

			clearInterval(combatInterval);
			const winner = alivePlayers[0];

			GAME.players.forEach(p => {
				const isWinner = winner && p.id === winner.id;
				if (isWinner) {
					GAME.Autochess.state.rerolls[p.id] = AUTOCHESS_CONFIG.WIN_REROLLS;
					// Apply temporary session-only Veteran buffs to survivors
					p.dice.filter(u => !u.isDeath).forEach(u => {
						u.veteranLevel = (u.veteranLevel || 0) + 1;
						u.attack += AUTOCHESS_CONFIG.VETERAN_ATK_BONUS;
						u.maxHp += AUTOCHESS_CONFIG.VETERAN_HP_BONUS;
						u.hp = u.maxHp;
					});
				} else {
					GAME.Autochess.state.rerolls[p.id] = AUTOCHESS_CONFIG.LOSS_REROLLS;
				}
			});

			GAME.Autochess.state.lastResult = (winner && !winner.isAI) ? 'WIN' : 'LOSS';
			GAME.Autochess.state.phase = 'RECAP';
		}, 100);
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

	handleCombat(GAME, attackerUnit, defenderUnit, combatRoll, defenderEffectiveArmor) {
		const isSuccess = Math.ceil((attackerUnit.attack + combatRoll) / 2) > defenderEffectiveArmor;
		
		if (isSuccess) {
			const damage = 30 + attackerUnit.attack * 2;
			GAME.addLog(`${GAME.logUnit(attackerUnit)} dealt ${damage} damage to ${GAME.logUnit(defenderUnit)}!`);
			defenderUnit.hp -= damage;
		} else {
			const damage = 5 + attackerUnit.attack;
			GAME.addLog(`Attack deflected! Minor damage: ${damage}`);
			defenderUnit.hp -= damage;
		}

		if (defenderUnit.hp <= 0) {
			defenderUnit.isDeath = true;
			const hex = GAME.getHex(defenderUnit.hexId);
			if (hex) {
				hex.unit = null;
				hex.unitId = null;
			}
		}
	},

	nextRound(GAME) {
		GAME.Autochess.state.round++;
		if (GAME.Autochess.state.round > 6) {
			alert("Tournament Complete!");
			location.reload();
		} else {
			GAME.Autochess.generateRecruits(GAME);
			GAME.Autochess.state.phase = 'PREPARATION';
		}
	},
};
