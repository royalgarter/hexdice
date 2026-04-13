// deno-lint-ignore-file
const R = 5; // Map size radius
const HEX_SIZE = 60; // pixels
const HEX_WIDTH = HEX_SIZE;
const HEX_HEIGHT = HEX_SIZE * Math.sqrt(3) / 2; // Height of one equilateral triangle half

const BOARD_DOT = [
	`                         .`,
	`                     .       .`,
	`                 .       .       .`,
	`             .       .       .       .`,
	`         .       .       .       .       .`,
	`     .       .       .       .       .       .`,
	` .       .       .       .       .       .       .`,
	`     .       .       .       .       .       .`,
	` .       .       .       .       .       .       .`,
	`     .       .       .       .       .       .`,
	` .       .       .       .       .       .       .`,
	`     .       .       .       .       .       .`,
	` .       .       .       .       .       .       .`,
	`     .       .       .       .       .       .`,
	` .       .       .       .       .       .       .`,
	`     .       .       .       .       .       .`,
	` .       .       .       .       .       .       .`,
	`     .       .       .       .       .       .`,
	` .       .       .       .       .       .       .`,
	`     .       .       .       .       .       .`,
	`         .       .       .       .       .`,
	`             .       .       .       .`,
	`                 .       .       .`,
	`                     .       .`,
	`                         .`,
].join('\n');
const BOARD_NUM = [
	`                        057`,
	`                    045     070`,
	`                034     058     082`,
	`            024     046     071     093`,
	`        015     035     059     083     103`,
	`    007     025     047     072     094     112`,
	`000     016     036     060     084     104     120`,
	`    008     026     048     073     095     113`,
	`001     017     037     061     085     105     121`,
	`    009     027     049     074     096     114`,
	`002     018     038     062     086     106     122`,
	`    010     028     050     075     097     115`,
	`003     019     039     063     087     107     123`,
	`    011     029     051     076     098     116`,
	`004     020     040     064     088     108     124`,
	`    012     030     052     077     099     117`,
	`005     021     041     065     089     109     125`,
	`    013     031     053     078     100     118`,
	`006     022     042     066     090     110     126`,
	`    014     032     054     079     101     119`,
	`        023     043     067     091     111`,
	`            033     055     080     102`,
	`                044     068     092`,
	`                    056     081`,
	`                        069`,
].join('\n');

// BIND-EDIT rules.md: ### **4. Dice Soldiers (Unit Types)**
const UNIT_STATS = {
	1: { name: "Fencer", attack: 2, armor: 2, range: 0, distance: 2, movement: '*' },
	2: { name: "Archer", attack: 2, armor: 1, range: 2, distance: 1, movement: '*' },
	3: { name: "Hussar", attack: 3, armor: 0, range: 0, distance: 3, movement: 'L' },
	4: { name: "Knight", attack: 2, armor: 1, range: 0, distance: 3, movement: 'X' },
	5: { name: "Tanker", attack: 1, armor: 4, range: 0, distance: 1, movement: '*' },
	6: { name: "Oracle", attack: 0, armor: 0, range: 2, distance: 1, movement: '*' },
};
const AXES = [
	{i: 0, q: +1, r: -1, name: '2h'},
	{i: 1, q: +1, r: +0, name: '4h'},
	{i: 2, q: +0, r: +1, name: '6h'},
	{i: 3, q: -1, r: +1, name: '8h'},
	{i: 4, q: -1, r: +0, name: '10h'},
	{i: 5, q: +0, r: -1, name: '12h'},
];
const PLAYER_PRIMARY_AXIS = {
	1: [ AXES[5] ],
	2: [ AXES[5], AXES[2] ],
	3: [ AXES[4], AXES[2], AXES[0] ],
	4: [ AXES[4], AXES[3], AXES[0], AXES[1] ],
	5: [ AXES[5], AXES[3], AXES[0], AXES[2], AXES[4] ],
	6: [ AXES[0], AXES[1], AXES[2], AXES[3], AXES[4], AXES[5] ],
};
const PLAYER_CONFIG = [
	{ id: 0, color: 'Blue', sprite: 'blue', bg: 'bg-hexblue', logColor: 'text-blue-700' },
	{ id: 1, color: 'Red', sprite: 'red', bg: 'bg-hexred', logColor: 'text-red-700' },
	{ id: 2, color: 'Green', sprite: 'green', bg: 'bg-hexgreen', logColor: 'text-green-700' },
	{ id: 3, color: 'Purple', sprite: 'purple', bg: 'bg-hexpurple', logColor: 'text-purple-700' },
	{ id: 4, color: 'White', sprite: 'white', bg: 'bg-hexwhite', logColor: 'text-white-700' },
	{ id: 5, color: 'Yellow', sprite: 'brown', bg: 'bg-hexyellow', logColor: 'text-yellow-700' },
];

const TERRAIN_CONFIG = {
	'PLAIN': { color: 'Plain', bg: 'bg-hexplain', logColor: 'text-gray-500' },
	'FOREST': { color: 'Forest', bg: 'bg-hexforest', logColor: 'text-green-800' },
	'LAKE': { color: 'Lake', bg: 'bg-hexlake', logColor: 'text-blue-500' },
	'TOWER': { color: 'Tower', bg: 'bg-hextower', logColor: 'text-purple-600' },
	'MOUNTAIN': { color: 'Mountain', bg: 'bg-hexmountain', logColor: 'text-gray-700' },
};

Array.prototype.random = function () { return this[Math.floor((random() * this.length))]; }
const random = () => {return Math.random();const a = new Uint32Array(1);crypto.getRandomValues(a);return a[0] / 4294967296/*2^32*/;}

