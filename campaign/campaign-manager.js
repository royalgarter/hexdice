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
		isCampaignActive: new URLSearchParams(location.search).get('campaign') === 'true'
	},

	STORAGE_KEY: 'hexdice_campaign_state',

	/**
	 * Select an active save slot and load its data.
	 */
	selectSlot(slotId) {
		this.state.activeSlot = slotId;
		const slot = this.state.slots[slotId];
		if (slot && slot.data) {
			this.state = { ...this.state, ...slot.data };
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
				B: { name: "Ranger", desc: "Run & Gun: Can move 1 step, shoot, and move 1 step again." }
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
	init() {
		const savedState = localStorage.getItem(this.STORAGE_KEY);
		if (savedState) {
			try {
				const parsed = JSON.parse(savedState);
				this.state = { ...this.state, ...parsed };
				
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

				// Ensure recoveryLevels exists for backward compatibility
				if (!this.state.recoveryLevels) {
					this.state.recoveryLevels = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
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

	/*
	// DEPRECATED: Use a rune from the inventory.
	consumeRune(runeType) {
		if (this.state.runes[runeType] > 0) {
			this.state.runes[runeType]--;
			this.save();
			return true;
		}
		return false;
	},

	// DEPRECATED: Grant rewards (runes) to the player's inventory.
	grantRewards(rewards) {
		if (!rewards) return;
		for (const [type, count] of Object.entries(rewards)) {
			this.state.runes[type] = (this.state.runes[type] || 0) + count;
		}
		this.save();
	},
	*/

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

		const attackerAtk = attacker.attack + attackMod;
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

	/**
	 * Check if a player needs an initial roll.
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
		return true;
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
		this.state = {
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
			isCampaignActive: true
		};
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

		const path = `/campaign/ro_level_rmi.json`;
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

		return {
			name: `Ragnarok Online Level ${levelNum} (${map})`,
			rmi: `${map}.gif`,
			level: levelNum,
			radius: 5,
			deploymentLimit: 3,
			player1Dice: [1, 2, 3, 4, 5, 6],
			enemyDice: enemyDice,
			config: {
				p2AI: true,
				options: "rm"
			}
		}
	}
};
