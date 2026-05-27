/**
 * Autochess - Handles the state and logic for Autochess mode.
 */
const Autochess = {
	state: {
		enabled: new URLSearchParams(location.search).get('autochess') === 'true',
		round: 1,
		maxRound: AUTOCHESS_CONFIG.MAX_ROUND,
		inventories: {}, // playerId -> array of units
		rerolls: {},    // playerId -> number
		lastResult: null,
		phase: 'PREPARATION', // PREPARATION, COMBAT, RECAP
		selectedProfile: 'baseline',
		roundTimer: 0,
		selectedUnitId: null, // For merging
		ready: {}, // playerId -> boolean (for online multiplayer ready-up)
	},

	init(GAME) {
		GAME.showLog = true;
		GAME.gameplayVersion = 2;
		GAME.options = GAME.options || '';
		if (!GAME.options.includes('a')) GAME.options += 'a';
		GAME.autochess = true;

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
			if (h.unit) {
				h.unit = null;
				h.unitId = null;
			}
		});

		// Deploy first 6 units to valid base hexes
		const unitsToDeploy = player.dice.slice(0, 6);
		const validHexes = GAME.calcValidDeploymentHexes(playerIdx);
		
		unitsToDeploy.forEach((unit, i) => {
			unit.isDeath = false;
			unit.hp = unit.maxHP;
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
		GAME.players.forEach(p => {
			p.dice.forEach(d => {
				d.hp = d.maxHP;
				d.attack = d.maxAtk;
				d.currentArmor = d.armor;
			});
		});

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

	recruitUnit(GAME, playerIdx, index) {
		const player = GAME.players[playerIdx];
		if (!player) return;
		const pid = player.id;

		if (GAME.online?.roomId) {
			GAME.publishAction('AUTOCHESS_RECRUIT', { index });
			return;
		}
		const unit = GAME.Autochess.state.inventories[pid]?.splice(index, 1)?.[0];
		if (unit) {
			player.dice.push(unit);

			// Auto-deploy recruited unit to board if under 6 deployed
			const deployedCount = player.dice.filter(u => u.hexId).length;
			if (deployedCount < 6) {
				const validHexes = GAME.calcValidDeploymentHexes(playerIdx).filter(hexId => !GAME.getUnitOnHex(hexId));
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
	},

	rerollRecruits(GAME, playerIdx) {
		const player = GAME.players[playerIdx];
		if (!player) return;
		const pid = player.id;

		if (GAME.online?.roomId) {
			GAME.publishAction('AUTOCHESS_REROLL', {});
			return;
		}
		if (GAME.Autochess.state.rerolls[pid] > 0) {
			GAME.Autochess.state.rerolls[pid]--;
			GAME.Autochess.generateRecruits(GAME, pid);
		}
	},

	moveUnit(GAME, playerId, fromIndex, toIndex) {
		const player = GAME.players[playerId];
		if (fromIndex < 0 || fromIndex >= player.dice.length || toIndex < 0 || toIndex >= player.dice.length) return;

		const unit = player.dice.splice(fromIndex, 1)[0];
		player.dice.splice(toIndex, 0, unit);

		if (GAME.online?.roomId) {
			GAME.publishAction('AUTOCHESS_MOVE', { fromIndex, toIndex });
		}
	},

	clickUnit(GAME, unit) {
		if (!GAME?.Autochess?.state || !unit?.id) return console.log('Autochess.clickUnit.invalid');
		
		const playerIdx = GAME.autochessPlayerIndex ?? 0;
		const state = GAME.Autochess.state;
		if (state.selectedUnitId && state.selectedUnitId !== unit.id) {
			const u1 = GAME.players[playerIdx]?.dice.find(u => u.id === state.selectedUnitId);

			if (u1 && u1.value === unit.value)
				GAME.Autochess.mergeUnits(GAME, playerIdx, state.selectedUnitId, unit.id);
			else
				state.selectedUnitId = unit.id;
		} else {
			state.selectedUnitId = (state.selectedUnitId === unit.id ? null : unit.id);
		}
	},

	mergeUnits(GAME, playerId, unitId1, unitId2) {
		if (GAME.online?.roomId) {
			GAME.publishAction('AUTOCHESS_MERGE', { unitId1, unitId2 });
			return;
		}
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

		if (u1.veteranLevel >= 3) {
			GAME.addLog("Cannot merge: Maximum veteran level reached (★3).");
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

		if (!u1.perks) {
			u1.perks = { tier1: null, tier2: null, tier3: null };
		}

		u1.maxHP += AUTOCHESS_CONFIG.VETERAN_HP_BONUS;
		u1.maxAtk += Math.min(AUTOCHESS_CONFIG.VETERAN_ATK_BONUS, u1.maxAtk);

		u1.hp = u1.maxHP;
		u1.attack = u1.maxAtk;

		// Update display name with stars, keep internal 'class' unchanged for logic
		u1.displayName = `${u1.name} ${'★'.repeat(u1.veteranLevel)}`;

		// Remove u2
		player.dice.splice(u2Index, 1);

		GAME.Autochess.state.selectedUnitId = unitId1;
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
			maxHP: AUTOCHESS_CONFIG.BASE_HP,
			maxAtk: stats.attack,
			currentArmor: stats.armor,
			speed: (6 + stats.distance) || (10 - stats.distance) || Math.floor(20 / stats.distance) || { 1: 10, 2: 12, 3: 15, 4: 8, 5: 5, 6: 10 }[value] || 10,
			actionGauge: 0,
			isDeath: false,
			veteranLevel: 0,
			perks: { tier1: null, tier2: null, tier3: null },

			// Autochess-specific tracking
			ticksInCombat: 0,
			oncePerBattleUsed: false,
			lastWindriderTick: 0,
			consecutiveHits: 0,
			lastTargetId: null,
			entrenchStacks: 0,
			parryShield: 0,
			frozenTicks: 0,
			speedBuff: 0,
			speedBuffDuration: 0,
			sniperCount: 0,
		};
		unit.spriteUrl = GAME.getUnitSpriteUrl(unit);
		unit.iconUrl = '/assets/sprites/icons/' + value + '.png';
		unit.id = `unit_${Math.random().toString(36).substr(2, 9)}`;

		return unit;
	},

	selectUnitSkill(GAME, unitId, tier, option) {
		const playerIdx = GAME.autochessPlayerIndex ?? 0;
		const unit = GAME.players[playerIdx]?.dice.find(u => u.id === unitId);
		if (!unit) return;

		const tierLevel = { 'tier1': 1, 'tier2': 2, 'tier3': 3 }[tier];
		if (unit.veteranLevel < tierLevel) {
			GAME.addLog("Unit veteran level is too low for this skill.");
			return;
		}

		if (!unit.perks) {
			unit.perks = { tier1: null, tier2: null, tier3: null };
		}

		unit.perks[tier] = option;
		GAME.addLog(`${unit.displayName} learned ${Autochess.PERK_DESCRIPTIONS[unit.value][tier][option].name}!`);
	},

	startCombat(GAME) {
		window?.AudioManager?.playMusic('battle');
		if (GAME.online?.roomId) {
			GAME.publishAction('AUTOCHESS_START_COMBAT', {});
			return;
		}
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

	adjustAIVeterans(GAME) {
		const p0 = GAME.players[0];
		if (!p0) return;

		// Collect veteran levels from player 0's top 6 (deployed) units
		const p0Deployed = p0.dice.slice(0, 6);
		const veteranLevels = p0Deployed.map(u => u.veteranLevel || 0).filter(lvl => lvl > 0);

		GAME.players.forEach((player, playerIdx) => {
			if (playerIdx === 0) return; // Skip human player

			// Reset all AI units to base level 0 stats first
			player.dice.forEach(unit => {
				const baseStats = UNIT_STATS[unit.value];
				if (baseStats) {
					unit.attack = baseStats.attack;
					unit.maxHP = AUTOCHESS_CONFIG.BASE_HP;
					unit.veteranLevel = 0;
					unit.displayName = baseStats.name;
					unit.hp = unit.maxHP;
					unit.perks = { tier1: null, tier2: null, tier3: null };
				}
			});

			// If player 0 has no veterans, we are done
			if (veteranLevels.length === 0) return;

			// Assign veteran levels to a random subset of AI units
			const indices = player.dice.map((_, idx) => idx);
			for (let i = indices.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				const temp = indices[i];
				indices[i] = indices[j];
				indices[j] = temp;
			}

			// Apply the veteran levels to the selected random units
			const numToUpgrade = Math.min(veteranLevels.length, player.dice.length);
			for (let k = 0; k < numToUpgrade; k++) {
				const unitIdx = indices[k];
				const targetLevel = veteranLevels[k];
				const unit = player.dice[unitIdx];

				for (let lvl = 0; lvl < targetLevel; lvl++) {
					unit.veteranLevel++;
					unit.attack += Math.min(AUTOCHESS_CONFIG.VETERAN_ATK_BONUS, unit.attack);
					unit.maxHP += AUTOCHESS_CONFIG.VETERAN_HP_BONUS;
					
					const tier = `tier${lvl + 1}`;
					unit.perks[tier] = Math.random() < 0.5 ? 'A' : 'B';
				}
				unit.hp = unit.maxHP;
				unit.displayName = `${unit.name} ${'★'.repeat(unit.veteranLevel)}`;
			}
		});
	},

	prepareCombat(GAME) {
		// Clear AI units only (Player 0 units are already placed and can be moved manually)
		GAME.hexes.forEach(h => {
			if (h.unit && h.unit.playerId !== 0) {
				h.unit = null;
				h.unitId = null;
			}
		});

		// Dynamic veteran adjustment for AI players to match Player 0
		GAME.Autochess.adjustAIVeterans(GAME);

		GAME.players.forEach((player, playerIdx) => {
			// Reset ALL units' state first to prevent stale isDeployed/isDeath flags
			player.dice.forEach(u => {
				u.isDeath = false;
				u.hp = u.maxHP;
				u.actionGauge = 0;
				u.isDeployed = false;
				u.hexId = null;
				u.ticksInCombat = 0;
				u.hasMovedOrAttackedThisTurn = false;
				u.actionsTakenThisTurn = 0;
				u.oncePerBattleUsed = false;
				u.speedBuff = 0;
				u.speedBuffDuration = 0;
				u.frozenTicks = 0;
				u.parryShield = 0;
				u.consecutiveHits = 0;
				u.lastTargetId = null;
			});

			if (playerIdx === 0) {
				// For human player, identify which units were manually placed on board
				GAME.hexes.forEach(h => {
					if (h.unit && h.unit.playerId === 0) {
						h.unit.isDeployed = true;
						h.unit.hexId = h.id;
					}
				});
				return;
			}

			// AI deployment: Only deploy first 6 units
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

			const alivePlayers = GAME.players.filter(p => p.dice.some(u => u.hexId && u.isDeployed && !u.isDeath));

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
			GAME.Autochess.state.lastWinnerId = winner ? winner.id : null;
			GAME.Autochess.state.phase = 'RECAP';
		}, 100);
	},

	resolveTimeout(GAME) {
		const aliveUnits = GAME.players.map(p => p.dice.filter(u => u.hexId && u.isDeployed && !u.isDeath));
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
		GAME.Autochess.state.lastWinnerId = winner ? winner.id : null;
		GAME.Autochess.state.phase = 'RECAP';
	},

	simulateStep(GAME, state) {
		const targetPlayers = (state || GAME).players;
		const allUnits = targetPlayers.flatMap(p => p.dice)
			.filter(u => u.hexId && u.isDeployed && !u.isDeath)
			.sort((a, b) => (b.actionGauge - a.actionGauge) || (Math.random() - 0.5));

		allUnits.forEach(unit => {
			if (unit.isDeath || !unit.hexId) return;

			unit.ticksInCombat = (unit.ticksInCombat || 0) + 1;

			// --- Status Effect Ticks ---
			if (unit.frozenTicks > 0) {
				unit.frozenTicks--;
				return;
			}

			if (unit.speedBuffDuration > 0) {
				unit.speedBuffDuration--;
				if (unit.speedBuffDuration === 0) unit.speedBuff = 0;
			}

			// --- Poison/Venom Logic ---
			if (unit.venomDuration > 0) {
				const venomDamage = 10;
				unit.hp -= venomDamage;
				unit.venomDuration--;
				GAME.addLog(`🐍 ${GAME.logUnit(unit, state)} suffers ${venomDamage} poison damage (${unit.venomDuration} ticks left).`, (state || GAME).Autochess.state.phase === 'COMBAT', state);
				if (unit.hp <= 0) {
					GAME.Autochess.killUnit(GAME, unit, state);
					return;
				}
			}

			// --- Passive Auras (Every 10 ticks = 1s) ---
			if (unit.ticksInCombat % 10 === 0 && unit.hexId) {
				const hex = GAME.getHex(unit.hexId, state);

				// Oracle T1A Blessed Aura
				if (unit.value === 6 && GAME.hasPerk(unit, 'tier1', 'A')) {
					GAME.getNeighbors(hex, state).forEach(n => {
						const friend = GAME.getUnitOnHex(n.id, state);
						if (friend && friend.playerId === unit.playerId) {
							friend.hp = Math.min(friend.maxHP, friend.hp + 10);
						}
					});
				}
				// Oracle T1B Hex
				if (unit.value === 6 && GAME.hasPerk(unit, 'tier1', 'B')) {
					const enemies = targetPlayers.find(p => p.id !== unit.playerId).dice.filter(d => !d.isDeath && d.hexId);
					enemies.sort((a, b) => GAME.axialDistance(hex.q, hex.r, GAME.getHex(a.hexId, state).q, GAME.getHex(a.hexId, state).r) - GAME.axialDistance(hex.q, hex.r, GAME.getHex(b.hexId, state).q, GAME.getHex(b.hexId).r));
					enemies.slice(0, 2).forEach(e => {
						e.currentArmor = Math.max(0, (e.currentArmor || e.armor) - 10);
						GAME.addLog(`🔮 Hex! ${GAME.logUnit(e, state)} lost 10 DEF.`, true, state);
					});
				}
			}

			// Tanker T1B Magnetic (Every 15 ticks)
			if (unit.ticksInCombat % 15 === 0 && unit.hexId && unit.value === 5 && GAME.hasPerk(unit, 'tier1', 'B')) {
				const hex = GAME.getHex(unit.hexId, state);
				const enemies = targetPlayers.find(p => p.id !== unit.playerId).dice.filter(d => !d.isDeath && d.hexId);
				enemies.sort((a, b) => GAME.axialDistance(hex.q, hex.r, GAME.getHex(a.hexId, state).q, GAME.getHex(a.hexId, state).r) - GAME.axialDistance(hex.q, hex.r, GAME.getHex(b.hexId, state).q, GAME.getHex(b.hexId, state).r));
				const target = enemies[0];
				if (target && GAME.axialDistance(hex.q, hex.r, GAME.getHex(target.hexId, state).q, GAME.getHex(target.hexId, state).r) <= 3) {
					const neighbors = GAME.getNeighbors(hex, state).filter(n => !GAME.getUnitOnHex(n.id, state));
					if (neighbors.length > 0) {
						const targetHex = neighbors.random();
						GAME.move(target, GAME.getHex(target.hexId, state), targetHex, state);
						target.frozenTicks = 20;
						GAME.addLog(`🧲 Magnetic! ${GAME.logUnit(target, state)} pulled and stunned.`, true, state);
					}
				}
			}

			// --- Speed Calculation ---
			let currentSpeed = unit.speed + (unit.speedBuff || 0);

			// Behemoth T3A Speed bonus
			if (unit.value === 5 && GAME.hasPerk(unit, 'tier3', 'A') && unit.hp < (unit.maxHP / 2)) {
				currentSpeed *= 1.5;
			}

			// Knight T2B Vanguard (Enemy Speed debuff)
			const hex = unit.hexId ? GAME.getHex(unit.hexId, state) : null;
			if (hex) {
				GAME.getNeighbors(hex, state).forEach(n => {
					const enemy = GAME.getUnitOnHex(n.id, state);
					if (enemy && enemy.playerId !== unit.playerId && GAME.hasPerk(enemy, 'tier2', 'B')) {
						currentSpeed -= 5;
					}
				});

				// Templar T3A Speed Aura
				(state || GAME).hexes.forEach(h => {
					const templar = h.unit;
					if (templar && templar.playerId === unit.playerId && templar.value === 4 && GAME.hasPerk(templar, 'tier3', 'A')) {
						if (GAME.axialDistance(hex.q, hex.r, h.q, h.r) <= 2) {
							currentSpeed += templar.speed * 0.2;
						}
					}
				});
			}

			unit.actionGauge += Math.max(1, currentSpeed);
			if (unit.actionGauge >= 100) {
				// Fencer T1A Parry Shield Refresh
				if (unit.value === 1 && GAME.hasPerk(unit, 'tier1', 'A')) {
					unit.parryShield = 15;
				}
				// Tanker T2A Entrench
				if (unit.value === 5 && GAME.hasPerk(unit, 'tier2', 'A') && unit.actionsTakenThisTurn === 0) {
					unit.entrenchStacks = Math.min(3, (unit.entrenchStacks || 0) + 1);
					unit.currentArmor = (unit.currentArmor || unit.armor) + 20;
					GAME.addLog(`🛡️ Entrench! ${GAME.logUnit(unit, state)} gains DEF (Stack: ${unit.entrenchStacks})`, true, state);
				}

				GAME.Autochess.executeAction(GAME, unit, state);
				unit.actionGauge -= 100;
			}
		});
	},

	killUnit(GAME, unit, state) {
		unit.isDeath = true;
		GAME.addLog(`💀 ${GAME.logUnit(unit, state)} has been defeated!`, (state || GAME).Autochess.state.phase === 'COMBAT', state);

		// Oracle T3A High Priest (Rescue)
		if (!unit.oncePerBattleUsed) {
			const player = (state || GAME).players[unit.playerId];
			const oracle = player.dice.find(d => !d.isDeath && d.value === 6 && GAME.hasPerk(d, 'tier3', 'A'));
			if (oracle) {
				unit.isDeath = false;
				unit.hp = 1;
				unit.actionGauge = 100;
				unit.oncePerBattleUsed = true;
				GAME.addLog(`😇 Divine Intervention! ${GAME.logUnit(unit, state)} rescued by High Priest!`, true, state);
				return;
			}
		}

		const hexId = unit.hexId;
		const hex = GAME.getHex(hexId, state);
		if (hex) {
			hex.unit = null;
			hex.unitId = null;
		}
		unit.hexId = null;
		unit.isDeployed = false;

		// Tanker T3B Dreadnought (On Death)
		if (unit.value === 5 && GAME.hasPerk(unit, 'tier3', 'B')) {
			GAME.Autochess.triggerDreadnoughtDeath(GAME, unit, hexId, state);
		}
	},

	triggerDreadnoughtDeath(GAME, unit, hexId, state) {
		const hex = GAME.getHex(hexId, state);
		if (!hex) return;
		GAME.addLog(`💥 Reactor Meltdown! ${GAME.logUnit(unit, state)} explodes!`, true, state);
		const targetHexes = (state || GAME).hexes;
		targetHexes.forEach(h => {
			if (GAME.axialDistance(hex.q, hex.r, h.q, h.r) <= 3) {
				const target = h.unit;
				if (target) {
					target.hp -= 100;
					target.actionGauge = 0;
					if (target.hp <= 0) GAME.Autochess.killUnit(GAME, target, state);
				}
			}
		});
	},

	PERK_DESCRIPTIONS: {
		1: {
			tier1: { A: { name: "Parry", desc: "Negates 15 damage every Gauge reset." }, B: { name: "Lunge", desc: "+20 DMG if Gauge > Target Gauge." } },
			tier2: { A: { name: "Riposte", desc: "On hit: +20% Gauge & 50% ATK counter." }, B: { name: "Flurry", desc: "+2 Speed per consecutive hit (Max +10)." } },
			tier3: { A: { name: "Paladin", desc: "Attacks heal neighbors for 15% Max HP." }, B: { name: "Blademaster", desc: "Gauge +30% on attack, 100% on kill." } }
		},
		2: {
			tier1: { A: { name: "Eagle Eye", desc: "Range +1. No max range penalty." }, B: { name: "Point Blank", desc: "Attacks at Range 1-2 grant +10 Speed." } },
			tier2: { A: { name: "Piercing Arrow", desc: "40% DEF ignore, -10% Target Gauge." }, B: { name: "Slowing Shot", desc: "Reduce Target Speed by 5." } },
			tier3: { A: { name: "Sniper", desc: "3rd hit: +100% DMG & 50 tick freeze." }, B: { name: "Ranger", desc: "+20 Speed while moving." } }
		},
		3: {
			tier1: { A: { name: "Momentum", desc: "+1 ATK per 10% Gauge at start of action." }, B: { name: "Evasion", desc: "30% dodge if Gauge > 50%." } },
			tier2: { A: { name: "Hit & Run", desc: "Teleport after attack, +5 Speed." }, B: { name: "Trample", desc: "Passing enemies reduces their Gauge by 30%." } },
			tier3: { A: { name: "Dragoon", desc: "Landing jump: 30 DMG & 0 Gauge to neighbors." }, B: { name: "Windrider", desc: "Kill: 100% Gauge (5s Cooldown)." } }
		},
		4: {
			tier1: { A: { name: "Pincer Strike", desc: "+15 Speed if ally is adjacent to target." }, B: { name: "Joust", desc: "Push back. If blocked: -50% Target Gauge." } },
			tier2: { A: { name: "Bulwark", desc: "+30 DEF while charging Gauge." }, B: { name: "Vanguard", desc: "Adjacent enemies: -5 Speed, -10 ATK." } },
			tier3: { A: { name: "Templar", desc: "Allies Range 2: +20% Templar Speed." }, B: { name: "Dark Knight", desc: "50% Lifesteal, 10% Gauge Vampire." } }
		},
		5: {
			tier1: { A: { name: "Spiked Armor", desc: "Reflect 20 flat damage." }, B: { name: "Magnetic", desc: "Every 1.5s: Pull enemy Range 3 & Stun." } },
			tier2: { A: { name: "Entrench", desc: "Gauge 100 (Stayed Still): +20 DEF (Stack 3)." }, B: { name: "Heavy Ordinance", desc: "Range 2 AOE, but -5 Speed next action." } },
			tier3: { A: { name: "Behemoth", desc: "Max HP x2. If <50% HP: +50% Speed." }, B: { name: "Dreadnought", desc: "Death: 100 AOE DMG & 0 Gauge." } }
		},
		6: {
			tier1: { A: { name: "Blessed Aura", desc: "Every 1s: Heal allies Range 2 for 10." }, B: { name: "Hex", desc: "Every 1s: Nearest 2 enemies -10 DEF." } },
			tier2: { A: { name: "Haste Cast", desc: "Spells grant +10 Speed." }, B: { name: "Twin Cast", desc: "Spells hit 3 targets & +10% Gauge." } },
			tier3: { A: { name: "High Priest", desc: "1/Battle: Rescues ally with 1 HP & 100% Gauge." }, B: { name: "Warlock", desc: "1/Battle: Sac 40 HP for Global Gauge Warp." } }
		}
	},

	triggerOracleWarlock(GAME, unit, state) {
		unit.hp -= 40;
		unit.oncePerBattleUsed = true;
		GAME.addLog(`🧙 Warlock! Time Warp!`, true, state);
		const players = (state || GAME).players;
		players.forEach(p => {
			p.dice.forEach(d => {
				if (d.isDeath || !d.hexId) return;
				if (d.playerId === unit.playerId) d.actionGauge = 100;
				else d.actionGauge = 0;
			});
		});
	},

	executeAction(GAME, unit, state) {
		// Store original turn index to restore after action
		const originalPlayerIndex = GAME.currentPlayerIndex;

		// Oracle T3B Warlock
		if (unit.value === 6 && GAME.hasPerk(unit, 'tier3', 'B') && !unit.oncePerBattleUsed && unit.hp > 60) {
			const targetPlayers = (state || GAME).players;
			const enemies = targetPlayers.find(p => p.id !== unit.playerId).dice.filter(d => !d.isDeath && d.hexId);
			if (enemies.length > 2) {
				GAME.Autochess.triggerOracleWarlock(GAME, unit, state);
				unit.actionGauge = 0;
				return;
			}
		}

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
		const profileName = (state || GAME).players[unit.playerId].profileName || classProfiles[unit.value] || 'baseline';

		const evaluationState = state || GAME.cloneState();
		const move = evaluateBestMoveForUnit(GAME, evaluationState, unit, profileName);

		if (move && move.actionType !== 'END_TURN') {
			// If it's a spell, we need to set oracleSelectedSpell
			if (move.actionType.startsWith('SPELLCAST_')) {
				GAME.oracleSelectedSpell = move.actionType.replace('SPELLCAST_', '');

				// Oracle T2A Haste Cast
				if (GAME.hasPerk(unit, 'tier2', 'A')) {
					unit.speedBuff = 10;
					unit.speedBuffDuration = 20;
				}
				// Oracle T2B Twin Cast (Simplified)
				if (GAME.hasPerk(unit, 'tier2', 'B')) {
					unit.actionGauge = Math.min(100, unit.actionGauge + 10);
				}
			}
			applyMove(GAME, move, state);

			// Hussar T3A Dragoon Jump Effect
			if (unit.value === 3 && GAME.hasPerk(unit, 'tier3', 'A') && move.actionType === 'MOVE') {
				const hex = GAME.getHex(unit.hexId, state);
				GAME.getNeighbors(hex, state).forEach(n => {
					const enemy = GAME.getUnitOnHex(n.id, state);
					if (enemy && enemy.playerId !== unit.playerId) {
						enemy.hp -= 30;
						enemy.actionGauge = 0;
						GAME.addLog(`🐉 Dragoon Landing! ${GAME.logUnit(enemy, state)} crushed.`, true, state);
						if (enemy.hp <= 0) GAME.Autochess.killUnit(GAME, enemy, state);
					}
				});
			}
		}

		// Restore original turn index
		GAME.currentPlayerIndex = originalPlayerIndex;
	},

	handleCombat(GAME, attackerUnit, defenderUnit, combatRoll, defenderEffectiveArmor, state, combatType = 'MELEE', distance = 1) {
		let attackMod = 0;
		let damageMod = 0;

		// --- Attack Perks ---
		// Fencer Tier 1 [B] Lunge
		if (GAME.hasPerk(attackerUnit, 'tier1', 'B') && attackerUnit.actionGauge > defenderUnit.actionGauge) {
			damageMod += 20;
		}
		// Hussar Tier 1 [A] Momentum
		if (attackerUnit.value === 3 && GAME.hasPerk(attackerUnit, 'tier1', 'A')) {
			damageMod += Math.floor(attackerUnit.actionGauge / 10);
		}
		// Archer Tier 1 [A] Eagle Eye
		if (attackerUnit.value === 2 && GAME.hasPerk(attackerUnit, 'tier1', 'A')) {
			if (distance >= 3) attackMod += 10;
		}
		// Archer Tier 3 [A] Sniper
		if (attackerUnit.value === 2 && GAME.hasPerk(attackerUnit, 'tier3', 'A')) {
			attackerUnit.sniperCount = (attackerUnit.sniperCount || 0) + 1;
			if (attackerUnit.sniperCount % 3 === 0) {
				damageMod += (10 + 6 * attackerUnit.attack); // +100% Damage
				defenderUnit.frozenTicks = 50;
				GAME.addLog(`🎯 Sniper Shot! Critical damage and freeze!`, state);
			}
		}
		// Knight Tier 1 [A] Pincer Strike
		if (attackerUnit.value === 4 && GAME.hasPerk(attackerUnit, 'tier1', 'A')) {
			const neighbors = GAME.getNeighbors(GAME.getHex(defenderUnit.hexId, state), state);
			const allies = neighbors.filter(n => {
				const u = GAME.getUnitOnHex(n.id, state);
				return u && u.playerId === attackerUnit.playerId && u.id !== attackerUnit.id;
			});
			if (allies.length > 0) {
				attackerUnit.speedBuff = 15;
				attackerUnit.speedBuffDuration = 10;
			}
		}

		// Archer Tier 2 [A] Piercing Arrow
		if (attackerUnit.value === 2 && GAME.hasPerk(attackerUnit, 'tier2', 'A')) {
			defenderEffectiveArmor = Math.floor(defenderEffectiveArmor * 0.6); // 40% ignore
			defenderUnit.actionGauge = Math.max(0, defenderUnit.actionGauge - 10);
		}

		// --- Defensive Calculations ---
		// Knight T2A Bulwark
		if (defenderUnit.value === 4 && GAME.hasPerk(defenderUnit, 'tier2', 'A')) {
			defenderEffectiveArmor += 30;
		}

		const isSuccess = Math.ceil((attackerUnit.attack + combatRoll + attackMod) / 2) > defenderEffectiveArmor;
		
		let damage = 10 + 6 * attackerUnit.attack + damageMod;
		if (!isSuccess) {
			damage = damage >> 1;
		}

		// --- Defensive Perks ---
		// Fencer Tier 1 [A] Parry
		if (defenderUnit.value === 1 && GAME.hasPerk(defenderUnit, 'tier1', 'A') && (defenderUnit.parryShield || 0) > 0) {
			const reduction = Math.min(damage, defenderUnit.parryShield);
			damage -= reduction;
			defenderUnit.parryShield -= reduction;
			GAME.addLog(`🛡️ Parry! ${reduction} damage negated.`, state);
		}
		// Hussar Tier 1 [B] Evasion
		if (defenderUnit.value === 3 && GAME.hasPerk(defenderUnit, 'tier1', 'B') && defenderUnit.actionGauge > 50) {
			if (Math.random() < 0.3) {
				damage = 0;
				GAME.addLog(`💨 Evaded!`, state);
			}
		}
		// Tanker Tier 1 [A] Spiked Armor
		if (defenderUnit.value === 5 && GAME.hasPerk(defenderUnit, 'tier1', 'A')) {
			const reflect = 20;
			attackerUnit.hp -= reflect;
			GAME.addLog(`💥 Spiked Armor! ${GAME.logUnit(attackerUnit, state)} takes ${reflect} reflect damage.`, state);
		}

		if (damage > 0) {
			if (isSuccess) {
				GAME.addLog(`⚔️ ${GAME.logUnit(attackerUnit, state)} dealt ${damage} damage to ${GAME.logUnit(defenderUnit, state)}!`, state);
			} else {
				GAME.addLog(`🍌 ${GAME.logUnit(attackerUnit, state)}'s attack deflected, minor ${damage} damage to ${GAME.logUnit(defenderUnit, state)}!`, state);
			}
		}

		if (!state) {
			if (combatType === 'RANGED_ATTACK') window?.AudioManager?.playSfx('bow');
			else if (isSuccess) window?.AudioManager?.playSfx('sword');
			else window?.AudioManager?.playSfx('deflect');
		}

		defenderUnit.hp -= damage;

		// --- Post-Damage Perks ---
		// Archer Tier 2 [B] Slowing Shot
		if (attackerUnit.value === 2 && GAME.hasPerk(attackerUnit, 'tier2', 'B')) {
			defenderUnit.speedBuff = -5;
			defenderUnit.speedBuffDuration = 20;
		}
		// Knight Tier 3 [B] Dark Knight (Lifesteal + Vampire)
		if (attackerUnit.value === 4 && GAME.hasPerk(attackerUnit, 'tier3', 'B')) {
			const heal = Math.floor(damage * 0.5);
			attackerUnit.hp = Math.min(attackerUnit.maxHP, attackerUnit.hp + heal);
			const vamp = Math.floor(defenderUnit.actionGauge * 0.1);
			defenderUnit.actionGauge -= vamp;
			attackerUnit.actionGauge = Math.min(100, attackerUnit.actionGauge + vamp);
		}
		// Fencer Tier 2 [A] Riposte (On Hit)
		if (defenderUnit.value === 1 && GAME.hasPerk(defenderUnit, 'tier2', 'A')) {
			defenderUnit.actionGauge = Math.min(100, defenderUnit.actionGauge + 20);
			const counterDamage = Math.floor(defenderUnit.attack * 0.5);
			attackerUnit.hp -= counterDamage;
			GAME.addLog(`↩️ Riposte! Countered for ${counterDamage} damage.`, state);
		}
		// Fencer Tier 2 [B] Flurry
		if (attackerUnit.value === 1 && GAME.hasPerk(attackerUnit, 'tier2', 'B')) {
			if (attackerUnit.lastTargetId === defenderUnit.id) {
				attackerUnit.consecutiveHits = Math.min(5, (attackerUnit.consecutiveHits || 0) + 1);
				attackerUnit.speedBuff = attackerUnit.consecutiveHits * 2;
				attackerUnit.speedBuffDuration = 20;
			} else {
				attackerUnit.consecutiveHits = 1;
				attackerUnit.lastTargetId = defenderUnit.id;
			}
		}
		// Fencer Tier 3 [A] Paladin (Heal on hit)
		if (attackerUnit.value === 1 && GAME.hasPerk(attackerUnit, 'tier3', 'A')) {
			const hex = GAME.getHex(attackerUnit.hexId, state);
			if (hex) {
				GAME.getNeighbors(hex, state).forEach(n => {
					const friend = GAME.getUnitOnHex(n.id, state);
					if (friend && friend.playerId === attackerUnit.playerId) {
						const heal = Math.floor(friend.maxHP * 0.15);
						friend.hp = Math.min(friend.maxHP, friend.hp + heal);
					}
				});
			}
		}

		if (defenderUnit.hp <= 0) {
			GAME.Autochess.killUnit(GAME, defenderUnit, state);

			// Hussar Tier 3 [B] Windrider
			if (attackerUnit.value === 3 && GAME.hasPerk(attackerUnit, 'tier3', 'B')) {
				if (attackerUnit.ticksInCombat - (attackerUnit.lastWindriderTick || 0) > 50) {
					attackerUnit.actionGauge = 100;
					attackerUnit.lastWindriderTick = attackerUnit.ticksInCombat;
					GAME.addLog(`🌪️ Windrider!`, state);
				}
			}
			// Fencer Tier 3 [B] Blademaster (Kill)
			if (attackerUnit.value === 1 && GAME.hasPerk(attackerUnit, 'tier3', 'B')) {
				attackerUnit.actionGauge = 100;
			}
		} else {
			// Knight Tier 1 [B] Joust
			if (attackerUnit.value === 4 && GAME.hasPerk(attackerUnit, 'tier1', 'B')) {
				const attackerHex = GAME.getHex(attackerUnit.hexId, state);
				const defenderHex = GAME.getHex(defenderUnit.hexId, state);
				const dq = defenderHex.q - attackerHex.q;
				const dr = defenderHex.r - attackerHex.r;
				const backQ = defenderHex.q + dq;
				const backR = defenderHex.r + dr;
				const backHex = GAME.getHexByQR(backQ, backR, state);
				const blocker = backHex ? GAME.getUnitOnHex(backHex.id, state) : null;

				if (!backHex || blocker || backHex.terrainType === 'LAKE' || backHex.terrainType === 'MOUNTAIN') {
					defenderUnit.actionGauge = Math.max(0, defenderUnit.actionGauge - 50);
					GAME.addLog(`🛡️ Joust blocked! ${GAME.logUnit(defenderUnit, state)} Gauge reduced.`, state);
				} else {
					GAME.move(defenderUnit, defenderHex, backHex, state);
					GAME.addLog(`🛡️ Joust! ${GAME.logUnit(defenderUnit, state)} pushed back.`, state);
				}
			}
		}

		// Blademaster Tier 3 [B] (Attack)
		if (attackerUnit.value === 1 && GAME.hasPerk(attackerUnit, 'tier3', 'B') && !defenderUnit.isDeath) {
			attackerUnit.actionGauge = Math.min(100, attackerUnit.actionGauge + 30);
		}

		if (attackerUnit.hp <= 0) {
			GAME.Autochess.killUnit(GAME, attackerUnit, state);
		}
	},

	nextRound(GAME) {
		window?.AudioManager?.playMusic('queue');
		if (GAME.online?.roomId) {
			GAME.publishAction('AUTOCHESS_NEXT_ROUND', {});
			return;
		}
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
			GAME.Autochess.state.ready = {}; // Reset ready for next round
		}
	},

	toggleReady(GAME) {
		if (GAME.online?.roomId) {
			GAME.publishAction('AUTOCHESS_READY', {});
			return;
		}
		// Single-player: start combat immediately
		GAME.Autochess.startCombat(GAME);
	},

	placeUnit(GAME, playerIdx, unitId, toHexId, fromHexId) {
		const player = GAME.players[playerIdx];
		if (!player) return;

		if (GAME.online?.roomId) {
			GAME.publishAction('AUTOCHESS_PLACE', { unitId, toHexId, fromHexId });
			return;
		}
		// Single-player: already handled by local hex click logic
	},

};
