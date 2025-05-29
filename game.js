// deno-lint-ignore-file
const R = 6; // Map size radius
const HEX_SIZE = 60; // pixels
const HEX_WIDTH = HEX_SIZE;
const HEX_HEIGHT = HEX_SIZE * Math.sqrt(3) / 2; // Height of one equilateral triangle half

// Axial directions
const DIRS = [
	{q: 1, r: 0}, {q: 0, r: 1}, {q: -1, r: 1},
	{q: -1, r: 0}, {q: 0, r: -1}, {q: 1, r: -1}
];

const UNIT_STATS = {
	1: { name: "Pawn", armor: 1, attack: 2, range: 0, distance: 4, movement: 'LINE', notes: "Straight line" },
	2: { name: "Bishop", armor: 2, attack: 3, range: 0, distance: 3, movement: 'DIAGONAL_X', notes: "'X' shape diagonals" },
	3: { name: "Knight", armor: 3, attack: 4, range: 0, distance: 3, movement: 'L_SHAPE', notes: "'L' pattern" },
	4: { name: "Rook", armor: 4, attack: 5, range: 0, distance: 1, distance_v: 2, distance_h: 1, movement: 'AXIAL_SPLIT', notes: "Vertical/Horizontal" },
	5: { name: "Archer", armor: 5, attack: 6, range: "2-3", distance: 1, movement: 'ADJACENT', notes: "Ranged Attack" },
	6: { name: "Legion", armor: 6, attack: 6, range: 1, distance: 0, movement: 'NONE', notes: "Special Attack, Adjacent Armor+1" }
};

Array.prototype.random = function () { return this[Math.floor((Math.random() * this.length))]; }