function alpineHexDiceTacticGame() { return {
	/* --- VARIABLES --- */
	rules: {
		dicePerPlayer: 12,
	},
	options: 'r', //'rm',
	hexGrid: {},
	hexes: [],
	hexesQR: {},
	players: [],
	playerCount: 2,
	turnCount: 0,
	phase: 'SETUP_ROLL', // SETUP_ROLL, SETUP_REROLL, SETUP_DEPLOY, PLAYER_TURN, GAME_OVER
	currentPlayerIndex: 0,
	selectedUnitHexId: null,
	selectedDieToDeploy: null, // index in player's dice array
	hovering: {},
	unitstat: null,
	trail: {fromHex: null, toHex: null, unit: null, path: []},
	trailAttack: {fromHex: null, toHex: null, unit: null},
	validMoves: [], // array of hex IDs
	validMerges: [], // array of hex IDs
	validTargets: [], // array of hex IDs for attacks/merges
	diceToReroll: [], // indices of dice selected for reroll
	messageLog: [],
	logCounter: 0,
	winnerMessage: "",
	actionMode: null, // 'MOVE', 'RANGED_ATTACK', 'SPECIAL_ATTACK', 'MERGE_SELECT_TARGET', 'SPELLCAST'
	oracleSelectedSpell: null, // 'SHIELD', 'SWAP', 'SKIRMISH'
	showLog: true,
	debug: {
		quiet: false,
		coordinate: new URLSearchParams(location.search).get('mode')?.includes('coordinate'),
		skipReroll: new URLSearchParams(location.search).get('mode')?.includes('debug'),
		skipDeploy: new URLSearchParams(location.search).get('mode')?.includes('debug'),
		autoPlay: new URLSearchParams(location.search).get('mode')?.includes('auto'),
	},

	// --- SETUP TERRAIN METHODS ---
	setupTerrain(force) {
		const urlParams = new URLSearchParams(location.search);
		const v12Active = urlParams.get('v') === '1.2';
		const radius = parseInt(urlParams.get('R')) || ((this.playerCount <= 3) ? 5 : 6);

		if (!v12Active && !force) return; // Only setup terrain for v1.2

		this.addLog("Setting up terrain");

		// Implement Roulette (sum-of-6-dice and clockwise placement)
		// User chose "Auto-Placement (Simple)" for roulette
		this.generateRouletteTerrain();

		// Implement R=8 terrain generation (4-roll algorithm)
		if (radius === 8) {
			this.generateR8Terrain();
		}
	},

	generateRouletteTerrain() {
		this.addLog("Generating Roulette Terrain...");
		this.hexes.forEach(x => x.terrainType = 'PLAIN');

		const terrainDiceRolls = Array.from({ length: 6 }, () => Math.floor(random() * 6) + 1);
		const totalTerrainCells = terrainDiceRolls.reduce((sum, roll) => sum + roll, 0);
		this.addLog(`Roulette dice rolls: ${terrainDiceRolls.join(', ')}. Total terrain cells: ${totalTerrainCells}.`);

		// Collect all deployment hexes for all players to exclude
		const deploymentHexIds = new Set();
		this.players.forEach((_, playerId) => {
			this.calcValidDeploymentHexes(playerId).forEach(id => deploymentHexIds.add(id));
		});

		const validTerrainHexes = this.hexes.filter(hex => {
			// Not the R=0 center hex
			if (hex.q === 0 && hex.r === 0) return false;
			// Not one of the 6 Base corner hexes
			if (hex.basePlayerId !== null && hex.basePlayerId !== undefined) return false;

			// Not in any player's deployment area
			// if (deploymentHexIds.has(hex.id)) return false;

			// Does not already contain a terrain hex (though it should be plain at this stage)
			if (hex.terrainType !== 'PLAIN') return false;
			return true;
		});

		// Shuffle valid hexes to pick random locations
		// (Fisher-Yates shuffle)
		for (let i = validTerrainHexes.length - 1; i > 0; i--) {
			const j = Math.floor(random() * (i + 1));
			[validTerrainHexes[i], validTerrainHexes[j]] = [validTerrainHexes[j], validTerrainHexes[i]];
		}

		// Place terrain (e.g., Forest for simplicity for now, actual type from roll 4)
		// For roulette, the rules specify "each player places one terrain cell in their wish on valid hex"
		// Since user chose "Auto-Placement (Simple)", I will just randomly pick a terrain type for each.
		const terrainTypes = Object.keys(TERRAIN_CONFIG).filter(x => x != 'PLAIN');

		for (let i = 0; i < totalTerrainCells && i < validTerrainHexes.length; i++) {
			const hex = validTerrainHexes[i];
			const randomTerrainType = terrainTypes[Math.floor(random() * terrainTypes.length)];

			if (randomTerrainType == 'LAKE' && deploymentHexIds.has(hex.id))
				hex.terrainType = 'PLAIN';
			else
				hex.terrainType = randomTerrainType;

			this.addLog(`${randomTerrainType} at [${hex.id}](${hex.q},${hex.r},${hex.s}).`);
		}
	},

	generateR8Terrain() {
		this.addLog("Generating R=8 Terrain...");
		this.hexes.forEach(x => x.terrainType = 'PLAIN');

		const terrainDiceRolls = Array.from({ length: 6 }, () => Math.floor(random() * 6) + 1);
		const totalTerrainCells = terrainDiceRolls.reduce((sum, roll) => sum + roll, 0);
		this.addLog(`R=8 Terrain dice rolls: ${terrainDiceRolls.join(', ')}. Total terrain cells: ${totalTerrainCells}.`);

		const distanceMap = [null, 3, 4, 5, 6, 7, 8]; // Index 1-6 for rolls
		const terrainTypeMap = [null, 'FOREST', 'FOREST', 'LAKE', 'LAKE', 'TOWER', 'MOUNTAIN']; // Index 1-6 for rolls

		// Collect all deployment hexes for all players to exclude
		const deploymentHexIds = new Set();
		this.players.forEach((_, playerId) => {
			this.calcValidDeploymentHexes(playerId).forEach(id => deploymentHexIds.add(id));
		});

		const centerHex = this.getHexByQR(0, 0);

		for (let i = 0; i < totalTerrainCells; i++) {
			const roll1Direction = Math.floor(random() * 6) + 1; // 1-6
			const roll2Distance = Math.floor(random() * 6) + 1; // 1-6
			const roll3Scatter = Math.floor(random() * 6) + 1; // 1-6
			const roll4Terrain = Math.floor(random() * 6) + 1; // 1-6

			this.addLog(`Rolls for terrain #${i+1}: Direction ${roll1Direction}, Distance ${roll2Distance}, Scatter ${roll3Scatter}, Terrain ${roll4Terrain}.`);

			// Roll 1 (Direction)
			const primaryAxis = AXES[roll1Direction - 1]; // AXES is 0-indexed

			// Roll 2 (Distance) - Anchor Hex calculation
			const distSteps = distanceMap[roll2Distance];
			const anchorQ = centerHex.q + primaryAxis.q * distSteps;
			const anchorR = centerHex.r + primaryAxis.r * distSteps;
			let potentialTerrainHex = this.getHexByQR(anchorQ, anchorR);

			// Roll 3 (Scatter) - Apply scatter from Anchor Hex
			if (potentialTerrainHex) {
				const scatterAxis = AXES[roll3Scatter - 1];
				const scatterQ = potentialTerrainHex.q + scatterAxis.q;
				const scatterR = potentialTerrainHex.r + scatterAxis.r;
				potentialTerrainHex = this.getHexByQR(scatterQ, scatterR);
			}

			// Roll 4 (Terrain)
			const terrainType = terrainTypeMap[roll4Terrain];

			if (potentialTerrainHex) {
				// Placement Check
				// Not the R=0 center hex
				if (potentialTerrainHex.q === 0 && potentialTerrainHex.r === 0) {
					this.addLog(`Skipped terrain #${i+1}: Location is center hex (0,0).`);
					continue;
				}
				// Not one of the 6 Base corner hexes
				if (potentialTerrainHex.basePlayerId !== null && potentialTerrainHex.basePlayerId !== undefined) {
					this.addLog(`Skipped terrain #${i+1}: Location is a Base hex (${potentialTerrainHex.q}, ${potentialTerrainHex.r}).`);
					continue;
				}
				// Not in any player's deployment area
				if (deploymentHexIds.has(potentialTerrainHex.id)) {
					this.addLog(`Skipped terrain #${i+1}: Location is a deployment hex (${potentialTerrainHex.q}, ${potentialTerrainHex.r}).`);
					continue;
				}
				// Does not already contain a terrain hex
				if (potentialTerrainHex.terrainType !== 'PLAIN') {
					this.addLog(`Skipped terrain #${i+1}: Location already has terrain (${potentialTerrainHex.q}, ${potentialTerrainHex.r}).`);
					continue;
				}

				// If all checks pass, place the terrain
				potentialTerrainHex.terrainType = terrainType;
				this.addLog(`Placed ${terrainType} at (${potentialTerrainHex.q}, ${potentialTerrainHex.r}).`);
			} else {
				this.addLog(`Skipped terrain #${i+1}: Invalid or out-of-bounds hex generated.`);
			}
		}
	},

	/* --- INITIALIZATION --- */
	init() {
		this.playerCount = parseInt(new URLSearchParams(location.search).get('players')) || 2;

		// Map size modifier: 2, 3 players -> R=5; 4, 6 players -> R=6
		const radius = (this.playerCount <= 3) ? 5 : 6;
		this.generateHexGrid(radius);

		// Adjust dice per player based on player count (Total 24 dice)
		this.rules.dicePerPlayer = Math.floor((this.playerCount <= 3 ? 24 : 36) / this.playerCount);

		this.determineBaseLocations(radius);
		this.options = new URLSearchParams(location.search).get('options') || this.options || '';

		try {
			const url = new URL(location.href || location.toString());
			url.searchParams.set('options', this.options);
			url.searchParams.set('players', this.playerCount);
			if (window?.history?.replaceState) window.history.replaceState(null, '', url);
		} catch(e) {
			// Silent fail for non-browser environments
		}

		this.addLog("Game started. Welcome to Hex Dice!");
		this.resetGame({
			isCampaign: new URLSearchParams(location.search).get('mode') == 'campaign',
		});
	},
	resetGame(opts) {
		this.players = [];
		for (let i = 0; i < this.playerCount; i++) {
			this.players.push({
				...PLAYER_CONFIG[i],
				dice: [],
				initialRollDone: false,
				baseHexId: null,
				rerollsUsed: 0,
				isEliminated: false,
				isAI: (i > 0 && opts?.isCampaign)
			});
		}

		const radius = (this.playerCount <= 3) ? 5 : 6;
		this.generateHexGrid(radius);
		this.hexes.forEach(h => {
			h.unitId = null; // Clear units from hexes
			h.terrainType = 'PLAIN'; // Reset terrain
		});
		this.determineBaseLocations(radius); // Redetermine bases on reset
		this.setupTerrain(); // Trigger terrain setup for v1.2 rules
		this.phase = 'SETUP_ROLL';
		this.turnCount = 0;
		this.currentPlayerIndex = 0;
		this.selectedUnitHexId = null;
		this.selectedDieToDeploy = null;
		this.actionMode = null;
		this.oracleSelectedSpell = null;
		this.validMoves = [];
		this.validMerges = [];
		this.validTargets = [];
		this.diceToReroll = [];
		this.messageLog = [];

		if (this.debug?.autoPlay) {
			this.players.forEach(p => p.isAI = true);
			this.addLog(`Autoplay game started`);
		}

		this.addLog(`New game started with ${this.playerCount} players.`);
	},

	/* --- HEX GRID --- */
	generateHexGrid(radius, padding=1) {
		this.hexes = [];
		this.hexesQR = {};
		let id = 0;
		for (let q = -radius; q <= radius; q++) {
			for (let r = -radius; r <= radius; r++) {
				if (-q - r >= -radius && -q - r <= radius) { // Check if s is also within radius
					const x = HEX_WIDTH * 3/4 * q;
					const y = HEX_HEIGHT * (r + q / 2);

					this.hexes.push({ id, q, r, s: -q-r, unitId: null, visualX: x, visualY: y, terrainType: 'PLAIN' });
					this.hexesQR[(q * 1e3) + r] = id;

					id++;
				}
			}
		}

		const allX = this.hexes.map(h => h.visualX);
		const allY = this.hexes.map(h => h.visualY);
		const minX = Math.min(...allX);
		const maxX = Math.max(...allX);
		const minY = Math.min(...allY);
		const maxY = Math.max(...allY);
		const gridWidth = maxX - minX + HEX_WIDTH;
		const gridHeight = maxY - minY + HEX_HEIGHT; // Approx

		const style = `width: ${gridWidth}px; height: ${gridHeight}px;`;

		this.hexGrid = {allX, allY, minX, minY, gridWidth, gridHeight, style};

		let css = '';
		for (let i=0; i<this.hexes.length; i++) {
			this.hexes[i].left = this.hexes[i].visualX - this.hexGrid.minX + padding;
			this.hexes[i].top = this.hexes[i].visualY - this.hexGrid.minY + padding;
			this.hexes[i].width = HEX_WIDTH - (padding << 1);
			this.hexes[i].height = HEX_HEIGHT - (padding << 1);

			this.hexes[i].trailX = this.hexes[i].left + (this.hexes[i].width / 2);
			this.hexes[i].trailY = this.hexes[i].top + (this.hexes[i].height / 2);

			css += `.hex-${this.hexes[i].id} { left: ${this.hexes[i].left}px; top: ${this.hexes[i].top}px; width: ${this.hexes[i].width}px; height: ${this.hexes[i].height}px; }\n`;
		}

		if (typeof document !== 'undefined') {
			let styleTag = document.getElementById('dynamic-hex-styles');
			if (!styleTag) {
				styleTag = document.createElement('style');
				styleTag.id = 'dynamic-hex-styles';
				document.head.appendChild(styleTag);
			}
			styleTag.textContent = css;
		}
	},
	determineBaseLocations(radius) {
		let radiusOffset = -(radius - 1);

		// Clear existing base assignments
		this.hexes.forEach(h => {
			h.basePlayerId = null;
		});

		for (let i = 0; i < this.players.length; i++) {
			const primary = PLAYER_PRIMARY_AXIS[this.players.length][i];
			if (!primary) continue;

			const baseHex = this.getHexByQR(primary.q * radiusOffset, primary.r * radiusOffset);
			if (baseHex) {
				baseHex.basePlayerId = i;
				this.players[i].baseHexId = baseHex.id;
			}
		}
	},
	axialDistance(q1, r1, q2, r2) {
		const dq = q1 - q2;
		const dr = r1 - r2;
		return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)); // Optimized

		// const ds = (-q1 - r1) - (-q2 - r2);
		// return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
	},
	getHex(id, state) {
		return (state || this).hexes[id]; /*(state || this).hexes.find(h => h.id === id);*/
	},
	getHexByQR(q, r, state) {
		state = (state || this);
		return state.hexes[state.hexesQR[(q * 1e3) + r]];
		/* return (state || this).hexes.find(h => h.q === q && h.r === r); */
	},
	getUnitOnHex(hexId, state) {
		const hex = this.getHex(hexId, state);

		if (!hex || (!hex.unit && !hex.unitId)) return null;

		let unit = hex.unit;

		if (!unit) {
			const [playerId, diceIndex] = hex.unitId.split('_').map(Number);
			unit = (state || this).players[playerId]?.dice[diceIndex];
		}

		return (!unit.isDeath) && unit;
	},
	getNeighbors(hex, state) {
		if (!hex) return [];
		return AXES.map(dir => this.getHexByQR(hex.q + dir.q, hex.r + dir.r, state)).filter(Boolean);
	},
	renderMono(state) {
		state = state || this;

		let render = state.hexes.reduce((render, hex) => render.replace(
			hex.id.toString().padStart(3, `0`),
			hex.unit ? `${hex.unit.playerId}-${hex.unit.value}` : ` . `,
		), BOARD_NUM);

		return render;
	},

	/* --- UI STYLING --- */
	hexColor(hex, state) {
		// const unit = this.getUnitOnHex(hex.id, state);

		let cls = TERRAIN_CONFIG[hex.terrainType]?.bg || 'bg-hexdefault';

		if (hex.basePlayerId !== null && hex.basePlayerId !== undefined) {
			cls = PLAYER_CONFIG[hex.basePlayerId].bg;
		}

		state = state || this;

		if (state.selectedUnitHexId === hex.id) cls = 'bg-hexselect';
		else if (state.validMoves?.includes(hex.id)) cls = 'bg-hexmove';
		else if (state.validMerges?.includes(hex.id)) cls = 'bg-hexmerge';
		else if (state.validTargets?.includes(hex.id)) cls = 'bg-hextarget';
		else if (state.dangerHexes?.[hex.id]) cls = 'bg-hexdanger';

		if (state.phase === 'SETUP_DEPLOY' && this.calcValidDeploymentHexes(this.currentPlayerIndex).includes(hex.id)) {
			cls = 'bg-hexdeploy';
		}

		let hovering = state.hovering;
		if (hovering.hexId && (state.selectedUnitHexId != hovering.hexId)) {
			if (hovering.validMoves?.includes(hex.id)) cls += ' bg-hexmove';
			else if (hovering.validMerges?.includes(hex.id)) cls += ' bg-hexmerge';
			else if (hovering.validTargets?.includes(hex.id)) cls += ' bg-hextarget';
		}

		return cls;
	},
	hexStyle(hex) {
		let style = [];

		const unit = this.getUnitOnHex(hex.id);
		if (unit) {
			const {value, playerId} = unit;
			const spriteColor = PLAYER_CONFIG[playerId].sprite;
			style.push(`background-size: auto 70%, cover;`,
				`background-image: url("/assets/sprites/multi_players/d${value}_${spriteColor}.gif")
					${(TERRAIN_CONFIG[hex.terrainType] && (hex.terrainType!='PLAIN'))
						? `, url("/assets/sprites/terrain/${hex.terrainType.toLowerCase()}_01.png")`
						: ''
					};`
			);
		} else if (TERRAIN_CONFIG[hex.terrainType] && (hex.terrainType!='PLAIN')) {
			style.push(`background-size: 110%;`,
				`background-image: url("/assets/sprites/terrain/${hex.terrainType.toLowerCase()}_01.png");`
			);
		}
		return style.join(' ');
	},
	hoverHex(hexId) {
		if (this.phase !== 'PLAYER_TURN') return;

		this.hovering = {};

		this.hovering.hexId = hexId;
		this.hovering.unit = this.getUnitOnHex(hexId);

		if (this.hovering.unit) {
			this.hovering.validMoves = this.calcValidMoves(hexId);
			this.hovering.validMerges = this.calcValidMoves(hexId, 'MERGE');

			if (this.hovering.unit?.value == 2) {
				this.hovering.validTargets = this.calcValidRangedTargets(hexId, null, true);
			}

			if (this.hovering.unit?.value == 6) {
				this.hovering.validTargets = this.calcValidSpecialAttackTargets(hexId, null, true);
			}
		}
	},

	/* --- SETUP --- */
	setupStatusMessage() {
		if (this.phase === 'SETUP_ROLL') return "Roll initial dice for both players.";
		if (this.phase === 'SETUP_REROLL') return `P${this.currentPlayerIndex + 1} (${this.players[this.currentPlayerIndex].color}) - Reroll Phase.`;
		if (this.phase === 'SETUP_DEPLOY') return `P${this.currentPlayerIndex + 1} (${this.players[this.currentPlayerIndex].color}) - Deployment Phase.`;
		return "Setup";
	},
	rollInitialDice(playerId) {
		if (this.players[playerId].initialRollDone) return;
		const player = this.players[playerId];
		player.dice = [];
		for (let i = 0; i < this.rules.dicePerPlayer; i++) {
			const roll = Math.floor(random() * 6) + 1;
			player.dice.push({
				id: `${playerId}_${i}`, // Unique ID for the die unit
				originalIndex: i, // to link back to player.dice array
				playerId: playerId,
				value: roll,
				...UNIT_STATS[roll], // Spread initial stats
				currentArmor: UNIT_STATS[roll].armor,
				armorReduction: 0,
				isDeployed: false,
				hexId: null,
				hasMovedOrAttackedThisTurn: false,
				isGuarding: 0,
				skirmishBuff: 0,
				isDeath: false,
				actionsTakenThisTurn: 0, // For merged unit to act if target hasn't
			});
		}
		player.initialRollDone = true;
		this.addLog(`P${playerId + 1} rolled: ${player.dice.map(d => d.value).join(', ')}`);

		if (this.players.every(p => p.initialRollDone)) {
			this.phase = 'SETUP_REROLL';
			this.currentPlayerIndex = 0; // Player 1 starts reroll
			this.diceToReroll = [];

			if (this.debug?.skipReroll) this.players.forEach(() => this.skipReroll());
		}
	},
	toggleRerollSelection(diceIndex) {
		if (this.players[this.currentPlayerIndex].dice[diceIndex].isDeployed) return;
		const indexInReroll = this.diceToReroll.indexOf(diceIndex);
		const maxRerolls = Math.floor(this.rules.dicePerPlayer / 3);
		if (indexInReroll > -1) {
			this.diceToReroll.splice(indexInReroll, 1);
		} else {
			if (this.diceToReroll.length < maxRerolls) {
				this.diceToReroll.push(diceIndex);
			}
		}
	},
	canConfirmReroll() {
		return this.players[this.currentPlayerIndex].rerollsUsed === 0; // Only one reroll phase
	},
	performReroll() {
		if (!this.canConfirmReroll() || this.diceToReroll.length === 0) {
			this.skipReroll(); // If no dice selected or already rerolled, just skip
			return;
		}
		const player = this.players[this.currentPlayerIndex];
		let rerolledValues = [];
		this.diceToReroll.forEach(diceIndex => {
			const newRoll = Math.floor(random() * 6) + 1;
			player.dice[diceIndex].value = newRoll;
			// Update stats based on new roll
			Object.assign(player.dice[diceIndex], UNIT_STATS[newRoll]);
			player.dice[diceIndex].currentArmor = UNIT_STATS[newRoll].armor;
			player.dice[diceIndex].armorReduction = 0; // Reset this on reroll
			rerolledValues.push(newRoll);
		});
		this.addLog(`P${player.id + 1} rerolled ${this.diceToReroll.length} dice. New values: ${rerolledValues.join(', ')}`);
		player.rerollsUsed++;
		this.diceToReroll = [];
		this.nextPlayerSetupRerollOrDeploy();
	},
	skipReroll() {
		this.addLog(`P${this.currentPlayerIndex + 1} skipped reroll.`);
		this.players[this.currentPlayerIndex].rerollsUsed++; // Mark as reroll phase completed
		this.diceToReroll = [];
		this.nextPlayerSetupRerollOrDeploy();
	},
	nextPlayerSetupRerollOrDeploy() {
		// Find next player who hasn't finished reroll phase
		const nextRerollPlayer = this.players.find(p => p.rerollsUsed === 0);

		if (nextRerollPlayer) {
			this.currentPlayerIndex = nextRerollPlayer.id;
			this.diceToReroll = [];
		} else {
			// All players finished reroll phase
			this.phase = 'SETUP_DEPLOY';
			this.currentPlayerIndex = 0; // Player 1 starts deployment
			this.selectedDieToDeploy = 0;

			if (this.debug?.skipDeploy) {
				this.players.forEach((player, playerIdx) => {
					player.dice.forEach((dice, diceIdx) => {
						this.selectDieToDeploy(diceIdx);
						this.handleHexClick(this.calcValidDeploymentHexes(playerIdx).random());
					});
				});
			}
		}
	},
	selectDieToDeploy(diceIndex) {
		if (this.players[this.currentPlayerIndex].dice[diceIndex].isDeployed) return;
		this.selectedDieToDeploy = diceIndex;
	},
	deployUnit(hexId) {
		if (this.selectedDieToDeploy === null) {
			this.addLog("Select a die to deploy first.");
			return;
		}
		const player = this.players[this.currentPlayerIndex];
		const dieToDeploy = player.dice[this.selectedDieToDeploy];
		const targetHex = this.getHex(hexId);

		if (!targetHex || dieToDeploy.isDeployed) return;

		const validDeploymentHexes = this.calcValidDeploymentHexes(this.currentPlayerIndex);
		if (!validDeploymentHexes.includes(hexId)) {
			this.addLog("Invalid deployment hex. Deploy on your base or adjacent hexes.");
			return;
		}
		if (this.getUnitOnHex(hexId)) {
			this.addLog("Hex is already occupied.");
			return;
		}

		dieToDeploy.isDeployed = true;

		this.move(dieToDeploy, null, targetHex);
		// dieToDeploy.hexId = hexId;
		// targetHex.unit = dieToDeploy;
		// targetHex.unitId = dieToDeploy.id;

		this.addLog(`P${player.id + 1} deployed #${dieToDeploy.value} to [${hexId}](${targetHex.q},${targetHex.r},${targetHex.s})`);
		this.selectedDieToDeploy = player.dice.find(x => !x.isDeployed)?.originalIndex;

		// Check if current player has deployed all dice
		if (player.dice.every(d => d.isDeployed)) {
			// Find next player who hasn't deployed all dice
			const nextDeployPlayer = this.players.find(p => p.dice.some(d => !d.isDeployed));

			if (nextDeployPlayer) {
				this.currentPlayerIndex = nextDeployPlayer.id;
				this.selectedDieToDeploy = this.players[this.currentPlayerIndex].dice.findIndex(d => !d.isDeployed);
				this.addLog(`P${this.currentPlayerIndex + 1} turn to deploy`);
			} else {
				this.startGamePlay();
			}
		}
	},
	startGamePlay() {
		this.phase = 'PLAYER_TURN';
		this.currentPlayerIndex = 0; // Player 1 starts the game
		this.trail = {fromHex: null, toHex: null, unit: null, path: []};

		this.resetTurnActionsForPlayer(this.currentPlayerIndex);
		this.addLog("---");
		this.addLog("P1 turn.");

		if (this.players[this.currentPlayerIndex].isAI) {
			this.addLog("[AI] P2 turn.");
			this.performAITurn();
		} else if (this.debug?.autoPlay) {
			this.autoPlay();
		}
	},
	randomStart() {
		// Roll initial dice for all players
		this.players.forEach((p, i) => this.rollInitialDice(i));
		
		// Deploy all dice randomly for all players
		this.players.forEach((player, playerIdx) => {
			player.dice.forEach((dice, diceIdx) => {
				const validHexes = this.calcValidDeploymentHexes(playerIdx);
				if (validHexes.length > 0) {
					this.selectedDieToDeploy = diceIdx;
					this.deployUnit(validHexes.random());
				}
			});
		});
		
		this.addLog(`Random start completed! Player 1's turn.`);
	},
	/**
	 * Start "Romance of the Dice Kingdoms" mode - all players are AI and play automatically
	 */
	startRomanceMode() {
		this.addLog("👑 Romance of the Dice Kingdoms - All players are AI!");

		// Set all players as AI
		this.players.forEach(p => p.isAI = true);

		// Roll initial dice for all players
		this.players.forEach((p, i) => this.rollInitialDice(i));

		// Deploy all dice randomly for all players
		this.players.forEach((player, playerIdx) => {
			player.dice.forEach((dice, diceIdx) => {
				const validHexes = this.calcValidDeploymentHexes(playerIdx);
				if (validHexes.length > 0) {
					this.selectedDieToDeploy = diceIdx;
					this.deployUnit(validHexes.random());
				}
			});
		});

		this.addLog(`👑 All kingdoms ready for battle! Watching AI play...`);

		// Start autoplay
		this.autoPlay();
	},
	autoPlay() {
		setTimeout(() => this.performAITurn(), 1e3);
	},

	/* --- GAMEPLAY --- */
	handleHexClick(hexId) {
		if (this.phase === 'SETUP_DEPLOY') {
			this.deployUnit(hexId);
			return;
		}

		if (this.phase !== 'PLAYER_TURN') return;

		const clickedHex = this.getHex(hexId);
		const unitOnClickedHex = this.getUnitOnHex(hexId);

		if (this.actionMode) { // If in an action mode like MOVE or ATTACK
			this.completeAction(hexId);
			if (this.actionMode !== 'SKIRMISH_POST_MOVE') {
				this.deselectUnit();
			}
			if (unitOnClickedHex ) {
				if (unitOnClickedHex.playerId === this.currentPlayerIndex) this.selectUnit(hexId);
				this.hoverHex(hexId);
			}
		} else { // Normal selection mode
			if (unitOnClickedHex) {
				if (unitOnClickedHex.playerId === this.currentPlayerIndex) this.selectUnit(hexId);
				this.hoverHex(hexId);
			} else if (this.selectedUnitHexId !== null) { // Clicked on empty or enemy hex while a unit is selected (implies move/attack intent)
				// This could be simplified to require explicit action button click
				// For now, deselect if not a valid action target
				this.deselectUnit();
			} else {
				this.deselectUnit();
			}
		}
	},
	selectUnit(hexId, state) {
		if (state) return;
		const unit = this.getUnitOnHex(hexId);

		if (!unit || unit.playerId !== this.currentPlayerIndex || unit.hasMovedOrAttackedThisTurn) {
			if(unit && unit.hasMovedOrAttackedThisTurn) this.addLog("This unit has already acted this turn.");
			this.deselectUnit();
			return;
		}
		this.selectedUnitHexId = hexId;
		this.validMoves = []; // Will be calculated if 'MOVE' action is chosen
		this.validTargets = []; // Will be calculated if attack action is chosen
		this.validMerges = this.options.includes('m') ? this.calcValidMoves(this.selectedUnitHexId, 'MERGE') : [];
		this.dangerHexes = this.calcDangerHex(this.currentPlayerIndex, state);

		// this.addLog(`Selected Unit: Dice ${unit.value} [${unit.range}] at (${this.getHex(hexId).q}, ${this.getHex(hexId).r})`);

		if (unit.value == 2) {
			this.validTargets = this.calcValidRangedTargets(this.selectedUnitHexId);
		}

		if (unit.value == 6) {
			this.validTargets = this.calcValidSpecialAttackTargets(this.selectedUnitHexId);
		}

		if (this.canPerformAction(this.selectedUnitHexId, 'MOVE')) this.initiateAction('MOVE');
	},
	/**
	 * Initiate Oracle spell selection UI prompt.
	 * Asks player to choose between Shield, Swap, Skirmish spells, or cancel.
	 */
	initiateOracleSpellSelection() {
		this.actionMode = 'ORACLE_SPELL_SELECT';
		// this.addLog("Oracle Spell - Choose a spell from the control panel.");
	},
	selectOracleSpell(spell) {
		this.oracleSelectedSpell = spell;
		this.actionMode = 'SPELLCAST';
		// this.addLog(`Oracle will cast ${spell}. Select a friendly unit within Range 2.`);
	},
	deselectUnit(state) {
		state = state || this;

		state.hovering = {}
		state.selectedUnitHexId = null;
		state.validMoves = [];
		state.validTargets = [];
		state.validMerges = [];
		state.actionMode = null;
		state.dangerHexes = {};
	},
	initiateAction(actionType) {
		if (!this.selectedUnitHexId) return;
		const unit = this.getUnitOnHex(this.selectedUnitHexId);
		if (!unit || unit.hasMovedOrAttackedThisTurn) {
			this.addLog("Unit cannot perform this action or has already acted.");
			return;
		}

		this.actionMode = actionType;
		this.validMoves = [];
		// this.validMerges = [];
		// this.validTargets = [];

		if (actionType === 'MOVE' || actionType === 'MERGE') {
			this.validMoves = this.calcValidMoves(this.selectedUnitHexId, actionType === 'MERGE');
			if (this.validMoves.length === 0) {
				this.addLog("No valid moves for this unit.");
				// this.cancelAction();
			}
		} else if (actionType === 'RANGED_ATTACK') {
			this.validTargets = this.calcValidRangedTargets(this.selectedUnitHexId);
			 if (this.validTargets.length === 0) {
				this.addLog("No valid targets for Ranged Attack.");
				// this.cancelAction();
			}
		} else if (actionType === 'SPECIAL_ATTACK') {
			this.validTargets = this.calcValidSpecialAttackTargets(this.selectedUnitHexId);
			 if (this.validTargets.length === 0) {
				this.addLog("No valid targets for Special Attack.");
				// this.cancelAction();
			} else {
				// Oracle: Prompt for spell selection when SPECIAL_ATTACK action is initiated
				const unit = this.getUnitOnHex(this.selectedUnitHexId);
				if (unit && unit.value === 6) {
					this.initiateOracleSpellSelection();
				}
			}
		} else if (actionType === 'BRAVE_CHARGE') {
			this.validMoves = this.calcValidBraveChargeMoves(this.selectedUnitHexId);
			 if (this.validMoves.length === 0) {
				this.addLog("No valid targets for Brave Charge.");
				// this.cancelAction();
			}
		} else if (actionType === 'ORACLE_SACRIFICE') {
			// Show adjacent enemy Oracles as valid targets
			this.validTargets = this.calcValidSacrificeTargets(this.selectedUnitHexId);
			if (this.validTargets.length === 0) {
				this.addLog("No valid targets for Oracle Sacrifice.");
			}
		}
	},
	actionModeMessage() {
		if (this.actionMode === 'MOVE') return "Select a destination hex for your unit.";
		if (this.actionMode === 'RANGED_ATTACK') return "Select an ranged enemy unit to target.";
		if (this.actionMode === 'SPECIAL_ATTACK') return "Select an adjacent enemy unit to target.";
		if (this.actionMode === 'MERGE') return "Select a friendly unit to merge with.";
		if (this.actionMode === 'SPELLCAST') return "Select a friendly unit to cast spell on.";
		if (this.actionMode === 'ORACLE_SACRIFICE') return "Select an adjacent enemy Oracle to eliminate (both Oracles will be removed).";
		if (this.actionMode === 'SKIRMISH_POST_MOVE') return "Skirmish success! Select an adjacent hex to move to (or stay put).";
		return "";
	},
	cancelAction() {
		this.actionMode = null;
		this.validMoves = [];
		this.validMerges = [];
		this.validTargets = [];

		if (this.debug?.autoPlay) this.endTurn();
	},
	completeAction(targetHexId) {
		if (!this.actionMode) return;

		const unit = this.getUnitOnHex(this.selectedUnitHexId);
		const target = this.getUnitOnHex(targetHexId);
		const action = this.actionMode;
		this.actionMode = null; // Clear action mode first

		if (action == 'BRAVE_CHARGE_TARGET') {
			this.performBraveCharge(this.selectedUnitHexId, targetHexId);
			this.endTurn();
			return;
		}

		// Oracle Sacrifice
		if (action === 'ORACLE_SACRIFICE' && this.validTargets.includes(targetHexId)) {
			this.performOracleSacrifice(this.selectedUnitHexId, targetHexId);
			this.endTurn();
			return;
		}

		if (this.selectedUnitHexId == targetHexId && action !== 'SKIRMISH_POST_MOVE') {
			this.deselectUnit();
			return;
		}

		// Oracle spell casting
		if (action === 'SPELLCAST' && unit.value === 6 && this.validTargets.includes(targetHexId)) {
			if (this.oracleSelectedSpell && target && target.playerId === unit.playerId) {
				this.performSpellCast(this.selectedUnitHexId, targetHexId, this.oracleSelectedSpell);
				this.oracleSelectedSpell = null;
				this.endTurn();
				return;
			}
		}

		if (unit.value == 2 && this.validTargets.includes(targetHexId)) {
			this.performRangedAttack(this.selectedUnitHexId, targetHexId);
			this.endTurn();
			return;
		} else if (unit.value == 6 && this.validTargets.includes(targetHexId)) {
			// Legacy: only if no spell was selected (Oracle can still move if spell cancelled)
			if (!this.oracleSelectedSpell) {
				// Oracle movement is handled by validMoves below
			} else {
				this.addLog("Invalid spell target.");
				this.oracleSelectedSpell = null;
				return;
			}
		}

		if (this.validMoves.includes(targetHexId)) {
			if (unit.playerId == target?.playerId) {
				this.performMerge(this.selectedUnitHexId, targetHexId);
				// New merge unit could take action if sum > 6
			} else {
				if (unit.value === 2 && target && target.playerId !== unit.playerId) {
					this.addLog("Archers cannot perform melee attacks. Move to an empty hex only.");
					return;
				}
				
				this.performMove(this.selectedUnitHexId, targetHexId);

				if (action == 'BRAVE_CHARGE') {
					this.actionMode = 'BRAVE_CHARGE_TARGET';
					this.selectedUnitHexId = targetHexId;
					this.validTargets = this.calcValidSpecialAttackTargets(this.selectedUnitHexId);
					this.addLog("Now choose a target of Dice 1 Brave Change");
				} else if (this.actionMode === 'SKIRMISH_POST_MOVE') {
					// Don't end turn yet! Let user pick reposition hex.
				} else {
					this.endTurn();
				}
			}

			return;
		} else if (action === 'SKIRMISH_POST_MOVE' && this.validMoves.includes(targetHexId)) {
			this.performSkirmishPostMove(this.selectedUnitHexId, targetHexId);
			this.endTurn();
			return;
		} else if (this.validMerges.includes(targetHexId)){
			this.endTurn();
			return;
		}

		// Deselect unit after action attempt, regardless of success, unless it's a failed move
		// If move failed, unit stays selected. If combat failed, unit stays.
		// For simplicity now, deselect. More complex logic can keep it selected.
		// if (this.getUnitOnHex(this.selectedUnitHexId)?.hasMovedOrAttackedThisTurn) {
		//      this.deselectUnit();
		// }
	},
	canPerformAction(unitHexId, actionType, state) {
		const unit = this.getUnitOnHex(unitHexId, state);
		if (!unit || unit.hasMovedOrAttackedThisTurn) return false;

		const options = (state || this).options || ''; //'rm';

		switch(actionType) {
			case 'MOVE': return true;
			case 'REROLL': return options.includes('r') && !unit.isRerolled && !unit.isGuarding;
			case 'GUARD': return true;
			case 'RANGED_ATTACK': return unit.value === 2;
			case 'SPECIAL_ATTACK': return unit.value === 6;
			case 'BRAVE_CHARGE': return unit.value === 1;
			case 'MERGE': return options.includes('m');
			case 'ORACLE_SACRIFICE':
				// Oracle can sacrifice if it's the last unit for its player and has adjacent enemy Oracles
				if (unit.value !== 6) return false;
				return this.isOracleLastUnitAndCanSacrifice(unitHexId, state);
			default: return false;
		}
	},
	performAction(actionType, unitHexId) {
		const unit = this.getUnitOnHex(unitHexId);
		if (!unit || unit.hasMovedOrAttackedThisTurn) {
			this.addLog("Unit cannot act or has already acted.");
			return;
		}

		switch(actionType) {
			case 'REROLL':
				this.performUnitReroll(unitHexId);
				break;
			case 'GUARD':
				this.performGuard(unitHexId);
				break;
			// Other actions are initiated via `initiateAction`
		}
		// `initiateAction` handles MOVE, RANGED_ATTACK, SPECIAL_ATTACK, MERGE

		this.endTurn();
	},

	/* --- ACTIONS --- */
	move(unit, fromHex, toHex, state) {
		if (!unit) return;

		if (fromHex) {
			unit.lastHexId = fromHex.id; // Store last position
			fromHex.unit = null;
			fromHex.unitId = null;
			this.trail.fromHex = state ? null : fromHex;
		}

		if (toHex) {
			toHex.unit = unit;
			toHex.unitId = unit.id;
			unit.hexId = toHex.id;
			this.trail.toHex = state ? null : toHex;
		}

		if (state) return;

		this.trail.unit = unit;

		this.trail.path = [];

		if (fromHex && toHex) {
			const dist = this.axialDistance(fromHex.q, fromHex.r, toHex.q, toHex.r);
			this.trail.dist = dist;
			// (unit.playerId==0) && console.log('trail.dist', dist, fromHex.q, fromHex.r, toHex.q, toHex.r);
			if (false && dist > 1) {
				const stepQ = (toHex.q - fromHex.q) / dist;
				const stepR = (toHex.r - fromHex.r) / dist;
				// (unit.playerId==0) && console.log('trail.step', stepQ, stepR);

				// Start checking from 1 hex away from attacker up to 1 hex away from target
				for (let i = 0; i < dist; i++) {
					let checkQ = fromHex.q + stepQ * i;
					let checkR = fromHex.r + stepR * i;

					checkQ = (checkQ > 0.5) ? Math.ceil(checkQ) : Math.floor(checkQ);
					checkR = (checkR > 0.5) ? Math.ceil(checkR) : Math.floor(checkR);

					// const checkQ = Math.floor(fromHex.q + stepQ * i);
					// const checkR = Math.floor(fromHex.r + stepR * i);
					const checkHex = this.getHexByQR(checkQ, checkR);

					// (unit.playerId==0) && console.log('trail.checkHex', checkQ, checkR, fromHex.q + stepQ * i, fromHex.r + stepR * i);

					this.trail.path.push(checkHex.id)
				}
			}
		}

		if (this.trailAttack?.unit && (this.trailAttack.unit != fromHex.unit)) {
			this.trailAttack = {};
		}
	},
	performMove(unitHexId, targetHexId, state) {
		if (unitHexId == targetHexId) {
			this.addLog("Move failed: Same hex.", state);
			return;
		}

		const attackerUnit = this.getUnitOnHex(unitHexId, state);
		const defenderUnit = this.getUnitOnHex(targetHexId, state);
		const attackerHex = this.getHex(unitHexId, state);
		const defenderHex = this.getHex(targetHexId, state);

		if (!attackerUnit || !attackerHex || !defenderHex) {
			this.addLog("Move failed: Invalid unit or hex.", state);
			this.deselectUnit(state); // Deselect if something is wrong
			return;
		}

		// this.addLog(`P${attackerUnit.playerId + 1} attempts to move Dice ${attackerUnit.value} from (${attackerHex.q},${attackerHex.r}) to (${defenderHex.q},${defenderHex.r}).`, state);
		attackerUnit.isGuarding = Math.max(attackerUnit.isGuarding - 1, 0);

		if (defenderUnit) { // Moving into an enemy occupied hex
			if (defenderUnit.playerId === attackerUnit.playerId) {
				this.addLog("Cannot move into a hex occupied by a friendly unit (use Merge action).", state);
				// Do not deselect, allow player to choose another action or target
				return;
			}
			// Combat occurs
			this.handleCombat(unitHexId, targetHexId, 'MELEE', state);
		} else { // Moving to an empty hex
			this.addLog([
				`P${attackerUnit.playerId+1} D${attackerUnit.value} moved `,
				`[${attackerHex.id}](${attackerHex.q},${attackerHex.r},${attackerHex.s})`,
				`->`,
				`[${defenderHex.id}](${defenderHex.q},${defenderHex.r},${defenderHex.s}).`
			].join(''), state);
			this.move(attackerUnit, attackerHex, defenderHex, state);
			// attackerHex.unit = null;
			// attackerHex.unitId = null;
			// defenderHex.unit = attackerUnit;
			// defenderHex.unitId = attackerUnit.id;
			// attackerUnit.hexId = targetHexId;

			attackerUnit.hasMovedOrAttackedThisTurn = true;
			attackerUnit.actionsTakenThisTurn++;
			this.deselectUnit(state); // Action complete
		}
		this.checkWinConditions(state);
	},
	/**
	 * Finalize the post-skirmish move to an adjacent hex.
	 * @param {number} unitHexId - Current hex ID of the attacker
	 * @param {number} targetHexId - Destination hex ID
	 */
	performSkirmishPostMove(unitHexId, targetHexId) {
		const unit = this.getUnitOnHex(unitHexId);
		const fromHex = this.getHex(unitHexId);
		const toHex = this.getHex(targetHexId);

		if (!unit || !fromHex || !toHex) return;

		if (unitHexId !== targetHexId) {
			this.addLog(`P${unit.playerId + 1} D${unit.value} skirmish reposition: (${fromHex.q},${fromHex.r}) -> (${toHex.q},${toHex.r}).`);
			this.move(unit, fromHex, toHex);
		} else {
			this.addLog(`P${unit.playerId + 1} D${unit.value} skirmish reposition: stayed at (${fromHex.q},${fromHex.r}).`);
		}

		unit.hasMovedOrAttackedThisTurn = true;
		unit.actionsTakenThisTurn++;
		this.deselectUnit();
	},
	performUnitReroll(unitHexId, state) {
		const targetHex = this.getHex(unitHexId, state);
		const unit = this.getUnitOnHex(unitHexId, state);
		if (!unit || unit.hasMovedOrAttackedThisTurn) return;

		const oldVal = unit.value;
		const newRoll = Math.floor(random() * 6) + 1;
		unit.value = newRoll;
		Object.assign(unit, UNIT_STATS[newRoll]); // Update stats
		unit.currentArmor = UNIT_STATS[newRoll].armor;
		// unit.armorReduction = 0; // Reset armor reduction
		unit.isGuarding = 0; // Rerolling removes guard
		unit.isRerolled = true; // Penalty: 0 effective armor until next turn starts
		unit.skirmishBuff = 0;

		unit.hasMovedOrAttackedThisTurn = true;
		unit.actionsTakenThisTurn++;
		this.addLog(`P${unit.playerId + 1} D${oldVal} rerolled D${newRoll} (${targetHex.q},${targetHex.r}). Penalty: 0 Effective Armor until next turn.`, state);
		this.deselectUnit(state);
		this.checkWinConditions(state);
	},
	performGuard(unitHexId, state) {
		const targetHex = this.getHex(unitHexId, state);
		const unit = this.getUnitOnHex(unitHexId, state);
		if (!unit || unit.hasMovedOrAttackedThisTurn) return;

		if (unit.isGuarding < 1) unit.isGuarding = 1;

		unit.skirmishBuff = 0;

		// Actual armor buff is applied during combat calculation
		unit.hasMovedOrAttackedThisTurn = true;
		unit.actionsTakenThisTurn++;
		this.addLog(`P${unit.playerId + 1} D${unit.value} guarded [${unitHexId}](${targetHex.q},${targetHex.r},${targetHex.s}).`, state);
		this.deselectUnit(state);
		this.checkWinConditions(state); // Though guard alone won't win
	},
	performMerge(mergingUnitHexId, targetUnitHexId, isAI, state) {
		const mergingUnit = this.getUnitOnHex(mergingUnitHexId, state);
		const targetUnit = this.getUnitOnHex(targetUnitHexId, state);
		const mergingHex = this.getHex(mergingUnitHexId, state);
		const targetHex = this.getHex(targetUnitHexId, state);

		if (!mergingUnit || !targetUnit || mergingUnit.playerId !== targetUnit.playerId || mergingUnit.id === targetUnit.id) {
			this.addLog("Merge failed: Invalid units or target.", state);
			this.deselectUnit(state);
			return;
		}

		if (!isAI && !confirm(`Merge Dice ${mergingUnit.value} [${mergingHex.id}] & Dice ${targetUnit.value} [${targetHex.id}] into new unit?`) == true) {
			this.deselectUnit(state);
			return;
		}

		this.addLog(`P${mergingUnit.playerId + 1} D${mergingUnit.value} merged D${targetUnit.value} (${mergingHex.q},${mergingHex.r})->(${targetHex.q},${targetHex.r}).`, state);

		const sum = mergingUnit.value + targetUnit.value;
		let newDieValue;
		let newUnitCanAct = false;

		if (sum <= 6) {
			newDieValue = sum;
		} else {
			// Player chooses. For prototype, let's pick a default (e.g., 6) or prompt.
			// Simple: always pick 6 for >6 sum. A real game would prompt.
			newDieValue = isAI
				? [3, 4, 5].random()
				: (parseInt(prompt(`Sum is ${sum} (>6). Choose new dice value (1-6):`, "6")) || 6);

			if (newDieValue < 1 || newDieValue > 6) newDieValue = 6;

			// "And if the Target Unit did not take action last turn, the new unit is may immediately perform one action"
			// "last turn" here means "this turn before merging"
			if (targetUnit.actionsTakenThisTurn === 0) {
				newUnitCanAct = true;
			}
		}

		// Remove original units from player's dice array
		// This is tricky because indices shift. Find by ID.
		const p = (state || this).players[mergingUnit.playerId];

		// const mergingUnitArrayIndex = p.dice.findIndex(d => d.id === mergingUnit.id);
		// if (mergingUnitArrayIndex !== -1) p.dice.splice(mergingUnitArrayIndex, 1);

		// const targetUnitArrayIndex = p.dice.findIndex(d => d.id === targetUnit.id);
		// if (targetUnitArrayIndex !== -1) p.dice.splice(targetUnitArrayIndex, 1);

		p.dice.find(d => d.id === mergingUnit.id).isDeath = true;
		p.dice.find(d => d.id === targetUnit.id).isDeath = true

		// Create new unit ( reusing one of the slots, or pushing new. Let's reuse targetUnit's slot in array by re-finding or assign new ID)
		// For simplicity, let's add a new die to the player's list. This might mess up indexing if not careful.
		// A better way: modify targetUnit in place, and remove mergingUnit.
		// Best way for this model: Create totally new die, assign new unique ID
		const newDieOriginalIndex = p.dice.length; // New effective index
		const newUnit = {
			id: `${p.id}_${newDieOriginalIndex}`, // Unique enough for prototype
			originalIndex: newDieOriginalIndex,
			playerId: p.id,
			value: newDieValue,
			...UNIT_STATS[newDieValue],
			currentArmor: UNIT_STATS[newDieValue].armor,
			armorReduction: 0,
			isDeployed: true,
			isDeath: false,
			hexId: targetHex.id,
			hasMovedOrAttackedThisTurn: !newUnitCanAct, // If can act, it hasn't "completed" its action for the turn yet
			isGuarding: 0,
			skirmishBuff: 0,
			actionsTakenThisTurn: newUnitCanAct ? 0 : 1, // If cannot act, it counts as action taken
		};
		p.dice.push(newUnit);

		// Update hexes
		mergingHex.unitId = null;
		mergingHex.unit = null;
		targetHex.unitId = newUnit.id;
		targetHex.unit = newUnit;

		this.addLog(`Merged into a new Dice ${newUnit.value}. ${newUnitCanAct ? "It may act this turn." : "It cannot act further this turn."}`, state);

		this.deselectUnit(state); // Deselect old unit
		if (newUnitCanAct) {
			this.selectUnit(newUnit.hexId, state); // Select the new unit so player can act with it
			this.addLog(`New Dice ${newUnit.value} selected. Choose an action.`, state);
			// if (isAI) this.performAITurn();
		} else {
			this.endTurn(state);
		}
		this.checkWinConditions(state);
	},
	performRangedAttack(attackerHexId, targetHexId, state) {
		// this.addLog(`Dice 5 at (${this.getHex(attackerHexId, state).q},${this.getHex(attackerHexId, state).r}) performs Ranged Attack on unit at (${this.getHex(targetHexId, state).q},${this.getHex(targetHexId, state).r}).`, state);
		this.handleCombat(attackerHexId, targetHexId, 'RANGED_ATTACK', state);
		const attackerUnit = this.getUnitOnHex(attackerHexId, state); // Attacker stays on its hex for ranged
		if (attackerUnit) {
			attackerUnit.hasMovedOrAttackedThisTurn = true;
			attackerUnit.actionsTakenThisTurn++;
		}
		this.deselectUnit(state);
		this.checkWinConditions(state);
	},
	performComandConquer(attackerHexId, targetHexId, state) {
		// this.addLog(`Dice 6 at (${this.getHex(attackerHexId, state).q},${this.getHex(attackerHexId, state).r}) performs Special Attack on unit at (${this.getHex(targetHexId, state).q},${this.getHex(targetHexId, state).r}).`, state);
		this.handleCombat(attackerHexId, targetHexId, 'COMMAND_CONQUER', state);
		const attackerUnit = this.getUnitOnHex(attackerHexId, state); // Attacker might have moved if Dice 6 wins
		if (attackerUnit && attackerUnit.hexId === attackerHexId) { // if it didn't move (attack failed)
			 attackerUnit.hasMovedOrAttackedThisTurn = true;
			 attackerUnit.actionsTakenThisTurn++;
		} else if (this.getUnitOnHex(targetHexId, state)?.id === attackerUnit?.id) { // if it moved (attack succeeded)
			 attackerUnit.hasMovedOrAttackedThisTurn = true;
			 attackerUnit.actionsTakenThisTurn++;
		}
		this.deselectUnit(state);
		this.checkWinConditions(state);
	},
	/**
	 * Perform Oracle spell casting action.
	 * Routes to specific spell functions based on the spellType parameter.
	 * @param {number} oracleHexId - Hex ID of the Oracle unit
	 * @param {number} targetHexId - Hex ID of the target friendly unit
	 * @param {string} spellType - 'SHIELD', 'SWAP', or 'SKIRMISH'
	 * @param {object} state - Optional game state for simulation
	 */
	performSpellCast(oracleHexId, targetHexId, spellType, state) {
		const oracleUnit = this.getUnitOnHex(oracleHexId, state);
		const targetUnit = this.getUnitOnHex(targetHexId, state);
		const oracleHex = this.getHex(oracleHexId, state);
		const targetHex = this.getHex(targetHexId, state);

		if (!oracleUnit || oracleUnit.value !== 6) {
			this.addLog("Spell cast failed: Invalid Oracle unit.", state);
			this.deselectUnit(state);
			return;
		}

		if (!targetUnit || targetUnit.playerId !== oracleUnit.playerId) {
			this.addLog("Spell cast failed: Must target a friendly unit.", state);
			this.deselectUnit(state);
			return;
		}

		// Check range (Range 2 for Oracle spells)
		const distance = this.axialDistance(oracleHex.q, oracleHex.r, targetHex.q, targetHex.r);
		if (distance > oracleUnit.range) {
			this.addLog("Spell cast failed: Target out of range.", state);
			this.deselectUnit(state);
			return;
		}

		// Skip Check line of sight
		if (false && !this.hasLineOfSight(oracleHex, targetHex, oracleHexId, state)) {
			this.addLog("Spell cast failed: Line of sight blocked.", state);
			this.deselectUnit(state);
			return;
		}

		switch (spellType) {
			case 'SHIELD':
				this.performShieldSpell(oracleHexId, targetHexId, state);
				break;
			case 'SWAP':
				this.performSwapSpell(oracleHexId, targetHexId, state);
				break;
			case 'SKIRMISH':
				this.performSkirmishSpell(oracleHexId, targetHexId, state);
				break;
			default:
				this.addLog("Spell cast failed: Invalid spell type.", state);
				this.deselectUnit(state);
				return;
		}

		oracleUnit.hasMovedOrAttackedThisTurn = true;
		oracleUnit.actionsTakenThisTurn++;
		this.deselectUnit(state);
		this.checkWinConditions(state);
	},
	/**
	 * Check if an Oracle is the last unit for its player and can sacrifice to eliminate an adjacent enemy Oracle.
	 * @param {number} oracleHexId - Hex ID of the Oracle unit
	 * @param {object} state - Optional game state for simulation
	 * @returns {boolean} True if Oracle is last unit and has adjacent enemy Oracle
	 */
	isOracleLastUnitAndCanSacrifice(oracleHexId, state) {
		const oracleUnit = this.getUnitOnHex(oracleHexId, state);
		const oracleHex = this.getHex(oracleHexId, state);
		if (!oracleUnit || oracleUnit.value !== 6 || !oracleHex) return false;

		// Check if this Oracle is the last unit for its player
		const player = (state || this).players[oracleUnit.playerId];
		const activeUnits = player.dice.filter(d => d.isDeployed && !d.isDeath && d.value != 6);
		if (activeUnits.length) return false;

		// Check if there's an adjacent enemy Oracle
		return this.getNeighbors(oracleHex, state).some(neighborHex => {
			if (!neighborHex) return false;
			const neighborUnit = this.getUnitOnHex(neighborHex.id, state);
			return neighborUnit && neighborUnit.playerId !== oracleUnit.playerId && neighborUnit.value === 6;
		});
	},
	/**
	 * Perform Oracle Sacrifice action - Oracle sacrifices itself to remove an adjacent enemy Oracle.
	 * This prevents stalemate when both players only have Oracles remaining.
	 * @param {number} oracleHexId - Hex ID of the sacrificing Oracle
	 * @param {number} targetHexId - Hex ID of the enemy Oracle to remove
	 * @param {object} state - Optional game state for simulation
	 */
	performOracleSacrifice(oracleHexId, targetHexId, state) {
		const oracleUnit = this.getUnitOnHex(oracleHexId, state);
		const targetUnit = this.getUnitOnHex(targetHexId, state);
		const oracleHex = this.getHex(oracleHexId, state);
		const targetHex = this.getHex(targetHexId, state);

		if (!oracleUnit || oracleUnit.value !== 6 || !targetUnit || targetUnit.value !== 6) {
			this.addLog("Sacrifice failed: Invalid units.", state);
			return;
		}

		if (oracleUnit.playerId === targetUnit.playerId) {
			this.addLog("Sacrifice failed: Cannot target friendly unit.", state);
			return;
		}

		const distance = this.axialDistance(oracleHex.q, oracleHex.r, targetHex.q, targetHex.r);
		if (distance > 1) {
			this.addLog("Sacrifice failed: Target must be adjacent.", state);
			return;
		}

		// Both Oracles are removed
		oracleUnit.isDeath = true;
		targetUnit.isDeath = true;
		oracleHex.unit = null;
		oracleHex.unitId = null;
		targetHex.unit = null;
		targetHex.unitId = null;

		this.addLog(`P${oracleUnit.playerId+1} Oracle sacrificed to eliminate P${targetUnit.playerId+1} Oracle! Both Oracles removed.`, state);

		oracleUnit.hasMovedOrAttackedThisTurn = true;
		oracleUnit.actionsTakenThisTurn++;
		this.deselectUnit(state);
		this.checkWinConditions(state);
	},
	/**
	 * Shield Spell: Target unit enters Guard Mode (+1 Effective Armor).
	 * @param {number} oracleHexId - Hex ID of the Oracle unit
	 * @param {number} targetHexId - Hex ID of the target friendly unit
	 * @param {object} state - Optional game state for simulation
	 */
	performShieldSpell(oracleHexId, targetHexId, state) {
		const oracleUnit = this.getUnitOnHex(oracleHexId, state);
		const targetUnit = this.getUnitOnHex(targetHexId, state);
		const targetHex = this.getHex(targetHexId, state);
		const oracleHex = this.getHex(oracleHexId, state);

		if (!oracleUnit || !targetUnit || !targetHex || !oracleHex) return;

		targetUnit.isGuarding = 2;
		targetUnit.skirmishBuff = 0; // Shield cancels Skirmish
		this.addLog(`P${oracleUnit.playerId+1} Oracle cast Shield on P${targetUnit.playerId+1} D${targetUnit.value} (${targetHex.q},${targetHex.r}).`, state);
	},
	/**
	 * Swap Spell: Oracle and target friendly unit exchange positions.
	 * @param {number} oracleHexId - Hex ID of the Oracle unit
	 * @param {number} targetHexId - Hex ID of the target friendly unit
	 * @param {object} state - Optional game state for simulation
	 */
	performSwapSpell(oracleHexId, targetHexId, state) {
		const oracleUnit = this.getUnitOnHex(oracleHexId, state);
		const targetUnit = this.getUnitOnHex(targetHexId, state);
		const oracleHex = this.getHex(oracleHexId, state);
		const targetHex = this.getHex(targetHexId, state);

		if (!oracleUnit || !targetUnit || !oracleHex || !targetHex) return;

		// Manually swap positions to avoid the "move clears previous unit" bug
		oracleHex.unit = targetUnit;
		oracleHex.unitId = targetUnit.id;
		targetHex.unit = oracleUnit;
		targetHex.unitId = oracleUnit.id;

		oracleUnit.lastHexId = oracleHexId;
		oracleUnit.hexId = targetHexId;
		targetUnit.lastHexId = targetHexId;
		targetUnit.hexId = oracleHexId;

		if (!state) {
			this.trail.fromHex = oracleHex;
			this.trail.toHex = targetHex;
			this.trail.unit = oracleUnit;
			this.trail.path = [];
			this.trail.dist = this.axialDistance(oracleHex.q, oracleHex.r, targetHex.q, targetHex.r);
		}

		this.addLog(`P${oracleUnit.playerId+1} Oracle swapped with P${targetUnit.playerId+1} D${targetUnit.value} (${oracleHex.q},${oracleHex.r})<->(${targetHex.q},${targetHex.r}).`, state);
	},
	/**
	 * Skirmish Spell: Target unit gains Hit & Run status for its next attack.
	 * -1 Attack penalty. On success: stays in starting hex. On failure: eliminated.
	 * @param {number} oracleHexId - Hex ID of the Oracle unit
	 * @param {number} targetHexId - Hex ID of the target friendly unit
	 * @param {object} state - Optional game state for simulation
	 */
	performSkirmishSpell(oracleHexId, targetHexId, state) {
		const oracleUnit = this.getUnitOnHex(oracleHexId, state);
		const targetUnit = this.getUnitOnHex(targetHexId, state);
		const targetHex = this.getHex(targetHexId, state);
		const oracleHex = this.getHex(oracleHexId, state);

		if (!oracleUnit || !targetUnit || !targetHex || !oracleHex) return;

		targetUnit.skirmishBuff = 2; // Lasts until end of next activation cycle
		targetUnit.isGuarding = 0; // Skirmish cancels Shield
		this.addLog(`P${oracleUnit.playerId+1} Oracle cast Skirmish on P${targetUnit.playerId+1} D${targetUnit.value} (${targetHex.q},${targetHex.r}). Hit & Run (Atk-1) enabled! Fails lead to elimination.`, state);
	},
	performBraveCharge(attackerHexId, targetHexId, state) {
		const attackerUnit = this.getUnitOnHex(attackerHexId, state);
		const defenderUnit = this.getUnitOnHex(targetHexId, state);
		const attackerHex = this.getHex(attackerHexId, state);
		const defenderHex = this.getHex(targetHexId, state);

		if (!attackerUnit || !defenderUnit || !attackerHex || !defenderHex) {
			this.addLog("Brave Charge failed: Invalid units or hexes.", state);
			this.deselectUnit(state);
			return;
		}

		if (attackerUnit.value !== 1) {
			this.addLog("Brave Charge failed: Only Dice 1 units can perform this action.", state);
			this.deselectUnit(state);
			return;
		}

		const distance = this.axialDistance(attackerHex.q, attackerHex.r, defenderHex.q, defenderHex.r);
		if (distance !== 1) {
			this.addLog("Brave Charge failed: Target must be adjacent.", state);
			this.deselectUnit(state);
			return;
		}

		const defenderEffectiveArmor = this.calcDefenderEffectiveArmor(targetHexId, state);
		if (defenderEffectiveArmor < 6) {
			this.addLog("Brave Charge failed: Target unit must have Effective Armor 6 or higher.", state);
			this.deselectUnit(state);
			return;
		}

		this.addLog(`P${attackerUnit.playerId+1} D1 charged P${defenderUnit.playerId+1} D${defenderUnit.value} (${attackerHex.q},${attackerHex.r})->(${defenderHex.q},${defenderHex.r}).`, state);

		// Effect: Remove the Dice 1 unit
		this.removeUnit(attackerHexId, state);
		// Effect: Reduce target enemy unit's armor by 6
		this.applyDamage(targetHexId, 6, state, true); // Apply 6 damage, handle unit removal if armor <= 0

		this.endTurn(state); // End the player's turn after the charge
	},
	performAITurn() {
		// let choice = ['Simple', 'Analyze', 'Random', 'Minimax', 'Greedy'].random();
		// this.addLog(`AI persona: ${choice}`);
		// this['performAI_' + choice]();

		// console.time('performAITurn')
		performAIByWeight(this);

		this.deselectUnit();

		// this.addLog('currentPlayerIndex' + this.currentPlayerIndex);

		// this.endTurn();
		// console.timeEnd('performAITurn')
	},

	/* --- CALCULATE --- */
	/**
	 * Calculate valid targets for ranged attack (Dice 2 Archer).
	 * Ranged attack is blocked if any enemy unit is adjacent to the attacker.
	 * Requires clear line of sight (no units blocking the path).
	 * @param {number} attackerHexId - Hex ID of the attacking unit
	 * @param {object} state - Optional game state for simulation
	 * @param {boolean} isHovering - If true, show all hexes in range (for UI preview)
	 * @returns {number[]} Array of valid target hex IDs
	 */
	calcValidRangedTargets(attackerHexId, state, isHovering) {
		const attackerUnit = this.getUnitOnHex(attackerHexId, state);
		const attackerHex = this.getHex(attackerHexId, state);
		// Assuming unit with range property > 0 is a ranged unit
		if (!attackerUnit || attackerUnit.range < 2 || !attackerHex) return [];

		let minRange = 1;
		let maxRange = attackerUnit.range;

		switch (attackerHex.terrainType) {
			case 'TOWER': minRange = 1;maxRange = 2;break;
			case 'MOUNTAIN':minRange = 1;maxRange = 3;break;
		}

		let targets = [];

		// Archer cannot ranged attack if any enemy is adjacent (engaged in melee)
		let isEnemyAdjacent = false;
		for (let neighborHex of this.getNeighbors(attackerHex, state)) {
			if (neighborHex) {
				const targetUnit = this.getUnitOnHex(neighborHex.id, state);
				if (targetUnit && targetUnit.playerId !== attackerUnit.playerId) {
					isEnemyAdjacent = true;
					break;
				}
			}
		}
		// Archer & Oracle will not be limited by adjacent enemy unit restriction when stand in Tower or Mountain
		if (isEnemyAdjacent && !(attackerHex.terrainType === 'TOWER' || attackerHex.terrainType === 'MOUNTAIN')) return [];

		(state || this).hexes.forEach(potentialTargetHex => {
			if (!potentialTargetHex || potentialTargetHex.id === attackerHexId) return;

			const targetUnit = this.getUnitOnHex(potentialTargetHex.id, state);
			if ((targetUnit && targetUnit.playerId !== attackerUnit.playerId) // Is an enemy unit
				|| isHovering
			) {
				const dist = this.axialDistance(attackerHex.q, attackerHex.r, potentialTargetHex.q, potentialTargetHex.r);

				if (dist >= minRange && dist <= maxRange) {
					// Check Line of Sight: iterate through hexes between attacker and target
					if (!this.hasLineOfSight(attackerHex, potentialTargetHex, attackerHexId, state)) {
						return; // Blocked, skip this target
					}
					targets.push(potentialTargetHex.id);
				}
			}
		});

		return targets;
	},
	/**
	 * Check if there is a clear line of sight between two hexes.
	 * Returns false if any non-dead unit blocks the path.
	 * Uses proper hex linear interpolation for axial coordinates.
	 * @param {object} fromHex - Starting hex
	 * @param {object} toHex - Target hex
	 * @param {number} attackerHexId - Attacker's hex ID (to exclude from blocking check)
	 * @param {object} state - Optional game state for simulation
	 * @returns {boolean} True if path is clear
	 */
	hasLineOfSight(fromHex, toHex, attackerHexId, state) {
		const dist = this.axialDistance(fromHex.q, fromHex.r, toHex.q, toHex.r);
		if (dist <= 1) return true; // Adjacent hexes always have LoS

		// Linear interpolation for hex coordinates
		// Check each intermediate hex (1 step away from attacker, up to dist-1)
		for (let i = 1; i < dist; i++) {
			// Calculate interpolated position
			const lerpQ = fromHex.q + (toHex.q - fromHex.q) * i / dist;
			const lerpR = fromHex.r + (toHex.r - fromHex.r) * i / dist;

			// Round to nearest hex using cube coordinate rounding
			const lerpS = -lerpQ - lerpR;
			let roundQ = Math.round(lerpQ);
			let roundR = Math.round(lerpR);
			let roundS = Math.round(lerpS);

			// Adjust rounding to ensure q + r + s = 0
			const qDiff = Math.abs(roundQ - lerpQ);
			const rDiff = Math.abs(roundR - lerpR);
			const sDiff = Math.abs(roundS - lerpS);

			if (roundQ + roundR + roundS !== 0) {
				if (qDiff > rDiff && qDiff > sDiff) {
					roundQ = -roundR - roundS;
				} else if (rDiff > sDiff) {
					roundR = -roundQ - roundS;
				} else {
					roundS = -roundQ - roundR;
				}
			}

			const intermediateHex = this.getHexByQR(roundQ, roundR, state);
			if (!intermediateHex || intermediateHex.id === attackerHexId || intermediateHex.id === toHex.id) continue;

			switch (intermediateHex.terrainType) {
				case 'FOREST':
				case 'TOWER':
				case 'MOUNTAIN':
					return false; // Blocked by terrain
				case 'LAKE':
					// LAKE remains transparent, do nothing here
					break;
			}

			const intermediateUnit = this.getUnitOnHex(intermediateHex.id, state);
			if (intermediateUnit && !intermediateUnit.isDeath) {
				return false; // Blocked by unit
			}
		}
		return true; // Path is clear
	},
	/**
	 * Check if a unit has any enemy units adjacent to it.
	 * @param {number} unitHexId - Hex ID of the unit to check
	 * @param {object} state - Optional game state for simulation
	 * @returns {boolean} True if enemy is adjacent
	 */
	isUnitEngaged(unitHexId, state) {
		const unit = this.getUnitOnHex(unitHexId, state);
		const unitHex = this.getHex(unitHexId, state);
		if (!unit || !unitHex) return false;

		return this.getNeighbors(unitHex, state).some(neighborHex => {
			if (!neighborHex) return false;
			const neighborUnit = this.getUnitOnHex(neighborHex.id, state);
			return neighborUnit && neighborUnit.playerId !== unit.playerId;
		});
	},
	/**
	 * Calculate valid targets for special attack (Dice 6 Legate Command & Conquer).
	 * Only adjacent enemy units are valid targets.
	 * For Oracle (Dice 6): targets friendly units within Range 2 for spell casting.
	 * @param {number} attackerHexId - Hex ID of the attacking unit
	 * @param {object} state - Optional game state for simulation
	 * @param {boolean} isHovering - If true, show all valid targets (for UI preview)
	 * @returns {number[]} Array of valid target hex IDs
	 */
	calcValidSpecialAttackTargets(attackerHexId, state, isHovering) {
		const attackerUnit = this.getUnitOnHex(attackerHexId, state);
		const attackerHex = this.getHex(attackerHexId, state);

		if (!attackerUnit || ![6].includes(attackerUnit.value) || !attackerHex) return [];
		// DEPRECATED: if (!attackerUnit || ![1, 6].includes(attackerUnit.value) || !attackerHex) return [];

		// Oracle (Dice 6): Spell targeting - target friendly units within Range 2
		if (attackerUnit.value === 6) {
			let targets = [];
			let range = attackerUnit.range; // Range 2 for Oracle
			let minRange = 1;

			// Engaged Spell Disablement: Oracle cannot cast spells when enemy is adjacent
			const isEngaged = this.isUnitEngaged(attackerHexId, state);
			if (isEngaged && !isHovering && !(attackerHex.terrainType === 'TOWER' || attackerHex.terrainType === 'MOUNTAIN')) {
				return []; // Cannot cast spells while engaged unless on Tower or Mountain
			}

			(state || this).hexes.forEach(potentialTargetHex => {
				if (!potentialTargetHex || potentialTargetHex.id === attackerHexId) return;

				const dist = this.axialDistance(attackerHex.q, attackerHex.r, potentialTargetHex.q, potentialTargetHex.r);
				if (dist < minRange || dist > range) return;

				// Skip Check Line of Sight for spell
				// if (!this.hasLineOfSight(attackerHex, potentialTargetHex, attackerHexId, state)) return;

				const targetUnit = this.getUnitOnHex(potentialTargetHex.id, state);

				// Oracle targets friendly units (for spells)
				if (targetUnit && targetUnit.playerId === attackerUnit.playerId) {
					targets.push(potentialTargetHex.id);
				} else if (isHovering && dist <= range) {
					// For hover preview, show all hexes in range
					targets.push(potentialTargetHex.id);
				}
			});

			return targets;
		}

		// Legacy behavior for other Dice 6 units (if any)
		let targets = [];
		this.getNeighbors(attackerHex, state).forEach(neighborHex => {
			if (neighborHex) {
				if (isHovering) {
					targets.push(neighborHex.id);
					return;
				}

				const targetUnit = this.getUnitOnHex(neighborHex.id, state);
				if (targetUnit && targetUnit.playerId !== attackerUnit.playerId) {
					targets.push(neighborHex.id);
				}
			}
		});
		return targets;
	},
	/**
	 * Calculate valid targets for Oracle Sacrifice action.
	 * Shows adjacent enemy Oracles that can be eliminated by sacrifice.
	 * @param {number} oracleHexId - Hex ID of the Oracle unit
	 * @param {object} state - Optional game state for simulation
	 * @returns {number[]} Array of valid target hex IDs
	 */
	calcValidSacrificeTargets(oracleHexId, state) {
		const oracleUnit = this.getUnitOnHex(oracleHexId, state);
		const oracleHex = this.getHex(oracleHexId, state);

		if (!oracleUnit || oracleUnit.value !== 6 || !oracleHex) return [];

		let targets = [];
		this.getNeighbors(oracleHex, state).forEach(neighborHex => {
			if (!neighborHex) return;

			const targetUnit = this.getUnitOnHex(neighborHex.id, state);
			if (targetUnit && targetUnit.playerId !== oracleUnit.playerId && targetUnit.value === 6) {
				targets.push(neighborHex.id);
			}
		});

		return targets;
	},
	/**
	 * Calculate valid moves for a unit.
	 * Movement patterns: | (primary axis), L (knight-like), X (diagonal), + (complex), * (any direction), 0 (stationary).
	 * @param {number} unitHexId - Hex ID of the unit to move
	 * @param {boolean} isForMerging - If true, calculate moves for merging with friendly units
	 * @param {object} state - Optional game state for simulation
	 * @returns {number[]} Array of valid destination hex IDs
	 */
	calcValidMoves(unitHexId, isForMerging = false, state) {
		const unit = this.getUnitOnHex(unitHexId, state);
		const startHex = this.getHex(unitHexId, state);
		if (!unit || !startHex) return [];

		let possibleMoves = [];
		const unitStats = UNIT_STATS[unit.value];
		const primary = PLAYER_PRIMARY_AXIS[this.players.length][unit.playerId];
		const mod3 = primary.i % 3;
		const axes_b = AXES.find(({i}) => (i != primary.i) && ((i % 3) == mod3));
		const axes_x = AXES || AXES.filter(({i}) => (i % 3) != mod3);

		switch (unitStats.movement) {
			case '|': // Dice 1 (Fencer) - primary axis forward, 1 step backward
				let fwdCost = 0;
				for (let i = 1; i <= unitStats.distance; i++) {
					const hex = this.getHexByQR(startHex.q + primary.q * i, startHex.r + primary.r * i, state);
					if (!hex) break;
					if (hex.terrainType === 'LAKE') break;
					let stepCost = 1;
					let effDist = unitStats.distance;
					if (hex.terrainType === 'MOUNTAIN') {
						stepCost = 2;
						effDist = unitStats.distance - 1;
					}
					fwdCost += stepCost;
					if (fwdCost > effDist) break;
					possibleMoves.push(hex.id);
					if (this.getUnitOnHex(hex.id, state)) break; // Blocked by unit
				}
				// 1 step backward
				const backHex = this.getHexByQR(startHex.q + axes_b.q * 1, startHex.r + axes_b.r * 1, state);
				if (backHex && backHex.terrainType !== 'LAKE') {
					const backCost = backHex.terrainType === 'MOUNTAIN' ? 2 : 1;
					const backEffDist = backHex.terrainType === 'MOUNTAIN' ? unitStats.distance - 1 : unitStats.distance;
					if (backCost <= backEffDist) possibleMoves.push(backHex.id);
				}
				break;
			case 'X': // Dice 4 (Knight) - diagonal axes only
				for (let axis of axes_x) {
					let axisCost = 0;
					for (let i = 1; i <= unitStats.distance; i++) {
						const hex = this.getHexByQR(startHex.q + axis.q * i, startHex.r + axis.r * i, state);
						if (!hex) break;
						if (hex.terrainType === 'LAKE') break;
						let stepCost = 1;
						let effDist = unitStats.distance;
						if (hex.terrainType === 'MOUNTAIN') {
							stepCost = 2;
							effDist = unitStats.distance - 1;
						}
						axisCost += stepCost;
						if (axisCost > effDist) break;
						possibleMoves.push(hex.id);
						if (this.getUnitOnHex(hex.id, state)) break; // Blocked by unit
					}
				}
				break;
			case 'L': // Dice 3 (Hussar) - L-shaped jumps
				const dValidsLShape = [
					[-1, -2], [-2, -1],
					[-3, 1], [-3, 2],
					[-2, 3], [-1, 3],
					[1, 2], [2, 1],
					[3, -1], [3, -2],
					[2, -3], [1, -3],
				];
				for (let valid of dValidsLShape) {
					const hex = this.getHexByQR(startHex.q + valid[0], startHex.r + valid[1], state);
					if (hex && hex.terrainType !== 'LAKE') possibleMoves.push(hex.id);
				}
				break;
			case '+': // Dice 4 variant - primary + adjacent axes
				this.getNeighbors(startHex, state).forEach(neighbor => {
					if (neighbor && neighbor.terrainType !== 'LAKE') possibleMoves.push(neighbor?.id);
				});
				// Straight lines should check for blocking
				let pCost = 0;
				for (let i = 1; i <= 2; i++) {
					const hex = this.getHexByQR(startHex.q + primary.q * i, startHex.r + primary.r * i, state);
					if (!hex) break;
					if (hex.terrainType === 'LAKE') break;
					let stepCost = 1;
					let effDist = 2;
					if (hex.terrainType === 'MOUNTAIN') {
						stepCost = 2;
						effDist = 1;
					}
					pCost += stepCost;
					if (pCost > effDist) break;
					if (i > 1) possibleMoves.push(hex.id);
					if (this.getUnitOnHex(hex.id, state)) break;
				}
				let bCost = 0;
				for (let i = 1; i <= 2; i++) {
					const hex = this.getHexByQR(startHex.q + axes_b.q * i, startHex.r + axes_b.r * i, state);
					if (!hex) break;
					if (hex.terrainType === 'LAKE') break;
					let stepCost = 1;
					let effDist = 2;
					if (hex.terrainType === 'MOUNTAIN') {
						stepCost = 2;
						effDist = 1;
					}
					bCost += stepCost;
					if (bCost > effDist) break;
					if (i > 1) possibleMoves.push(hex.id);
					if (this.getUnitOnHex(hex.id, state)) break;
				}
				// Diagonal-ish jumps in + pattern
				if (mod3 == 2) {
					const h1 = this.getHexByQR(startHex.q + -2, startHex.r + 1, state);
					const h2 = this.getHexByQR(startHex.q + 2, startHex.r + -1, state);
					if (h1 && h1.terrainType !== 'LAKE') possibleMoves.push(h1.id);
					if (h2 && h2.terrainType !== 'LAKE') possibleMoves.push(h2.id);
				} else if (mod3 == 1) {
					const h1 = this.getHexByQR(startHex.q + -1, startHex.r + 2, state);
					const h2 = this.getHexByQR(startHex.q + 1, startHex.r + -2, state);
					if (h1 && h1.terrainType !== 'LAKE') possibleMoves.push(h1.id);
					if (h2 && h2.terrainType !== 'LAKE') possibleMoves.push(h2.id);
				} else if (mod3 == 0) {
					const h1 = this.getHexByQR(startHex.q + -1, startHex.r + -1, state);
					const h2 = this.getHexByQR(startHex.q + 1, startHex.r + 1, state);
					if (h1 && h1.terrainType !== 'LAKE') possibleMoves.push(h1.id);
					if (h2 && h2.terrainType !== 'LAKE') possibleMoves.push(h2.id);
				}
				break;
			case '*': // Dice 2, 5 (Archer, Tanker) - BFS any direction
				this.bfsValidMoves(startHex, unit, isForMerging, state, possibleMoves);
				break;
			case '0': // Dice 6 (Legate) - stationary
				break;
		}

		possibleMoves = [...new Set(possibleMoves.filter(x => x))];
		possibleMoves = possibleMoves.filter(id => this.getHex(id, state)?.terrainType != 'LAKE')

		// Filter based on target: empty or enemy (for move), or friendly (for merge)
		return possibleMoves.filter(hexId => {
			const targetUnit = this.getUnitOnHex(hexId, state);
			if (isForMerging) {
				return targetUnit && targetUnit.playerId === unit.playerId && targetUnit.id !== unit.id;
			} else {
				return !targetUnit || targetUnit.playerId !== unit.playerId;
			}
		});
	},
	/**
	 * BFS helper for calculating valid moves in any direction (Dice 2, 5).
	 * Handles empty hexes, friendly merges, and enemy attacks.
	 * @param {object} startHex - Starting hex
	 * @param {object} unit - Unit object with playerId and range
	 * @param {boolean} isForMerging - If true, look for friendly units to merge
	 * @param {object} state - Optional game state for simulation
	 * @param {number[]} possibleMoves - Array to populate with valid move hex IDs
	 */
	bfsValidMoves(startHex, unit, isForMerging, state, possibleMoves) {
		let q = [{hex: startHex, pathCost: 0}]; // Store hex and path cost
		let visited = new Map([[startHex.id, 0]]); // Map hexId to min cost to reach it

		let maxDistance = unit.distance;

		while (q.length > 0) {
			const {hex: curr, pathCost: currentCost} = q.shift();

			this.getNeighbors(curr, state).forEach(n => {
				if (!n) return; // Skip invalid neighbors

				if (n.terrainType === 'LAKE') return; // Unit could not stand on LAKE & LAKE should block movement

				let costToEnter = 1;
				let effectiveMaxDistance = maxDistance;

				if (n.terrainType === 'MOUNTAIN') {
					if (maxDistance > 1) {
						costToEnter = 2;
						effectiveMaxDistance = maxDistance - 1;
					}
				}

				const newCost = currentCost + costToEnter;

				if (newCost > effectiveMaxDistance) return;

				// If we found a shorter path to this hex, update and re-add to queue
				if (!visited.has(n.id) || newCost < visited.get(n.id)) {
					const unitOnN = this.getUnitOnHex(n.id, state);

					if (!unitOnN || unitOnN.isDeath) {
						// Empty hex - can move here
						possibleMoves.push(n.id);
						visited.set(n.id, newCost);
						q.push({hex: n, pathCost: newCost});
					} else if (isForMerging && unitOnN.playerId === unit.playerId) {
						// Friendly unit - can merge (but can't move through)
						possibleMoves.push(n.id);
						visited.set(n.id, newCost);
						// Do NOT add to queue for further movement, units can't move *through* merged units
					} else if (!isForMerging && unitOnN.playerId !== unit.playerId) {
						// Enemy unit, melee attacker - can attack (but can't move through)
						// Archers (Dice 2) cannot perform melee attacks
						if (unit.value !== 2) {
							possibleMoves.push(n.id);
						}
						visited.set(n.id, newCost);
						// Do NOT add to queue for further movement, units can't move *through* enemy units
					}
				}
			});
		}
	},
	/**
	 * Calculate valid deployment hexes for a player during setup phase.
	 * Deployment area expands based on dicePerPlayer count:
	 * - <=6: Base hex + adjacent ring
	 * - <=9: Above + 2 special offset positions
	 * - <=14: Base + 2-ring expansion
	 * @param {number} playerId - Player ID (0 or 1)
	 * @param {object} state - Optional game state for simulation
	 * @returns {number[]} Array of valid deployment hex IDs
	 */
	calcValidDeploymentHexes(playerId, state) {
		state = state || this;
		const player = state.players[playerId];
		const baseHex = this.getHex(player.baseHexId, state);
		if (!baseHex) return [];

		const primary = PLAYER_PRIMARY_AXIS[state.players.length][playerId];
		const mod3 = primary.i % 3;

		let deploymentHexes = [baseHex];
		this.getNeighbors(baseHex, state).forEach(neighbor => deploymentHexes.push(neighbor));

		if (this.rules.dicePerPlayer <= 6) {
			// Base + adjacent only
		} else if (this.rules.dicePerPlayer <= 9) {
			// Add 2 special offset positions based on primary axis modulo
			if (mod3 == 2) {
				deploymentHexes.push(this.getHexByQR(baseHex.q + -2, baseHex.r + 1, state));
				deploymentHexes.push(this.getHexByQR(baseHex.q + 2, baseHex.r + -1, state));
			} else if (mod3 == 1) {
				deploymentHexes.push(this.getHexByQR(baseHex.q + -1, baseHex.r + 2, state));
				deploymentHexes.push(this.getHexByQR(baseHex.q + 1, baseHex.r + -2, state));
			} else if (mod3 == 0) {
				deploymentHexes.push(this.getHexByQR(baseHex.q + -1, baseHex.r + -1, state));
				deploymentHexes.push(this.getHexByQR(baseHex.q + 1, baseHex.r + 1, state));
			}
		} else if (this.rules.dicePerPlayer <= 14) {
			// Full 2-ring expansion
			this.getNeighbors(baseHex, state).forEach(neighbor => {
				this.getNeighbors(neighbor, state).forEach(neighbor => deploymentHexes.push(neighbor));
			});
		}

		// Filter out hexes that are already occupied or are LAKE
		return deploymentHexes
			.filter(x => x)
			.filter(hex => hex.terrainType !== 'LAKE')
			.filter(hex => !this.getUnitOnHex(hex.id, state)) // Ensure hex is empty
			.map(hex => hex.id);
	},
	/**
	 * Calculate effective armor for a defender including buffs.
	 * Includes: base armor, guard bonus (+1), adjacent Legate bonus (+1 each), minus armor reduction.
	 * Does NOT mutate the unit object (pure function).
	 * @param {number} defenderHexId - Hex ID of the defending unit
	 * @param {object} state - Optional game state for simulation
	 * @returns {number} Effective armor value (minimum 0)
	 */
	calcDefenderEffectiveArmor(defenderHexId, state) {
		const defenderUnit = this.getUnitOnHex(defenderHexId, state);
		const defenderHex = this.getHex(defenderHexId, state); // Get the hex to check terrain
		if (!defenderUnit || !defenderHex) return 0;
		if (defenderUnit.isRerolled) return 0; // Penalty for rerolling

		let effectiveArmor = defenderUnit.currentArmor;
		if (defenderUnit.isGuarding) effectiveArmor += defenderUnit.isGuarding;
		effectiveArmor -= defenderUnit.armorReduction;

		switch (defenderHex.terrainType) {
			case 'FOREST':
			case 'TOWER':
			case 'MOUNTAIN':
				effectiveArmor += 1;
				break;
			// LAKE is impassable, so units shouldn't be there to defend
		}

		return Math.max(0, effectiveArmor);
	},
	/**
	 * Calculate valid positions for Dice 1 (Fencer) Brave Charge.
	 * Fencer can move along primary axis (forward) or 1 step backward (axis_b).
	 * Target must be an adjacent enemy with effective armor >= 6.
	 * @param {number} unitHexId - Hex ID of the Fencer unit
	 * @param {object} state - Optional game state for simulation
	 * @returns {number[]} Array of valid hex IDs for Brave Charge
	 */
	calcValidBraveChargeMoves(unitHexId, state) {
		state = state || this;
		const unit = this.getUnitOnHex(unitHexId, state);
		const startHex = this.getHex(unitHexId, state);
		if (!unit || !startHex) return [];

		let possibleMoves = [];
		const primary = PLAYER_PRIMARY_AXIS[state.players.length][unit.playerId];
		const mod3 = primary.i % 3;
		const axes_b = AXES.find(({i}) => (i != primary.i) && ((i % 3) == mod3));

		// Check forward movement along primary axis
		let currentCost = 0;
		for (let i = 1; i <= unit.distance; i++) {
			let hex = this.getHexByQR(startHex.q + primary.q * i, startHex.r + primary.r * i, state);
			if (!hex) break;

			if (hex.terrainType === 'LAKE') break; // LAKE blocks movement

			let costToEnter = 1;
			let effectiveMaxDistance = unit.distance;

			if (hex.terrainType === 'MOUNTAIN') {
				costToEnter = 2;
				effectiveMaxDistance = unit.distance - 1; // Dice 1 distance reduced on mountain
			}

			currentCost += costToEnter;
			if (currentCost > effectiveMaxDistance) break;

			if (this.getUnitOnHex(hex.id, state)) break; // Blocked by unit

			if (this.hasAdjacentHighArmorEnemy(hex, unit, state)) {
				possibleMoves.push(hex.id);
			}
		}

		// Check backward movement (1 step only, matching Fencer's standard movement)
		if (axes_b) {
			let hex = this.getHexByQR(startHex.q + axes_b.q * 1, startHex.r + axes_b.r * 1, state);
			if (hex && hex.terrainType !== 'LAKE' && !this.getUnitOnHex(hex.id, state)) {
				let costToEnter = (hex.terrainType === 'MOUNTAIN') ? 2 : 1;
				let effectiveMaxDistance = (hex.terrainType === 'MOUNTAIN') ? unit.distance - 1 : unit.distance;

				if (costToEnter <= effectiveMaxDistance && this.hasAdjacentHighArmorEnemy(hex, unit, state)) {
					possibleMoves.push(hex.id);
				}
			}
		}

		return possibleMoves;
	},
	/**
	 * Helper to check if a hex has an adjacent enemy with effective armor >= 6.
	 * @param {object} hex - Hex to check neighbors of
	 * @param {object} unit - The attacking unit (for player ID comparison)
	 * @param {object} state - Optional game state for simulation
	 * @returns {boolean} True if high-armor enemy is adjacent
	 */
	hasAdjacentHighArmorEnemy(hex, unit, state) {
		return this.getNeighbors(hex, state).some(neighborHex => {
			const targetUnit = this.getUnitOnHex(neighborHex.id, state);
			const defenderEffectiveArmor = this.calcDefenderEffectiveArmor(neighborHex.id, state);
			return targetUnit && targetUnit.playerId !== unit.playerId && defenderEffectiveArmor >= 6;
		});
	},
	/**
	 * Get unit stats for UI display.
	 * @param {number} hexId - Hex ID containing the unit
	 * @param {object} state - Optional game state for simulation
	 * @returns {string} HTML-formatted unit stats
	 */
	calcUIDiceStat(hexId, state) {
		// const FIELDS = 'id,name,armor,attack,range,distance,movement,armorReduction,effectiveArmor';
		const FIELDS = {
			id: 'ID',
			name: 'Name',
			attack: 'Attack',
			armor: 'Armor',
			armorReduction: 'Armor Reduction',
			effectiveArmor: 'Effectice Armor',
			distance: 'Movement',
			range: 'Range',
		};

		const unit = this.getUnitOnHex(hexId, state);

		if (!unit || unit.isDeath) return '';

		unit.effectiveArmor = this.calcDefenderEffectiveArmor(hexId, state);

		return Object.entries(unit)
			.filter(([k ,v]) => Object.keys(FIELDS).includes(k))
			.map(([k ,v]) => `${FIELDS[k]}: ${v}`)
			.join('<br>');
	},
	/**
	 * Check if an attacker unit can attack a target unit.
	 * Validates melee, ranged (Dice 2), and special (Dice 6) attack capabilities.
	 * @param {object} attackerUnit - The attacking unit
	 * @param {object} targetUnit - The target unit
	 * @param {object} state - Optional game state for simulation
	 * @returns {boolean} True if attack is valid
	 */
	canUnitAttackTarget(attackerUnit, targetUnit, state) {
		if (!attackerUnit || !targetUnit || attackerUnit.playerId === targetUnit.playerId) return false;

		const attackerHex = this.getHex(attackerUnit.hexId, state);
		const targetHex = this.getHex(targetUnit.hexId, state);

		if (!attackerHex || !targetHex) return false;

		// Melee attack (implicitly part of move)
		const validMeleeMoves = this.calcValidMoves(attackerUnit.hexId, state);
		if (validMeleeMoves.includes(targetHex.id)) return true;

		// Ranged attack (Dice 2)
		if (attackerUnit.value === 2) {
			const validRangedTargets = this.calcValidRangedTargets(attackerUnit.hexId, state);
			if (validRangedTargets.includes(targetHex.id)) return true;
		}

		// Special attack (Dice 6)
		if (attackerUnit.value === 6) {
			const validSpecialTargets = this.calcValidSpecialAttackTargets(attackerUnit.hexId, state);
			if (validSpecialTargets.includes(targetHex.id)) return true;
		}

		return false;
	},

	/**
	 * Calculate all hexes that are dangerous for the current player's units.
	 * A hex is dangerous if moving a unit there would result in it being attacked or killed
	 * by any enemy player's units (melee, ranged, or special attacks).
	 * @param {number} playerId - Player ID to calculate danger for (defaults to currentPlayerIndex)
	 * @param {object} state - Optional game state for simulation
	 * @returns {object} Object with hexId as key and danger info as value
	 */
	calcDangerHex(playerId, state) {
		state = state || this;
		playerId = (playerId !== undefined && playerId !== null) ? playerId : state.currentPlayerIndex;

		const dangerMap = {};

		// Get all enemy players
		const enemyPlayers = state.players.filter(p => p.id !== playerId && !p.isEliminated);
		if (enemyPlayers.length === 0) return dangerMap;

		// For each enemy unit, collect all hexes they can attack using existing methods
		enemyPlayers.forEach(enemyPlayer => {
			enemyPlayer.dice.forEach(enemyUnit => {
				// Skip units that are not deployed or dead
				if (!enemyUnit.isDeployed || enemyUnit.isDeath) return;

				const enemyHexId = enemyUnit.hexId;
				const enemyHex = state.getHex(enemyHexId, state);
				if (!enemyHex) return;

				const enemyStats = UNIT_STATS[enemyUnit.value];
				let attackHexes = [];

				// Melee units: reuse calcValidMoves to get attackable hexes
				if (!enemyUnit.range || enemyUnit.range === 0) {
					// calcValidMoves returns hexes the unit can move to, including enemy attack targets
					attackHexes = state.calcValidMoves(enemyHexId, false, state);
				}

				// Ranged units (Dice 2 - Archer): reuse calcValidRangedTargets
				if (enemyUnit.value === 2) {
					attackHexes = state.calcValidRangedTargets(enemyHexId, state, true);
				}

				// Oracle (Dice 6): reuse calcValidSpecialAttackTargets
				if (enemyUnit.value === 6) {
					attackHexes = state.calcValidSpecialAttackTargets(enemyHexId, state, true);
				}

				// Mark all attack hexes as dangerous
				attackHexes.forEach(hexId => {
					const targetHex = state.getHex(hexId, state);
					if (!targetHex) return;

					// Skip hexes occupied by friendly units
					const existingUnit = state.getUnitOnHex(hexId, state);
					if (existingUnit && existingUnit.playerId === playerId) return;

					const dist = state.axialDistance(enemyHex.q, enemyHex.r, targetHex.q, targetHex.r);

					let attackType = 'MELEE';
					if (enemyUnit.value === 2) attackType = 'RANGED_ATTACK';
					if (enemyUnit.value === 6) attackType = 'SPECIAL_ATTACK';

					if (!dangerMap[hexId]) {
						dangerMap[hexId] = {
							hexId: hexId,
							q: targetHex.q,
							r: targetHex.r,
							threats: [],
							threatCount: 0,
							isLethal: false,
							minDistance: Infinity
						};
					}

					dangerMap[hexId].threats.push({
						enemyHexId: enemyHex.id,
						enemyUnit: enemyUnit,
						attackType: attackType,
						isLethal: true,
						distance: dist
					});
				});
			});
		});

		// Update aggregated fields
		Object.values(dangerMap).forEach(entry => {
			entry.threatCount = entry.threats.length;
			entry.isLethal = entry.threats.some(t => t.isLethal);
			entry.minDistance = Math.min(...entry.threats.map(t => t.distance));
		});

		return dangerMap;
	},
	/**
	 * Check if a hex is in the danger zone.
	 * Helper method to quickly check if a specific hex is dangerous.
	 * @param {number} hexId - Hex ID to check
	 * @param {number} playerId - Player ID to check danger for
	 * @param {object} state - Optional game state
	 * @returns {object|null} Danger info or null if safe
	 */
	isHexDangerous(hexId, playerId, state) {
		const dangerMap = this.calcDangerHex(playerId, state);
		return dangerMap[hexId] || null;
	},

	/* --- COMBAT --- */
	/**
	 * Resolve combat between attacker and defender.
	 * Attacker wins if: defender's armor is depleted (reduction >= base armor) OR attacker's attack >= defender's effective armor.
	 * On failed attack, both units suffer 1 armor reduction.
	 * @param {number} attackerHexId - Hex ID of the attacking unit
	 * @param {number} defenderHexId - Hex ID of the defending unit
	 * @param {string} combatType - 'MELEE', 'RANGED_ATTACK', or 'COMMAND_CONQUER'
	 * @param {object} state - Optional game state for simulation
	 */
	handleCombat(attackerHexId, defenderHexId, combatType, state) { // combatType: 'MELEE', 'RANGED_ATTACK', 'COMMAND_CONQUER'
		const attackerUnit = this.getUnitOnHex(attackerHexId, state);
		const defenderUnit = this.getUnitOnHex(defenderHexId, state);
		const attackerHex = this.getHex(attackerHexId, state);
		const defenderHex = this.getHex(defenderHexId, state);

		if (!attackerUnit || !defenderUnit || !attackerHex || !defenderHex) {
			this.addLog("Combat error: attacker or defender not found.", state);
			return;
		}

		attackerUnit.isGuarding = Math.max(attackerUnit.isGuarding - 1, 0);

		const isSkirmishing = !!attackerUnit.skirmishBuff;
		const distance = this.axialDistance(attackerHex.q, attackerHex.r, defenderHex.q, defenderHex.r);

		let attackMod = 0;
		if (isSkirmishing) attackMod -= 1;
		// Range 3 (further than usual 2 range) the attack is reduce by 1
		if (combatType === 'RANGED_ATTACK' && distance === 3) attackMod -= 1;

		const effectiveAttack = Math.max(1, attackerUnit.attack + attackMod);

		const defenderEffectiveArmor = this.calcDefenderEffectiveArmor(defenderHexId, state);
		const defenderBaseArmor = UNIT_STATS[defenderUnit.value].armor;

		// Attacker wins if armor is depleted OR attack beats effective armor
		const isArmorDepleted = defenderUnit.armorReduction >= defenderBaseArmor;
		const attackWins = defenderUnit.isGuarding ? (effectiveAttack > defenderEffectiveArmor) : (effectiveAttack >= defenderEffectiveArmor);
		const attackerWins = isArmorDepleted || attackWins;

		// Set combat trail for visual feedback (all combats)
		this.trailAttack = {
			fromHex: attackerHex,
			toHex: defenderHex,
			unit: attackerUnit,
			dist: this.axialDistance(attackerHex.q, attackerHex.r, defenderHex.q, defenderHex.r),
		};

		if (attackerWins) {
			// Remove defender
			this.removeUnit(defenderHexId, state);
			defenderHex.unitId = null;

			if (isSkirmishing) {
				this.addLog(`P${attackerUnit.playerId+1} D${attackerUnit.value} performed a successful Skirmish! Choose a destination adjacent to the target.`, state);

				if (!state) {
					// Switch to post-skirmish move mode
					this.actionMode = 'SKIRMISH_POST_MOVE';
					this.selectedUnitHexId = attackerHexId;

					// Valid moves are the target hex itself PLUS adjacent hexes to the target that are empty (OR the current attacker hex)
					const neighbors = this.getNeighbors(defenderHex);
					this.validMoves = neighbors
						.filter(n => !this.getUnitOnHex(n.id) || n.id === attackerHexId)
						.map(n => n.id);

					// Add the target hex and ensure current hex is included as valid options
					if (!this.validMoves.includes(defenderHexId)) this.validMoves.push(defenderHexId);
					if (!this.validMoves.includes(attackerHexId)) this.validMoves.push(attackerHexId);

					return; // Wait for user to click a hex
				}
			} else if (combatType === 'MELEE' || combatType === 'COMMAND_CONQUER') {
				// Attacker moves into vacated hex (melee or command & conquer)
				this.move(attackerUnit, attackerHex, defenderHex, state);
				this.addLog(`P${attackerUnit.playerId+1} D${attackerUnit.value} ${combatType.toLowerCase()} attacked P${defenderUnit.playerId+1} D${defenderUnit.value} (${attackerHex.q},${attackerHex.r})->(${defenderHex.q},${defenderHex.r}).`, state);
			} else {
				this.addLog(`P${attackerUnit.playerId+1} D${attackerUnit.value} ${combatType.toLowerCase()} attacked P${defenderUnit.playerId+1} D${defenderUnit.value} (${defenderHex.q},${defenderHex.r}).`, state);
			}
			// For Ranged, attacker stays. For Special, attacker moves if successful.
			this.trailAttack = {};
		} else { // Attacker fails
			if (isSkirmishing) {
				this.addLog(`Skirmish failed! P${attackerUnit.playerId+1} D${attackerUnit.value} has been eliminated.`, state);
				this.removeUnit(attackerHexId, state);
			} else {
				this.addLog(`Attack failed! Both party's Armor reduced by 1.`, state);
				this.addLog(`P${attackerUnit.playerId+1} D${attackerUnit.value} attacked P${defenderUnit.playerId+1} D${defenderUnit.value} failed.`, state);

				// Ranged attacks don't receive counter-damage (attacker is at safe distance)
				if (combatType === 'RANGED_ATTACK') {
					if (defenderUnit.isGuarding <= 1) {
						this.applyDamage(defenderHexId, 1, state, defenderUnit.isGuarding ? false : true);
					}
				} else {
					if (attackerUnit.isGuarding <= 1) {
						this.applyDamage(attackerHexId, 1, state, false);
					}

					if (defenderUnit.isGuarding <= 1) {
						this.applyDamage(defenderHexId, 1, state, defenderUnit.isGuarding ? false : true);
					}
				}
			}
		}

		attackerUnit.skirmishBuff = 0; // Clear buff after combat

		attackerUnit.hasMovedOrAttackedThisTurn = true; // Failed attack still counts as action
		attackerUnit.actionsTakenThisTurn++;

		defenderUnit.isGuarding = 0;
		// Deselect after combat resolution
		this.deselectUnit();
	},
	/**
	 * Remove a unit from the board (mark as death and clear hex).
	 * @param {number} hexId - Hex ID containing the unit to remove
	 * @param {object} state - Optional game state for simulation
	 */
	removeUnit(hexId, state) {
		const unit = this.getUnitOnHex(hexId, state);
		if (!unit) return;
		// Only log when not simulating (state is provided)
		if (!state) {
			this.addLog(`P${unit.playerId+1} D${unit.value} removed (${this.getHex(hexId, state).q},${this.getHex(hexId, state).r}).`);
		}
		(state || this).players[unit.playerId].dice.find(d => d.id === unit.id).isDeath = true; // Mark as death
		this.getHex(hexId, state).unitId = null; // Clear hex
	},
	/**
	 * Apply armor reduction damage to a unit.
	 * If effective armor reaches 0, the unit is automatically removed.
	 * @param {number} hexId - Hex ID containing the unit
	 * @param {number} damage - Amount of armor reduction to apply (default: 1)
	 * @param {object} state - Optional game state for simulation
	 */
	applyDamage(hexId, damage=1, state, isKillOnZero) {
		const unit = this.getUnitOnHex(hexId, state);
		if (!unit) return;
		unit.armorReduction += damage;
		const effectiveArmor = this.calcDefenderEffectiveArmor(hexId, state); // Recalculate effective armor

		if (isKillOnZero) {
			if (effectiveArmor <= 0) this.removeUnit(hexId, state); // Remove if armor drops to 0 or less
		} else {
			if (effectiveArmor < 0) this.removeUnit(hexId, state); // Remove if armor drops less than 0
		}
	},

	/* --- TURN --- */
	endTurn(state) {
		let isState = !!state;
		state = state || this;

		state.hovering = {};
		state.actionMode = null;
		state.validMoves = [];
		state.validMerges = [];
		state.validTargets = [];

		if (state.phase !== 'PLAYER_TURN') return;

		// state.players[state.currentPlayerIndex].evaluation = boardEvaluation(this, state);
		// this.addLog(`${state.players[state.currentPlayerIndex].isAI ? '[AI] ' : ''}P${state.currentPlayerIndex + 1}' turn ended (eval: ${state.players[state.currentPlayerIndex].evaluation}).`, isState ? state : undefined);
		// this.addLog(`---`, isState ? state : undefined);

		this.deselectUnit(state); // Clear selection
		state.actionMode = null; // Clear action mode

		// Move to next non-eliminated player
		let nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
		while (state.players[nextPlayerIndex].isEliminated && nextPlayerIndex !== state.currentPlayerIndex) {
			nextPlayerIndex = (nextPlayerIndex + 1) % state.players.length;
		}

		state.currentPlayerIndex = nextPlayerIndex;
		state.turnCount++;
		this.resetTurnActionsForPlayer(state.currentPlayerIndex, state);

		// state.players[state.currentPlayerIndex].evaluation = boardEvaluation(this, state);
		// this.addLog(`${state.players[state.currentPlayerIndex].isAI ? '[AI] ' : ''}P${state.currentPlayerIndex + 1} turn started (eval: ${state.players[state.currentPlayerIndex].evaluation}).`, isState ? state : undefined);

		this.checkWinConditions(state); // Check at start of turn too (e.g. if opponent was eliminated on their own turn by some effect)

		if (isState) return;

		if (state.phase === 'PLAYER_TURN' && state.players[state.currentPlayerIndex].isAI) {
			setTimeout(() => this.performAITurn(), 500);
		} else if (this.debug?.autoPlay) {
			this.autoPlay();
		}
	},
	resetTurnActionsForPlayer(playerId, state) {
		const player = (state || this).players[playerId];
		player.dice.forEach(die => {
			if(die.isDeployed) {
				die.hasMovedOrAttackedThisTurn = false;
				die.actionsTakenThisTurn = 0;
				die.isRerolled = false; // Penalty expires when turn starts
				// Decrement skirmish buff
				if (die.skirmishBuff && die.skirmishBuff > 0) die.skirmishBuff--;
				// Guard status persists until the unit moves or rerolls.
			}
		});
	},
	checkWinConditions(state) {
		if (this.phase === 'GAME_OVER') return;

		const activePlayers = (state || this).players.filter(p => !p.isEliminated);

		activePlayers.forEach(p => {
			const activeDice = p.dice.filter(d => d.isDeployed && !d.isDeath).length;
			const baseHex = this.getHex(p.baseHexId, state);
			const unitOnBase = this.getUnitOnHex(baseHex?.id, state);
			const baseCaptured = baseHex && unitOnBase && unitOnBase.playerId !== p.id;

			if (activeDice === 0 || baseCaptured) {
				p.isEliminated = true;
				const reason = activeDice === 0 ? "annihilated" : "base captured";
				this.addLog(`P${p.id + 1} (${p.color}) has been ${reason}!`, state);
			}

			if (baseCaptured) {
				// Remove all units of eliminated player from the board
				p.dice.forEach(d => {
					if (d.isDeployed && !d.isDeath && d.hexId !== null) {
						const hex = this.getHex(d.hexId, state);
						if (hex) {
							hex.unit = null;
							hex.unitId = null;
							d.isDeath = true;
						}
					}
				});
			}
		});

		const remainingPlayers = (state || this).players.filter(p => !p.isEliminated);

		if (remainingPlayers.length === 1) {
			const winner = remainingPlayers[0];
			this.gameOver(winner.id, `P${winner.id + 1} claims final victory!`);
		} else if (remainingPlayers.length === 0) {
			this.gameOver(-1, "All players eliminated! It's a draw!");
		}
	},
	gameOver(winnerPlayerIndex, message) {
		this.phase = 'GAME_OVER';
		if (winnerPlayerIndex === -1) { // Draw
			 this.winnerMessage = message;
		} else {
			this.winnerMessage = `P${winnerPlayerIndex + 1} (${this.players[winnerPlayerIndex].color}) wins! ${message}`;
		}
		this.addLog(`Game Over: ${this.winnerMessage}`);
	},

	/* --- UTILITIES --- */
	cloneState(game) { // Very low performance
		let data = JSON.parse(JSON.stringify((game || this).$data));

		delete data.trail;
		delete data.messageLog;

		return data;
	},
	addLog(message, state) {
		if (this.debug.quiet) return;

		if (state) return; console.debug(' >', message);

		message = [
			`${new Date().toLocaleTimeString()}: ${message}`,
			// this.phase == 'PLAYER_TURN' ? `[${boardEvaluation(this)}]` : '',
		].join(' ').trim();

		this.messageLog.unshift({ id: this.logCounter++, message });
		if (this.messageLog.length > 50) this.messageLog.pop();
		
		// Auto-scroll log
		this.$nextTick(() => {
			const logContainer = document.getElementById('messageLogContainer');
			if (logContainer) logContainer.scrollTop = 0;
		});
	},
};}
