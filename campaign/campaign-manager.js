/**
 * CampaignManager - Handles the state and logic for "Journey of the Six" campaign mode.
 * Persistent fatigue and rune systems.
 */
const CampaignManager = {
	state: {
		unitUsage: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }, // Consecutive uses
		runes: { aegis: 2, pegasus: 1, forge: 1 },       // Inventory
		currentLevel: 1,
		isCampaignActive: new URLSearchParams(location.search).get('campaign') === 'true'
	},

	STORAGE_KEY: 'hexdice_campaign_state',

	/**
	 * Initialize the campaign state by loading from localStorage.
	 */
	init() {
		if (!this.state.isCampaignActive) return;

		const savedState = localStorage.getItem(this.STORAGE_KEY);
		if (savedState) {
			try {
				this.state = { ...this.state, ...JSON.parse(savedState) };
				// Ensure isCampaignActive is always correctly derived from the URL
				this.state.isCampaignActive = true;
			} catch (e) {
				console.error("Failed to parse campaign state:", e);
			}
		}

		console.log("Campaign Mode Active:", this.state);
	},

	/**
	 * Save the current campaign state to localStorage.
	 */
	save() {
		localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
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
	 * @param {Array<number>} deployedUnitValues - The face values of units that were deployed.
	 */
	updateAfterBattle(deployedUnitValues) {
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
	 * Reset the entire campaign (for "New Game" in campaign mode).
	 */
	resetCampaign() {
		this.state = {
			unitUsage: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
			runes: { aegis: 2, pegasus: 1, forge: 1 },
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
		const path = filename.startsWith('/') ? filename : `/campaign/${filename}`;
		const response = await fetch(path);
		if (!response.ok) throw new Error(`Failed to load campaign map: ${filename}`);
		return await response.json();
	}
};
