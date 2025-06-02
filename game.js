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

const EVALUATION_WEIGHT = {
    UNIT_COUNT: 10, UNIT_FACTOR: 1, GUARD: 1, DISTANCE: 1, THREAT: 1, VULNERABLE: 1, MERGE_GT_6: 10, BRAVE_CHARGE: 2,
};

Array.prototype.random = function () { return this[Math.floor((Math.random() * this.length))]; }

function clone(obj) {
	// return Object.assign({}, obj);
	return JSON.parse(JSON.stringify(obj));
}

function alpineHexDiceTacticGame() { return {
	/* --- VARIABLES --- */
	rules: {
		dicePerPlayer: 8, // For 2 players
		maxRerolls: 2,    // 1/3 of 6
	},
	hexes: [],
	players: [
		{ id: 0, color: 'Blue', dice: [], initialRollDone: false, baseHexId: null, rerollsUsed: 0 },
		{ id: 1, color: 'Red', dice: [], initialRollDone: false, baseHexId: null, rerollsUsed: 0 }
	],
	phase: 'SETUP_ROLL', // SETUP_ROLL, SETUP_REROLL, SETUP_DEPLOY, PLAYER_TURN, GAME_OVER
	currentPlayerIndex: 0,
	selectedUnitHexId: null,
	selectedDieToDeploy: null, // index in player's dice array
	hovering: {},
	validMoves: [], // array of hex IDs
	validMerges: [], // array of hex IDs
	validTargets: [], // array of hex IDs for attacks/merges
	diceToReroll: [], // indices of dice selected for reroll
	messageLog: [],
	logCounter: 0,
	winnerMessage: "",
	actionMode: null, // 'MOVE', 'RANGED_ATTACK', 'SPECIAL_ATTACK', 'MERGE_SELECT_TARGET'
	debug: {
		coordinate: new URLSearchParams(location.search).get('mode')?.includes('debug'),
		skipReroll: new URLSearchParams(location.search).get('mode')?.includes('debug'),
		skipDeploy: new URLSearchParams(location.search).get('mode')?.includes('debug'),
		autoPlay: new URLSearchParams(location.search).get('mode')?.includes('autoPlay'),
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
	generateHexGrid(radius) {
		this.hexes = [];
		let id = 0;
		for (let q = -radius; q <= radius; q++) {
			for (let r = -radius; r <= radius; r++) {
				if (-q - r >= -radius && -q - r <= radius) { // Check if s is also within radius
					const x = HEX_WIDTH * 3/4 * q;
					const y = HEX_HEIGHT * (r + q / 2);
					this.hexes.push({ id: id++, q, r, s: -q-r, unitId: null, isP1Base: false, isP2Base: false, visualX: x, visualY: y });
				}
			}
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
		const ds = (-q1 - r1) - (-q2 - r2);
		return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
	},
	getHex(id, state) { return (state || this).hexes[id]; /*(state || this).hexes.find(h => h.id === id);*/ },
	getHexByQR(q, r, state) { return (state || this).hexes.find(h => h.q === q && h.r === r); },
	getUnitOnHex(hexId, state) {
		const hex = this.getHex(hexId, state);
		if (!hex || hex.unitId === null) return null;
		const [playerId, diceIndex] = hex.unitId.split('_').map(Number);

		let unit = (state || this).players[playerId]?.dice[diceIndex];
		return (!unit.isDeath) && unit;
	},
	getNeighbors(hex, state) {
		if (!hex) return [];
		return AXES.map(dir => this.getHexByQR(hex.q + dir.q, hex.r + dir.r, state)).filter(Boolean);
	},

	/* --- UI STYLING --- */
	gridContainerStyle() {
		const allX = this.hexes.map(h => h.visualX);
		const allY = this.hexes.map(h => h.visualY);
		const minX = Math.min(...allX);
		const maxX = Math.max(...allX);
		const minY = Math.min(...allY);
		const maxY = Math.max(...allY);
		const gridWidth = maxX - minX + HEX_WIDTH;
		const gridHeight = maxY - minY + HEX_HEIGHT; // Approx

		return `width: ${gridWidth}px; height: ${gridHeight}px;`;
	},
	hexColor(hex, state) {
		const unit = this.getUnitOnHex(hex.id, state);

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
		const allX = this.hexes.map(h => h.visualX);
		const allY = this.hexes.map(h => h.visualY);
		const minX = Math.min(...allX);
		const minY = Math.min(...allY);

		return `
			left: ${hex.visualX - minX + padding}px;
			top: ${hex.visualY - minY + padding}px;
			width: ${HEX_WIDTH - (padding << 1)}px;
			height: ${HEX_HEIGHT - (padding << 1)}px;
		`;
	},
	hoverHex(hexId){
		if (this.phase !== 'PLAYER_TURN') return;

		if (!hexId || (hexId && (this.selectedUnitHexId == hexId))) this.hovering = {};

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
			const roll = Math.floor(Math.random() * 6) + 1;
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
		if (indexInReroll > -1) {
			this.diceToReroll.splice(indexInReroll, 1);
		} else {
			if (this.diceToReroll.length < this.rules.maxRerolls) {
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
			const newRoll = Math.floor(Math.random() * 6) + 1;
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
		dieToDeploy.hexId = hexId;
		targetHex.unitId = dieToDeploy.id;
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
		this.resetTurnActionsForAllUnits();
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
		} else { // Normal selection mode
			if (unitOnClickedHex && unitOnClickedHex.playerId === this.currentPlayerIndex) {
				this.selectUnit(hexId);
			} else if (this.selectedUnitHexId !== null) { // Clicked on empty or enemy hex while a unit is selected (implies move/attack intent)
				// This could be simplified to require explicit action button click
				// For now, deselect if not a valid action target
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
		if (!state) return;
		this.selectedUnitHexId = null;
		this.validMoves = [];
		this.validTargets = [];
		this.validMerges = [];
		this.actionMode = null;
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
			attackerHex.unitId = null;
			defenderHex.unitId = attackerUnit.id;
			attackerUnit.hexId = targetHexId;
			attackerUnit.hasMovedOrAttackedThisTurn = true;
			attackerUnit.actionsTakenThisTurn++;
			this.deselectUnit(state); // Action complete
		}
		this.checkWinConditions(state);
	},
	performUnitReroll(unitHexId, state) {
		const unit = this.getUnitOnHex(unitHexId, state);
		if (!unit || unit.hasMovedOrAttackedThisTurn) return;

		const oldVal = unit.value;
		const newRoll = Math.floor(Math.random() * 6) + 1;
		unit.value = newRoll;
		Object.assign(unit, UNIT_STATS[newRoll]); // Update stats
		unit.currentArmor = UNIT_STATS[newRoll].armor;
		unit.armorReduction = 0; // Reset armor reduction
		unit.isGuarding = false; // Rerolling removes guard

		unit.hasMovedOrAttackedThisTurn = true;
		unit.actionsTakenThisTurn++;
		this.addLog(`P${unit.playerId + 1} D${oldVal} rerolled D${newRoll}.`, state);
		this.deselectUnit(state);
		this.checkWinConditions(state);
	},
	performGuard(unitHexId, state) {
		const unit = this.getUnitOnHex(unitHexId, state);
		if (!unit || unit.hasMovedOrAttackedThisTurn) return;

		unit.isGuarding = true;
		// Actual armor buff is applied during combat calculation
		unit.hasMovedOrAttackedThisTurn = true;
		unit.actionsTakenThisTurn++;
		this.addLog(`P${unit.playerId + 1} D${unit.value} guarded.`, state);
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
		this.handleCombat(attackerHexId, targetHexId, 'RANGED', state);
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
		this.handleCombat(attackerHexId, targetHexId, 'CONQUER', state);
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

		this.hexes.forEach(potentialTargetHex => {
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
						const checkQ = Math.round(attackerHex.q + stepQ * i);
						const checkR = Math.round(attackerHex.r + stepR * i);
						const intermediateHex = this.getHexByQR(checkQ, checkR, state);
						if (intermediateHex && (intermediateHex.id != attackerHexId) && this.getUnitOnHex(intermediateHex.id, state)) {
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

			if (this.getUnitOnHex(hex.id, state)) continue;

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

	/* --- COMBAT --- */
	handleCombat(attackerHexId, defenderHexId, combatType, state) { // combatType: 'MELEE', 'RANGED', 'CONQUER'
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

			if (combatType === 'MELEE' || (combatType === 'CONQUER' && attackerUnit.value === 6)) {
				// Attacker moves into vacated hex (melee, special, or if specifically allowed)
				attackerHex.unitId = null;
				defenderHex.unitId = attackerUnit.id;
				attackerUnit.hexId = defenderHex.id;
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

	/* --- TURN MANAGEMENT & WIN CONDITIONS --- */
	endTurn(state) {
		let isState = !!state;
		state = state || this;

		state.hovering = {};
		state.actionMode = null;
		state.validMoves = [];
		state.validMerges = [];
		state.validTargets = [];

		if (state.phase !== 'PLAYER_TURN') return;

		state.players[state.currentPlayerIndex].evaluation = this.boardEvaluation(state);
		this.addLog(`${state.players[state.currentPlayerIndex].isAI ? '[AI] ' : ''}P${state.currentPlayerIndex + 1}' turn ended (eval: ${state.players[state.currentPlayerIndex].evaluation}).`, isState ? state : undefined);
		this.addLog(`---`, isState ? state : undefined);

		this.deselectUnit(state); // Clear selection
		state.actionMode = null; // Clear action mode

		state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
		this.resetTurnActionsForAllUnits(state);

		state.players[state.currentPlayerIndex].evaluation = this.boardEvaluation(state);
		this.addLog(`${state.players[state.currentPlayerIndex].isAI ? '[AI] ' : ''}P${state.currentPlayerIndex + 1} turn started (eval: ${state.players[state.currentPlayerIndex].evaluation}).`, isState ? state : undefined);

		this.checkWinConditions(state); // Check at start of turn too (e.g. if opponent was eliminated on their own turn by some effect)

		if (isState) return;

		if (state.phase === 'PLAYER_TURN' && state.players[state.currentPlayerIndex].isAI) {
			this.performAITurn();
		} else if (this.debug?.autoPlay) {
			this.autoPlay();
		}
	},
	resetTurnActionsForAllUnits(state) {
		(state || this).players.forEach(player => {
			player.dice.forEach(die => {
				if(die.isDeployed) {
					die.hasMovedOrAttackedThisTurn = false;
					die.actionsTakenThisTurn = 0;
					// Guard status persists until the unit moves or rerolls.
				}
			});
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

	/* --- AI OPPONENT --- */
	performAITurn() {
		let choice = ['Simple', 'Analyze', 'Random', 'Minimax', 'Greedy'].random();
		choice = 'Greedy';
		this.addLog(`AI persona: ${choice}`);
		this['performAI_' + choice]();
	},
	performAI_Simple() { // Simple AI
		if (this.phase !== 'PLAYER_TURN' || !this.players[this.currentPlayerIndex].isAI) return;

		// this.addLog("AI is thinking...");

		const aiPlayer = this.players[this.currentPlayerIndex];
		const otherPlayer = this.players[(this.currentPlayerIndex + 1) % this.players.length];
		const aiUnits = aiPlayer.dice.filter(d => d.isDeployed && !d.isDeath);
		const opponentUnits = otherPlayer.dice.filter(d => d.isDeployed && !d.isDeath);
		const aiBaseHexId = aiPlayer.baseHexId;
		const opponentBaseHexId = otherPlayer.baseHexId;

		// Simple AI Strategy:
		// 1. If any unit can attack an enemy and win, do it. Prioritize units closer to opponent base?
		// 2. If no winning attacks, check for merges to create stronger units.
		// 3. If no good merges, move units towards the opponent's base, prioritizing units that can move.
		// 4. If no moves possible, Guard or Reroll (very basic - Guard nearby vulnerable units?)

		let actionTaken = false;

		// Prioritize Attacks
		for (const unit of aiUnits) {
			if (unit.hasMovedOrAttackedThisTurn) continue;

			this.selectedUnitHexId = unit.hexId; // Select the unit for calculation

			// Check for ranged attacks (Dice 5)
			if (unit.value === 5) {
				const targets = this.calcValidRangedTargets(unit.hexId);
				if (targets.length > 0) {
					// Simple: attack the first valid target
					const targetHexId = targets[0];
					this.addLog(`AI (Dice 5) performs Ranged Attack on hex ${targetHexId}`);
					this.performRangedAttack(unit.hexId, targetHexId);
					actionTaken = true;
					break; // AI performs one action per turn for now
				}
			}

			// Check for special attacks (Dice 6)
			if (unit.value === 6) {
				const targets = this.calcValidSpecialAttackTargets(unit.hexId);
				if (targets.length > 0) {
					// Simple: attack the first valid target
					const targetHexId = targets[0];
					this.addLog(`AI (Dice 6) performs Special Attack on hex ${targetHexId}`);
					this.performComandConquer(unit.hexId, targetHexId);
					actionTaken = true;
					break; // AI performs one action per turn for now
				}
			}

			// Check for Melee attacks (implicitly part of move)
			const validMoves = this.calcValidMoves(unit.hexId);
			for (const targetHexId of validMoves) {
				const targetUnit = this.getUnitOnHex(targetHexId);
				if (targetUnit && targetUnit.playerId !== aiPlayer.id) { // It's an enemy
					// Simple: Attack if possible. More complex AI would simulate combat outcome.
					this.addLog(`AI (Dice ${unit.value}) moves to attack unit at hex ${targetHexId}`);
					this.performMove(unit.hexId, targetHexId); // Move action triggers combat
					actionTaken = true;
					break; // AI performs one action per turn for now
				}
			}
			if(actionTaken) break;
		}

		// If no attack, try to merge (simple: merge with first valid friendly)
		if (false && !actionTaken) {
			for (const unit of aiUnits) {
				if (unit.hasMovedOrAttackedThisTurn) continue;
				this.selectedUnitHexId = unit.hexId;
				const validMerges = this.calcValidMoves(unit.hexId, true);
				if (validMerges.length > 0) {
					const targetHexId = validMerges[0];
					this.addLog(`AI (Dice ${unit.value}) attempts to merge with unit at hex ${targetHexId}`);
					this.performMerge(unit.hexId, targetHexId);
					actionTaken = true;
					// If merge results in a new unit that can act, the AI should try to use it.
					// For now, assume merge ends the unit's actions for the turn unless the rule grants it.
					break;
				}
			}
		}

		// If no attack or merge, move towards opponent base
		if (!actionTaken) {
			// Basic movement: find unit that hasn't moved, find a valid empty move target closest to opponent base.
			let bestMove = null;
			let closestDistance = Infinity;

			for (const unit of aiUnits) {
				if (unit.hasMovedOrAttackedThisTurn || unit.distance <= 0) continue;
				this.selectedUnitHexId = unit.hexId;
				const validMoves = this.calcValidMoves(unit.hexId); // Get moves to empty hexes

				for (const targetHexId of validMoves) {
					const targetHex = this.getHex(targetHexId);
					const opponentBaseHex = this.getHex(opponentBaseHexId);
					if (targetHex && opponentBaseHex) {
						const distanceToOpponentBase = this.axialDistance(targetHex.q, targetHex.r, opponentBaseHex.q, opponentBaseHex.r);
						if (distanceToOpponentBase < closestDistance) {
							closestDistance = distanceToOpponentBase;
							bestMove = { unitHexId: unit.hexId, targetHexId: targetHexId };
						}
					}
				}
			}

			if (bestMove) {
				this.addLog(`AI (Dice ${this.getUnitOnHex(bestMove.unitHexId).value}) moves towards opponent base.`);
				this.performMove(bestMove.unitHexId, bestMove.targetHexId);
				actionTaken = true;
			}
		}

		// If no action taken (no attacks, merges, or moves), Guard a unit or reroll (basic - just guard a random unit)
		if (!actionTaken) {
			const unitsToGuardOrReroll = aiUnits.filter(unit => !unit.hasMovedOrAttackedThisTurn);
			if (unitsToGuardOrReroll.length > 0) {
				const unitToActWith = unitsToGuardOrReroll.random();
				// For simplicity, AI always Guards if it can't move/attack/merge
				if (this.canPerformAction(unitToActWith.hexId, 'GUARD')) {
					this.addLog(`AI (Dice ${unitToActWith.value}) decides to Guard.`);
					this.performGuard(unitToActWith.hexId);
					actionTaken = true;
				}
				// Add Reroll logic here if desired (e.g., Reroll low value dice)
			}
		}

		// If no unit could perform any action, or all active units have acted, end turn.
		this.deselectUnit(); // Ensure unit is deselected before ending turn
		this.endTurn();
	},
	performAI_Greedy() { // Greedy AI
		if (this.phase !== 'PLAYER_TURN' || !this.players[this.currentPlayerIndex].isAI) return;

		// this.addLog("AI is greedy...");

		const aiPlayer = this.players[this.currentPlayerIndex];
		const otherPlayer = this.players[(this.currentPlayerIndex + 1) % this.players.length];
		const aiUnits = aiPlayer.dice.filter(d => d.isDeployed && !d.isDeath);
		const opponentUnits = otherPlayer.dice.filter(d => d.isDeployed && !d.isDeath);
		const aiBaseHexId = aiPlayer.baseHexId;
		const opponentBaseHexId = otherPlayer.baseHexId;

		const currentGameStateCopy = clone(this.$data);
		const initScore = this.boardEvaluation(currentGameStateCopy);
		let bestScore = -Infinity;
		let bestMove = null;

		// Iterate through all possible actions for all active AI units
		for (const unit of aiUnits) {
			if (unit.hasMovedOrAttackedThisTurn) continue;

			// Simulate Move actions
			const validMoves = this.calcValidMoves(unit.hexId, false, currentGameStateCopy);
			for (const targetHexId of validMoves) {
				const nextGameState = clone(currentGameStateCopy);
				this.performMove(unit.hexId, targetHexId, nextGameState);

				const evaluation = this.boardEvaluation(nextGameState);
				console.log('MOVE', unit.hexId, targetHexId, evaluation);
				if (evaluation > bestScore) {
					bestScore = evaluation;
					bestMove = { actionType: 'MOVE', unit: unit.value, unitHexId: unit.hexId, targetHexId: targetHexId };
				}
			}

			// Simulate Ranged Attack (Dice 5)
			if (unit.value === 5) {
				const validRangedTargets = this.calcValidRangedTargets(unit.hexId, currentGameStateCopy);
				for (const targetHexId of validRangedTargets) {
					const nextGameState = clone(currentGameStateCopy);
					this.performRangedAttack(unit.hexId, targetHexId, nextGameState);

					const evaluation = this.boardEvaluation(nextGameState);
					console.log('RANGED_ATTACK', unit.hexId, targetHexId, evaluation);
					if (evaluation > bestScore) {
						bestScore = evaluation;
						bestMove = { actionType: 'RANGED_ATTACK', unit: unit.value, unitHexId: unit.hexId, targetHexId: targetHexId };
					}
				}
			}

			// Simulate Command & Conquer (Dice 6)
			if (unit.value === 6) {
				const validSpecialTargets = this.calcValidSpecialAttackTargets(unit.hexId, currentGameStateCopy);
				for (const targetHexId of validSpecialTargets) {
					const nextGameState = clone(currentGameStateCopy);
					this.performComandConquer(unit.hexId, targetHexId, nextGameState);

					const evaluation = this.boardEvaluation(nextGameState);
					console.log('COMMAND_CONQUER', unit.hexId, targetHexId, evaluation);
					if (evaluation > bestScore) {
						bestScore = evaluation;
						bestMove = { actionType: 'COMMAND_CONQUER', unit: unit.value, unitHexId: unit.hexId, targetHexId: targetHexId };
					}
				}
			}

			// Simulate Brave Charge (Dice 1) - Simulate move and then attack logic
			if (unit.value === 1) {
				const validBraveChargeMoves = this.calcValidBraveChargeMoves(unit.hexId, currentGameStateCopy);
				for (const moveHexId of validBraveChargeMoves) {
					const nextGameStateAfterMove = clone(currentGameStateCopy);
					this.performMove(unit.hexId, moveHexId, nextGameStateAfterMove);

					// After moving, simulate the Brave Charge attack on eligible adjacent targets
					const potentialTargets = this.calcValidSpecialAttackTargets(moveHexId, nextGameStateAfterMove); // Special attack targets are adjacent
					for (const targetHexId of potentialTargets) {
						const targetUnit = this.getUnitOnHex(targetHexId, nextGameStateAfterMove);
						if (targetUnit && targetUnit.playerId !== unit.playerId && this.calcDefenderEffectiveArmor(targetHexId, nextGameStateAfterMove) >= 6) {
							const nextGameStateAfterCharge = clone(nextGameStateAfterMove);
							this.performBraveCharge(moveHexId, targetHexId, nextGameStateAfterCharge); // Needs to be implemented

							const evaluation = this.boardEvaluation(nextGameStateAfterCharge);
							console.log('BRAVE_CHARGE', unit.hexId, targetHexId, evaluation);
							if (evaluation > bestScore) {
								bestScore = evaluation;
								bestMove = { actionType: 'BRAVE_CHARGE', unit: unit.value, unitHexId: unit.hexId, targetHexId: targetHexId }; // Record the initial unit and final target
							}
						}
					}
				}
			}

			// Simulate Merge
			const validMerges = this.calcValidMoves(unit.hexId, true, currentGameStateCopy);
			for (const targetHexId of validMerges) {
				const nextGameState = clone(currentGameStateCopy);
				this.performMerge(unit.hexId, targetHexId, true, nextGameState);

				const evaluation = (initScore - 1) || this.boardEvaluation(nextGameState);// Merge is so random, score is unpredictable
				if (evaluation > bestScore) {
					bestScore = evaluation;
					bestMove = { actionType: 'MERGE', unit: unit.value, unitHexId: unit.hexId, targetHexId: targetHexId };
				}
			}

			// Simulate Reroll
			if (this.canPerformAction(unit.hexId, 'REROLL', currentGameStateCopy)) {
				const nextGameState = clone(currentGameStateCopy);
				this.performUnitReroll(unit.hexId, nextGameState);

				const evaluation = (initScore + 1) || this.boardEvaluation(nextGameState); // Reroll is so random, score is unpredictable
				if (evaluation > bestScore) {
					bestScore = evaluation;
					bestMove = { actionType: 'REROLL', unit: unit.value, unitHexId: unit.hexId };
				}
			}

			// Simulate Guard
			if (this.canPerformAction(unit.hexId, 'GUARD', currentGameStateCopy)) { 
				const nextGameState = clone(currentGameStateCopy);
				this.performGuard(unit.hexId, nextGameState);

				const evaluation = this.boardEvaluation(nextGameState);
				if (evaluation > bestScore) {
					bestScore = evaluation;
					bestMove = { actionType: 'GUARD', unit: unit.value, unitHexId: unit.hexId };
				}
			}
		}

		// If no action found improves the board state, consider a default action like Guarding or skipping turn
		if (bestMove === null) {
			const unitsToGuard = aiUnits.filter(unit => !unit.hasMovedOrAttackedThisTurn && this.canPerformAction(unit.hexId, 'GUARD', currentGameStateCopy));
			if (unitsToGuard.length > 0) {
				const unitToActWith = unitsToGuard.random();
				// Simple: if no better move, Guard a random unit
				bestMove = { unitHexId: unitToActWith.hexId, actionType: 'GUARD' }; // No target hex for Guard
			}
		}

		console.log('bestMove:', bestMove, ', evaluation:', initScore, '->', bestScore);

		if (!bestMove) return this.endTurn();

		switch (bestMove.actionType) {
			case 'MOVE': this.performMove(bestMove.unitHexId, bestMove.targetHexId); break;
			case 'RANGED_ATTACK': this.performRangedAttack(bestMove.unitHexId, bestMove.targetHexId); break;
			case 'COMMAND_CONQUER': this.performComandConquer(bestMove.unitHexId, bestMove.targetHexId); break;
			case 'BRAVE_CHARGE': this.performBraveCharge(bestMove.unitHexId, bestMove.targetHexId); break;
			case 'MERGE': this.performMerge(bestMove.unitHexId, bestMove.targetHexId, true); break;
			case 'REROLL': this.performUnitReroll(bestMove.unitHexId); break;
			case 'GUARD': this.performGuard(bestMove.unitHexId); break;
		}

		this.deselectUnit();
		this.endTurn();
	},
	performAI_Analyze() { // Strategic AI
		if (this.phase !== 'PLAYER_TURN' || !this.players[this.currentPlayerIndex].isAI) return;

		// this.addLog("AI is planning its turn...");

		const aiPlayer = this.players[this.currentPlayerIndex];
		const otherPlayer = this.players[(this.currentPlayerIndex + 1) % this.players.length];
		const aiUnits = aiPlayer.dice.filter(d => d.isDeployed && !d.isDeath);
		const opponentUnits = otherPlayer.dice.filter(d => d.isDeployed && !d.isDeath);
		const aiBaseHexId = aiPlayer.baseHexId;
		const opponentBaseHexId = otherPlayer.baseHexId;

		/* --- Improved AI Strategy --- */
		// Evaluate the board state
		const threats = this.analyzeThreats(aiUnits, opponentUnits, aiBaseHexId);
		const opportunities = this.analyzeOpportunities(aiUnits, opponentUnits, opponentBaseHexId);

		// Prioritize actions based on analysis
		let actionExecuted = false;

		// 1. Defend Base or Eliminate High-Value Threats
		for (const threat of threats) {
			// Prioritize threats to the base
			if (threat.type === 'baseThreat') {
				const defendingUnit = this.getUnitOnHex(threat.defendingUnitHexId);
				const attackingUnit = this.getUnitOnHex(threat.attackingUnitHexId);
				if (defendingUnit && !defendingUnit.hasMovedOrAttackedThisTurn) {
					// Try to attack the threatening unit
					this.selectedUnitHexId = defendingUnit.hexId;
					const validAttacks = this.calcValidMoves(defendingUnit.hexId).filter(hexId => this.getUnitOnHex(hexId)?.id === attackingUnit.id);
					if (validAttacks.length > 0) {
						this.addLog(`AI: Defending base - attacking threatening unit at hex ${threat.attackingUnitHexId}.`);
						this.performMove(defendingUnit.hexId, threat.attackingUnitHexId); // Melee attack by moving
						actionExecuted = true;
						break;
					}
					// If no direct attack, consider moving a unit to block or guard
					// (More complex: find nearest unit that can move to intercept)
				}
			}

			// Prioritize eliminating high-value opponent units if possible
			if (!actionExecuted && threat.type === 'unitThreat' && threat.attackerValue >= 4) { // Consider Dice 4, 5, 6 high-value
				const defendingUnit = this.getUnitOnHex(threat.defendingUnitHexId);
				const attackingUnit = this.getUnitOnHex(threat.attackingUnitHexId);
				if (defendingUnit && !defendingUnit.hasMovedOrAttackedThisTurn) {
					this.selectedUnitHexId = defendingUnit.hexId;
					// Check for direct attacks (melee, ranged, special)
					if (defendingUnit.value === 5) {
						const rangedTargets = this.calcValidRangedTargets(defendingUnit.hexId);
						if (rangedTargets.includes(attackingUnit.hexId)) {
							this.addLog(`AI: Eliminating high-value threat - performing Ranged Attack on hex ${attackingUnit.hexId}.`);
							this.performRangedAttack(defendingUnit.hexId, attackingUnit.hexId);
							actionExecuted = true;
							break;
						}
					}
					if (!actionExecuted && defendingUnit.value === 6) {
						const specialTargets = this.calcValidSpecialAttackTargets(defendingUnit.hexId);
						if (specialTargets.includes(attackingUnit.hexId)) {
							this.addLog(`AI: Eliminating high-value threat - performing Special Attack on hex ${attackingUnit.hexId}.`);
							this.performComandConquer(defendingUnit.hexId, attackingUnit.hexId);
							actionExecuted = true;
							break;
						}
					}
					if (!actionExecuted) {
						const validMoves = this.calcValidMoves(defendingUnit.hexId);
						if (validMoves.includes(attackingUnit.hexId)) {
							this.addLog(`AI: Eliminating high-value threat - moving to attack unit at hex ${attackingUnit.hexId}.`);
							this.performMove(defendingUnit.hexId, attackingUnit.hexId); // Melee attack by moving
							actionExecuted = true;
							break;
						}
					}
				}
			}
			if(actionExecuted) break;
		}

		// 2. Strengthen Units (Merge)
		if (false && !actionExecuted) {
			// Look for good merge opportunities (e.g., merging two 3s to a 6, or creating a unit that can immediately act and attack)
			let bestMerge = null;
			// Simple merge logic: find the first available merge
			for (const unit of aiUnits) {
				if (unit.hasMovedOrAttackedThisTurn) continue;
				this.selectedUnitHexId = unit.hexId;
				const validMerges = this.calcValidMoves(unit.hexId, true);
				if (validMerges.length > 0) {
					// Simple: take the first valid merge
					bestMerge = { mergingUnitHexId: unit.hexId, targetUnitHexId: validMerges[0] };
					break;
				}
			}

			if (bestMerge) {
				this.addLog(`AI: Merging units at hex ${bestMerge.mergingUnitHexId} and ${bestMerge.targetUnitHexId}.`);
				this.performMerge(bestMerge.mergingUnitHexId, bestMerge.targetUnitHexId, true);
				actionExecuted = true;
				// Note: If merge results in a unit that can act, the AI needs another loop to use it.
				// For simplicity now, assume merge ends the action for the turn.
			}
		}

		// 3. Attack Weaker Enemies or Advance
		if (!actionExecuted) {
			// Prioritize attacking any enemy unit within reach
			let bestAttackOrMove = null;

			for (const unit of aiUnits) {
				if (unit.hasMovedOrAttackedThisTurn) continue;
				this.selectedUnitHexId = unit.hexId;

				// Check for direct attacks (ranged, special, melee)
				const rangedTargets = (unit.value === 5) ? this.calcValidRangedTargets(unit.hexId) : [];
				const specialTargets = (unit.value === 6) ? this.calcValidSpecialAttackTargets(unit.hexId) : [];
				const meleeTargets = this.calcValidMoves(unit.hexId).filter(hexId => this.getUnitOnHex(hexId)?.playerId !== aiPlayer.id);

				if (rangedTargets.length > 0) {
					bestAttackOrMove = { type: 'RANGED_ATTACK', unitHexId: unit.hexId, targetHexId: rangedTargets[0] };
					break;
				}
				if (specialTargets.length > 0) {
					bestAttackOrMove = { type: 'SPECIAL_ATTACK', unitHexId: unit.hexId, targetHexId: specialTargets[0] };
					break;
				}
				if (meleeTargets.length > 0) {
					bestAttackOrMove = { type: 'MELEE_ATTACK', unitHexId: unit.hexId, targetHexId: meleeTargets[0] };
					break;
				}

				// If no attack, find the best move towards the opponent's base
				const validMoves = this.calcValidMoves(unit.hexId);
				let closestDistance = Infinity;
				let bestMoveTarget = null;
				const opponentBaseHex = this.getHex(opponentBaseHexId);

				for (const targetHexId of validMoves) {
					const targetHex = this.getHex(targetHexId);
					if (targetHex && opponentBaseHex) {
						const distanceToOpponentBase = this.axialDistance(targetHex.q, targetHex.r, opponentBaseHex.q, opponentBaseHex.r);
						if (distanceToOpponentBase < closestDistance) {
							closestDistance = distanceToOppanceBase;
							bestMoveTarget = targetHexId;
						}
					}
				}
				if (bestMoveTarget) {
					// Simple: Take the first unit that can move towards the base
					bestAttackOrMove = { type: 'MOVE', unitHexId: unit.hexId, targetHexId: bestMoveTarget };
					break;
				}
			}

			if (bestAttackOrMove) {
				if (bestAttackOrMove.type === 'MOVE') {
					this.addLog(`AI: Moving unit at hex ${bestAttackOrMove.unitHexId} towards opponent base.`);
					this.performMove(bestAttackOrMove.unitHexId, bestAttackOrMove.targetHexId);
				} else if (bestAttackOrMove.type === 'MELEE_ATTACK') {
					this.addLog(`AI: Attacking unit at hex ${bestAttackOrMove.targetHexId} with unit at hex ${bestAttackOrMove.unitHexId}.`);
					this.performMove(bestAttackOrMove.unitHexId, bestAttackOrMove.targetHexId); // Melee is a move
				} else if (bestAttackOrMove.type === 'RANGED_ATTACK') {
					this.addLog(`AI: Performing Ranged Attack on unit at hex ${bestAttackOrMove.targetHexId} with unit at hex ${bestAttackOrMove.unitHexId}.`);
					this.performRangedAttack(bestAttackOrMove.unitHexId, bestAttackOrMove.targetHexId);
				} else if (bestAttackOrMove.type === 'SPECIAL_ATTACK') {
					this.addLog(`AI: Performing Special Attack on unit at hex ${bestAttackOrMove.targetHexId} with unit at hex ${bestAttackOrMove.unitHexId}.`);
					this.performComandConquer(bestAttackOrMove.unitHexId, bestAttackOrMove.targetHexId);
				}
				actionExecuted = true;
			}
		}

		// 4. Guard Vulnerable Units or Reroll
		if (!actionExecuted) {
			// Identify vulnerable units (e.g., low armor, exposed position)
			const vulnerableUnits = aiUnits.filter(unit => !unit.hasMovedOrAttackedThisTurn && this.isUnitVulnerable(unit.hexId, opponentUnits));
			if (vulnerableUnits.length > 0) {
				// Simple: Guard the first vulnerable unit
				const unitToGuard = vulnerableUnits[0];
				if (this.canPerformAction(unitToGuard.hexId, 'GUARD')) {
					this.addLog(`AI: Guarding vulnerable unit at hex ${unitToGuard.hexId}.`);
					this.performGuard(unitToGuard.hexId);
					actionExecuted = true;
				}
			}
		}

		// 5. Reroll Low-Value Dice (as a last resort)
		if (!actionExecuted) {
			const unitsToReroll = aiUnits.filter(unit => !unit.hasMovedOrAttackedThisTurn && unit.value < 4); // Reroll Dice 1, 2, 3
			if (unitsToReroll.length > 0) {
				const unitToReroll = unitsToReroll[0];
				if (this.canPerformAction(unitToReroll.hexId, 'REROLL')) {
					this.addLog(`AI: Rerolling low-value dice at hex ${unitToReroll.hexId}.`);
					this.performUnitReroll(unitToReroll.hexId);
					actionExecuted = true;
				}
			}
		}

		// If no action was taken, end the turn.
		this.deselectUnit(); // Ensure unit is deselected before ending turn
		this.endTurn();
	},
	performAI_Random() { // Random AI
		if (this.phase !== 'PLAYER_TURN' || !this.players[this.currentPlayerIndex].isAI) return;

		// this.addLog("AI is acting randomly...");

		const aiPlayer = this.players[this.currentPlayerIndex];
		const aiUnits = aiPlayer.dice.filter(d => d.isDeployed && !d.isDeath && !d.hasMovedOrAttackedThisTurn);

		if (aiUnits.length === 0) {
			this.addLog("AI has no units that can act. Ending turn.");
			this.endTurn();
			return;
		}

		const unitToActWith = aiUnits.random();
		this.selectedUnitHexId = unitToActWith.hexId;

		const possibleActions = ['MOVE', 'REROLL', /*'GUARD',*/ 'MERGE'];
		if (unitToActWith.value === 5) possibleActions.push('RANGED_ATTACK');
		if (unitToActWith.value === 6) possibleActions.push('SPECIAL_ATTACK');
		// if (unitToActWith.value === 1) possibleActions.push('BRAVE_CHARGE');

		// Filter actions the unit *can* perform based on game rules (not just strategy)
		const validActions = possibleActions.filter(action => this.canPerformAction(unitToActWith.hexId, action));

		if (validActions.length === 0) {
			this.addLog(`AI (Dice ${unitToActWith.value}) at hex ${unitToActWith.hexId} has no valid actions. Ending turn.`);
			this.deselectUnit();
			this.endTurn();
			return;
		}

		const chosenAction = validActions.random();
		this.addLog(`AI (Dice ${unitToActWith.value}) at hex ${unitToActWith.hexId} chooses action: ${chosenAction}`);

		this.initiateAction(chosenAction); // This calculates valid targets/moves

		let targetHexId = null;
		if (this.validMoves.length > 0 && ['MOVE', 'MERGE', 'BRAVE_CHARGE'].includes(chosenAction)) {
			targetHexId = this.validMoves.random();
		} else if (this.validTargets.length > 0 && ['RANGED_ATTACK', 'SPECIAL_ATTACK'].includes(chosenAction)) {
			targetHexId = this.validTargets.random();
		}

		if (['REROLL', 'GUARD'].includes(chosenAction)) {
			this.performAction(chosenAction, this.selectedUnitHexId);
		}

		if (targetHexId !== null) {
			this.completeAction(targetHexId); // Perform the action with the chosen target
		}
		// If no target found for a target-based action, the action fails gracefully, and the turn ends.
	},
	performAI_Minimax() { // Minimax AI
		if (this.phase !== 'PLAYER_TURN' || !this.players[this.currentPlayerIndex].isAI) return;

		// this.addLog("Minimax AI is thinking...");

		const aiPlayer = this.players[this.currentPlayerIndex];
		const aiUnits = aiPlayer.dice.filter(d => d.isDeployed && !d.isDeath && !d.hasMovedOrAttackedThisTurn);

		if (aiUnits.length === 0) {
			this.addLog("Minimax AI has no units that can act. Ending turn.");
			this.endTurn();
			return;
		}

		// Find the best move using the Minimax algorithm
		// We need to pass a copy of the current game state to minimax
		const currentGameStateCopy = clone(this.$data); // Copy the game state
		const bestMove = this.findBestMove(currentGameStateCopy, 3); // Search depth of 3 (can adjust)

		if (bestMove) {
			const unitToAct = this.getUnitOnHex(bestMove.unitHexId);
			const targetHex = this.getHex(bestMove.targetHexId);

			this.selectedUnitHexId = bestMove.unitHexId; // Select the unit for the action

			// Determine the action type based on the best move
			let actionType = null;
			const unit = this.getUnitOnHex(bestMove.unitHexId);
			const targetUnit = this.getUnitOnHex(bestMove.targetHexId);

			// Logic to determine action type (this needs to be more robust)
			// - If target is empty and move is valid for unit's movement type, it's a MOVE
			// - If target is enemy and move is valid, it's a MELEE attack (handled by performMove)
			// - If unit is Dice 5 and target is in ranged attack range, it's a RANGED_ATTACK
			// - If unit is Dice 6 and target is adjacent enemy, it's a SPECIAL_ATTACK
			// - If target is friendly and move is valid, it's a MERGE

			 const validMoves = this.calcValidMoves(bestMove.unitHexId);
			 const validRangedTargets = (unit?.value === 5) ? this.calcValidRangedTargets(unit.hexId) : [];
			 const validSpecialTargets = (unit?.value === 6) ? this.calcValidSpecialAttackTargets(unit.hexId) : [];
			 const validMerges = this.calcValidMoves(unit.hexId, true);

			if (validMoves.includes(bestMove.targetHexId) && !targetUnit) {
				 actionType = 'MOVE';
			 } else if (validMoves.includes(bestMove.targetHexId) && targetUnit?.playerId !== aiPlayer.id) {
				 actionType = 'MOVE'; // Melee attack
			 } else if (unit?.value === 5 && validRangedTargets.includes(bestMove.targetHexId)) {
				 actionType = 'RANGED_ATTACK';
			 } else if (unit?.value === 6 && validSpecialTargets.includes(bestMove.targetHexId)) {
				 actionType = 'SPECIAL_ATTACK';
			 } else if (validMerges.includes(bestMove.targetHexId)) {
				 actionType = 'MERGE';
			 } else {
				 // If no specific action type is identified, default to MOVE or handle other actions
				 // For now, if bestMove leads to no clear action, the AI might not act effectively
				 // This needs more sophisticated action determination based on the Minimax result
				 this.addLog("Minimax AI: Could not determine action type for best move.");
				 this.deselectUnit();
				 this.endTurn();
				 return;
			 }


			this.addLog(`Minimax AI: Performing ${actionType} with Dice ${unitToAct.value} from hex ${bestMove.unitHexId} to hex ${bestMove.targetHexId}.`);

			// Perform the action based on the determined type
			if (actionType === 'MOVE') this.performMove(bestMove.unitHexId, bestMove.targetHexId);
			else if (actionType === 'RANGED_ATTACK') this.performRangedAttack(bestMove.unitHexId, bestMove.targetHexId);
			else if (actionType === 'SPECIAL_ATTACK') this.performComandConquer(bestMove.unitHexId, bestMove.targetHexId);
			else if (actionType === 'MERGE') this.performMerge(bestMove.unitHexId, bestMove.targetHexId, true); // Pass true for AI merge
			// TODO: Add logic for Reroll and Guard if Minimax determines these are the best moves

		} else {
			this.addLog("Minimax AI: No best move found or no available actions. Ending turn.");
		}

		this.deselectUnit(); // Deselect unit after action
		this.endTurn(); // End AI turn
	},

	/* --- AI HELPER FUNCTIONS --- */
	boardEvaluation(state) {
		state = state || this;

		const aiPlayerIndex = state.currentPlayerIndex; // Assuming the AI is the current player for evaluation
		const opponentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;

		const aiPlayer = state.players[aiPlayerIndex];
		const opponentPlayer = state.players[opponentPlayerIndex];

		const aiUnits = aiPlayer.dice.filter(d => d.isDeployed && !d.isDeath);
		const opponentUnits = opponentPlayer.dice.filter(d => d.isDeployed && !d.isDeath);

		let score = 0;

		// 1. Unit Count and Value
		score += (aiUnits.length * EVALUATION_WEIGHT.UNIT_COUNT); // Award points for each AI unit
		score -= (opponentUnits.length * EVALUATION_WEIGHT.UNIT_COUNT); // Penalize for each opponent unit

		aiUnits.forEach(unit => {
			score += (unit.value * EVALUATION_WEIGHT.UNIT_FACTOR); // Add unit value to score
			if (unit.isGuarding) score += EVALUATION_WEIGHT.GUARD; // Bonus for guarding units
		});

		opponentUnits.forEach(unit => {
			score -= (unit.value * EVALUATION_WEIGHT.UNIT_FACTOR); // Penalize for opponent unit value
		});

		// 2. Positional Scoring (towards opponent's base)
		const opponentBaseHex = this.getHex(opponentPlayer.baseHexId, state);
		if (opponentBaseHex) {
			aiUnits.forEach(unit => {
				const unitHex = this.getHex(unit.hexId, state);
				if (unitHex) {
					const distanceToOpponentBase = this.axialDistance(unitHex.q, unitHex.r, opponentBaseHex.q, opponentBaseHex.r);
					// The closer to the opponent's base, the higher the score
					score += ((R * 2 - distanceToOpponentBase) * EVALUATION_WEIGHT.DISTANCE); // R*2 is roughly max distance
				}
			});
		}

		// 3. Threat and Vulnerability (simplified)
		let totalThreatScore = 0;
		let totalVulnerabilityScore = 0;

		// Calculate threat score for each AI unit
		aiUnits.forEach(aiUnit => {
			let aiUnitThreat = 0;
			opponentUnits.forEach(opponentUnit => {
				if (this.canUnitAttackTarget(opponentUnit, aiUnit, state)) {
					aiUnitThreat += opponentUnit.attack;
				}
			});
			totalThreatScore += aiUnitThreat;
		});

		// Calculate vulnerability score for each opponent unit
		opponentUnits.forEach(opponentUnit => {
			let opponentUnitVulnerability = 0;
			aiUnits.forEach(aiUnit => {
				if (this.canUnitAttackTarget(aiUnit, opponentUnit, state)) {
					opponentUnitVulnerability += aiUnit.attack;
				}
			});
			totalVulnerabilityScore += opponentUnitVulnerability;
		});

		score -= (totalThreatScore * EVALUATION_WEIGHT.THREAT); // Penalize for AI units being threatened
		score += (totalVulnerabilityScore * EVALUATION_WEIGHT.VULNERABLE); // Reward for opponent units being vulnerable

		// Consider merges
		aiUnits.forEach(aiUnit => {
			const validMerges = this.calcValidMoves(aiUnit.hexId, true, state);
			validMerges.forEach(mergeTargetHexId => {
				const targetUnit = this.getUnitOnHex(mergeTargetHexId, state);
				if (targetUnit) {
					score -= (aiUnit.value + targetUnit.value);
					score += (aiUnit.value + targetUnit.value) > 6 ? EVALUATION_WEIGHT.MERGE_GT_6 : (aiUnit.value + targetUnit.value);
				}
			});
		});

		// Brave Charge opportunities
		aiUnits.forEach(aiUnit => {
			if (aiUnit.value === 1) {
				const braveChargeMoves = this.calcValidBraveChargeMoves(aiUnit.hexId);
				braveChargeMoves.forEach(moveHexId => {
					// Check neighbors of the potential move hex for high armor enemy targets
					const moveHex = this.getHex(moveHexId, state);
					this.getNeighbors(moveHex, state).forEach(neighborHex => {
						const targetUnit = this.getUnitOnHex(neighborHex.id, state);
						if (targetUnit && targetUnit.playerId !== aiPlayerIndex && this.calcDefenderEffectiveArmor(neighborHex.id, state) >= 6) {
							score += (targetUnit.value * EVALUATION_WEIGHT.BRAVE_CHARGE); // Reward for potential Brave Charge on high-value enemy
						}
					});
				});
			}
		});

		// 4. Check Win/Loss conditions (Highest priority)
		if (state.phase === 'GAME_OVER') {
			if (state.winnerPlayerIndex === aiPlayerIndex) score = Infinity; // AI wins
			else if (state.winnerPlayerIndex === opponentPlayerIndex) score = -Infinity; // AI loses
			else score = 0; // Draw
		}

		return score;
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
	findBestMove(state, depth) {
		let bestScore = -Infinity;
		let bestMove = null;

		state = state || this;

		// Generate possible moves for the AI player
		const aiPlayer = state.players[state.currentPlayerIndex];
		const aiUnits = aiPlayer.dice.filter(d => d.isDeployed && !d.isDeath);
		const currentScore = this.boardEvaluation(state);

		 // Iterate through all possible actions for all active AI units
		 // Need to consider Move, Reroll, Guard, Ranged Attack, Special Attack, Merge

		 for (const unit of aiUnits) {
			// Simulate Move actions
			const validMoves = this.calcValidMoves(unit.hexId, state); // Need to make calcValidMoves work with the passed state

			for (const targetHexId of validMoves) {
				const nextGameState = clone(state);

				 // Apply the move in the copied state (needs to be implemented correctly)
				 // This simulation logic is crucial and needs to be accurate for all action types

				 // After simulating the move:
				 // 1. Update the unit's position
				 // 2. Handle potential combat and update units/hexes accordingly
				 // 3. Update win conditions in nextGameState
				 // 4. Switch the current player in nextGameState

				 // Call minimax for the opponent (minimizing player)
				const score = this.minimax(nextGameState, depth - 1, true);

				// Update bestScore and bestMove
				if (score > bestScore) {
					bestScore = score;
					// Store the move that led to this score
					bestMove = { unitHexId: unit.hexId, targetHexId: targetHexId, actionType: 'MOVE', score, currentScore }; // Store action type
				}
			}

			// TODO: Simulate Reroll, Guard, Ranged Attack, Special Attack, Merge actions
			// For each action, create nextGameState, apply the action, call minimax, and update bestScore/bestMove
		 }

		return bestMove; // Return the move (unitHexId, targetHexId, actionType) that leads to the best score
	},
	minimax(state, depth, maximizingPlayer) {
		// Base case: If depth is 0 or game is over, return the evaluated score
		if (depth === 0 || state.phase === 'GAME_OVER') {
			// Evaluate the state from the perspective of the maximizing player (AI)
			return this.boardEvaluation(state); // Assuming boardEvaluation is for the AI
		}

		// If maximizing player (AI)
		if (maximizingPlayer) {
			let maxScore = -Infinity;
			let bestMove = null; // To store the best move at the root

			// Generate possible moves for the current player
			const currentPlayer = state.players[state.currentPlayerIndex];
			const activeUnits = currentPlayer.dice.filter(d => d.isDeployed && !d.isDeath);

			for (const unit of activeUnits) {
				// Need to simulate all possible actions for the unit
				// This is a simplified example, would need to handle different action types (move, attack, etc.)
				// And their resulting game states

				// Example: Simulate moving to each valid move hex
				const validMoves = this.calcValidMoves(unit.hexId, state); // This needs access to the current state

				for (const targetHexId of validMoves) {
					// Create a deep copy of the game state to simulate the move
					const nextGameState = clone(state); // Simple deep copy, might need a more robust method

					// Apply the move to nextGameState (This part is complex and depends on your game state structure)
					// Find the unit and hex in the copied state and update
					const unitInNextState = nextGameState.players[nextGameState.currentPlayerIndex].dice.find(d => d.id === unit.id);
					const currentHexInNextState = nextGameState.hexes.find(hex => hex.id === unit.hexId);
					const targetHexInNextState = nextGameState.hexes.find(hex => hex.id === targetHexId);

					if (unitInNextState && currentHexInNextState && targetHexInNextState) {
						// Handle potential combat in the simulated move
						const targetUnitInNextState = nextGameState.hexes.find(hex => hex.id === targetHexId)?.unitId ?
													nextGameState.players[(nextGameState.currentPlayerIndex + 1) % nextGameState.players.length].dice.find(d => d.id === nextGameState.hexes.find(hex => hex.id === targetHexId).unitId) : null;

						if (targetUnitInNextState) {
							// Simulate combat logic here (based on your handleCombat function)
							// This is a simplification: assume attacker wins if attack >= defender armor
							const attackerEffectiveArmor = this.calcDefenderEffectiveArmor({ ...nextGameState, hexes: [ unitInNextState ] }, state); // Needs refinement
							const defenderEffectiveArmor = this.calcDefenderEffectiveArmor({ ...nextGameState, hexes: [ targetUnitInNextState ] }, state); // Needs refinement

							if (unitInNextState.attack >= defenderEffectiveArmor) {
								// Attacker wins, remove defender
								targetHexInNextState.unitId = null;
								targetUnitInNextState.isDeath = true;
								// Move attacker
								currentHexInNextState.unitId = null;
								targetHexInNextState.unitId = unitInNextState.id;
								unitInNextState.hexId = targetHexId;
							} else {
								// Attacker fails, stays put, defender armor reduced
								targetUnitInNextState.armorReduction++;
							}

						} else {
							// Move to empty hex
							currentHexInNextState.unitId = null;
							targetHexInNextState.unitId = unitInNextState.id;
							unitInNextState.hexId = targetHexId;
						}

						// After simulating the move, it's the opponent's turn
						nextGameState.currentPlayerIndex = (nextGameState.currentPlayerIndex + 1) % nextGameState.players.length;
						// Need to update state.phase based on simulated win conditions

						// Recursive call for the opponent (minimizing player)
						const score = this.minimax(nextGameState, depth - 1, false);
						console.log('minimax.score', depth, score)

						// Update maxScore if the current move leads to a better score
						if (score > maxScore) {
							maxScore = score;
							if (depth === 3) { // If at the root (initial call depth), store the move
								bestMove = { unitHexId: unit.hexId, targetHexId: targetHexId };
							}
						}
					}
				}
				// TODO: Simulate other actions like Reroll, Guard, Ranged Attack, Special Attack, Merge
			}

			if (depth === 3) { // Return the best move at the root
				return bestMove;
			}

			return maxScore; // Return the best score at other levels
		} else { // If minimizing player (Opponent)
			let minScore = Infinity;

			// Generate possible moves for the current player (opponent)
			// This part needs to simulate opponent's moves and call minimax(nextGameState, depth - 1, true)
			// For simplicity in this placeholder, it just returns a default value.
			// You would iterate through opponent's units and their possible actions here,
			// simulate each, get the resulting state, and call minimax recursively.

			return minScore; // Return the minimum score
		}
	},
	analyzeThreats(aiUnits, opponentUnits, aiBaseHexId) {
		const threats = [];
		const aiBaseHex = this.getHex(aiBaseHexId);

		// Check for threats to the AI base
		opponentUnits.forEach(enemyUnit => {
			if (!enemyUnit.isDeath) {
				this.selectedUnitHexId = enemyUnit.hexId; // Select enemy unit to calculate its potential moves/targets
				const enemyMoves = this.calcValidMoves(enemyUnit.hexId);
				const enemyRangedTargets = (enemyUnit.value === 5) ? this.calcValidRangedTargets(enemyUnit.hexId) : [];
				const enemySpecialTargets = (enemyUnit.value === 6) ? this.calcValidSpecialAttackTargets(enemyUnit.hexId) : [];

				if (enemyMoves.includes(aiBaseHexId) || enemyRangedTargets.includes(aiBaseHexId) || enemySpecialTargets.includes(aiBaseHexId)) {
					threats.push({
						type: 'baseThreat',
						attackingUnitHexId: enemyUnit.hexId,
						defendingUnitHexId: aiBaseHexId, // The base itself
						distance: this.axialDistance(this.getHex(enemyUnit.hexId).q, this.getHex(enemyUnit.hexId).r, aiBaseHex.q, aiBaseHex.r),
						attackerValue: enemyUnit.value
					});
				}

				// Check for threats to individual AI units
				aiUnits.forEach(aiUnit => {
					if (!aiUnit.isDeath) {
						if (enemyMoves.includes(aiUnit.hexId) || enemyRangedTargets.includes(aiUnit.hexId) || enemySpecialTargets.includes(aiUnit.hexId)) {
							threats.push({
								type: 'unitThreat',
								attackingUnitHexId: enemyUnit.hexId,
								defendingUnitHexId: aiUnit.hexId,
								distance: this.axialDistance(this.getHex(enemyUnit.hexId).q, this.getHex(enemyUnit.hexId).r, this.getHex(aiUnit.hexId).q, this.getHex(aiUnit.hexId).r),
								attackerValue: enemyUnit.value,
								defenderValue: aiUnit.value,
								// More advanced: assess combat outcome likelihood
							});
						}
					}
				});
			}
		});

		// Sort threats (e.g., base threats first, then closer, then higher value attackers)
		threats.sort((a, b) => {
			if (a.type === 'baseThreat' && b.type !== 'baseThreat') return -1;
			if (a.type !== 'baseThreat' && b.type === 'baseThreat') return 1;
			if (a.distance !== b.distance) return a.distance - b.distance;
			return b.attackerValue - a.attackerValue;
		});

		this.deselectUnit(); // Clean up selection used for calculation
		return threats;
	},
	analyzeOpportunities(aiUnits, opponentUnits, opponentBaseHexId) {
		const opportunities = [];
		const opponentBaseHex = this.getHex(opponentBaseHexId);

		// Look for attack opportunities on opponent units or base
		aiUnits.forEach(aiUnit => {
			if (!aiUnit.hasMovedOrAttackedThisTurn && !aiUnit.isDeath) {
				this.selectedUnitHexId = aiUnit.hexId;
				const validMoves = this.calcValidMoves(aiUnit.hexId);
				const validRangedTargets = (aiUnit.value === 5) ? this.calcValidRangedTargets(aiUnit.hexId) : [];
				const validSpecialTargets = (aiUnit.value === 6) ? this.calcValidSpecialAttackTargets(aiUnit.hexId) : [];

				// Check for attacks on opponent base
				if (validMoves.includes(opponentBaseHexId) || validRangedTargets.includes(opponentBaseHexId) || validSpecialTargets.includes(opponentBaseHexId)) {
					opportunities.push({
						type: 'attackBase',
						unitHexId: aiUnit.hexId,
						targetHexId: opponentBaseHexId,
						unitValue: aiUnit.value,
						distance: this.axialDistance(this.getHex(aiUnit.hexId).q, this.getHex(aiUnit.hexId).r, opponentBaseHex.q, opponentBaseHex.r),
						action: validMoves.includes(opponentBaseHexId) ? 'MOVE' : (aiUnit.value === 5 ? 'RANGED_ATTACK' : 'SPECIAL_ATTACK')
					});
				}

				// Check for attacks on opponent units
				opponentUnits.forEach(enemyUnit => {
					if (!enemyUnit.isDeath) {
						if (validMoves.includes(enemyUnit.hexId)) {
							opportunities.push({
								type: 'attackUnit',
								unitHexId: aiUnit.hexId,
								targetHexId: enemyUnit.hexId,
								unitValue: aiUnit.value,
								targetValue: enemyUnit.value,
								distance: this.axialDistance(this.getHex(aiUnit.hexId).q, this.getHex(aiUnit.hexId).r, this.getHex(enemyUnit.hexId).q, this.getHex(enemyUnit.hexId).r),
								action: 'MOVE' // Melee attack
								// More advanced: include combat outcome prediction
							});
						} else if (validRangedTargets.includes(enemyUnit.hexId)) {
							opportunities.push({
								type: 'attackUnit',
								unitHexId: aiUnit.hexId,
								targetHexId: enemyUnit.hexId,
								unitValue: aiUnit.value,
								targetValue: enemyUnit.value,
								distance: this.axialDistance(this.getHex(aiUnit.hexId).q, this.getHex(aiUnit.hexId).r, this.getHex(enemyUnit.hexId).q, this.getHex(enemyUnit.hexId).r),
								action: 'RANGED_ATTACK'
							});
						} else if (validSpecialTargets.includes(enemyUnit.hexId)) {
							opportunities.push({
								type: 'attackUnit',
								unitHexId: aiUnit.hexId,
								targetHexId: enemyUnit.hexId,
								unitValue: aiUnit.value,
								targetValue: enemyUnit.value,
								distance: this.axialDistance(this.getHex(aiUnit.hexId).q, this.getHex(aiUnit.hexId).r, this.getHex(enemyUnit.hexId).q, this.getHex(enemyUnit.hexId).r),
								action: 'SPECIAL_ATTACK'
							});
						}
					}
				});

				// Look for merge opportunities
				const validMerges = this.calcValidMoves(aiUnit.hexId, true);
				validMerges.forEach(mergeTargetHexId => {
					const targetUnit = this.getUnitOnHex(mergeTargetHexId);
					if (targetUnit) {
						opportunities.push({
							type: 'merge',
							unitHexId: aiUnit.hexId,
							targetHexId: mergeTargetHexId,
							unitValue: aiUnit.value,
							targetValue: targetUnit.value,
							resultingValue: aiUnit.value + targetUnit.value > 6 ? 6 : aiUnit.value + targetUnit.value, // Simplified
							canResultUnitAct: targetUnit.actionsTakenThisTurn === 0,
							distance: this.axialDistance(this.getHex(aiUnit.hexId).q, this.getHex(aiUnit.hexId).r, this.getHex(targetUnit.hexId).q, this.getHex(targetUnit.hexId).r)
						});
					}
				});

				// Look for safe movement options towards opponent base
				validMoves.forEach(moveTargetHexId => {
					// Simple check: Is this move towards the opponent base and is the hex empty?
					const moveTargetHex = this.getHex(moveTargetHexId);
					if (!this.getUnitOnHex(moveTargetHexId) && this.axialDistance(moveTargetHex.q, moveTargetHex.r, opponentBaseHex.q, opponentBaseHex.r) < this.axialDistance(this.getHex(aiUnit.hexId).q, this.getHex(aiUnit.hexId).r, opponentBaseHex.q, opponentBaseHex.r)) {
						opportunities.push({
							type: 'advance',
							unitHexId: aiUnit.hexId,
							targetHexId: moveTargetHexId,
							unitValue: aiUnit.value,
							distanceToOpponentBase: this.axialDistance(moveTargetHex.q, moveTargetHex.r, opponentBaseHex.q, opponentBaseHex.r),
						});
					}
				});
			}
		});

		// Sort opportunities (e.g., attack base, then strong attacks, then good merges, then advances)
		opportunities.sort((a, b) => {
			if (a.type === 'attackBase' && b.type !== 'attackBase') return -1;
			if (a.type !== 'attackBase' && b.type === 'attackBase') return 1;
			if (a.type === 'attackUnit' && b.type !== 'attackUnit') return -1;
			if (a.type !== 'attackUnit' && b.type === 'attackUnit') return 1;
			// For attackUnit, prioritize by target value (high to low) then attacker value (high to low)
			if (a.type === 'attackUnit' && b.type === 'attackUnit') {
				if (a.targetValue !== b.targetValue) return b.targetValue - a.targetValue;
				return b.unitValue - a.unitValue;
			}
			if (a.type === 'merge' && b.type !== 'merge') return -1;
			if (a.type !== 'merge' && b.type === 'merge') return 1;
			// For merge, prioritize creating higher value units, then those that can act
			if (a.type === 'merge' && b.type === 'merge') {
				if (a.resultingValue !== b.resultingValue) return b.resultingValue - a.resultingValue;
				if (a.canResultUnitAct !== b.canResultUnitAct) return a.canResultUnitAct ? -1 : 1; // Prioritize able to act
			}
			if (a.type === 'advance' && b.type !== 'advance') return -1;
			if (a.type !== 'advance' && b.type === 'advance') return 1;
			// For advance, prioritize units closer to the base
			if (a.type === 'advance' && b.type === 'advance') {
				return a.distanceToOpponentBase - b.distanceToOpponentBase;
			}
			return 0; // Default
		});

		this.deselectUnit(); // Clean up selection used for calculation
		return opportunities;
	},
	isUnitVulnerable(unitHexId, opponentUnits) {
		const unit = this.getUnitOnHex(unitHexId);
		if (!unit || unit.isDeath) return false;

		// Simple vulnerability check: Is any enemy unit in range to attack this unit?
		this.selectedUnitHexId = unitHexId; // Select for calculating potential threats
		let isThreatened = false;
		opponentUnits.forEach(enemyUnit => {
			if (!enemyUnit.isDeath) {
				const enemyHex = this.getHex(enemyUnit.hexId);
				if (!enemyHex) return;

				// Check if enemy can reach this unit's hex
				const enemyPotentialMoves = this.calcValidMoves(enemyUnit.hexId);
				if (enemyPotentialMoves.includes(unitHexId)) {
					isThreatened = true;
					return;
				}

				// Check if enemy ranged/special can target this unit
				const enemyRangedTargets = (enemyUnit.value === 5) ? this.calcValidRangedTargets(enemyUnit.hexId) : [];
				if (enemyRangedTargets.includes(unitHexId)) {
					isThreatened = true;
					return;
				}
				const enemySpecialTargets = (enemyUnit.value === 6) ? this.calcValidSpecialAttackTargets(enemyUnit.hexId) : [];
				if (enemySpecialTargets.includes(unitHexId)) {
					isThreatened = true;
					return;
				}
			}
		});

		this.deselectUnit(); // Clean up selection
		return isThreatened; // Basic vulnerability: is any enemy unit able to attack it?
		// More complex: consider unit's armor, value, number of threatening enemies, friendly support
	},

	/* --- UTILITIES --- */
	addLog(message, state) {
		if (state) return console.debug(' >', message);
		
		this.messageLog.unshift({ id: this.logCounter++, message: `[${new Date().toLocaleTimeString()}] ${message}` });
		if (this.messageLog.length > 50) this.messageLog.pop();
		
		// Auto-scroll log
		this.$nextTick(() => {
			const logContainer = document.getElementById('messageLogContainer');
			if (logContainer) logContainer.scrollTop = 0;
		});
	},
};}