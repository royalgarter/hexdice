// deno-lint-ignore-file
const R = 6; // Map size radius
const HEX_SIZE = 60; // pixels
const HEX_WIDTH = HEX_SIZE;
const HEX_HEIGHT = HEX_SIZE * Math.sqrt(3) / 2; // Height of one equilateral triangle half

// Axial directions
const AXES = [
	{i: 0, q: 1, r: -1, name: '2h'},
	{i: 1, q: 1, r: 0, name: '4h'},
	{i: 2, q: 0, r: 1, name: '6h'},
	{i: 3, q: -1, r: 1, name: '8h'},
	{i: 4, q: -1, r: 0, name: '10h'},
	{i: 5, q: 0, r: -1, name: '12h'},
];

const UNIT_STATS = {
	1: { name: "Pawn", armor: 1, attack: 2, range: 0, distance: 3, movement: '|' },
	2: { name: "Bishop", armor: 2, attack: 3, range: 0, distance: 3, movement: 'X' },
	3: { name: "Knight", armor: 3, attack: 4, range: 0, distance: 3, movement: 'L' },
	4: { name: "Rook", armor: 4, attack: 5, range: 0, distance: 2, movement: '+' },
	5: { name: "Archer", armor: 5, attack: 6, range: "2-2", distance: 1, movement: '*' },
	6: { name: "Legion", armor: 6, attack: 6, range: 1, distance: 0, movement: '0' },
};

const PLAYER_PRIMARY_AXIS = {
	1: [ AXES[5] ],
	2: [ AXES[5], AXES[2] ],
	3: [ AXES[4], AXES[2], AXES[0] ],
	4: [ AXES[4], AXES[3], AXES[0], AXES[1] ],
	6: [ AXES[0], AXES[1], AXES[2], AXES[3], AXES[4], AXES[5] ],
};

function random() {
	const array = new Uint32Array(1);
	crypto.getRandomValues(array);
	return array[0] / 4294967296; // 2^32
}

Array.prototype.random = function () { return this[Math.floor((random() * this.length))]; }

