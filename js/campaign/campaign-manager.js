/**
 * CampaignManager - Handles the state and logic for "Journey of the Six" campaign mode.
 * Persistent fatigue and rune systems.
 */
const CampaignManager = {
		state: {
		activeSlot: 1,
		slots: {
			1: { name: 'Campaign 1', data: null },
			2: null,
			3: null
		},
		unitUsage: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
		recoveryLevels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
		devotionPoints: 0,
		upgrades: {
			1: { atk: 0, def: 0, hp: 0, points: 0, perks: { tier1: null, tier2: null, tier3: null } },
			2: { atk: 0, def: 0, hp: 0, points: 0, perks: { tier1: null, tier2: null, tier3: null } },
			3: { atk: 0, def: 0, hp: 0, points: 0, perks: { tier1: null, tier2: null, tier3: null } },
			4: { atk: 0, def: 0, hp: 0, points: 0, perks: { tier1: null, tier2: null, tier3: null } },
			5: { atk: 0, def: 0, hp: 0, points: 0, perks: { tier1: null, tier2: null, tier3: null } },
			6: { atk: 0, def: 0, hp: 0, points: 0, perks: { tier1: null, tier2: null, tier3: null } },
		},
		currentLevel: 1,
		isCampaignActive: new URLSearchParams(location.search).get('campaign') === 'true',
		storyState: {
			currentArc: 1,
			completedQuests: {},
			bossesDefeated: [],
			seenIntros: {}
		}
	},

	STORAGE_KEY: 'hexdice_campaign_state',

	/**
	 * Select an active save slot and load its data.
	 */
	selectSlot(slotId) {
		this.state.activeSlot = slotId;
		const slot = this.state.slots[slotId];
		if (slot && slot.data) {
			Object.assign(this.state, slot.data);
		} else {
			// Initialize new slot if empty
			this.resetCampaign();
		}
		this.save();
	},

	/**
	 * Rename a campaign save slot.
	 */
	renameSlot(slotId, newName) {
		if (this.state.slots[slotId]) {
			this.state.slots[slotId].name = newName;
			this.save();
		}
	},

	/**
	 * Delete a campaign save slot.
	 */
	deleteSlot(slotId) {
		this.state.slots[slotId] = null;
		this.save();
	},


	PERK_DESCRIPTIONS: {
		1: {
			tier1: {
				A: { name: "Parry", desc: "Negates the first 15 damage taken each round." },
				B: { name: "Lunge", desc: "Deals +15 damage if attacking an enemy currently at full HP." }
			},
			tier2: {
				A: { name: "Riposte", desc: "After surviving a melee hit, instantly deals 50% of its ATK back to the attacker." },
				B: { name: "Flurry", desc: "Minimum chip damage increased from 10 to 25." }
			},
			tier3: {
				A: { name: "Paladin", desc: "Heals all adjacent friendly units for 20 HP whenever it deals damage." },
				B: { name: "Blademaster", desc: "Max move +1. Can move 1 step after attacking." }
			}
		},
		2: {
			tier1: {
				A: { name: "High Ground", desc: "Ignores the extra-range attack penalty." },
				B: { name: "Point Blank", desc: "Can shoot even if an enemy is adjacent." }
			},
			tier2: {
				A: { name: "Piercing Arrow", desc: "Ranged attacks ignore 30% of target DEF." },
				B: { name: "Venom Tipped", desc: "Targets hit lose 10 HP at the start of their next 2 turns." }
			},
			tier3: {
				A: { name: "Sniper", desc: "Base Range +1. If it doesn't move before attacking, deals +30 damage." },
				B: { name: "Ranger", desc: "Run & Gun: Can move 1 step, shoot, and move 1 step again." } // TODO: implement — requires split-move action sequence not yet supported by the engine
			}
		},
		3: {
			tier1: {
				A: { name: "Momentum", desc: "Gains +20 ATK if it moves its maximum (3 steps) before attacking." },
				B: { name: "Evasion", desc: "Takes 50% less damage from Ranged attacks." }
			},
			tier2: {
				A: { name: "Hit & Run", desc: "After a kill, may immediately jump 1 step in any direction." },
				B: { name: "Trample", desc: "Moving through an enemy deals 15 flat damage to them." }
			},
			tier3: {
				A: { name: "Dragoon", desc: "Impact Landing: All adjacent enemies take 20 damage when landing a jump." },
				B: { name: "Windrider", desc: "Refunds action once per turn after a kill." }
			}
		},
		4: {
			tier1: {
				A: { name: "Pincer Strike", desc: "+20 Damage if a friendly unit is on the opposite hex of target." },
				B: { name: "Joust", desc: "Pushes enemy 1 hex back. Deals +15 damage if push is blocked." }
			},
			tier2: {
				A: { name: "Bulwark", desc: "Gains +20 DEF for the round after moving 2+ steps." },
				B: { name: "Vanguard", desc: "Adjacent enemies have -10 ATK against other targets." }
			},
			tier3: {
				A: { name: "Templar", desc: "Aura: Allies in the Knight's 6-diagonal path gain +15 DEF." },
				B: { name: "Dark Knight", desc: "Lifesteal: Heals for 50% of damage dealt." }
			}
		},
		5: {
			tier1: {
				A: { name: "Spiked Armor", desc: "Reflected damage penalty deals an extra 15 flat damage." },
				B: { name: "Magnetic", desc: "Action: Pull an enemy within Range 2 into an adjacent hex." }
			},
			tier2: {
				A: { name: "Entrench", desc: "Heals 20 HP and gains +15 DEF if it Guards without moving." },
				B: { name: "Heavy Ordinance", desc: "Gains Range 2 attack, but costs the Tanker 10 HP to use." }
			},
			tier3: {
				A: { name: "Behemoth", desc: "Blocks Line of Sight. Immune to crits. Max HP is doubled." },
				B: { name: "Dreadnought", desc: "Overload: Self-destruct for remaining HP as area damage." }
			}
		},
		6: {
			tier1: {
				A: { name: "Blessed Aura", desc: "Heals adjacent allies for 10 HP at the start of its turn." },
				B: { name: "Hex", desc: "Adjacent enemies permanently lose 10 DEF at start of turn." }
			},
			tier2: {
				A: { name: "Swift Cast", desc: "Can cast spells even when engaged in melee." },
				B: { name: "Twin Cast", desc: "Shield and Skirmish affect target and one nearby ally." }
			},
			tier3: {
				A: { name: "High Priest", desc: "Resurrection: Revive a destroyed unit with 50% HP once per game." },
				B: { name: "Warlock", desc: "Transmute (Sacrifice) costs 80 HP and doesn't kill Oracle. Target melts in 3 turns." }
			}
		}
	},

	/**
	 * Initialize the campaign state by loading from localStorage.
	 */
	async init() {
		const savedState = localStorage.getItem(this.STORAGE_KEY);
		if (savedState) {
			try {
				const parsed = JSON.parse(savedState);
				Object.assign(this.state, parsed);

				// Ensure upgrades exist for backward compatibility
				if (!this.state.upgrades) {
					this.state.upgrades = {
						1: { atk: 0, def: 0, hp: 0, points: 0, perks: { tier1: null, tier2: null, tier3: null } },
						2: { atk: 0, def: 0, hp: 0, points: 0, perks: { tier1: null, tier2: null, tier3: null } },
						3: { atk: 0, def: 0, hp: 0, points: 0, perks: { tier1: null, tier2: null, tier3: null } },
						4: { atk: 0, def: 0, hp: 0, points: 0, perks: { tier1: null, tier2: null, tier3: null } },
						5: { atk: 0, def: 0, hp: 0, points: 0, perks: { tier1: null, tier2: null, tier3: null } },
						6: { atk: 0, def: 0, hp: 0, points: 0, perks: { tier1: null, tier2: null, tier3: null } },
					};
				}
				if (this.state.devotionPoints === undefined) this.state.devotionPoints = 0;

				// Ensure runes exist
				if (!this.state.runes) {
					this.state.runes = { aegis: 2, pegasus: 1, forge: 1 };
				}

			// Ensure recoveryLevels exists for backward compatibility
			if (!this.state.recoveryLevels) {
				this.state.recoveryLevels = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
			}

			// Ensure storyState exists for backward compatibility
			if (!this.state.storyState) {
				this.state.storyState = { currentArc: 1, completedQuests: {}, bossesDefeated: [], seenIntros: {} };
			}
			} catch (e) {
				console.error("Failed to parse campaign state:", e);
			}
		}

		// Ensure isCampaignActive is correctly synced with URL
		this.state.isCampaignActive = new URLSearchParams(location.search).get('campaign') === 'true';

		if (this.state.isCampaignActive) {
			console.log("Campaign Mode Active:", this.state);
		}

		// Sync with server if logged in
		await this.syncWithServer();

		// Load story engine data
		await StoryEngine.init();
	},

	/**
	 * Sync campaign state with server if user is authenticated.
	 */
	async syncWithServer(mode = 'PULL') {
		const app = Alpine.$data(document.querySelector('body'));
		if (!app || !app.auth || !app.auth.token) return;

		try {
			if (mode === 'PUSH') {
				await fetch('/api/user/data', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${app.auth.token}`
					},
					body: JSON.stringify({
						key: 'campaign_state',
						value: this.state
					})
				});
			} else {
				const res = await fetch(`/api/user/data?key=campaign_state`, {
					headers: {
						'Authorization': `Bearer ${app.auth.token}`
					}
				});
				const data = await res.json();
				if (data.value) {
					// Only apply server state if it's further ahead than local progress
					const serverLevel = data.value.currentLevel || 1;
					const localLevel = this.state.currentLevel || 1;
					if (serverLevel >= localLevel) {
						Object.assign(this.state, data.value);
						localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
					}
				}
			}
		} catch (e) {
			console.error("Failed to sync campaign with server:", e);
		}
	},

	/**
	 * Save the current campaign state to localStorage.
	 */
	save() {
		// Update current slot with active state
		if (this.state.activeSlot) {
			const slotData = { ...this.state };
			delete slotData.slots; // Prevent nested storage
			this.state.slots[this.state.activeSlot] = {
				name: this.state.slots[this.state.activeSlot]?.name || `Campaign ${this.state.activeSlot}`,
				data: slotData
			};
		}
		localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
		
		// Async push to server
		this.syncWithServer('PUSH');
	},

	/**
	 * Check if a unit is currently available (not locked out due to elimination).
	 * @param {number} unitValue - The face value of the die (1-6).
	 * @returns {boolean} True if the unit is available.
	 */
	isUnitAvailable(unitValue) {
		if (!this.state.isCampaignActive) return true;
		const recoveryLevel = this.state.recoveryLevels[unitValue] || 0;
		return this.state.currentLevel >= recoveryLevel;
	},

	/**
	 * Determine the fatigue status of a unit class.
	 * @param {number} unitValue - The face value of the die (1-6).
	 * @returns {string} 'FRESH', 'FATIGUED', or 'SCARRED'.
	 */
	getUnitStatus(unitValue) {
		const usage = this.state.unitUsage[unitValue] || 0;
		if (usage >= 3) return 'SCARRED';
		if (usage === 2) return 'FATIGUED';
		return 'FRESH';
	},

	/**
	 * Apply fatigue-related debuffs to a unit object.
	 * @param {object} unit - The unit object to modify.
	 */
	applyFatigueDebuffs(unit) {
		if (!this.state.isCampaignActive || unit.playerId !== 0) return;

		const status = this.getUnitStatus(unit.value);
		unit.fatigueStatus = status;

		if (status === 'SCARRED') {
			// Scarred units have -1 Effective Armor
			// Note: This is a permanent reduction for this battle.
			// We'll hook this into calcDefenderEffectiveArmor to be safe.
			unit.isScarred = true;
			console.log(`Unit ${unit.value} is SCARRED: -1 Armor and No Abilities.`);
		}
	},

	/**
	 * Check if a unit's class ability is disabled due to fatigue.
	 * @param {object} unit - The unit object.
	 * @returns {boolean} True if the ability is disabled.
	 */
	isAbilityDisabled(unit) {
		if (!this.state.isCampaignActive || unit.playerId !== 0) return false;
		return this.getUnitStatus(unit.value) === 'SCARRED';
	},

	/**
	 * Update usage tracking after a battle finishes.
	 * @param {Array<number>} deployedUnitValues - The face values of units that were deployed and survived.
	 * @param {Array<number>} eliminatedUnitValues - The face values of units that were eliminated.
	 */
	updateAfterBattle(deployedUnitValues, eliminatedUnitValues = []) {
		if (!this.state.isCampaignActive) return;

		// 1. Increment usage for deployed units
		// 2. Reset usage for non-deployed units (Resting)
		for (let val = 1; val <= 6; val++) {
			if (deployedUnitValues.includes(val)) {
				this.state.unitUsage[val] = (this.state.unitUsage[val] || 0) + 1;
			} else {
				this.state.unitUsage[val] = 0; // Resting resets usage
			}
		}

		// 3. Handle eliminated units (locked out for 1 level)
		eliminatedUnitValues.forEach(val => {
			// Unit recovers in 2 levels (skips the next level)
			this.state.recoveryLevels[val] = this.state.currentLevel + 2;
			this.state.unitUsage[val] = 0; // Reset usage when eliminated
		});

		this.save();
	},

	/**
	 * Advance the campaign level and grant rewards.
	 */
	advanceLevel() {
		this.state.currentLevel++;
		this.state.devotionPoints++; // Grant 1 point per level
		this.save();
	},

	/**
	 * Use a rune from the inventory.
	 */
	consumeRune(runeType) {
		if (this.state.runes && this.state.runes[runeType] > 0) {
			this.state.runes[runeType]--;
			this.save();
			return true;
		}
		return false;
	},

	/**
	 * Grant rewards (runes) to the player's inventory.
	 */
	grantRewards(rewards) {
		if (!rewards) return;
		if (!this.state.runes) this.state.runes = { aegis: 0, pegasus: 0, forge: 0 };
		for (const [type, count] of Object.entries(rewards)) {
			this.state.runes[type] = (this.state.runes[type] || 0) + count;
		}
		this.save();
	},

	/**
	 * Perform campaign-specific combat calculations.
	 */
	performCampaignCombat(attacker, defender, distance, combatType, gameInstance, state) {
		let attackMod = 0;
		if (!!attacker.skirmishBuff) attackMod -= 10;

		// Archer Tier 1 [A] High Ground
		if (attacker.value === 2 && distance === 3 && !gameInstance.hasPerk(attacker, 'tier1', 'A')) attackMod -= 10;

		// Hussar Tier 1 [A] Momentum
		if (attacker.value === 3 && gameInstance.hasPerk(attacker, 'tier1', 'A') && distance === 3) attackMod += 20;

		// Knight Tier 1 [A] Pincer Strike
		if (attacker.value === 4 && gameInstance.hasPerk(attacker, 'tier1', 'A')) {
			const defenderHex = gameInstance.getHex(defender.hexId, state);
			const attackerHex = gameInstance.getHex(attacker.hexId, state);
			const oppQ = defenderHex.q + (defenderHex.q - attackerHex.q);
			const oppR = defenderHex.r + (defenderHex.r - attackerHex.r);
			const oppHex = gameInstance.getHexByQR(oppQ, oppR, state);
			const friend = oppHex ? gameInstance.getUnitOnHex(oppHex.id, state) : null;
			if (friend && friend.playerId === attacker.playerId) {
				attackMod += 20;
				gameInstance.addLog(`⚔️ Pincer Strike! +20 damage.`);
			}
		}

		// Fencer Tier 1 [B] Lunge
		if (gameInstance.hasPerk(attacker, 'tier1', 'B') && defender.currentHP >= defender.maxHP) {
			attackMod += 15;
		}

		// Archer Tier 3 [A] Sniper (Stay still bonus)
		if (attacker.value === 2 && gameInstance.hasPerk(attacker, 'tier3', 'A') && attacker.actionsTakenThisTurn === 0) {
			attackMod += 30;
		}

		// Apply dynamic upgrades from CampaignManager state (to ensure accuracy)
		const upgrades = this.state.upgrades[attacker.value] || { atk: 0 };
		const attackerAtk = attacker.attack + attackMod; // Note: attacker.attack already includes base + upgrade from deployment, but let's be sure.
		
		// Let's re-verify: attacker.attack is calculated at deployment.
		// If the user buys an upgrade during camp, the current game session needs the updated stats.
		// Wait, the current game session reloads units only when a new game or level starts.
		
		// Knight Tier 2 [B] Vanguard: attacker gets -10 ATK if adjacent to an enemy Knight with this perk (and target is not that Knight)
		const attackerHex = gameInstance.getHex(attacker.hexId, state);
		if (attackerHex) {
			const vanguardDebuff = AXES.some(({q: dq, r: dr}) => {
				const adjHex = gameInstance.getHexByQR(attackerHex.q + dq, attackerHex.r + dr, state);
				if (!adjHex) return false;
				const adjUnit = gameInstance.getUnitOnHex(adjHex.id, state);
				return adjUnit && adjUnit.value === 4 && adjUnit.playerId !== attacker.playerId
					&& adjUnit.hexId !== defender.hexId && gameInstance.hasPerk(adjUnit, 'tier2', 'B');
			});
			if (vanguardDebuff) {
				attackMod -= 10;
				gameInstance.addLog(`🛡 Vanguard! ${gameInstance.logUnit(attacker)} -10 ATK.`);
			}
		}

		let defenderDef = gameInstance.calcDefenderEffectiveArmor(defender.hexId, state);

		// Archer Tier 2 [A] Piercing Arrow
		if (attacker.value === 2 && gameInstance.hasPerk(attacker, 'tier2', 'A')) {
			defenderDef = Math.floor(defenderDef * 0.7);
		}

		let damage = 40 + (attackerAtk - defenderDef);

		// Fencer Tier 2 [B] Flurry
		const minDamage = (attacker.value === 1 && gameInstance.hasPerk(attacker, 'tier2', 'B')) ? 25 : 10;
		damage = Math.max(minDamage, damage);

		gameInstance.addLog(`⚔️ ${gameInstance.logUnit(attacker)} deals ${damage} damage to ${gameInstance.logUnit(defender)}!`);
		gameInstance.applyDamage(defender.hexId, damage, state);
		return damage;
	},

	/**
	 * Main entry point for campaign combat from game.js.
	 * Handles damage, perks, and post-combat movement.
	 * @returns {boolean} True if the game loop should return early (e.g. waiting for skirmish input).
	 */
	handleCombat(game, attackerHexId, defenderHexId, combatType, state) {
		const attackerUnit = game.getUnitOnHex(attackerHexId, state);
		const defenderUnit = game.getUnitOnHex(defenderHexId, state);
		const attackerHex = game.getHex(attackerHexId, state);
		const defenderHex = game.getHex(defenderHexId, state);

		if (!attackerUnit || !defenderUnit || !attackerHex || !defenderHex) return false;

		const isSkirmishing = !!attackerUnit.skirmishBuff;
		const distance = game.axialDistance(attackerHex.q, attackerHex.r, defenderHex.q, defenderHex.r);

		const damage = this.performCampaignCombat(attackerUnit, defenderUnit, distance, combatType, game, state);

		const defenderStillAlive = game.getUnitOnHex(defenderHexId, state);

		// Knight Tier 1 [B] Joust (Push back)
		if (attackerUnit.value === 4 && game.hasPerk(attackerUnit, 'tier1', 'B')) {
			const dq = defenderHex.q - attackerHex.q;
			const dr = defenderHex.r - attackerHex.r;
			const backQ = defenderHex.q + dq;
			const backR = defenderHex.r + dr;
			const backHex = game.getHexByQR(backQ, backR, state);
			const blocker = backHex ? game.getUnitOnHex(backHex.id, state) : null;

			if (!backHex || blocker || backHex.terrainType === 'LAKE' || backHex.terrainType === 'MOUNTAIN') {
				game.addLog(`🛡️ Joust blocked! +15 bonus damage.`);
				game.applyDamage(defenderHexId, 15, state);
			} else if (defenderStillAlive) {
				game.addLog(`🛡️ Joust! ${game.logUnit(defenderStillAlive)} is pushed back.`);
				game.move(defenderStillAlive, defenderHex, backHex, state);
			}
		}

		// Tanker Tier 1 [A] Spiked Armor (Reflect)
		if (defenderUnit.value === 5 && defenderUnit.isGuarding) {
			if (damage < 30) {
				let reflect = 10;
				if (game.hasPerk(defenderUnit, 'tier1', 'A')) reflect += 15;
				game.addLog(`💥 Spiked Armor! ${game.logUnit(attackerUnit)} takes ${reflect} reflect damage.`);
				game.applyDamage(attackerHexId, reflect, state);
			}
		}

		// Knight Tier 3 [B] Dark Knight (Lifesteal)
		if (attackerUnit.value === 4 && game.hasPerk(attackerUnit, 'tier3', 'B')) {
			const heal = Math.floor(damage * 0.5);
			attackerUnit.currentHP = Math.min(attackerUnit.maxHP, attackerUnit.currentHP + heal);
			game.addLog(`🧛 Dark Knight lifesteal! Healed ${heal} HP.`);
		}

		// Archer Tier 2 [B] Venom Tipped
		if (attackerUnit.value === 2 && game.hasPerk(attackerUnit, 'tier2', 'B')) {
			defenderUnit.venomDuration = 2;
			game.addLog(`🐍 Venom! ${game.logUnit(defenderUnit)} is poisoned for 2 turns.`);
		}

		// Fencer Tier 3 [A] Paladin (Heal on hit)
		if (attackerUnit.value === 1 && game.hasPerk(attackerUnit, 'tier3', 'A')) {
			game.getNeighbors(attackerHex, state).forEach(n => {
				const friend = game.getUnitOnHex(n.id, state);
				if (friend && friend.playerId === attackerUnit.playerId) {
					const heal = 20;
					friend.currentHP = Math.min(friend.maxHP, friend.currentHP + heal);
				}
			});
		}

		if (defenderStillAlive) {
			// Fencer Tier 2 [A] Riposte
			if (combatType === 'MELEE' && defenderStillAlive.value === 1 && game.hasPerk(defenderStillAlive, 'tier2', 'A')) {
				const counterDamage = Math.floor(defenderStillAlive.attack * 0.5);
				game.addLog(`↩️ Riposte! ${game.logUnit(defenderStillAlive)} counters for ${counterDamage} damage!`);
				game.applyDamage(attackerHexId, counterDamage, state);
			}
		} else {
			game.addLog(`${game.logUnit(attackerUnit)} destroyed ${game.logUnit(defenderUnit)}!`);

			// Hussar Tier 3 [B] Windrider (Action Refund)
			if (attackerUnit.value === 3 && game.hasPerk(attackerUnit, 'tier3', 'B') && !attackerUnit.windriderUsed) {
				attackerUnit.windriderUsed = true;
				attackerUnit.hasMovedOrAttackedThisTurn = false;
				attackerUnit.actionsTakenThisTurn = 0;
				game.addLog(`🌪️ Windrider! Action refunded.`);
			}

			if (isSkirmishing) {
				game.handleSkirmishSuccess(attackerHexId, defenderHexId, state);
				if (game.actionMode === 'SKIRMISH_POST_MOVE') return true; // Wait for user input
			} else if (combatType === 'MELEE' || combatType === 'COMMAND_CONQUER') {
				game.move(attackerUnit, attackerHex, defenderHex, state);
			}

			// Fencer Tier 3 [B] Blademaster (Hit & Run)
			if (attackerUnit.value === 1 && game.hasPerk(attackerUnit, 'tier3', 'B') && combatType === 'MELEE') {
				game.handleSkirmishSuccess(attackerHexId, defenderHexId, state);
				if (game.actionMode === 'SKIRMISH_POST_MOVE') return true;
			}

			// Hussar Tier 2 [A] Hit & Run
			if (attackerUnit.value === 3 && game.hasPerk(attackerUnit, 'tier2', 'A')) {
				game.handleSkirmishSuccess(attackerHexId, defenderHexId, state);
				if (game.actionMode === 'SKIRMISH_POST_MOVE') return true;
			}
		}
		return false;
	},

	/**
	 * Select a skin for an AI player in campaign mode.
	 */
	getAIPlayerSkin(campaignData, availableSkins, ro_skins) {
		if (this.state.isCampaignActive && campaignData?.rmi) {
			let words = campaignData.rmi.split('.')?.[0]?.replace(/\d/g, '')?.split('_');
			let ro_rmi_skins = words?.length
				? ro_skins.filter(x => x.split('_').find(x => words.includes(x)))
				: [];

			return ro_rmi_skins?.length ? ro_rmi_skins.cosmic_random() : availableSkins.cosmic_random();
		} else {
			return availableSkins.cosmic_random();
		}
	},

	/**
	 * Initialize campaign dice for the player.
	 */
	initCampaignDice(game, campaignData, player) {
		let diceToLoad = campaignData?.player1Dice || [1, 2, 3, 4, 5, 6]; // Default: Legendary Six

		// Filter out units that are currently locked out (eliminated in previous level)
		diceToLoad = diceToLoad.filter(val => this.isUnitAvailable(val));

		diceToLoad.forEach((val, idx) => {
			const upgrades = this.state.upgrades[val] || { atk: 0, def: 0, hp: 0, perks: {} };
			const baseStats = UNIT_STATS[val];

			const die = {
				id: `0_${idx}`,
				originalIndex: idx,
				playerId: 0,
				value: val,
				...baseStats,
				attack: (baseStats.attack * 10) + upgrades.atk,
				armor: (baseStats.armor * 10) + upgrades.def,
				maxHP: 100 + upgrades.hp,
				isDeployed: false,
				hexId: null,
				hasMovedOrAttackedThisTurn: false,
				isGuarding: 0,
				skirmishBuff: 0,
				isDeath: false,
				actionsTakenThisTurn: 0
			};

			// Tanker Tier 3 [A] Behemoth: Max HP is permanently doubled
			if (val === 5 && upgrades.perks?.tier3 === 'A') {
				die.maxHP *= 2;
			}

			die.currentHP = die.maxHP;
			die.currentArmor = die.armor;
			die.armorReduction = 0;

			this.applyFatigueDebuffs(die);
			die.effectiveArmor = die.armor;
			die.spriteUrl = game.getUnitSpriteUrl(die);
			player.dice.push(die);
		});
	},

	/**
	 * Initialize enemy dice in campaign mode.
	 */
	initEnemyDice(game, campaignData, p2) {
		(campaignData.enemyDice || []).forEach((val, idx) => {
			const baseStats = UNIT_STATS[val];
			const die = {
				id: `1_${idx}`,
				originalIndex: idx,
				playerId: 1,
				value: val,
				...baseStats,
				attack: baseStats.attack * 10,
				armor: baseStats.armor * 10,
				maxHP: 100,
				isDeployed: false,
				hexId: null,
				hasMovedOrAttackedThisTurn: false,
				isGuarding: 0,
				skirmishBuff: 0,
				isDeath: false,
				actionsTakenThisTurn: 0
			};
			die.currentHP = die.maxHP;
			die.currentArmor = die.armor;
			die.armorReduction = 0;

			die.effectiveArmor = die.armor;
			die.spriteUrl = game.getUnitSpriteUrl(die);
			p2.dice.push(die);
		});
	},

	/**
	 * Initialize player skins for campaign mode.
	 */
	initPlayerSkins(game, playerId) {
		const player = game.players[playerId];
		if (!player) return;

		if (playerId === 0) {
			player.sprites = [];
			const level = game.campaignData?.level || this.state.currentLevel;
			if (level < 11) player.selectedSpriteSet = 'ro_job1';
			else if (level < 21) player.selectedSpriteSet = 'ro_job2';
			else if (level > 41) player.selectedSpriteSet = 'ro_trans';
			else if (level > 61) player.selectedSpriteSet = 'ro_job3';
			else if (level > 81) player.selectedSpriteSet = 'ro_job3_2';
			else player.selectedSpriteSet = 'tos_mix';
		}
	},

	/**
	 * Auto-deploy enemy forces in campaign mode.
	 */
	autoDeployEnemy(game, campaignData) {
		if (this.state.isCampaignActive && campaignData) {
			const p2 = game.players[1];
			p2.dice.forEach((die, idx) => {
				const validHexes = game.calcValidDeploymentHexes(1);
				if (validHexes.length > 0) {
					const hexId = validHexes[Math.floor(Math.random() * validHexes.length)];
					die.isDeployed = true;
					game.move(die, null, game.getHex(hexId));
				}
			});
			game.addLog("Enemy forces have taken their positions.");
		}
	},

	/**
	 * Main entry point for campaign game over from game.js.
	 * Handles rewards, level advancement, and unit tracking.
	 */
	handleGameOver(game, winnerPlayerIndex) {
		const deployedValues = game.players[0].dice
			.filter(d => d.isDeployed && !d.isDeath)
			.map(d => d.value);
		const eliminatedValues = game.players[0].dice
			.filter(d => d.isDeployed && d.isDeath)
			.map(d => d.value);

		this.updateAfterBattle(deployedValues, eliminatedValues);

		// Track story progression
		const levelNum = this.state.currentLevel;
		if (winnerPlayerIndex === 0) {
			this.state.storyState.completedQuests[levelNum] = true;
			if (StoryEngine.isBossLevel(levelNum)) {
				this.state.storyState.bossesDefeated.push(levelNum);
			}
			this.state.storyState.seenIntros[levelNum + 1] = false;

			this.advanceLevel();
			if (game.campaignData?.rewards) {
				this.grantRewards(game.campaignData.rewards);
				game.addLog("Rewards Granted: " + Object.entries(game.campaignData.rewards).map(([k, v]) => `${v}x ${k.toUpperCase()}`).join(', '));
			}
			game.addLog("Campaign Advanced: New Level Unlocked!");
		}
		game.nextCampaignMap = this.getCurrentMapName();
	},

	/**
	 * Apply campaign-specific damage to a unit.
	 * @returns {boolean} True if campaign damage was handled.
	 */
	applyDamage(game, hexId, damage, state) {
		const unit = game.getUnitOnHex(hexId, state);
		if (!unit) return false;

		// Fencer Tier 1 [A] Parry
		if (unit.value === 1 && game.hasPerk(unit, 'tier1', 'A')) {
			const parryAvailable = 15 - (unit.roundDamageNegated || 0);
			if (parryAvailable > 0) {
				const negated = Math.min(damage, parryAvailable);
				damage -= negated;
				unit.roundDamageNegated = (unit.roundDamageNegated || 0) + negated;
				if (negated > 0) game.addLog(`🛡️ Parry! ${game.logUnit(unit)} negates ${negated} damage.`);
			}
		}

		// Hussar Tier 1 [B] Evasion
		if (unit.value === 3 && game.hasPerk(unit, 'tier1', 'B') && game.trailAttack?.combatType === 'RANGED_ATTACK') {
			damage = Math.floor(damage * 0.5);
			game.addLog(`💨 Evasion! ${game.logUnit(unit)} takes half damage from ranged attack.`);
		}

		const wasAboveHalf = unit.currentHP > unit.maxHP / 2;
		unit.currentHP -= damage;
		if (unit.currentHP <= 0) {
			unit.currentHP = 0;
			game.removeUnit(hexId, state);
		} else if (!state && wasAboveHalf && unit.currentHP <= unit.maxHP / 2 && !unit._halfHpDialogueFired && unit.playerId !== 0) {
			unit._halfHpDialogueFired = true;
			const levelNum = game.campaignData?.level || this.state.currentLevel;
			game.showStoryDialogue(levelNum, 'half_hp');
		}

		// Queue game renderer update for campaign mode
		if (!state && game.gameRenderer?._hexCache.has(hexId)) {
			game.gameRenderer.queueUpdate(
				hexId, unit.currentHP, unit.maxHP,
				unit.currentArmor, unit.effectiveArmor || unit.currentArmor, unit.attack, unit.veteranLevel
			);
		}

		return true;
	},

	/**
	 * Get the campaign deployment limit based on current level and crucible bonuses.
	 */
	getDeploymentLimit(baseLimit) {
		if (!this.state.isCampaignActive) return 99;
		const crucibleBonus = Math.floor((this.state.currentLevel - 1) / 10);
		return (baseLimit || 3) + crucibleBonus;
	},

	/**
	 * Check if a player index should be AI based on current campaign state.
	 */
	isAIPlayer(playerIndex, opts, campaignData) {
		return playerIndex > 0 && (opts?.isCampaign || this.state.isCampaignActive || campaignData?.config?.p2AI);
	},

	needsInitialRoll(playerIndex, campaignData) {
		if (!this.state.isCampaignActive) return false;
		return (playerIndex === 0) || (playerIndex === 1 && !!campaignData);
	},

	canTraverseLake() {
		return !!this.state.isCampaignActive;
	},

	getCurrentMapName() {
		return `level${this.state.currentLevel}.json`;
	},

	getLevelStory(levelNum) {
		return {
			region: StoryEngine.getRegionName(levelNum),
			title: StoryEngine.getTitle(levelNum),
			quest: StoryEngine.getQuest(levelNum),
			intro: StoryEngine.getIntro(levelNum),
			outro: StoryEngine.getOutro(levelNum),
			npc: StoryEngine.getNPC(levelNum),
			arc: StoryEngine.getArcName(levelNum),
			arcSummary: StoryEngine.getArcSummary(levelNum),
			enemyFlavor: StoryEngine.getEnemyFlavor(levelNum),
			isBoss: StoryEngine.isBossLevel(levelNum),
			boss: StoryEngine.getBossForLevel(levelNum)
		};
	},

	/**
	 * Spend a devotion point on a stat path for a specific dice class.
	 * @param {number} classId - 1-6.
	 * @param {string} path - 'atk', 'def', 'hp'.
	 */
	spendDevotionPoint(classId, path) {
		if (this.state.devotionPoints <= 0) return false;
		const upgrade = this.state.upgrades[classId];
		if (!upgrade || upgrade.points >= 15) return false;

		if (path === 'atk') upgrade.atk += 5;
		else if (path === 'def') upgrade.def += 5;
		else if (path === 'hp') upgrade.hp += 20;
		else return false;

		upgrade.points++;
		this.state.devotionPoints--;
		this.save();
		
		// Update active units in the current game session
		this.applyUpgradeToActiveUnits(classId);
		
		return true;
	},

	applyUpgradeToActiveUnits(classId) {
		// TODO: replace Alpine.$data(body) with a stored game reference once one exists globally
		const game = Alpine.$data(document.querySelector('body'));
		if (!game || !game.players) return;
		
		game.players.forEach(player => {
			player.dice.forEach(die => {
				if (die.value === classId) {
					const upgrades = this.state.upgrades[classId];
					const baseStats = UNIT_STATS[die.value];
					die.attack = (baseStats.attack * 10) + upgrades.atk;
					die.armor = (baseStats.armor * 10) + upgrades.def;
					die.maxHP = 100 + upgrades.hp;
					die.effectiveArmor = die.armor;
				}
			});
		});
	},

	/**
	 * Select a mutually exclusive perk for a class.
	 * @param {number} classId - 1-6.
	 * @param {string} tier - 'tier1', 'tier2', 'tier3'.
	 * @param {string} option - 'A' or 'B'.
	 */
	selectPerk(classId, tier, option) {
		const upgrade = this.state.upgrades[classId];
		if (!upgrade) return false;

		const pointsNeeded = { 'tier1': 5, 'tier2': 10, 'tier3': 15 };
		if (upgrade.points < pointsNeeded[tier]) return false;
		if (upgrade.perks[tier]) return false; // Already selected

		upgrade.perks[tier] = option;
		this.save();
		return true;
	},

	/**
	 * Reset the entire campaign (for "New Game" in campaign mode).
	 */
		resetCampaign() {
		const newCampaignData = {
			unitUsage: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
			recoveryLevels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
			runes: { aegis: 2, pegasus: 1, forge: 1 },
			devotionPoints: 0,
			upgrades: {
				1: { atk: 0, def: 0, hp: 0, points: 0, perks: { tier1: null, tier2: null, tier3: null } },
				2: { atk: 0, def: 0, hp: 0, points: 0, perks: { tier1: null, tier2: null, tier3: null } },
				3: { atk: 0, def: 0, hp: 0, points: 0, perks: { tier1: null, tier2: null, tier3: null } },
				4: { atk: 0, def: 0, hp: 0, points: 0, perks: { tier1: null, tier2: null, tier3: null } },
				5: { atk: 0, def: 0, hp: 0, points: 0, perks: { tier1: null, tier2: null, tier3: null } },
				6: { atk: 0, def: 0, hp: 0, points: 0, perks: { tier1: null, tier2: null, tier3: null } },
			},
			currentLevel: 1,
			isCampaignActive: true,
			storyState: {
				currentArc: 1,
				completedQuests: {},
				bossesDefeated: [],
				seenIntros: {}
			}
		};

		// Merge instead of replace to preserve reactivity
		Object.assign(this.state, newCampaignData);

		this.save();
	},

	/**
	 * Fetch a campaign map from a JSON file.
	 * @param {string} filename - The name of the JSON file (e.g., 'level1.json').
	 * @returns {Promise<object>} The campaign level data.
	 */
	async fetchCampaignMap(filename) {
		// const path = filename.startsWith('/') ? filename : `/campaign/${filename}`;
		// const response = await fetch(path);
		// if (!response.ok) throw new Error(`Failed to load campaign map: ${filename}`);
		// return await response.json();

		const path = `/js/campaign/ro_level_rmi.json`;
		const response = await fetch(path);
		if (!response.ok) throw new Error(`Failed to load campaign map: ${filename}`);

		let maps = await response.json();
		let levelNum = filename.match(/\d+/)?.[0];
		let map = maps[levelNum - 1];

		if ( (parseInt(levelNum) % 5) == 0 ) {
			const pathMaps = `/assets/ro_maps.json`;
			const allMaps = await fetch(pathMaps).then(r => r.json()).catch();
			map = allMaps?.map(x => x?.split('/').pop().split('.')[0]).filter(x => !x?.match(/[\d\_A-Z]/)).random() || map;
		}

		let enemyDiceCount = Math.ceil(levelNum / 10 + 2);
		let enemyDice = Array.from({ length: enemyDiceCount }, () => Math.floor(Math.random() * 6) + 1);

		const levelNumInt = parseInt(levelNum);
		const isBoss = StoryEngine.isBossLevel(levelNumInt);

		return {
			name: isBoss
				? `${StoryEngine.getBossForLevel(levelNumInt).name} — ${StoryEngine.getBossForLevel(levelNumInt).title}`
				: `${StoryEngine.getRegionName(levelNumInt)} — ${StoryEngine.getTitle(levelNumInt)}`,
			rmi: `${map}.gif`,
			level: levelNumInt,
			radius: 5,
			baseDeploymentLimit: 3,
			deploymentLimit: 3,
			player1Dice: [1, 2, 3, 4, 5, 6],
			enemyDice: enemyDice,
			config: {
				p2AI: true,
				options: "rm"
			},
			story: {
				region: StoryEngine.getRegionName(levelNumInt),
				title: StoryEngine.getTitle(levelNumInt),
				quest: StoryEngine.getQuest(levelNumInt),
				intro: StoryEngine.getIntro(levelNumInt),
				outro: StoryEngine.getOutro(levelNumInt),
				npc: StoryEngine.getNPC(levelNumInt),
				arc: StoryEngine.getArcName(levelNumInt),
				enemyFlavor: StoryEngine.getEnemyFlavor(levelNumInt),
				isBoss: isBoss,
				boss: StoryEngine.getBossForLevel(levelNumInt),
				npcDialogue: StoryEngine.getNPCDialogue(levelNumInt),
				rewardHint: StoryEngine.getRewardHint(levelNumInt)
			}
		}
	}
};
