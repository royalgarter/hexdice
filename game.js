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

Array.prototype.random = function () { return this[Math.floor((Math.random() * this.length))]; }

function game() {
	return {
		// --- VARIABLES ---
		rules: {
			dicePerPlayer: 8, // For 2 players
			maxRerolls: 2,    // 1/3 of 6
		},
		hexes: [],
		players: [
			{ id: 0, color: 'Blue', dice: [], initialRollDone: false, baseHexId: null, rerollsUsed: 0 },
			{ id: 1, color: 'Red', dice: [], initialRollDone: false, baseHexId: null, rerollsUsed: 0 }
		],
		gameState: 'SETUP_ROLL', // SETUP_ROLL, SETUP_REROLL, SETUP_DEPLOY, PLAYER_TURN, GAME_OVER
		currentPlayerIndex: 0,
		selectedUnitHexId: null,
		selectedDieToDeploy: null, // index in player's dice array
		validMoves: [], // array of hex IDs
		validMerges: [], // array of hex IDs
		validTargets: [], // array of hex IDs for attacks/merges
		diceToReroll: [], // indices of dice selected for reroll
		messageLog: [],
		logCounter: 0,
		winnerMessage: "",
		actionMode: null, // 'MOVE', 'RANGED_ATTACK', 'SPECIAL_ATTACK', 'MERGE_SELECT_TARGET'
		debug: {
			coordinate: true,
			skipReroll: true,
			skipDeploy: true,
			autoPlay: false,
		},
		
		// --- INITIALIZATION ---
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
			this.gameState = 'SETUP_ROLL';
			this.currentPlayerIndex = 0;
			this.selectedUnitHexId = null;
			this.selectedDieToDeploy = null;
			this.actionMode = null;
			this.validMoves = [];
			this.validMerges = [];
			this.validTargets = [];
			this.diceToReroll = [];
			this.messageLog = [];

			this.addLog(`New game started. Player 1 (Red) rolls first. isP2AI=${!!opts?.isP2AI}`);
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
		getHex(id) { return this.hexes.find(h => h.id === id); },
		getHexByQR(q, r) { return this.hexes.find(h => h.q === q && h.r === r); },
		getUnitOnHex(hexId) {
			const hex = this.getHex(hexId);
			if (!hex || hex.unitId === null) return null;
			const [playerId, diceIndex] = hex.unitId.split('_').map(Number);

			let unit = this.players[playerId]?.dice[diceIndex]; 
			return (!unit.isDeath) && unit ;
		},
		axialDistance(q1, r1, q2, r2) {
			const dq = q1 - q2;
			const dr = r1 - r2;
			const ds = (-q1 - r1) - (-q2 - r2);
			return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
		},
		getNeighbors(hex) {
			if (!hex) return [];
			return AXES.map(dir => this.getHexByQR(hex.q + dir.q, hex.r + dir.r)).filter(Boolean);
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

			let cls = 'bg-hexdefault';

			if (hex.isP1Base) cls = 'bg-hexblue';
			if (hex.isP2Base) cls = 'bg-hexred';

			if (this.selectedUnitHexId === hex.id) cls = 'bg-hexselect';
			else if (this.validMoves.includes(hex.id)) cls = 'bg-hexmove';
			else if (this.validMerges.includes(hex.id)) cls = 'bg-hexmerge';
			else if (this.validTargets.includes(hex.id)) cls = 'bg-hextarget';
			else if (this.gameState === 'SETUP_DEPLOY' && this.calculateValidDeploymentHexes(this.currentPlayerIndex).includes(hex.id)) {
				cls = 'bg-hexdeploy';
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
					isDeath: false,
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
				this.gameState = 'SETUP_DEPLOY';
				this.currentPlayerIndex = 0; // Player 1 starts deployment
				this.selectedDieToDeploy = 0;

				if (this.debug?.skipDeploy) {
					this.players.forEach((player, playerIdx) => {
						player.dice.forEach((dice, diceIdx) => {
							this.selectDieToDeploy(diceIdx);
							this.handleHexClick(this.calculateValidDeploymentHexes(playerIdx).random());
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

			const validDeploymentHexes = this.calculateValidDeploymentHexes(this.currentPlayerIndex);
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
			this.gameState = 'PLAYER_TURN';
			this.currentPlayerIndex = 0; // Player 1 starts the game
			this.resetTurnActionsForAllUnits();
			this.addLog("All units deployed. Player 1's turn.");

			if (this.currentPlayerIndex === 1 && this.players[this.currentPlayerIndex].isAI) {
				this.addLog("Player 2 (AI) turn.");
				setTimeout(() => this.performAITurn(), 500); // Delay AI for a moment
			} else if (this.debug?.autoPlay) {
				this.autoPlay();
			}
		},
		autoPlay() {
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
			this.validMerges = this.calculateValidMoves(this.selectedUnitHexId, 'MERGE');
			this.addLog(`Selected Unit: Dice ${unit.value} [${unit.range}] at (${this.getHex(hexId).q}, ${this.getHex(hexId).r})`);
			
			if (unit.range == '2-3') {
				this.validTargets = this.calculateValidRangedTargets(this.selectedUnitHexId);	
			}

			if (unit.range == 1) {
				this.validTargets = this.calculateValidSpecialAttackTargets(this.selectedUnitHexId);
			}

			if (this.canPerformAction(this.selectedUnitHexId, 'MOVE')) this.initiateAction('MOVE');
		},
		deselectUnit() {
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
				this.validMoves = this.calculateValidMoves(this.selectedUnitHexId, actionType === 'MERGE');
				if (this.validMoves.length === 0) {
					this.addLog("No valid moves for this unit.");
					// this.cancelAction();
				}
			} else if (actionType === 'RANGED_ATTACK') {
				this.validTargets = this.calculateValidRangedTargets(this.selectedUnitHexId);
				 if (this.validTargets.length === 0) {
					this.addLog("No valid targets for Ranged Attack.");
					// this.cancelAction();
				}
			} else if (actionType === 'SPECIAL_ATTACK') {
				this.validTargets = this.calculateValidSpecialAttackTargets(this.selectedUnitHexId);
				 if (this.validTargets.length === 0) {
					this.addLog("No valid targets for Special Attack.");
					// this.cancelAction();
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
					this.endTurn();
				}
				
				return;
			} else if (this.validMerges.includes(targetHexId)){
				this.performMerge(this.selectedUnitHexId, targetHexId);
				// New merge unit could take action if sum > 6
				return;
			} else if (unit.range == '2-3' && this.validTargets.includes(targetHexId)) {
				this.performRangedAttack(this.selectedUnitHexId, targetHexId);
				this.endTurn();
				return;
			} else if (unit.range == 1 && this.validTargets.includes(targetHexId)) {
				this.performSpecialAttack(this.selectedUnitHexId, targetHexId);
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

		// --- CALCULATE ---
		calculateValidRangedTargets(attackerHexId) {
			const attackerUnit = this.getUnitOnHex(attackerHexId);
			const attackerHex = this.getHex(attackerHexId);
			if (!attackerUnit || attackerUnit.value !== 5 || !attackerHex) return [];

			let targets = [];

			let isEnemyAdjacent = false;

			for (let neighborHex of this.getNeighbors(attackerHex)) {
				if (neighborHex) {
					const targetUnit = this.getUnitOnHex(neighborHex.id);
					if (targetUnit && targetUnit.playerId !== attackerUnit.playerId) {
						isEnemyAdjacent = true;
						break;
					}
				}
			});

			if (isEnemyAdjacent) return [];

			this.hexes.forEach(potentialTargetHex => {
				if (!potentialTargetHex || potentialTargetHex.id === attackerHexId) return;
				
				const targetUnit = this.getUnitOnHex(potentialTargetHex.id);
				if (targetUnit && targetUnit.playerId !== attackerUnit.playerId) { // Is an enemy unit
					const dist = this.axialDistance(attackerHex.q, attackerHex.r, potentialTargetHex.q, potentialTargetHex.r);

					let [min, max] = attackerUnit.range.split('-').map(parseInt);
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
							const intermediateHex = this.getHexByQR(checkQ, checkR);
							if (intermediateHex && this.getUnitOnHex(intermediateHex.id)) {
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
		calculateValidMoves(unitHexId, isForMerging = false) {
			const unit = this.getUnitOnHex(unitHexId);
			const startHex = this.getHex(unitHexId);
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

			const primary = PLAYER_PRIMARY_AXIS[this.players.length][this.currentPlayerIndex];
			const mod3 = primary.i % 3;
			const axes_b = AXES.find(({i}) => (i != primary.i) && ((i % 3) == mod3) );
			const axes_x = AXES.filter(({i}) => (i % 3) != mod3 );

			switch (unitStats.movement) {
				case '|': // Dice 1
					for (let i = 1; i <= unitStats.distance; i++) {
						possibleMoves.push(this.getHexByQR(startHex.q + primary.q * i, startHex.r + primary.r * i)?.id);
					}
					
					for (let i = 1; i <= unitStats.armor; i++) {
						possibleMoves.push(this.getHexByQR(startHex.q + axes_b.q * i, startHex.r + axes_b.r * i)?.id);
					}
					break;
				case 'X': // Dice 2
					for (let axis of axes_x) {
						for (let i = 1; i <= unitStats.distance; i++) {
							possibleMoves.push(this.getHexByQR(startHex.q + axis.q * i, startHex.r + axis.r * i)?.id);
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
						possibleMoves.push(this.getHexByQR(startHex.q + valid[0], startHex.r + valid[1])?.id);
					}

					break;
				case '+': // Dice 4
					this.getNeighbors(startHex).forEach(neighbor => possibleMoves.push(neighbor?.id));

					possibleMoves.push(this.getHexByQR(startHex.q + primary.q * 2, startHex.r + primary.r * 2)?.id);
					possibleMoves.push(this.getHexByQR(startHex.q + axes_b.q * 2, startHex.r + axes_b.r * 2)?.id);

					if (mod3 == 2) {
						possibleMoves.push(this.getHexByQR(startHex.q + -2, startHex.r + 1)?.id);
						possibleMoves.push(this.getHexByQR(startHex.q + 2, startHex.r + -1)?.id);
					} else if (mod3 == 1) {
						possibleMoves.push(this.getHexByQR(startHex.q + -1, startHex.r + 2)?.id);
						possibleMoves.push(this.getHexByQR(startHex.q + 1, startHex.r + -2)?.id);
					} else if (mod3 == 0) {
						possibleMoves.push(this.getHexByQR(startHex.q + -1, startHex.r + -1)?.id);
						possibleMoves.push(this.getHexByQR(startHex.q + 1, startHex.r + 1)?.id);
					}

					break;
				case '*': // Dice 5
					this.getNeighbors(startHex)
						.map(hex => hex.id)
						.filter(hexId => !!unit.playerId == !!this.getUnitOnHex(hexId)?.playerId)
						.forEach(neighbor => possibleMoves.push(neighbor));
					break;
				case '0': // Dice 6
					 // Dice 6 cannot initiate a move action, only special attack or move after combat.
					break;
			}

			possibleMoves = [...new Set(possibleMoves.filter(x => x))];

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
		calculateValidDeploymentHexes(playerId) {
			const player = this.players[playerId];
			const baseHex = this.getHex(player.baseHexId);
			if (!baseHex) return [];

			const primary = PLAYER_PRIMARY_AXIS[this.players.length][playerId];
			const mod3 = primary.i % 3;
			
			let deploymentHexes = [baseHex];
			this.getNeighbors(baseHex).forEach(neighbor => deploymentHexes.push(neighbor));
			if (mod3 == 2) {
				deploymentHexes.push(this.getHexByQR(baseHex.q + -2, baseHex.r + 1));
				deploymentHexes.push(this.getHexByQR(baseHex.q + 2, baseHex.r + -1));
			} else if (mod3 == 1) {
				deploymentHexes.push(this.getHexByQR(baseHex.q + -1, baseHex.r + 2));
				deploymentHexes.push(this.getHexByQR(baseHex.q + 1, baseHex.r + -2));
			} else if (mod3 == 0) {
				deploymentHexes.push(this.getHexByQR(baseHex.q + -1, baseHex.r + -1));
				deploymentHexes.push(this.getHexByQR(baseHex.q + 1, baseHex.r + 1));
			}
			
			// Filter out hexes that are already occupied by friendly units
			return deploymentHexes
				.filter(x => x)
				.filter(hex => !this.getUnitOnHex(hex.id)) // Ensure hex is empty
				.map(hex => hex.id);
		},
		calculateDefenderEffectiveArmor(defenderHexId) {
			const defenderUnit = this.getUnitOnHex(defenderHexId);
			if (!defenderUnit) return 0; // Or some error state

			let effectiveArmor = defenderUnit.currentArmor;
			if (defenderUnit.isGuarding) effectiveArmor++;

			// Dice 6 adjacent buff - check neighbors of defender
			this.getNeighbors(this.getHex(defenderHexId)).forEach(neighbor => {
				const neighborUnit = this.getUnitOnHex(neighbor.id);
				if (neighborUnit && neighborUnit.playerId === defenderUnit.playerId && neighborUnit.value === 6) {
					effectiveArmor++;
				}
			});
			effectiveArmor -= defenderUnit.armorReduction;

			defenderUnit.effectiveArmor = Math.max(0, effectiveArmor);
			return defenderUnit.effectiveArmor;
		},
		calculateUIDiceStat(hexId) {
			const FIELDS = 'id,name,armor,attack,range,distance,movement,armorReduction,effectiveArmor';
			const unit = this.getUnitOnHex(hexId);

			if (!unit || unit.isDeath) return;

			this.calculateDefenderEffectiveArmor(hexId);

			return Object.entries(unit)
				.filter(([k ,v]) => FIELDS.includes(k))
				.map(x => x.join(': '))
				.join('<br>');
		},

		// --- ACTIONS ---
		performMove(unitHexId, targetHexId) {
			if (unitHexId == targetHexId) {
				this.addLog("Move failed: Same hex.");
				return;
			}

			const attackerUnit = this.getUnitOnHex(unitHexId);
			const defenderUnit = this.getUnitOnHex(targetHexId);
			const attackerHex = this.getHex(unitHexId);
			const defenderHex = this.getHex(targetHexId);

			if (!attackerUnit || !attackerHex || !defenderHex) {
				this.addLog("Move failed: Invalid unit or hex.");
				this.deselectUnit(); // Deselect if something is wrong
				return;
			}
			
			this.addLog(`Player ${attackerUnit.playerId + 1} attempts to move Dice ${attackerUnit.value} from (${attackerHex.q},${attackerHex.r}) to (${defenderHex.q},${defenderHex.r}).`);
			attackerUnit.isGuarding = false;

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
		performMerge(mergingUnitHexId, targetUnitHexId, isAI) {
			const mergingUnit = this.getUnitOnHex(mergingUnitHexId);
			const targetUnit = this.getUnitOnHex(targetUnitHexId);
			const mergingHex = this.getHex(mergingUnitHexId);
			const targetHex = this.getHex(targetUnitHexId);

			if (!mergingUnit || !targetUnit || mergingUnit.playerId !== targetUnit.playerId || mergingUnit.id === targetUnit.id) {
				this.addLog("Merge failed: Invalid units or target.");
				this.deselectUnit();
				return;
			}

			if (!isAI && !confirm(`Merge Dice ${mergingUnit.value} [${mergingHex.id}] & Dice ${targetUnit.value} [${targetHex.id}] into new unit?`) == true) {
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
				newDieValue = isAI 
					? [2, 3, 4, 5].random()
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
			const p = this.players[mergingUnit.playerId];

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

			this.addLog(`Merged into a new Dice ${newUnit.value}. ${newUnitCanAct ? "It may act this turn." : "It cannot act further this turn."}`);
			
			this.deselectUnit(); // Deselect old unit
			if (newUnitCanAct) {
				this.selectUnit(newUnit.hexId); // Select the new unit so player can act with it
				this.addLog(`New Dice ${newUnit.value} selected. Choose an action.`);
				if (isAI) this.performAITurn();
			} else {
				this.endTurn();
			}
			this.checkWinConditions();
		},
		performRangedAttack(attackerHexId, targetHexId) {
			this.addLog(`Dice 5 at (${this.getHex(attackerHexId).q},${this.getHex(attackerHexId).r}) performs Ranged Attack on unit at (${this.getHex(targetHexId).q},${this.getHex(targetHexId).r}).`);
			this.handleCombat(attackerHexId, targetHexId, 'RANGED');
			const attackerUnit = this.getUnitOnHex(attackerHexId); // Attacker stays on its hex for ranged
			if (attackerUnit) {
				attackerUnit.hasMovedOrAttackedThisTurn = true;
				attackerUnit.actionsTakenThisTurn++;
			}
			this.deselectUnit();
			this.checkWinConditions();
		},
		performSpecialAttack(attackerHexId, targetHexId) {
			this.addLog(`Dice 6 at (${this.getHex(attackerHexId).q},${this.getHex(attackerHexId).r}) performs Special Attack on unit at (${this.getHex(targetHexId).q},${this.getHex(targetHexId).r}).`);
			this.handleCombat(attackerHexId, targetHexId, 'SPECIAL');
			const attackerUnit = this.getUnitOnHex(attackerHexId); // Attacker might have moved if Dice 6 wins
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

		// --- COMBAT ---
		handleCombat(attackerHexId, defenderHexId, combatType, attackerMovesAfterCombat = false) { // combatType: 'MELEE', 'RANGED', 'SPECIAL'
			const attackerUnit = this.getUnitOnHex(attackerHexId);
			const defenderUnit = this.getUnitOnHex(defenderHexId);
			const attackerHex = this.getHex(attackerHexId);
			const defenderHex = this.getHex(defenderHexId);

			if (!attackerUnit || !defenderUnit || !attackerHex || !defenderHex) {
				this.addLog("Combat error: attacker or defender not found.");
				return;
			}

			const defenderEffectiveArmor = this.calculateDefenderEffectiveArmor(defenderHexId);
			
			if (defenderUnit.armorReduction >= UNIT_STATS[defenderUnit.value].armor || attackerUnit.attack >= defenderEffectiveArmor) { // Attacker wins
				this.addLog("Attacker wins! Defender is defeated.");
				// Remove defender
				// this.players[defenderUnit.playerId].dice = this.players[defenderUnit.playerId].dice.filter(d => d.id !== defenderUnit.id);
				this.players[defenderUnit.playerId].dice.find(d => d.id == defenderUnit.id).isDeath = true;
				defenderHex.unitId = null;

				if (combatType === 'MELEE' || (combatType === 'SPECIAL' && attackerUnit.value === 6)) {
					// Attacker moves into vacated hex (melee, special, or if specifically allowed)
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
			this.actionMode = null;
			this.validMoves = [];
			this.validMerges = [];
			this.validTargets = [];

			if (this.gameState !== 'PLAYER_TURN') return;
			
			this.addLog(`Player ${this.currentPlayerIndex + 1} ends their turn.`);
			this.deselectUnit(); // Clear selection
			this.actionMode = null; // Clear action mode

			this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
			this.resetTurnActionsForAllUnits();

			this.addLog(`Player ${this.currentPlayerIndex + 1}'s turn.`);

			this.checkWinConditions(); // Check at start of turn too (e.g. if opponent was eliminated on their own turn by some effect)

			if (this.gameState === 'PLAYER_TURN' && this.currentPlayerIndex === 1 && this.players[this.currentPlayerIndex].isAI) {
				setTimeout(() => this.performAITurn(), 500);
			} else if (this.debug?.autoPlay) {
				this.autoPlay();
			}
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
			const p1BaseHex = this.getHex(p1.baseHexId);
			const p2BaseHex = this.getHex(p2.baseHexId);

			if (p1BaseHex && this.getUnitOnHex(p1BaseHex.id)?.playerId === 1) {
				this.gameOver(1, "Player 2 captured Player 1's base!");
				return;
			}
			if (p2BaseHex && this.getUnitOnHex(p2BaseHex.id)?.playerId === 0) {
				this.gameOver(0, "Player 1 captured Player 2's base!");
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

		// --- AI OPPONENT (Player 2) ---
		performAITurn_1() {
			if (this.gameState !== 'PLAYER_TURN' || this.currentPlayerIndex !== 1) return;

			this.addLog("AI (Player 2) is thinking...");

			const aiPlayer = this.players[1];
			const aiUnits = aiPlayer.dice.filter(d => d.isDeployed && !d.isDeath);
			const opponentUnits = this.players[0].dice.filter(d => d.isDeployed && !d.isDeath);
			const aiBaseHexId = aiPlayer.baseHexId;
			const opponentBaseHexId = this.players[0].baseHexId;

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
					const targets = this.calculateValidRangedTargets(unit.hexId);
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
					const targets = this.calculateValidSpecialAttackTargets(unit.hexId);
					if (targets.length > 0) {
						// Simple: attack the first valid target
						const targetHexId = targets[0];
						this.addLog(`AI (Dice 6) performs Special Attack on hex ${targetHexId}`);
						this.performSpecialAttack(unit.hexId, targetHexId);
						actionTaken = true;
						break; // AI performs one action per turn for now
					}
				}

				// Check for Melee attacks (implicitly part of move)
				const validMoves = this.calculateValidMoves(unit.hexId);
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
					const validMerges = this.calculateValidMoves(unit.hexId, true);
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
					const validMoves = this.calculateValidMoves(unit.hexId); // Get moves to empty hexes

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
		performAITurn_2(forceUnits) {
			if (this.gameState !== 'PLAYER_TURN' || this.currentPlayerIndex !== 1) return;

			this.addLog("AI (Player 2) is planning its turn...");

			const aiPlayer = this.players[1];
			const aiUnits = forceUnits || aiPlayer.dice.filter(d => d.isDeployed && !d.isDeath);
			const opponentUnits = this.players[0].dice.filter(d => d.isDeployed && !d.isDeath);
			const aiBaseHexId = aiPlayer.baseHexId;
			const opponentBaseHexId = this.players[0].baseHexId;

			// --- Improved AI Strategy ---
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
						const validAttacks = this.calculateValidMoves(defendingUnit.hexId).filter(hexId => this.getUnitOnHex(hexId)?.id === attackingUnit.id);
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
							const rangedTargets = this.calculateValidRangedTargets(defendingUnit.hexId);
							if (rangedTargets.includes(attackingUnit.hexId)) {
								this.addLog(`AI: Eliminating high-value threat - performing Ranged Attack on hex ${attackingUnit.hexId}.`);
								this.performRangedAttack(defendingUnit.hexId, attackingUnit.hexId);
								actionExecuted = true;
								break;
							}
						}
						if (!actionExecuted && defendingUnit.value === 6) {
							const specialTargets = this.calculateValidSpecialAttackTargets(defendingUnit.hexId);
							if (specialTargets.includes(attackingUnit.hexId)) {
								this.addLog(`AI: Eliminating high-value threat - performing Special Attack on hex ${attackingUnit.hexId}.`);
								this.performSpecialAttack(defendingUnit.hexId, attackingUnit.hexId);
								actionExecuted = true;
								break;
							}
						}
						if (!actionExecuted) {
							const validMoves = this.calculateValidMoves(defendingUnit.hexId);
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
					const validMerges = this.calculateValidMoves(unit.hexId, true);
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
					const rangedTargets = (unit.value === 5) ? this.calculateValidRangedTargets(unit.hexId) : [];
					const specialTargets = (unit.value === 6) ? this.calculateValidSpecialAttackTargets(unit.hexId) : [];
					const meleeTargets = this.calculateValidMoves(unit.hexId).filter(hexId => this.getUnitOnHex(hexId)?.playerId !== aiPlayer.id);

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
					const validMoves = this.calculateValidMoves(unit.hexId);
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
						this.performSpecialAttack(bestAttackOrMove.unitHexId, bestAttackOrMove.targetHexId);
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
		performAITurn() {
			let choice = [1, 2].random();
			this['performAITurn_' + choice]();
		},

		// --- AI HELPER FUNCTIONS ---
		analyzeThreats(aiUnits, opponentUnits, aiBaseHexId) {
			const threats = [];
			const aiBaseHex = this.getHex(aiBaseHexId);

			// Check for threats to the AI base
			opponentUnits.forEach(enemyUnit => {
				if (!enemyUnit.isDeath) {
					this.selectedUnitHexId = enemyUnit.hexId; // Select enemy unit to calculate its potential moves/targets
					const enemyMoves = this.calculateValidMoves(enemyUnit.hexId);
					const enemyRangedTargets = (enemyUnit.value === 5) ? this.calculateValidRangedTargets(enemyUnit.hexId) : [];
					const enemySpecialTargets = (enemyUnit.value === 6) ? this.calculateValidSpecialAttackTargets(enemyUnit.hexId) : [];

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
					const validMoves = this.calculateValidMoves(aiUnit.hexId);
					const validRangedTargets = (aiUnit.value === 5) ? this.calculateValidRangedTargets(aiUnit.hexId) : [];
					const validSpecialTargets = (aiUnit.value === 6) ? this.calculateValidSpecialAttackTargets(aiUnit.hexId) : [];

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
					const validMerges = this.calculateValidMoves(aiUnit.hexId, true);
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
					const enemyPotentialMoves = this.calculateValidMoves(enemyUnit.hexId);
					if (enemyPotentialMoves.includes(unitHexId)) {
						isThreatened = true;
						return;
					}

					// Check if enemy ranged/special can target this unit
					const enemyRangedTargets = (enemyUnit.value === 5) ? this.calculateValidRangedTargets(enemyUnit.hexId) : [];
					if (enemyRangedTargets.includes(unitHexId)) {
						isThreatened = true;
						return;
					}
					const enemySpecialTargets = (enemyUnit.value === 6) ? this.calculateValidSpecialAttackTargets(enemyUnit.hexId) : [];
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
		
		// --- UTILITIES ---
		addLog(message) {
			// console.log(message);
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