function alpineHexDiceTacticGame() { return {
	/* --- VARIABLES --- */
	rules: {
		dicePerPlayer: 12,
	},
	hexGrid: {},
	hexes: [],
	hexesQR: {},
	players: [
		{ id: 0, color: 'Blue', dice: [], initialRollDone: false, baseHexId: null, rerollsUsed: 0 },
		{ id: 1, color: 'Red', dice: [], initialRollDone: false, baseHexId: null, rerollsUsed: 0 }
	],
	phase: 'SETUP_ROLL', // SETUP_ROLL, SETUP_REROLL, SETUP_DEPLOY, PLAYER_TURN, GAME_OVER
	currentPlayerIndex: 0,
	selectedUnitHexId: null,
	selectedDieToDeploy: null, // index in player's dice array
	hovering: {},
	unitstat: null,
	trail: {fromHex: null, toHex: null, unit: null, path: []},
	validMoves: [], // array of hex IDs
	validMerges: [], // array of hex IDs
	validTargets: [], // array of hex IDs for attacks/merges
	diceToReroll: [], // indices of dice selected for reroll
	messageLog: [],
	logCounter: 0,
	winnerMessage: "",
	actionMode: null, // 'MOVE', 'RANGED_ATTACK', 'SPECIAL_ATTACK', 'MERGE_SELECT_TARGET'
	debug: {
		coordinate: new URLSearchParams(location.search).get('mode')?.includes('coordinate'),
		skipReroll: new URLSearchParams(location.search).get('mode')?.includes('debug'),
		skipDeploy: new URLSearchParams(location.search).get('mode')?.includes('debug'),
		autoPlay: new URLSearchParams(location.search).get('mode')?.includes('auto'),
	},

	/* --- INITIALIZATION --- */
	init() {
		this.generateHexGrid(R);
		this.determineBaseLocations();
		this.addLog("Game started. Welcome to Hex Dice!");
		this.resetGame({
			isP2AI: new URLSearchParams(location.search).get('mode') == 'campaign',
		});
	},
	resetGame(opts) {
		this.players = [
			{ id: 0, color: 'Blue', dice: [], initialRollDone: false, baseHexId: null, rerollsUsed: 0 },
			{ id: 1, color: 'Red', dice: [], initialRollDone: false, baseHexId: null, rerollsUsed: 0, isAI: opts?.isP2AI }
		];
		this.hexes.forEach(h => h.unitId = null); // Clear units from hexes
		this.determineBaseLocations(); // Redetermine bases on reset
		this.phase = 'SETUP_ROLL';
		this.currentPlayerIndex = 0;
		this.selectedUnitHexId = null;
		this.selectedDieToDeploy = null;
		this.actionMode = null;
		this.validMoves = [];
		this.validMerges = [];
		this.validTargets = [];
		this.diceToReroll = [];
		this.messageLog = [];

		if (this.debug?.autoPlay) {
			this.players.forEach(p => p.isAI = true);
			this.addLog(`Autoplay game started`);
		}

		this.addLog(`New game started. Player 1 (Red) rolls first. isP2AI=${!!opts?.isP2AI}`);
	},

	/* --- HEX GRID --- */
	generateHexGrid(radius, padding=0) {
		this.hexes = [];
		this.hexesQR = {};
		let id = 0;
		for (let q = -radius; q <= radius; q++) {
			for (let r = -radius; r <= radius; r++) {
				if (-q - r >= -radius && -q - r <= radius) { // Check if s is also within radius
					const x = HEX_WIDTH * 3/4 * q;
					const y = HEX_HEIGHT * (r + q / 2);

					this.hexes.push({ id, q, r, s: -q-r, unitId: null, isP1Base: false, isP2Base: false, visualX: x, visualY: y });
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

		for (let i=0; i<this.hexes.length; i++) {
			this.hexes[i].left = this.hexes[i].visualX - this.hexGrid.minX + padding;
			this.hexes[i].top = this.hexes[i].visualY - this.hexGrid.minY + padding;
			this.hexes[i].width = HEX_WIDTH - (padding << 1);
			this.hexes[i].height = HEX_HEIGHT - (padding << 1);

			this.hexes[i].trailX = this.hexes[i].left + (this.hexes[i].width / 2);
			this.hexes[i].trailY = this.hexes[i].top + (this.hexes[i].height / 2);
		}
	},
	determineBaseLocations() {
		let radius = -(R-1);

		const primary1 = PLAYER_PRIMARY_AXIS[this.players.length][0];
		const base1Hex = this.getHexByQR(primary1.q * radius, primary1.r * radius);
		if (base1Hex) {
			base1Hex.isP1Base = true;
			this.players[0].baseHexId = base1Hex.id;
		}

		const primary2 = PLAYER_PRIMARY_AXIS[this.players.length][1];
		const base2Hex = this.getHexByQR(primary2.q * radius, primary2.r * radius);
		if (base2Hex) {
			base2Hex.isP2Base = true;
			this.players[1].baseHexId = base2Hex.id;
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

	/* --- UI STYLING --- */
	hexColor(hex, state) {
		// const unit = this.getUnitOnHex(hex.id, state);

		let cls = 'bg-hexdefault';

		if (hex.isP1Base) cls = 'bg-hexblue';
		if (hex.isP2Base) cls = 'bg-hexred';

		state = state || this;

		if (state.selectedUnitHexId === hex.id) cls = 'bg-hexselect saturate-50';
		else if (state.validMoves?.includes(hex.id)) cls = 'bg-hexmove saturate-50';
		else if (state.validMerges?.includes(hex.id)) cls = 'bg-hexmerge saturate-50';
		else if (state.validTargets?.includes(hex.id)) cls = 'bg-hextarget saturate-50';

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
	hexStyle(hex, padding=0) {
		// Calculate offset for positioning
		// Find minX and minY to offset all hexes so they start near 0,0 of the container
		// const allX = this.hexes.map(h => h.visualX);
		// const allY = this.hexes.map(h => h.visualY);
		// const minX = Math.min(...allX);
		// const minY = Math.min(...allY);

		hex.left = hex.visualX - this.hexGrid.minX + padding;
		hex.top = hex.visualY - this.hexGrid.minY + padding;
		hex.width = HEX_WIDTH - (padding << 1);
		hex.height = HEX_HEIGHT - (padding << 1);

		let style = [
			`left: ${hex.left}px;`,
			`top: ${hex.top}px;`,
			`width: ${hex.width}px;`,
			`height: ${hex.height}px;`,
		];

		const unit = this.getUnitOnHex(hex.id);
		if (unit) {
			const {value, playerId} = unit;
			style.push(`background-size: auto 70%;`, `background-repeat: no-repeat;`, `background-position: center;`);
			style.push(`background-image: url("/assets/sprites/fe_mystery/d${value}${playerId == 0 ? 'blue' : 'red' }.gif");`);
		}
		// https://github.com/Klokinator/FE-Repo
		// https://fireemblemwiki.org/w/index.php?title=Special:Search&limit=500&offset=0&profile=images&search=map-sprite

		// let [trail, trailIdx, step] = [this.trail, this.trail.path.indexOf(hex.id), 15];
		// if (hex.id == trail?.fromHex?.id) {
		// 	style.push(`filter: grayscale(${step}%);`);
		// } else if (hex.id == trail?.toHex?.id) {
		// 	style.push(`filter: grayscale(${(trail.path.length+2) * step}%);`);
		// } else if (trailIdx >= 0) {
		// 	style.push(`filter: grayscale(${(trailIdx+2) * step}%);`);
		// }

		return style.join('');
	},
	hoverHex(hexId) {
		if (this.phase !== 'PLAYER_TURN') return;

		this.hovering = {};

		this.hovering.hexId = hexId;
		this.hovering.unit = this.getUnitOnHex(hexId);

		if (this.hovering.unit) {
			this.hovering.validMoves = this.calcValidMoves(hexId);
			this.hovering.validMerges = this.calcValidMoves(hexId, 'MERGE');

			if (this.hovering.unit?.value == 5) {
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
		if (this.phase === 'SETUP_REROLL') return `Player ${this.currentPlayerIndex + 1} (${this.players[this.currentPlayerIndex].color}) - Reroll Phase.`;
		if (this.phase === 'SETUP_DEPLOY') return `Player ${this.currentPlayerIndex + 1} (${this.players[this.currentPlayerIndex].color}) - Deployment Phase.`;
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
				isGuarding: false,
				isDeath: false,
				actionsTakenThisTurn: 0, // For merged unit to act if target hasn't
			});
		}
		player.initialRollDone = true;
		this.addLog(`Player ${playerId + 1} rolled: ${player.dice.map(d => d.value).join(', ')}`);

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
		this.addLog(`Player ${player.id + 1} rerolled ${this.diceToReroll.length} dice. New values: ${rerolledValues.join(', ')}`);
		player.rerollsUsed++;
		this.diceToReroll = [];
		this.nextPlayerSetupRerollOrDeploy();
	},
	skipReroll() {
		this.addLog(`Player ${this.currentPlayerIndex + 1} skipped reroll.`);
		this.players[this.currentPlayerIndex].rerollsUsed++; // Mark as reroll phase completed
		this.diceToReroll = [];
		this.nextPlayerSetupRerollOrDeploy();
	},
	nextPlayerSetupRerollOrDeploy() {
		if (this.currentPlayerIndex === 0 && this.players[1].rerollsUsed === 0) {
			this.currentPlayerIndex = 1; // Move to Player 2's reroll
		} else {
			// Both players finished reroll phase
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

		this.addLog(`Player ${player.id + 1} deployed Dice #${dieToDeploy.value} to hex ${hexId} [${targetHex.q}, ${targetHex.r}]`);
		this.selectedDieToDeploy = player.dice.find(x => !x.isDeployed)?.originalIndex;

		// Check if current player has deployed all dice
		if (player.dice.every(d => d.isDeployed)) {
			if (this.currentPlayerIndex === 0) {
				this.currentPlayerIndex = 1; // Move to Player 2's deployment
				this.selectedDieToDeploy = 0;
				this.addLog("Player 2 turn to deploy");

				if (this.players[1].dice.every(d => d.isDeployed)) {
					this.startGamePlay();
				}
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
			this.deselectUnit();
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
		this.validMerges = this.calcValidMoves(this.selectedUnitHexId, 'MERGE');
		// this.addLog(`Selected Unit: Dice ${unit.value} [${unit.range}] at (${this.getHex(hexId).q}, ${this.getHex(hexId).r})`);

		if (unit.value == 5) {
			this.validTargets = this.calcValidRangedTargets(this.selectedUnitHexId);
		}

		if (unit.value == 6) {
			this.validTargets = this.calcValidSpecialAttackTargets(this.selectedUnitHexId);
		}

		if (this.canPerformAction(this.selectedUnitHexId, 'MOVE')) this.initiateAction('MOVE');
	},
	deselectUnit(state) {
		state = state || this;

		state.hovering = {}
		state.selectedUnitHexId = null;
		state.validMoves = [];
		state.validTargets = [];
		state.validMerges = [];
		state.actionMode = null;
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
			}
		} else if (actionType === 'BRAVE_CHARGE') {
			this.validMoves = this.calcValidBraveChargeMoves(this.selectedUnitHexId);
			 if (this.validMoves.length === 0) {
				this.addLog("No valid targets for Brave Charge.");
				// this.cancelAction();
			}
		}
	},
	actionModeMessage() {
		if (this.actionMode === 'MOVE') return "Select a destination hex for your unit.";
		if (this.actionMode === 'RANGED_ATTACK') return "Select an ranged enemy unit to target.";
		if (this.actionMode === 'SPECIAL_ATTACK') return "Select an adjacent enemy unit to target.";
		if (this.actionMode === 'MERGE') return "Select a friendly unit to merge with.";
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
		const target = this.getUnitOnHex(this.targetHexId);
		const action = this.actionMode;
		this.actionMode = null; // Clear action mode first

		if (action == 'BRAVE_CHARGE_TARGET') {
			this.performBraveCharge(this.selectedUnitHexId, targetHexId);
			this.endTurn();
			return;
		}

		if (this.selectedUnitHexId == targetHexId) {
			this.deselectUnit();
			return;
		}

		if (this.validMoves.includes(targetHexId)) {
			if (unit.playerId == target?.playerId) {
				this.performMerge(this.selectedUnitHexId, targetHexId);
				// New merge unit could take action if sum > 6
			} else {
				this.performMove(this.selectedUnitHexId, targetHexId);

				if (action == 'BRAVE_CHARGE') {
					this.actionMode = 'BRAVE_CHARGE_TARGET';
					this.selectedUnitHexId = targetHexId;
					this.validTargets = this.calcValidSpecialAttackTargets(this.selectedUnitHexId);
					this.addLog("Now choose a target of Dice 1 Brave Change");
				} else {
					this.endTurn();
				}
			}

			return;
		} else if (this.validMerges.includes(targetHexId)){
			this.performMerge(this.selectedUnitHexId, targetHexId);
			// New merge unit could take action if sum > 6
			return;
		} else if (unit.value == 5 && this.validTargets.includes(targetHexId)) {
			this.performRangedAttack(this.selectedUnitHexId, targetHexId);
			this.endTurn();
			return;
		} else if (unit.value == 6 && this.validTargets.includes(targetHexId)) {
			this.performComandConquer(this.selectedUnitHexId, targetHexId);
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

		switch(actionType) {
			case 'MOVE': return true;
			case 'REROLL': return true;
			case 'GUARD': return true;
			case 'RANGED_ATTACK': return unit.value === 5;
			case 'SPECIAL_ATTACK': return unit.value === 6;
			case 'BRAVE_CHARGE': return unit.value === 1;
			case 'MERGE': return true;
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
			if (dist > 1) {
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

		// this.addLog(`Player ${attackerUnit.playerId + 1} attempts to move Dice ${attackerUnit.value} from (${attackerHex.q},${attackerHex.r}) to (${defenderHex.q},${defenderHex.r}).`, state);
		attackerUnit.isGuarding = false;

		if (defenderUnit) { // Moving into an enemy occupied hex
			if (defenderUnit.playerId === attackerUnit.playerId) {
				this.addLog("Cannot move into a hex occupied by a friendly unit (use Merge action).", state);
				// Do not deselect, allow player to choose another action or target
				return;
			}
			// Combat occurs
			this.handleCombat(unitHexId, targetHexId, 'MELEE', state);
		} else { // Moving to an empty hex
			this.addLog(`P${attackerUnit.playerId+1} D${attackerUnit.value} moved (${attackerHex.q},${attackerHex.r})->(${defenderHex.q},${defenderHex.r}).`, state);


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
	performUnitReroll(unitHexId, state) {
		const targetHex = this.getHex(unitHexId, state);
		const unit = this.getUnitOnHex(unitHexId, state);
		if (!unit || unit.hasMovedOrAttackedThisTurn) return;

		const oldVal = unit.value;
		const newRoll = Math.floor(random() * 6) + 1;
		unit.value = newRoll;
		Object.assign(unit, UNIT_STATS[newRoll]); // Update stats
		unit.currentArmor = UNIT_STATS[newRoll].armor;
		unit.armorReduction = 0; // Reset armor reduction
		unit.isGuarding = false; // Rerolling removes guard

		unit.hasMovedOrAttackedThisTurn = true;
		unit.actionsTakenThisTurn++;
		this.addLog(`P${unit.playerId + 1} D${oldVal} rerolled D${newRoll} (${targetHex.q},${targetHex.r}).`, state);
		this.deselectUnit(state);
		this.checkWinConditions(state);
	},
	performGuard(unitHexId, state) {
		const targetHex = this.getHex(unitHexId, state);
		const unit = this.getUnitOnHex(unitHexId, state);
		if (!unit || unit.hasMovedOrAttackedThisTurn) return;

		unit.isGuarding = true;
		// Actual armor buff is applied during combat calculation
		unit.hasMovedOrAttackedThisTurn = true;
		unit.actionsTakenThisTurn++;
		this.addLog(`P${unit.playerId + 1} D${unit.value} guarded (${targetHex.q},${targetHex.r}).`, state);
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
			isGuarding: false,
			actionsTakenThisTurn: newUnitCanAct ? 0 : 1, // If cannot act, it counts as action taken
		};
		p.dice.push(newUnit);

		// Update hexes
		mergingHex.unitId = null;
		targetHex.unitId = newUnit.id;

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
		this.applyDamage(targetHexId, 6, state); // Apply 6 damage, handle unit removal if armor <= 0

		this.endTurn(state); // End the player's turn after the charge
	},
	performAITurn() {
		// let choice = ['Simple', 'Analyze', 'Random', 'Minimax', 'Greedy'].random();
		// this.addLog(`AI persona: ${choice}`);
		// this['performAI_' + choice]();

		console.time('performAITurn')
		performAIByWeight(this);

		this.deselectUnit();
		this.endTurn();
		console.timeEnd('performAITurn')
	},

	/* --- CALCULATE --- */
	calcValidRangedTargets(attackerHexId, state, isHovering) {
		const attackerUnit = this.getUnitOnHex(attackerHexId, state);
		const attackerHex = this.getHex(attackerHexId, state);
		if (!attackerUnit || attackerUnit.value !== 5 || !attackerHex) return [];

		let [min, max] = attackerUnit.range.split('-').map(x => parseInt(x, 10));
		let targets = [];

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
		if (isEnemyAdjacent) return [];

		(state || this).hexes.forEach(potentialTargetHex => {
			if (!potentialTargetHex || potentialTargetHex.id === attackerHexId) return;

			const targetUnit = this.getUnitOnHex(potentialTargetHex.id, state);
			if ((targetUnit && targetUnit.playerId !== attackerUnit.playerId) // Is an enemy unit
				|| isHovering
			) {
				const dist = this.axialDistance(attackerHex.q, attackerHex.r, potentialTargetHex.q, potentialTargetHex.r);

				// Check for straight line (simplified: axial distance check implies straight line on hex grid)
				// More robust line of sight would check for blocking units/terrain. Not implemented here.
				if (dist >= min && dist <= max) {
					// Check Line of Sight: Iterate through hexes between attacker and target
					let blocked = false;
					const stepQ = (potentialTargetHex.q - attackerHex.q) / dist;
					const stepR = (potentialTargetHex.r - attackerHex.r) / dist;

					// Start checking from 1 hex away from attacker up to 1 hex away from target
					for (let i = 1; i < dist; i++) {
						let checkQ, checkR, intermediateHex, intermediateUnit;

						checkQ = Math.ceil(attackerHex.q + stepQ * i);
						checkR = Math.ceil(attackerHex.r + stepR * i);
						intermediateHex = this.getHexByQR(checkQ, checkR, state);
						intermediateUnit = this.getUnitOnHex(intermediateHex.id, state);
						if (intermediateHex && (intermediateHex.id != attackerHexId) && intermediateUnit && !intermediateUnit.isDeath) {
							blocked = true;
							break;
						}

						checkQ = Math.floor(attackerHex.q + stepQ * i);
						checkR = Math.floor(attackerHex.r + stepR * i);
						intermediateHex = this.getHexByQR(checkQ, checkR, state);
						intermediateUnit = this.getUnitOnHex(intermediateHex.id, state);
						if (intermediateHex && (intermediateHex.id != attackerHexId) && intermediateUnit && !intermediateUnit.isDeath) {
							blocked = true;
							break;
						}
					}

					if (!blocked) targets.push(potentialTargetHex.id);
				}
			}
		});

		return targets;
	},
	calcValidSpecialAttackTargets(attackerHexId, state, isHovering) {
		const attackerUnit = this.getUnitOnHex(attackerHexId, state);
		const attackerHex = this.getHex(attackerHexId, state);

		if (!attackerUnit || ![1, 6].includes(attackerUnit.value) || !attackerHex) return [];

		let targets = [];
		this.getNeighbors(attackerHex, state).forEach(neighborHex => {
			if (neighborHex) {
				if (isHovering) {
					targets.push(neighborHex.id);
					return;
				}

				const targetUnit = this.getUnitOnHex(neighborHex.id, state);
				if (targetUnit && targetUnit.playerId !== attackerUnit.playerId) {

					if (attackerUnit.value == 1) {
						const defenderEffectiveArmor = this.calcDefenderEffectiveArmor(neighborHex.id, state);

						if (defenderEffectiveArmor >= 6) {
							targets.push(neighborHex.id);
						}
					} else {
						targets.push(neighborHex.id);
					}
				}
			}
		});
		return targets;
	},
	calcValidMoves(unitHexId, isForMerging = false, state) {
		const unit = this.getUnitOnHex(unitHexId, state);
		const startHex = this.getHex(unitHexId, state);
		if (!unit || !startHex) return [];

		let possibleMoves = [];
		const unitStats = UNIT_STATS[unit.value];

		// const checkNextHexBreak = (nextHex) => {
		// 	if (!nextHex) return false; // Off map

		// 	if (this.getUnitOnHex(nextHex.id) && !isForMerging) { // Occupied by any unit
		// 		if (this.getUnitOnHex(nextHex.id).playerId !== unit.playerId) possibleMoves.push(nextHex.id); // Can attack enemy
		// 		// break; // Blocked

		// 		return false; // Blocked
		// 	}
		// 	if (this.getUnitOnHex(nextHex.id) && isForMerging && this.getUnitOnHex(nextHex.id).playerId === unit.playerId) {
		// 		possibleMoves.push(nextHex.id); // Can merge with friendly
		// 		// Don't break, can potentially move past to another friendly for merge if rules allowed (not typical)
		// 	}
		// 	if (!this.getUnitOnHex(nextHex.id)) possibleMoves.push(nextHex.id); // Empty hex

		// 	return true;
		// }

		const primary = PLAYER_PRIMARY_AXIS[this.players.length][unit.playerId];
		const mod3 = primary.i % 3;
		const axes_b = AXES.find(({i}) => (i != primary.i) && ((i % 3) == mod3) );
		const axes_x = AXES.filter(({i}) => (i % 3) != mod3 );

		switch (unitStats.movement) {
			case '|': // Dice 1
				for (let i = 1; i <= unitStats.distance; i++) {
					possibleMoves.push(this.getHexByQR(startHex.q + primary.q * i, startHex.r + primary.r * i, state)?.id);
				}

				for (let i = 1; i <= unitStats.armor; i++) {
					possibleMoves.push(this.getHexByQR(startHex.q + axes_b.q * i, startHex.r + axes_b.r * i, state)?.id);
				}
				break;
			case 'X': // Dice 2
				for (let axis of axes_x) {
					for (let i = 1; i <= unitStats.distance; i++) {
						possibleMoves.push(this.getHexByQR(startHex.q + axis.q * i, startHex.r + axis.r * i, state)?.id);
					}
				}

				break;
			case 'L': // Dice 3
				const dValidsLShape = [
					[-1, -2], [-2, -1],
					[-3, 1], [-3, 2],
					[-2, 3], [-1, 3],
					[1, 2], [2, 1],
					[3, -1], [3, -2],
					[2, -3], [1, -3],
				];

				for (let valid of dValidsLShape) {
					possibleMoves.push(this.getHexByQR(startHex.q + valid[0], startHex.r + valid[1], state)?.id);
				}

				break;
			case '+': // Dice 4
				this.getNeighbors(startHex, state).forEach(neighbor => possibleMoves.push(neighbor?.id));

				possibleMoves.push(this.getHexByQR(startHex.q + primary.q * 2, startHex.r + primary.r * 2, state)?.id);
				possibleMoves.push(this.getHexByQR(startHex.q + axes_b.q * 2, startHex.r + axes_b.r * 2, state)?.id);

				if (mod3 == 2) {
					possibleMoves.push(this.getHexByQR(startHex.q + -2, startHex.r + 1, state)?.id);
					possibleMoves.push(this.getHexByQR(startHex.q + 2, startHex.r + -1, state)?.id);
				} else if (mod3 == 1) {
					possibleMoves.push(this.getHexByQR(startHex.q + -1, startHex.r + 2, state)?.id);
					possibleMoves.push(this.getHexByQR(startHex.q + 1, startHex.r + -2, state)?.id);
				} else if (mod3 == 0) {
					possibleMoves.push(this.getHexByQR(startHex.q + -1, startHex.r + -1, state)?.id);
					possibleMoves.push(this.getHexByQR(startHex.q + 1, startHex.r + 1, state)?.id);
				}

				break;
			case '*': // Dice 5
				this.getNeighbors(startHex, state)
					.map(hex => hex.id)
					.filter(hexId => !this.getUnitOnHex(hexId, state) || (unit.playerId == this.getUnitOnHex(hexId, state)?.playerId) )
					.forEach(neighbor => possibleMoves.push(neighbor));
				break;
			case '0': // Dice 6
				 // Dice 6 cannot initiate a move action, only special attack or move after combat.
				break;
		}

		possibleMoves = [...new Set(possibleMoves.filter(x => x))];

		// console.dir({calcValidMoves: unit, startHex, possibleMoves})

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

		} else if (this.rules.dicePerPlayer <= 9) {
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
			this.getNeighbors(baseHex, state).forEach(neighbor => this.getNeighbors(neighbor, state).forEach(neighbor => deploymentHexes.push(neighbor)));
		}

		// Filter out hexes that are already occupied by friendly units
		return deploymentHexes
			.filter(x => x)
			.filter(hex => !this.getUnitOnHex(hex.id, state)) // Ensure hex is empty
			.map(hex => hex.id);
	},
	calcDefenderEffectiveArmor(defenderHexId, state) {
		const defenderUnit = this.getUnitOnHex(defenderHexId, state);
		if (!defenderUnit) return 0; // Or some error state

		let effectiveArmor = defenderUnit.currentArmor;
		if (defenderUnit.isGuarding) effectiveArmor++;

		// Dice 6 adjacent buff - check neighbors of defender
		this.getNeighbors(this.getHex(defenderHexId, state), state).forEach(neighbor => {
			const neighborUnit = this.getUnitOnHex(neighbor.id, state);
			if (neighborUnit && neighborUnit.playerId === defenderUnit.playerId && neighborUnit.value === 6) {
				effectiveArmor++;
			}
		});
		effectiveArmor -= defenderUnit.armorReduction;

		defenderUnit.effectiveArmor = Math.max(0, effectiveArmor);
		return defenderUnit.effectiveArmor;
	},
	calcValidBraveChargeMoves(unitHexId, state) {
		state = state || this;
		const unit = this.getUnitOnHex(unitHexId, state);
		const startHex = this.getHex(unitHexId, state);
		if (!unit || !startHex) return [];

		let possibleMoves = [];
		const primary = PLAYER_PRIMARY_AXIS[state.players.length][unit.playerId];

		for (let i = 1; i <= unit.distance; i++) {
			let hex = this.getHexByQR(startHex.q + primary.q * i, startHex.r + primary.r * i, state);

			if (!hex || this.getUnitOnHex(hex.id, state)) continue;

			let foundEnemy = this.getNeighbors(hex, state).find(neighborHex => {
				const targetUnit = this.getUnitOnHex(neighborHex.id, state);

				const defenderEffectiveArmor = this.calcDefenderEffectiveArmor(neighborHex.id, state);
				if (targetUnit && targetUnit.playerId !== unit.playerId && defenderEffectiveArmor >= 6) {
					return true;
				}

				return false;
			})

			if (foundEnemy) possibleMoves.push(hex?.id);
		}

		return possibleMoves;
	},
	calcUIDiceStat(hexId, state) {
		const FIELDS = 'id,name,armor,attack,range,distance,movement,armorReduction,effectiveArmor';
		const unit = this.getUnitOnHex(hexId, state);

		if (!unit || unit.isDeath) return;

		this.calcDefenderEffectiveArmor(hexId, state);

		return Object.entries(unit)
			.filter(([k ,v]) => FIELDS.includes(k))
			.map(x => x.join(': '))
			.join('<br>');
	},
	canUnitAttackTarget(attackerUnit, targetUnit, state) {
		if (!attackerUnit || !targetUnit || attackerUnit.playerId === targetUnit.playerId) return false;

		const attackerHex = this.getHex(attackerUnit.hexId, state);
		const targetHex = this.getHex(targetUnit.hexId, state);

		if (!attackerHex || !targetHex) return false;

		const distance = this.axialDistance(attackerHex.q, attackerHex.r, targetHex.q, targetHex.r);

		// Melee attack (implicitly part of move)
		const validMeleeMoves = this.calcValidMoves(attackerUnit.hexId, state); // Need to make calcValidMoves work with passed gameState
		if (validMeleeMoves.includes(targetHex.id)) return true;

		// Ranged attack (Dice 5)
		if (attackerUnit.value === 5) {
			const validRangedTargets = this.calcValidRangedTargets(attackerUnit.hexId, state); // Need to make calcValidRangedTargets work with passed gameState
			if (validRangedTargets.includes(targetHex.id)) return true;
		}

		// Special attack (Dice 6)
		if (attackerUnit.value === 6) {
			const validSpecialTargets = this.calcValidSpecialAttackTargets(attackerUnit.hexId, state); // Need to make calcValidSpecialAttackTargets work with passed gameState
			if (validSpecialTargets.includes(targetHex.id)) return true;
		}

		// Brave Charge (Dice 1)
		if (attackerUnit.value === 1 && distance === 1) {
			// Check if target has effective armor >= 6
			const defenderEffectiveArmor = this.calcDefenderEffectiveArmor(targetHex.id, state); // Need to make calcDefenderEffectiveArmor work with passed gameState
			if (defenderEffectiveArmor >= 6) return true;
		}

		return false;
	},

	/* --- COMBAT --- */
	handleCombat(attackerHexId, defenderHexId, combatType, state) { // combatType: 'MELEE', 'RANGED_ATTACK', 'COMMAND_CONQUER'
		const attackerUnit = this.getUnitOnHex(attackerHexId, state);
		const defenderUnit = this.getUnitOnHex(defenderHexId, state);
		const attackerHex = this.getHex(attackerHexId, state);
		const defenderHex = this.getHex(defenderHexId, state);

		if (!attackerUnit || !defenderUnit || !attackerHex || !defenderHex) {
			this.addLog("Combat error: attacker or defender not found.", state);
			return;
		}

		const defenderEffectiveArmor = this.calcDefenderEffectiveArmor(defenderHexId, state);

		if (defenderUnit.armorReduction >= UNIT_STATS[defenderUnit.value].armor || attackerUnit.attack >= defenderEffectiveArmor) { // Attacker wins

			// Remove defender
			this.removeUnit(defenderHexId, state);
			defenderHex.unitId = null;

			if (combatType === 'MELEE' || (combatType === 'COMMAND_CONQUER' && attackerUnit.value === 6)) {
				// Attacker moves into vacated hex (melee, special, or if specifically allowed)

				this.move(attackerUnit, attackerHex, defenderHex, state);
				// attackerHex.unit = null;
				// attackerHex.unitId = null;
				// defenderHex.unit = attackerUnit;
				// defenderHex.unitId = attackerUnit.id;
				// attackerUnit.hexId = defenderHex.id;

				this.addLog(`P${attackerUnit.playerId+1} D${attackerUnit.value} ${combatType.toLowerCase()} attacked P${defenderUnit.playerId+1} D${defenderUnit.value} (${attackerHex.q},${attackerHex.r})->(${defenderHex.q},${defenderHex.r}).`, state);
			} else {
				this.addLog(`P${attackerUnit.playerId+1} D${attackerUnit.value} ${combatType.toLowerCase()} attacked P${defenderUnit.playerId+1} D${defenderUnit.value} (${defenderHex.q},${defenderHex.r}).`, state);
			}
			// For Ranged, attacker stays. For Special, attacker moves if successful.
			attackerUnit.hasMovedOrAttackedThisTurn = true;
			attackerUnit.actionsTakenThisTurn++;

		} else { // Attacker fails
			this.addLog(`Attack failed! Both party's Armor reduced by 1.`, state);
			this.addLog(`P${attackerUnit.playerId+1} D${attackerUnit.value} attacked P${defenderUnit.playerId+1} D${defenderUnit.value} failed.`, state);

			this.applyDamage(attackerHexId, 1, state);
			this.applyDamage(defenderHexId, 1, state);

			// defenderUnit.armorReduction++;
			// defenderUnit.currentArmor = UNIT_STATS[defenderUnit.value].armor; // Reset base armor for clarity if needed, reduction is separate

			// If armor reaches 0 conceptually (base_armor - reduction <= 0) it's defeated on next hit rule.
			// The rule is "If a unit's Armor reaches 0, the next attack it suffers, regardless of the attacker's Attack value, automatically defeats it."
			// And "Effective Armor cannot go below 0 for combat comparison."
			// So, if defenderEffectiveArmor was 0 (because base_armor - reduction tokens <=0), it should have been defeated.
			// The condition `defenderUnit.armorReduction >= defenderUnit.armor` handles the "Armor reaches 0" case.

			attackerUnit.hasMovedOrAttackedThisTurn = true; // Failed attack still counts as action
			attackerUnit.actionsTakenThisTurn++;
		}
		// If attack failed, unit stays selected for potential other actions if this was not its main action
		// But for this game, Move/Attack is one action. So, deselect.
		this.deselectUnit();
	},
	removeUnit(hexId, state) {
		const unit = this.getUnitOnHex(hexId, state);
		if (!unit) return;
		this.addLog(`P${unit.playerId+1} D${unit.value} removed (${this.getHex(hexId, state).q},${this.getHex(hexId, state).r}).`);
		(state || this).players[unit.playerId].dice.find(d => d.id === unit.id).isDeath = true; // Mark as death
		this.getHex(hexId, state).unitId = null; // Clear hex
	},
	applyDamage(hexId, damage=1, state) {
		const unit = this.getUnitOnHex(hexId, state);
		if (!unit) return;
		unit.armorReduction += damage;
		this.calcDefenderEffectiveArmor(hexId, state); // Recalculate effective armor
		if ((damage > 1) && unit.effectiveArmor <= 0) this.removeUnit(hexId, state); // Remove if armor drops to 0 or less
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

		state.players[state.currentPlayerIndex].evaluation = boardEvaluation(this, state);
		// this.addLog(`${state.players[state.currentPlayerIndex].isAI ? '[AI] ' : ''}P${state.currentPlayerIndex + 1}' turn ended (eval: ${state.players[state.currentPlayerIndex].evaluation}).`, isState ? state : undefined);
		// this.addLog(`---`, isState ? state : undefined);

		this.deselectUnit(state); // Clear selection
		state.actionMode = null; // Clear action mode

		state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
		this.resetTurnActionsForPlayer(state.currentPlayerIndex, state);

		state.players[state.currentPlayerIndex].evaluation = boardEvaluation(this, state);
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
				// Guard status persists until the unit moves or rerolls.
			}
		});
	},
	checkWinConditions(state) {
		if (this.phase === 'GAME_OVER') return;

		const p1 = (state || this).players[0];
		const p2 = (state || this).players[1];

		const p1ActiveDice = p1.dice.filter(d => d.isDeployed && !d.isDeath).length;
		const p2ActiveDice = p2.dice.filter(d => d.isDeployed && !d.isDeath).length;

		// Annihilation
		if (p1ActiveDice === 0 && p2ActiveDice > 0) {
			this.gameOver(1, "Player 1 annihilated!");
			return;
		}
		if (p2ActiveDice === 0 && p1ActiveDice > 0) {
			this.gameOver(0, "Player 2 annihilated!");
			return;
		}
		 if (p1ActiveDice === 0 && p2ActiveDice === 0) {
			this.gameOver(-1, "Mutual Annihilation! It's a draw!"); // Or last player to make move loses
			return;
		}

		// Base Capture
		const p1BaseHex = this.getHex(p1.baseHexId, state);
		const p2BaseHex = this.getHex(p2.baseHexId, state);

		if (p1BaseHex && this.getUnitOnHex(p1BaseHex.id, state)?.playerId === 1) {
			this.gameOver(1, "Player 2 captured Player 1's base!");
			return;
		}
		if (p2BaseHex && this.getUnitOnHex(p2BaseHex.id, state)?.playerId === 0) {
			this.gameOver(0, "Player 1 captured Player 2's base!");
			return;
		}
	},
	gameOver(winnerPlayerIndex, message) {
		this.phase = 'GAME_OVER';
		if (winnerPlayerIndex === -1) { // Draw
			 this.winnerMessage = message;
		} else {
			this.winnerMessage = `Player ${winnerPlayerIndex + 1} (${this.players[winnerPlayerIndex].color}) wins! ${message}`;
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
		if (state) return; console.debug(' >', message);

		message = [
			`${new Date().toLocaleTimeString()}: ${message}`,
			this.phase == 'PLAYER_TURN' ? `[${boardEvaluation(this)}]` : '',
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