function game() {
	return {
		// --- VARIABLES ---
		hexes: [],
		players: [
			{ id: 0, color: 'Red', dice: [], initialRollDone: false, baseHexId: null, rerollsUsed: 0 },
			{ id: 1, color: 'Blue', dice: [], initialRollDone: false, baseHexId: null, rerollsUsed: 0 }
		],
		rules: {
			dicePerPlayer: 6, // For 2 players
			maxRerolls: 2,    // 1/3 of 6
		},
		gameState: 'SETUP_ROLL', // SETUP_ROLL, SETUP_REROLL, SETUP_DEPLOY, PLAYER_TURN, GAME_OVER
		currentPlayerIndex: 0,
		selectedUnitHexId: null,
		selectedDieToDeploy: null, // index in player's dice array
		validMoves: [], // array of hex IDs
		validTargets: [], // array of hex IDs for attacks/merges
		diceToReroll: [], // indices of dice selected for reroll
		messageLog: [],
		logCounter: 0,
		winnerMessage: "",
		actionMode: null, // 'MOVE', 'RANGED_ATTACK', 'SPECIAL_ATTACK', 'MERGE_SELECT_TARGET'
		debug: {
			skipReroll: true,
			skipDeploy: true,
			autoPlay: false,
		},
		
		// --- INITIALIZATION ---
		init() {
			this.generateHexGrid(R);
			this.determineBaseLocations();
			this.addLog("Game started. Welcome to Hex Dice!");
			this.resetGame(); // To properly initialize players etc.
		},
		resetGame() {
			this.players = [
				{ id: 0, color: 'Red', dice: [], initialRollDone: false, baseHexId: this.getHexByQR(0, -(R-1))?.id, rerollsUsed: 0 },
				{ id: 1, color: 'Blue', dice: [], initialRollDone: false, baseHexId: this.getHexByQR(0, R-1)?.id, rerollsUsed: 0 }
			];
			this.hexes.forEach(h => h.unitId = null); // Clear units from hexes
			this.gameState = 'SETUP_ROLL';
			this.currentPlayerIndex = 0;
			this.selectedUnitHexId = null;
			this.selectedDieToDeploy = null;
			this.validMoves = [];
			this.validTargets = [];
			this.diceToReroll = [];
			this.actionMode = null;
			//this.messageLog = []; // Keep log or clear? Let's keep for now.
			this.addLog("New game started. Player 1 (Red) rolls first.");
		},

		// --- HEX GRID ---
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
			// For 2 players, assign specific base hexes
			// Using hexes near opposite edges for R=6
			const base1Hex = this.getHexByQR(0, -(R-1)); // e.g., Q=-5, R=0 for R=6
			if (base1Hex) {
				base1Hex.isP1Base = true;
				this.players[0].baseHexId = base1Hex.id;
			}
			const base2Hex = this.getHexByQR(0, R-1); // e.g., Q=5, R=0 for R=6
			if (base2Hex) {
				base2Hex.isP2Base = true;
				this.players[1].baseHexId = base2Hex.id;
			}
		},
		getHex(id) { return this.hexes.find(h => h.id === id); },
		getHexByQR(q, r) { return this.hexes.find(h => h.q === q && h.r === r); },
		getUnitOnHex(hexId) {
			const hex = this.getHex(hexId);
			if (!hex || hex.unitId === null) return null;
			const [playerId, dieIndex] = hex.unitId.split('_').map(Number);
			return this.players[playerId]?.dice[dieIndex];
		},
		axialDistance(q1, r1, q2, r2) {
			const dq = q1 - q2;
			const dr = r1 - r2;
			const ds = (-q1 - r1) - (-q2 - r2);
			return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
		},
		getNeighbors(hex) {
			if (!hex) return [];
			return DIRS.map(dir => this.getHexByQR(hex.q + dir.q, hex.r + dir.r)).filter(Boolean);
		},
		
		// --- UI STYLING ---
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
		hexColor(hex) {
			const unit = this.getUnitOnHex(hex.id);

			let color = 'default';
			if (hex.isP1Base) color = 'red';
			if (hex.isP2Base) color = 'blue';

			if (this.selectedUnitHexId === hex.id) color = 'selecte';
			else if (this.validMoves.includes(hex.id)) color = 'move';
			else if (this.validTargets.includes(hex.id)) color = 'target';
			else if (this.gameState === 'SETUP_DEPLOY' && this.getValidDeploymentHexes(this.currentPlayerIndex).includes(hex.id)) {
				color = 'deploy';
			}

			return color;
		},
		hexStyle(hex) {
			// Calculate offset for positioning
			// Find minX and minY to offset all hexes so they start near 0,0 of the container
			const allX = this.hexes.map(h => h.visualX);
			const allY = this.hexes.map(h => h.visualY);
			const minX = Math.min(...allX);
			const minY = Math.min(...allY);

			return `
				left: ${hex.visualX - minX}px; 
				top: ${hex.visualY - minY}px;
				width: ${HEX_WIDTH}px;
				height: ${HEX_HEIGHT}px;
			`;
		},

		// --- SETUP ---
		setupStatusMessage() {
			if (this.gameState === 'SETUP_ROLL') return "Roll initial dice for both players.";
			if (this.gameState === 'SETUP_REROLL') return `Player ${this.currentPlayerIndex + 1} (${this.players[this.currentPlayerIndex].color}) - Reroll Phase.`;
			if (this.gameState === 'SETUP_DEPLOY') return `Player ${this.currentPlayerIndex + 1} (${this.players[this.currentPlayerIndex].color}) - Deployment Phase.`;
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
					actionsTakenThisTurn: 0, // For merged unit to act if target hasn't
				});
			}
			player.initialRollDone = true;
			this.addLog(`Player ${playerId + 1} rolled: ${player.dice.map(d => d.value).join(', ')}`);

			if (this.players.every(p => p.initialRollDone)) {
				this.gameState = 'SETUP_REROLL';
				this.currentPlayerIndex = 0; // Player 1 starts reroll
				this.diceToReroll = [];

				if (this.debug?.skipReroll) this.players.forEach(() => this.skipReroll());
			}
		},
		toggleRerollSelection(dieIndex) {
			if (this.players[this.currentPlayerIndex].dice[dieIndex].isDeployed) return;
			const indexInReroll = this.diceToReroll.indexOf(dieIndex);
			if (indexInReroll > -1) {
				this.diceToReroll.splice(indexInReroll, 1);
			} else {
				if (this.diceToReroll.length < this.rules.maxRerolls) {
					this.diceToReroll.push(dieIndex);
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
			this.diceToReroll.forEach(dieIndex => {
				const newRoll = Math.floor(Math.random() * 6) + 1;
				player.dice[dieIndex].value = newRoll;
				// Update stats based on new roll
				Object.assign(player.dice[dieIndex], UNIT_STATS[newRoll]);
				player.dice[dieIndex].currentArmor = UNIT_STATS[newRoll].armor;
				player.dice[dieIndex].armorReduction = 0; // Reset this on reroll
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
				this.gameState = 'SETUP_DEPLOY';
				this.currentPlayerIndex = 0; // Player 1 starts deployment
				this.selectedDieToDeploy = null;

				if (this.debug?.skipDeploy) {
					this.players.forEach((player, playerIdx) => {
						const validDeploymentHexes = this.getValidDeploymentHexes(playerIdx);
						// console.dir({validDeploymentHexes})

						player.dice.forEach((dice, diceIdx) => {
							this.selectDieToDeploy(diceIdx);
							this.handleHexClick(validDeploymentHexes[diceIdx]);
							// console.dir(validDeploymentHexes[diceIdx])
						});
					});
				}
			}
		},
		selectDieToDeploy(dieIndex) {
			if (this.players[this.currentPlayerIndex].dice[dieIndex].isDeployed) return;
			this.selectedDieToDeploy = dieIndex;
		},
		getValidDeploymentHexes(playerId) {
			const player = this.players[playerId];
			const baseHex = this.getHex(player.baseHexId);
			if (!baseHex) return [];
			
			let deploymentHexes = [baseHex];
			this.getNeighbors(baseHex).forEach(neighbor => {
				if (neighbor) deploymentHexes.push(neighbor);
			});
			
			// Filter out hexes that are already occupied by friendly units
			return deploymentHexes
				.filter(hex => !this.getUnitOnHex(hex.id)) // Ensure hex is empty
				.map(hex => hex.id);
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

			const validDeploymentHexes = this.getValidDeploymentHexes(this.currentPlayerIndex);
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
			this.selectedDieToDeploy = null;

			// Check if current player has deployed all dice
			if (player.dice.every(d => d.isDeployed)) {
				if (this.currentPlayerIndex === 0) {
					this.currentPlayerIndex = 1; // Move to Player 2's deployment

					this.addLog("Player 2 turn to deploy");

					if(this.players[1].dice.every(d => d.isDeployed)) {
						this.startGamePlay();
					}
				} else {
					this.startGamePlay();
				}
			}
		},
		startGamePlay() {
			this.gameState = 'PLAYER_TURN';
			this.currentPlayerIndex = 0; // Player 1 starts the game
			this.resetTurnActionsForAllUnits();
			this.addLog("All units deployed. Player 1's turn.");

			if (this.debug?.autoPlay) this.autoPlay();
		},
		autoPlay() {
			console.log('autoPlay')
			if (!this.debug?.autoPlay) return;

			let player = this.players[this.currentPlayerIndex];
			let unit = player.dice.random();

			let actions = (unit.distance > 0) ? 'MOVE,REROLL,GUARD' : 'REROLL,GUARD';
			let trymax=10, valid, target, action;

			while (!target && (--trymax > 0)) {
				action = actions.split(',').random();
				switch (action) {
					case 'MOVE':
						this.selectUnit(unit.hexId);
						target = this.calculateValidMoves(unit.hexId).random();
						this.initiateAction('MOVE')
					break;
					default:
						valid = this.calculateValidMoves(unit.hexId, action);
						target = (valid?.possibleMoves || valid || []).random();
						if (target) this.performAction(action, unit.hexId);
				}
			}

			if (target) this.completeAction(target);

			console.dir({player, unit, action, valid, target, trymax});
		},
		
		// --- GAMEPLAY ---
		handleHexClick(hexId) {
			if (this.gameState === 'SETUP_DEPLOY') {
				this.deployUnit(hexId);
				return;
			}

			if (this.gameState !== 'PLAYER_TURN') return;

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
		selectUnit(hexId) {
			const unit = this.getUnitOnHex(hexId);
			if (!unit || unit.playerId !== this.currentPlayerIndex || unit.hasMovedOrAttackedThisTurn) {
				if(unit && unit.hasMovedOrAttackedThisTurn) this.addLog("This unit has already acted this turn.");
				this.deselectUnit();
				return;
			}
			this.selectedUnitHexId = hexId;
			this.validMoves = []; // Will be calculated if 'MOVE' action is chosen
			this.validTargets = []; // Will be calculated if attack action is chosen
			this.addLog(`Selected Unit: Dice ${unit.value} at (${this.getHex(hexId).q}, ${this.getHex(hexId).r})`);
			
			if (this.canPerformAction(this.selectedUnitHexId, 'MOVE')) this.initiateAction('MOVE');
		},
		deselectUnit() {
			this.selectedUnitHexId = null;
			this.validMoves = [];
			this.validTargets = [];
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
			this.validTargets = [];

			if (actionType === 'MOVE' || actionType === 'MERGE') {
				this.validMoves = this.calculateValidMoves(this.selectedUnitHexId, actionType === 'MERGE');
				if (this.validMoves.length === 0) {
					this.addLog("No valid moves for this unit.");
					this.cancelAction();
				}
			} else if (actionType === 'RANGED_ATTACK') {
				this.validTargets = this.calculateValidRangedTargets(this.selectedUnitHexId);
				 if (this.validTargets.length === 0) {
					this.addLog("No valid targets for Ranged Attack.");
					this.cancelAction();
				}
			} else if (actionType === 'SPECIAL_ATTACK') {
				this.validTargets = this.calculateValidSpecialAttackTargets(this.selectedUnitHexId);
				 if (this.validTargets.length === 0) {
					this.addLog("No valid targets for Special Attack.");
					this.cancelAction();
				}
			}
		},
		actionModeMessage() {
			if (this.actionMode === 'MOVE') return "Select a destination hex for your unit.";
			if (this.actionMode === 'RANGED_ATTACK') return "Select an enemy unit to target (2-3 hexes away).";
			if (this.actionMode === 'SPECIAL_ATTACK') return "Select an adjacent enemy unit to target.";
			if (this.actionMode === 'MERGE') return "Select a friendly unit to merge with.";
			return "";
		},
		cancelAction() {
			this.actionMode = null;
			this.validMoves = [];
			this.validTargets = [];

			if (this.debug?.autoPlay) this.endTurn();
		},
		completeAction(targetHexId) {
			if (!this.actionMode) return;

			const action = this.actionMode;
			this.actionMode = null; // Clear action mode first

			if (action === 'MOVE') {
				if (this.validMoves.includes(targetHexId)) {
					this.performMove(this.selectedUnitHexId, targetHexId);
					this.endTurn();
				} else {
					this.addLog("Invalid move destination.");
				}
			} else if (action === 'RANGED_ATTACK') {
				 if (this.validTargets.includes(targetHexId)) {
					this.performRangedAttack(this.selectedUnitHexId, targetHexId);
					this.endTurn();
				} else {
					this.addLog("Invalid target for Ranged Attack.");
				}
			} else if (action === 'SPECIAL_ATTACK') {
				 if (this.validTargets.includes(targetHexId)) {
					this.performSpecialAttack(this.selectedUnitHexId, targetHexId);
					this.endTurn();
				} else {
					this.addLog("Invalid target for Special Attack.");
				}
			} else if (action === 'MERGE') {
				if (this.validMoves.includes(targetHexId)) { // Merge uses move validation logic
					this.performMerge(this.selectedUnitHexId, targetHexId);
					this.endTurn();
				} else {
					this.addLog("Invalid target hex for merging.");
				}
			}
			
			// Deselect unit after action attempt, regardless of success, unless it's a failed move
			// If move failed, unit stays selected. If combat failed, unit stays.
			// For simplicity now, deselect. More complex logic can keep it selected.
			// if (this.getUnitOnHex(this.selectedUnitHexId)?.hasMovedOrAttackedThisTurn) {
			//      this.deselectUnit();
			// }
		},
		canPerformAction(unitHexId, actionType) {
			const unit = this.getUnitOnHex(unitHexId);
			if (!unit || unit.hasMovedOrAttackedThisTurn) return false;

			switch(actionType) {
				case 'MOVE': return true; // Basic check, specific unit limitations handled in calculateValidMoves
				case 'REROLL': return true;
				case 'GUARD': return true;
				case 'RANGED_ATTACK': return unit.value === 5;
				case 'SPECIAL_ATTACK': return unit.value === 6;
				case 'MERGE': return true; // Can always attempt to move to a friendly unit
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
		
		// --- MOVE ---
		calculateValidMoves(unitHexId, isForMerging = false) {
			const unit = this.getUnitOnHex(unitHexId);
			const startHex = this.getHex(unitHexId);
			if (!unit || !startHex) return [];

			let possibleMoves = [];
			const unitStats = UNIT_STATS[unit.value];

			const checkNextHexBreak = (nextHex) => {
				if (!nextHex) return false; // Off map

				if (this.getUnitOnHex(nextHex.id) && !isForMerging) { // Occupied by any unit
					if (this.getUnitOnHex(nextHex.id).playerId !== unit.playerId) possibleMoves.push(nextHex.id); // Can attack enemy
					// break; // Blocked

					return false; // Blocked
				}
				if (this.getUnitOnHex(nextHex.id) && isForMerging && this.getUnitOnHex(nextHex.id).playerId === unit.playerId) {
					possibleMoves.push(nextHex.id); // Can merge with friendly
					// Don't break, can potentially move past to another friendly for merge if rules allowed (not typical)
				}
				if (!this.getUnitOnHex(nextHex.id)) possibleMoves.push(nextHex.id); // Empty hex

				return true;
			}

			switch (unitStats.movement) {
				case 'LINE': // Dice 1
					let dirLine = {q: 0, r: 1};
					switch(this.currentPlayerIndex) {
						case 0: dirLine = {q: 0, r: 1}; break;
						case 1: dirLine = {q: 0, r: -1}; break;
					}

					for (let i = 1; i <= unitStats.distance; i++) {
						const nextHex = this.getHexByQR(startHex.q + dirLine.q * i, startHex.r + dirLine.r * i);
						checkNextHexBreak(nextHex)
					}
					break;
				case 'DIAGONAL_X': // Dice 2
					const dValidsX = [
						[-1, 0], [-2, 0], [-3, 0],
						[-1, 1], [-2, 2], [-3, 3],
						[1, 0], [2, 0], [3, 0],
						[1, -1], [2, -2], [3, -3],
					];

					for (let valid of dValidsX) {
						const nextHex = this.getHexByQR(startHex.q + valid[0], startHex.r + valid[1]);
						checkNextHexBreak(nextHex)
					}

					break;
				case 'L_SHAPE': // Dice 3
					const dValidsLShape = [
						[-1, -2], [-2, -1],
						[-3, 1], [-3, 2],
						[-2, 3], [-1, 3],
						[1, 2], [2, 1],
						[3, -1], [3, -2],
						[2, -3], [1, -3],
					];

					for (let valid of dValidsLShape) {
						const nextHex = this.getHexByQR(startHex.q + valid[0], startHex.r + valid[1]);
						checkNextHexBreak(nextHex)
					}

					break;
				case 'AXIAL_SPLIT': // Dice 4
					const dValidsAxialSplit = [
						[0, -1], [0, -2],
						[0, 1], [0, 2],
						[-2, 1], [2, -1],
					];

					for (let valid of dValidsAxialSplit) {
						const nextHex = this.getHexByQR(startHex.q + valid[0], startHex.r + valid[1]);
						checkNextHexBreak(nextHex)
					}

					break;
				case 'ADJACENT': // Dice 5
					this.getNeighbors(startHex).forEach(neighbor => {
						if (neighbor) possibleMoves.push(neighbor.id);
					});
					break;
				case 'NONE': // Dice 6
					 // Dice 6 cannot initiate a move action, only special attack or move after combat.
					break;
			}

			// console.dir({calculateValidMoves: unit, startHex, possibleMoves})
			
			// Filter based on target: empty or enemy (for move), or friendly (for merge)
			return possibleMoves.filter(hexId => {
				const targetUnit = this.getUnitOnHex(hexId);
				if (isForMerging) {
					return targetUnit && targetUnit.playerId === unit.playerId && targetUnit.id !== unit.id;
				} else {
					return !targetUnit || targetUnit.playerId !== unit.playerId;
				}
			});
		},
		performMove(unitHexId, targetHexId) {
			const attackerUnit = this.getUnitOnHex(unitHexId);
			const attackerHex = this.getHex(unitHexId);
			const defenderHex = this.getHex(targetHexId);
			const defenderUnit = this.getUnitOnHex(targetHexId);

			if (!attackerUnit || !attackerHex || !defenderHex) {
				this.addLog("Move failed: Invalid unit or hex.");
				this.deselectUnit(); // Deselect if something is wrong
				return;
			}
			
			this.addLog(`Player ${attackerUnit.playerId + 1} attempts to move Dice ${attackerUnit.value} from (${attackerHex.q},${attackerHex.r}) to (${defenderHex.q},${defenderHex.r}).`);

			if (defenderUnit) { // Moving into an enemy occupied hex
				if (defenderUnit.playerId === attackerUnit.playerId) {
					this.addLog("Cannot move into a hex occupied by a friendly unit (use Merge action).");
					// Do not deselect, allow player to choose another action or target
					return;
				}
				// Combat occurs
				this.handleCombat(unitHexId, targetHexId, 'MELEE');
			} else { // Moving to an empty hex
				attackerHex.unitId = null;
				defenderHex.unitId = attackerUnit.id;
				attackerUnit.hexId = targetHexId;
				attackerUnit.hasMovedOrAttackedThisTurn = true;
				attackerUnit.actionsTakenThisTurn++;
				this.addLog(`Dice ${attackerUnit.value} moved to (${defenderHex.q},${defenderHex.r}).`);
				this.deselectUnit(); // Action complete
			}
			this.checkWinConditions();
		},

		// --- ACTIONS ---
		performUnitReroll(unitHexId) {
			const unit = this.getUnitOnHex(unitHexId);
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
			this.addLog(`Player ${unit.playerId + 1}'s Dice ${oldVal} rerolled into a Dice ${newRoll}.`);
			this.deselectUnit();
			this.checkWinConditions();
		},
		performGuard(unitHexId) {
			const unit = this.getUnitOnHex(unitHexId);
			if (!unit || unit.hasMovedOrAttackedThisTurn) return;

			unit.isGuarding = true;
			// Actual armor buff is applied during combat calculation
			unit.hasMovedOrAttackedThisTurn = true;
			unit.actionsTakenThisTurn++;
			this.addLog(`Player ${unit.playerId + 1}'s Dice ${unit.value} is now Guarding.`);
			this.deselectUnit();
			this.checkWinConditions(); // Though guard alone won't win
		},
		
		calculateValidRangedTargets(attackerHexId) {
			const attackerUnit = this.getUnitOnHex(attackerHexId);
			const attackerHex = this.getHex(attackerHexId);
			if (!attackerUnit || attackerUnit.value !== 5 || !attackerHex) return [];

			let targets = [];
			this.hexes.forEach(potentialTargetHex => {
				if (!potentialTargetHex || potentialTargetHex.id === attackerHexId) return;
				
				const targetUnit = this.getUnitOnHex(potentialTargetHex.id);
				if (targetUnit && targetUnit.playerId !== attackerUnit.playerId) { // Is an enemy unit
					const dist = this.axialDistance(attackerHex.q, attackerHex.r, potentialTargetHex.q, potentialTargetHex.r);
					// Check for straight line (simplified: axial distance check implies straight line on hex grid)
					// More robust line of sight would check for blocking units/terrain. Not implemented here.
					if (dist >= 2 && dist <= 3) { // Range 2-3 for Dice 5
						// TODO: Check Line of Sight (no units in between)
						targets.push(potentialTargetHex.id);
					}
				}
			});
			return targets;
		},
		performRangedAttack(attackerHexId, targetHexId) {
			this.addLog(`Dice 5 at (${this.getHex(attackerHexId).q},${this.getHex(attackerHexId).r}) performs Ranged Attack on unit at (${this.getHex(targetHexId).q},${this.getHex(targetHexId).r}).`);
			this.handleCombat(attackerHexId, targetHexId, 'RANGED');
			const attackerUnit = this.getUnitOnHex(attackerHexId);
			if (attackerUnit) {
				attackerUnit.hasMovedOrAttackedThisTurn = true;
				attackerUnit.actionsTakenThisTurn++;
			}
			this.deselectUnit();
			this.checkWinConditions();
		},

		calculateValidSpecialAttackTargets(attackerHexId) {
			const attackerUnit = this.getUnitOnHex(attackerHexId);
			const attackerHex = this.getHex(attackerHexId);
			if (!attackerUnit || attackerUnit.value !== 6 || !attackerHex) return [];

			let targets = [];
			this.getNeighbors(attackerHex).forEach(neighborHex => {
				if (neighborHex) {
					const targetUnit = this.getUnitOnHex(neighborHex.id);
					if (targetUnit && targetUnit.playerId !== attackerUnit.playerId) {
						targets.push(neighborHex.id);
					}
				}
			});
			return targets;
		},
		performSpecialAttack(attackerHexId, targetHexId) {
			this.addLog(`Dice 6 at (${this.getHex(attackerHexId).q},${this.getHex(attackerHexId).r}) performs Special Attack on unit at (${this.getHex(targetHexId).q},${this.getHex(targetHexId).r}).`);
			this.handleCombat(attackerHexId, targetHexId, 'SPECIAL');
			const attackerUnit = this.getUnitOnHex(attackerHexId); // Attacker might have moved
			if (attackerUnit && attackerUnit.hexId === attackerHexId) { // if it didn't move (attack failed)
				 attackerUnit.hasMovedOrAttackedThisTurn = true;
				 attackerUnit.actionsTakenThisTurn++;
			} else if (this.getUnitOnHex(targetHexId)?.id === attackerUnit?.id) { // if it moved (attack succeeded)
				 attackerUnit.hasMovedOrAttackedThisTurn = true;
				 attackerUnit.actionsTakenThisTurn++;
			}
			this.deselectUnit();
			this.checkWinConditions();
		},

		performMerge(mergingUnitHexId, targetUnitHexId) {
			const mergingUnit = this.getUnitOnHex(mergingUnitHexId);
			const targetUnit = this.getUnitOnHex(targetUnitHexId);
			const mergingHex = this.getHex(mergingUnitHexId);
			const targetHex = this.getHex(targetUnitHexId);

			if (!mergingUnit || !targetUnit || mergingUnit.playerId !== targetUnit.playerId || mergingUnit.id === targetUnit.id) {
				this.addLog("Merge failed: Invalid units or target.");
				this.deselectUnit();
				return;
			}

			this.addLog(`Player ${mergingUnit.playerId + 1} merges Dice ${mergingUnit.value} with Dice ${targetUnit.value}.`);

			const sum = mergingUnit.value + targetUnit.value;
			let newDieValue;
			let newUnitCanAct = false;

			if (sum <= 6) {
				newDieValue = sum;
			} else {
				// Player chooses. For prototype, let's pick a default (e.g., 6) or prompt.
				// Simple: always pick 6 for >6 sum. A real game would prompt.
				newDieValue = parseInt(prompt(`Sum is ${sum} (>6). Choose new dice value (1-6):`, "6")) || 6;
				if (newDieValue < 1 || newDieValue > 6) newDieValue = 6;
				
				// "And if the Target Unit did not take action last turn, the new unit is may immediately perform one action"
				// "last turn" here means "this turn before merging"
				if (targetUnit.actionsTakenThisTurn === 0) {
					newUnitCanAct = true;
				}
			}
			
			// Remove original units from player's dice array
			// This is tricky because indices shift. Find by ID.
			const p = this.players[mergingUnit.playerId];
			const mergingUnitArrayIndex = p.dice.findIndex(d => d.id === mergingUnit.id);
			if (mergingUnitArrayIndex !== -1) p.dice.splice(mergingUnitArrayIndex, 1);
			
			const targetUnitArrayIndex = p.dice.findIndex(d => d.id === targetUnit.id);
			if (targetUnitArrayIndex !== -1) p.dice.splice(targetUnitArrayIndex, 1);

			// Create new unit ( reusing one of the slots, or pushing new. Let's reuse targetUnit's slot in array by re-finding or assign new ID)
			// For simplicity, let's add a new die to the player's list. This might mess up indexing if not careful.
			// A better way: modify targetUnit in place, and remove mergingUnit.
			// Best way for this model: Create totally new die, assign new unique ID
			const newDieOriginalIndex = p.dice.length; // New effective index
			const newUnit = {
				id: `${p.id}_${Date.now()}`, // Unique enough for prototype
				originalIndex: newDieOriginalIndex,
				playerId: p.id,
				value: newDieValue,
				...UNIT_STATS[newDieValue],
				currentArmor: UNIT_STATS[newDieValue].armor,
				armorReduction: 0,
				isDeployed: true,
				hexId: targetHex.id,
				hasMovedOrAttackedThisTurn: !newUnitCanAct, // If can act, it hasn't "completed" its action for the turn yet
				isGuarding: false,
				actionsTakenThisTurn: newUnitCanAct ? 0 : 1, // If cannot act, it counts as action taken
			};
			p.dice.push(newUnit);
			
			// Update hexes
			mergingHex.unitId = null;
			targetHex.unitId = newUnit.id;

			this.addLog(`Merged into a new Dice ${newUnit.value}. ${newUnitCanAct ? "It may act this turn." : "It cannot act further this turn."}`);
			
			this.deselectUnit(); // Deselect old unit
			if (newUnitCanAct) {
				this.selectUnit(newUnit.hexId); // Select the new unit so player can act with it
				this.addLog(`New Dice ${newUnit.value} selected. Choose an action.`);
			}
			this.checkWinConditions();
		},

		// --- COMBAT ---
		handleCombat(attackerHexId, defenderHexId, combatType) { // combatType: 'MELEE', 'RANGED', 'SPECIAL'
			const attackerUnit = this.getUnitOnHex(attackerHexId);
			const defenderUnit = this.getUnitOnHex(defenderHexId);
			const attackerHex = this.getHex(attackerHexId);
			const defenderHex = this.getHex(defenderHexId);

			if (!attackerUnit || !defenderUnit || !attackerHex || !defenderHex) {
				this.addLog("Combat error: attacker or defender not found.");
				return;
			}

			// Calculate effective armor for defender
			let defenderEffectiveArmor = defenderUnit.currentArmor;
			if (defenderUnit.isGuarding) defenderEffectiveArmor++;
			// Dice 6 adjacent buff - check neighbors of defender
			this.getNeighbors(defenderHex).forEach(neighbor => {
				const neighborUnit = this.getUnitOnHex(neighbor.id);
				if (neighborUnit && neighborUnit.playerId === defenderUnit.playerId && neighborUnit.value === 6) {
					defenderEffectiveArmor++;
				}
			});
			defenderEffectiveArmor -= defenderUnit.armorReduction;
			if (defenderEffectiveArmor < 0) defenderEffectiveArmor = 0;
			
			// Dice 6 adjacent buff for attacker (if attacker is Dice 6, it applies to ITS neighbors, not itself)
			// This is usually a passive aura, so only defender gets it from THEIR Dice 6.

			this.addLog(`Combat: Attacker (D${attackerUnit.value}, Atk ${attackerUnit.attack}) vs Defender (D${defenderUnit.value}, Eff.Armor ${defenderEffectiveArmor})`);

			if (defenderUnit.armorReduction >= defenderUnit.armor || attackerUnit.attack >= defenderEffectiveArmor) { // Attacker wins
				this.addLog("Attacker wins! Defender is defeated.");
				// Remove defender
				this.players[defenderUnit.playerId].dice = this.players[defenderUnit.playerId].dice.filter(d => d.id !== defenderUnit.id);
				defenderHex.unitId = null;

				if (combatType === 'MELEE' || (combatType === 'SPECIAL' && attackerUnit.value === 6)) {
					// Attacker moves into vacated hex
					attackerHex.unitId = null;
					defenderHex.unitId = attackerUnit.id;
					attackerUnit.hexId = defenderHex.id;
					this.addLog(`Attacker D${attackerUnit.value} moves into hex (${defenderHex.q},${defenderHex.r}).`);
				}
				// For Ranged, attacker stays. For Special, attacker moves if successful.
				attackerUnit.hasMovedOrAttackedThisTurn = true;
				attackerUnit.actionsTakenThisTurn++;

			} else { // Attacker fails
				this.addLog("Attacker fails! Defender's Armor reduced by 1.");
				defenderUnit.armorReduction++;
				defenderUnit.currentArmor = UNIT_STATS[defenderUnit.value].armor; // Reset base armor for clarity if needed, reduction is separate
				
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

		// --- TURN MANAGEMENT & WIN CONDITIONS ---
		endTurn() {
			if (this.gameState !== 'PLAYER_TURN') return;
			
			this.addLog(`Player ${this.currentPlayerIndex + 1} ends their turn.`);
			this.deselectUnit(); // Clear selection
			this.actionMode = null; // Clear action mode

			this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
			this.resetTurnActionsForAllUnits();
			
			// Deactivate guard mode for units of the player whose turn it WILL BE.
			// Rule: "Guard Mode is automatically deactivated (remove guard token) if unit move next turn."
			// This implies guard lasts until the unit's *owner's* next turn, and deactivates if it moves.
			// For simplicity here, let's say guard lasts for one round of attacks. Or clear at start of owner's turn.
			// More accurate: Guard is active. If unit moves, guard deactivates. If it guards again, it's active.
			// The current implementation of guard adding +1 Armor during combat is fine.
			// We need to reset isGuarding if the unit moves. Let's do it when a unit *successfully* moves.
			// Let's also clear guard for the *next* player's units at start of their turn if they had it from prev turn.
			// OR: Guard token removed if unit MOVES. It persists otherwise.
			// The rule "Guard Mode is automatically deactivated (remove guard token) if unit move next turn." is a bit ambiguous.
			// Let's assume it means: if a unit is guarding, and on ITS NEXT ACTIVATION it chooses to move, guard is removed.
			// So, `isGuarding` should persist until the unit itself moves or rerolls.
			// My current implementation: `isGuarding` is set, used in combat. If unit moves, `isGuarding` should be set to false.
			// If a unit moves, it loses guard:
			// In performMove: if (attackerUnit.isGuarding) attackerUnit.isGuarding = false;
			// In performUnitReroll: unit.isGuarding = false; (already there)
			// This seems correct.

			this.addLog(`Player ${this.currentPlayerIndex + 1}'s turn.`);
			this.checkWinConditions(); // Check at start of turn too (e.g. if opponent was eliminated on their own turn by some effect)

			if (this.debug?.autoPlay) this.autoPlay();
		},
		resetTurnActionsForAllUnits() {
			this.players.forEach(player => {
				player.dice.forEach(die => {
					if(die.isDeployed) {
						die.hasMovedOrAttackedThisTurn = false;
						die.actionsTakenThisTurn = 0;
						// Guard status persists until the unit moves or rerolls.
					}
				});
			});
		},
		checkWinConditions() {
			if (this.gameState === 'GAME_OVER') return;

			const p1 = this.players[0];
			const p2 = this.players[1];

			const p1ActiveDice = p1.dice.filter(d => d.isDeployed).length;
			const p2ActiveDice = p2.dice.filter(d => d.isDeployed).length;

			// Annihilation
			if (p1ActiveDice === 0 && p2ActiveDice > 0) {
				this.gameOver(1, "Player 1 (Red) annihilated!");
				return;
			}
			if (p2ActiveDice === 0 && p1ActiveDice > 0) {
				this.gameOver(0, "Player 2 (Blue) annihilated!");
				return;
			}
			 if (p1ActiveDice === 0 && p2ActiveDice === 0) {
				this.gameOver(-1, "Mutual Annihilation! It's a draw!"); // Or last player to make move loses
				return;
			}


			// Base Capture
			const p1BaseHex = this.getHex(p1.baseHexId);
			const p2BaseHex = this.getHex(p2.baseHexId);

			if (p1BaseHex && this.getUnitOnHex(p1BaseHex.id)?.playerId === 1) {
				this.gameOver(1, "Player 2 (Blue) captured Player 1's base!");
				return;
			}
			if (p2BaseHex && this.getUnitOnHex(p2BaseHex.id)?.playerId === 0) {
				this.gameOver(0, "Player 1 (Red) captured Player 2's base!");
				return;
			}
		},
		gameOver(winnerPlayerIndex, message) {
			this.gameState = 'GAME_OVER';
			if (winnerPlayerIndex === -1) { // Draw
				 this.winnerMessage = message;
			} else {
				this.winnerMessage = `Player ${winnerPlayerIndex + 1} (${this.players[winnerPlayerIndex].color}) wins! ${message}`;
			}
			this.addLog(`Game Over: ${this.winnerMessage}`);
		},

		// --- UTILITIES ---
		addLog(message) {
			console.log(message);
			this.messageLog.unshift({ id: this.logCounter++, message: `[${new Date().toLocaleTimeString()}] ${message}` });
			if (this.messageLog.length > 50) this.messageLog.pop();
			// Auto-scroll log
			this.$nextTick(() => {
				const logContainer = document.getElementById('messageLogContainer');
				if (logContainer) logContainer.scrollTop = 0;
			});
		},
	};
}