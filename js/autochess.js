/**
 * Autochess - Handles the state and logic for Autochess mode.
 */
const Autochess = {
	state: {
		enabled: new URLSearchParams(location.search).get('autochess') === 'true',
		round: 1,
		inventory: [],
		rerolls: 1,
		lastResult: null,
		phase: 'PREPARATION', // PREPARATION, COMBAT, RECAP
		selectedProfile: 'baseline',
	},

	init(GAME) {
		GAME.showLog = true;
		GAME.gameplayVersion = 2;
		GAME.options = GAME.options || '';
		if (!GAME.options.includes('a')) GAME.options += 'a';

		this.state.round = 1;
		this.state.rerolls = 1;

		GAME.generateHexGrid(GAME.getRadius());
		this.generateInitialArmy(GAME);
	},

	generateInitialArmy(GAME) {
		const p1 = GAME.players[0];
		p1.dice = [];
		for (let i = 0; i < 6; i++) {
			const value = Math.floor(Math.random() * 6) + 1;
			const unit = this.createUnit(GAME, value, 0);
			p1.dice.push(unit);
		}
	},

	generateRecruits(GAME) {
		this.state.inventory = [];
		const value = Math.floor(Math.random() * 6) + 1;
		this.state.inventory.push(this.createUnit(GAME, value, 0));
	},

	recruitUnit(GAME, index) {
		const unit = this.state.inventory.splice(index, 1)[0];
		GAME.players[0].dice.push(unit);
	},

	rerollRecruits(GAME) {
		if (this.state.rerolls > 0) {
			this.state.rerolls--;
			this.generateRecruits(GAME);
		}
	},

	createUnit(GAME, value, playerId) {
		const stats = UNIT_STATS[value];
		const unit = {
			...stats,
			value: value,
			playerId: playerId,
			hp: 100,
			maxHp: 100,
			currentArmor: stats.armor,
			speed: (6 + stats.distance) || { 1: 10, 2: 12, 3: 15, 4: 8, 5: 5, 6: 10 }[value] || 10,
			actionGauge: 0,
			isDeath: false
		};
		unit.spriteUrl = GAME.getUnitSpriteUrl(unit);

		if (playerId === 0 && GAME.CampaignManager.state.upgrades[value]) {
			const upgrades = GAME.CampaignManager.state.upgrades[value];
			unit.attack += upgrades.atk;
			unit.armor += upgrades.def;
			unit.currentArmor += upgrades.def;
			unit.maxHp += upgrades.hp * 10;
			unit.hp = unit.maxHp;
		}

		return unit;
	},

	startCombat(GAME) {
		this.state.phase = 'COMBAT';
		GAME.messageLog = [];
		// Apply selected profile to player
		GAME.players[0].profileName = this.state.selectedProfile;
		this.prepareCombat(GAME);
		this.runSimulation(GAME);
	},

	prepareCombat(GAME) {
		GAME.hexes.forEach(h => {
			h.unit = null;
			h.unitId = null;
		});

		// Player 2 and above are AI enemies
		for (let pIdx = 1; pIdx < GAME.playerCount; pIdx++) {
			const p = GAME.players[pIdx];
			p.dice = [];
			GAME.setPlayerAI(p, true);
			const enemyUnitCount = GAME.players[0].dice.length;
			for (let i = 0; i < enemyUnitCount; i++) {
				p.dice.push(this.createUnit(GAME, Math.floor(Math.random() * 6) + 1, pIdx));
			}
		}

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
			if (this.state.phase !== 'COMBAT') {
				clearInterval(combatInterval);
				return;
			}

			this.simulateStep(GAME);

			const alivePlayers = GAME.players.filter(p => p.dice.some(u => !u.isDeath));

			if (alivePlayers.length <= 1) {
				clearInterval(combatInterval);
				const winner = alivePlayers[0];
				this.state.lastResult = (winner && winner.id === 0) ? 'WIN' : 'LOSS';
				if (this.state.lastResult === 'WIN') {
					this.state.rerolls++;
					GAME.players[0].dice.filter(u => !u.isDeath).forEach(u => {
						u.attack += 1;
						u.maxHp += 5;
						if (GAME.CampaignManager.state.upgrades[u.value]) {
							GAME.CampaignManager.state.upgrades[u.value].atk += 1;
							GAME.CampaignManager.state.upgrades[u.value].hp += 1;
						}
					});
					GAME.CampaignManager.save();
				}
				this.state.phase = 'RECAP';
			}
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
				this.executeAction(GAME, unit);
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

	nextRound(GAME) {
		this.state.round++;
		if (this.state.round > 6) {
			alert("Tournament Complete!");
			location.reload();
		} else {
			this.generateRecruits(GAME);
			this.state.phase = 'PREPARATION';
		}
	},
};
