/**
 * CampaignManager - Handles the state and logic for "Journey of the Six" campaign mode.
 * Persistent fatigue and rune systems.
 */
const CampaignManager = {
	state: {
		unitUsage: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }, // Consecutive uses
		recoveryLevels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }, // Level when unit becomes available again
		runes: { aegis: 2, pegasus: 1, forge: 1 },       // Inventory
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

	/**
	 * Use a rune from the inventory.
	 * @param {string} runeType - 'aegis', 'pegasus', 'forge'.
	 * @returns {boolean} True if the rune was successfully used.
	 */
	consumeRune(runeType) {
		if (this.state.runes[runeType] > 0) {
			this.state.runes[runeType]--;
			this.save();
			return true;
		}
		return false;
	},

	/**
	 * Grant rewards (runes) to the player's inventory.
	 * @param {object} rewards - e.g., { aegis: 1, pegasus: 1 }.
	 */
	grantRewards(rewards) {
		if (!rewards) return;
		for (const [type, count] of Object.entries(rewards)) {
			this.state.runes[type] = (this.state.runes[type] || 0) + count;
		}
		this.save();
	},

	/**
	 * Advance the current level in the campaign.
	 */
	advanceLevel() {
		this.state.currentLevel++;
		this.save();
	},

	/**
	 * Get the map filename for the current or next level.
	 * @returns {string} e.g., 'level1.json'.
	 */
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
