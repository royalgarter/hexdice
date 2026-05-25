// Constants are now in constants.js

Array.prototype.random = function () { return this[Math.floor((random() * this.length))]; }
Array.prototype.cosmic_random = function () { return this[Math.floor((Math.random() * this.length))]; }
let _seed = Math.floor(Math.random() * 1e9);
const setSeed = (s) => { _seed = s; console.log("Seed set to:", s); };
let random = () => {
	_seed = (_seed * 1664525 + 1013904223) % 4294967296;
	return _seed / 4294967296;
};
// const random = () => {return Math.random();const a = new Uint32Array(1);crypto.getRandomValues(a);return a[0] / 4294967296/*2^32*/;}

function alpineHexDiceTacticGame() { return {
	/* --- VARIABLES --- */
	Autochess: Autochess,
	CampaignManager: CampaignManager,
	auth: {
		clientId: '___GOOGLE_CLIENT_ID___',
		user: null,
		token: null,
	},
	online: {
		roomId: null,
		isHost: false,
		status: 'OFFLINE', // OFFLINE, LOBBY, PLAYING
		opponent: null,
		mqttClient: null,
		playerIndex: null, // 0 for host, 1 for guest
		nextSentSeq: 1,
		lastRecvSeq: 0,
		turnTimer: 60,
		timerInterval: null,
	},
	rules: {
		dicePerPlayer: 12,
	},
	gameplayVersion: 1, // 1: Decisive Dice, 2: Destiny Dice
	turnPhase: null, // For Version 2: 'FATE_CALL', 'TACTICAL_COMMAND'
	fateRoll: null,
	options: '', // 'a' = annihilation mode (base capture doesn't end game), 'r': reroll, 'm': merge
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
	unitstat: null, // Pinned hex id for the unit info panel (set on click).
	hoverUnitHexId: null, // Hex id under hover-with-delay; preview source when no pin.
	hoverUnitHexIdImmediate: null, // Hex id set immediately on mouseenter for instant highlight.
	_unitPanelHoverTimer: null,
	trail: {fromHex: null, toHex: null, unit: null, path: []},
	trailAttack: {fromHex: null, toHex: null, unit: null},
	trailSpell: {},
	cursorX: 0,
	cursorY: 0,
	cursorSprite: null,
	validMoves: [], // array of hex IDs
	validMerges: [], // array of hex IDs
	validTargets: [], // array of hex IDs for attacks/merges
	validMovesSet: new Set(),
	validMergesSet: new Set(),
	validTargetsSet: new Set(),
	validDeploymentHexesSet: new Set(),
	diceToReroll: [], // indices of dice selected for reroll
	messageLog: [],
	logCounter: 0,
	winnerMessage: "",
	winnerPlayerId: null,
	rollingDice: false,
	campaignData: null,
	isCampaign: false,
	nextCampaignMap: null,
	deploymentLimit: 666,
	actionMode: null, // 'MOVE', 'RANGED_ATTACK', 'SPECIAL_ATTACK', 'MERGE_SELECT_TARGET', 'SPELLCAST'
	oracleSelectedSpell: null, // 'SHIELD', 'SWAP', 'SKIRMISH'
	gameId: null,
	currentReplay: {
		metadata: {},
		games: [],
		summary: {}
	},
	showLog: true,
	showMinimap: true,
	showUnitInfo: false,
	showCamp: false,
	preset: null,
	spriteSets: [],
	selectedSpriteSet: '', // DEPRECATED: use player.selectedSpriteSet instead
	debug: {
		quiet: false,
		coordinate: new URLSearchParams(location.search).get('mode')?.includes('coordinate'),
		skipReroll: new URLSearchParams(location.search).get('mode')?.includes('debug'),
		skipDeploy: new URLSearchParams(location.search).get('mode')?.includes('debug'),
		autoPlay: new URLSearchParams(location.search).get('mode')?.includes('auto'),
	},

	async loadComponent(el, name) {
		try {
			const response = await fetch(`/html/${name}.html`);
			el.innerHTML = await response.text();
			Alpine.initTree(el);
			if (name === 'auth') this.renderGoogleButtons();
		} catch (e) {
			console.error(`Failed to load component ${name}:`, e);
		}
	},

	generateGameId() {
		return Date.now().toString(36).substr(2) + Math.random().toString(36).substr(2, 3);
	},
	syncUrlWithGameId() {
		if (this.gameId) {
			const url = new URL(window.location.href);
			url.searchParams.set('id', this.gameId);
			window.history.replaceState({}, '', url);
		}
	},

	recordMetadata() {
		this.currentReplay.metadata = {
			date: new Date().toISOString(),
			gameId: this.gameId,
			games: 1,
			version: '1.0',
			playerCount: this.playerCount,
			aiTypes: this.players.map(p => p.isAI ? p.profileName : "Human"),
			options: this.options,
			seed: _seed
		};
	},

	recordAction(actionType, details = {}) {
		if (this.online.status === 'SYNCING') return;

		let normalizedType = actionType;
		// HDPGN compatibility mappings
		if (actionType === 'MELEE') normalizedType = 'MOVE';

		const move = {
			turn: this.turnCount,
			player: this.currentPlayerIndex,
			actionType: normalizedType,
			...details,
			logMessage: (this.messageLog.length > 0) ? (this.messageLog[this.messageLog.length - 1].message || this.messageLog[this.messageLog.length - 1]) : "",
			stateHash: btoa(JSON.stringify({
				playersDice: this.players.map((p, i) =>
					`p${i}Dice:${p.dice.map(d => `${d.value}-${d.hexId}-${d.isDeath === true ? 'true' : 'false'}`).join('|')}`
				).join(';')
			}))
		};

		if (!this.currentReplay.games[0]) {
			this.currentReplay.games[0] = {
				gameNumber: 1,
				winner: -1,
				winnerReason: "",
				totalTurns: 0,
				moves: []
			};
		}
		this.currentReplay.games[0].moves.push(move);
	},

	downloadFile(content, fileName, contentType) {
		const a = document.createElement("a");
		const file = new Blob([content], { type: contentType });
		a.href = URL.createObjectURL(file);
		a.download = fileName;
		a.click();
	},

	exportReplay() {
		const fileName = `replay_${this.gameId || Date.now()}.json`;
		this.downloadFile(JSON.stringify(this.currentReplay, null, 2), fileName, 'application/json');
	},

	generateHDPGN() {
		const replayData = this.currentReplay;
		let hdpgnContent = '';

		for (const gameInstance of replayData.games) {
			hdpgnContent += `[Event "HexDice Game ${this.gameId}"]\n`;
			hdpgnContent += `[Site "Web"]\n`;
			hdpgnContent += `[Date "${replayData.metadata.date}"]\n`;
			hdpgnContent += `[Round "${gameInstance.gameNumber}"]\n`;
			this.players.forEach((p, i) => {
				hdpgnContent += `[Player${i} "${p.name || `Player ${i+1}`}"]\n`;
			});
			hdpgnContent += `[Result "${gameInstance.winner === 0 ? '1-0' : gameInstance.winner === 1 ? '0-1' : '1/2-1/2'}"]\n`;

			const aiList = this.players.map((p, i) => `P${i}=${p.isAI ? p.profileName : "Human"}`).join(',');
			hdpgnContent += `[AIDice "${aiList}"]\n`;

			hdpgnContent += '\n';

			let currentTurn = -1;
			let moveText = '';
			for (const move of gameInstance.moves) {
				if (move.turn !== currentTurn) {
					if (moveText !== '') {
						hdpgnContent += `${currentTurn}. ${moveText.trim()}\n`;
					}
					currentTurn = move.turn;
					moveText = '';
				}

				const fromHex = this.getHex(move.fromHex);
				const toHex = this.getHex(move.toHex);
				const fromQR = fromHex ? { q: fromHex.q, r: fromHex.r } : null;
				const toQR = toHex ? { q: toHex.q, r: toHex.r } : null;

				let moveStr = `${move.player}${move.unitValue || ''}`;
				switch (move.actionType) {
					case 'DEPLOY':
						moveStr += `D(${toQR ? `${toQR.q},${toQR.r}` : ''})`;
						break;
					case 'MOVE':
					case 'MELEE':
						moveStr += `M(${fromQR ? `${fromQR.q},${fromQR.r}` : ''})-(${toQR ? `${toQR.q},${toQR.r}` : ''})`;
						break;
					case 'RANGED_ATTACK':
						moveStr += `RA(${fromQR ? `${fromQR.q},${fromQR.r}` : ''})T(${toQR ? `${toQR.q},${toQR.r}` : ''})`;
						break;
					case 'SPECIAL_ATTACK':
					case 'COMMAND_CONQUER':
						moveStr += `SA(${fromQR ? `${fromQR.q},${fromQR.r}` : ''})T(${toQR ? `${toQR.q},${toQR.r}` : ''})`;
						break;
					case 'MERGE':
						moveStr += `Me(${fromQR ? `${fromQR.q},${fromQR.r}` : ''})-(${toQR ? `${toQR.q},${toQR.r}` : ''})`;
						break;
					case 'REROLL':
						moveStr += `Reroll(${move.unitValue})`;
						break;
					case 'GUARD':
						moveStr += `Guard(${fromQR ? `${fromQR.q},${fromQR.r}` : ''})`;
						break;
					case 'END_TURN':
						moveStr = `P${move.player}END`;
						break;
					default:
						moveStr += `(${move.actionType})`;
						break;
				}
				moveText += `${moveStr} `;
			}
			if (moveText !== '') {
				hdpgnContent += `${currentTurn}. ${moveText.trim()}\n`;
			}
			hdpgnContent += '\n';
		}
		return hdpgnContent;
	},

	exportHDPGN() {
		const fileName = `game_${this.gameId || Date.now()}.hdpgn`;
		this.downloadFile(this.generateHDPGN(), fileName, 'text/plain');
	},

	/* --- AUTOCHESS --- */
	get autochess() { return this.Autochess.state.enabled; },
	get autochessRound() { return this.Autochess.state.round; },
	get autochessInventory() { return this.Autochess.state.inventory; },
	get autochessRerolls() { return this.Autochess.state.rerolls; },
	get autochessLastResult() { return this.Autochess.state.lastResult; },
	get autochessPhase() { return this.Autochess.state.phase; },
	get selectedAutochessProfile() { return this.Autochess.state.selectedProfile; },
	get audioManager() { return window?.AudioManager || {}; },

	initAutochess() { this.Autochess.init(this); },
	generateAutochessInitialArmy() { this.Autochess.generateInitialArmy(this); },
	generateAutochessRecruits() { this.Autochess.generateRecruits(this); },
	recruitAutochessUnit(playerId, index) { this.Autochess.recruitUnit(this, playerId, index); },
	rerollAutochessRecruits(playerId) { this.Autochess.rerollRecruits(this, playerId); },
	createAutochessUnit(value, playerId) { return this.Autochess.createUnit(this, value, playerId); },
	startAutochessCombat() { this.Autochess.startCombat(this); },
	prepareAutochessCombat() { this.Autochess.prepareCombat(this); },
	runAutochessSimulation() { this.Autochess.runSimulation(this); },
	simulateAutochessStep() { this.Autochess.simulateStep(this); },
	executeAutochessAction(unit) { this.Autochess.executeAction(this, unit); },
	nextAutochessRound() { this.Autochess.nextRound(this); },
	selectAutochessUnitSkill(unitId, tier, option) { this.Autochess.selectUnitSkill(this, unitId, tier, option); },
	clickAutochessUnit(unit) { this.Autochess.clickUnit(this, unit); },
	moveAutochessUnit(playerId, fromIndex, toIndex) { this.Autochess.moveUnit(this, playerId, fromIndex, toIndex); },

	get isUnitPanelVisible() {
		const hexId = this.unitPanelHexId();
		return (this.phase === 'PLAYER_TURN' && hexId != null && this.getUnitOnHex(hexId)) &&
               ((window.innerWidth > 768) || this.showUnitInfo);
	},
	get unitPanelData() {
		const hexId = this.unitPanelHexId();
		const u = this.getUnitOnHex(hexId);
		const h = this.getHex(hexId);
		if (!u) return { u: null, h: null, br: { total: 0, parts: [], rerolled: false }, flags: [], terrain: { name: '', effect: '' }, actions: [] };
		return {
			u: u,
			h: h,
			br: this.unitPanelBreakdown(u, h),
			flags: this.unitStatusFlags(u, h),
			terrain: this.unitTerrainText(h),
			actions: this.unitActions(u, h)
		};
	},

	updateUrlParam(key, value) {
		const url = new URL(window.location.href);
		url.searchParams.set(key, value);
		return url.search + url.hash;
	},

	// --- SETUP TERRAIN METHODS ---
	async setupTerrain(force) {
		const radius = this.getRadius();

		this.addLog("Setting up terrain");

		if (this.campaignData?.rmi) {
			await this.generateTerrainFromRMI(this.campaignData);
			return;
		}

		// Implement Roulette (sum-of-6-dice and clockwise placement)
		// User chose "Auto-Placement (Simple)" for roulette
		this.generateRouletteTerrain();

		// Implement R=8 terrain generation (4-roll algorithm)
		if (radius === 8) {
			this.generateR8Terrain();
		}
	},

	terrainByType(type) {
		return `${type.toLowerCase()}_${this.isCampaign ? 'ro' : 'wc2'}`;
	},

	setTerrainType(hex, type) {
		hex.terrainType = type;
		hex.terrainClass = TERRAIN_CONFIG[type]?.bg || 'bg-hexplain';

		const isTerrain = (type !== 'PLAIN');
		if (isTerrain) {
			hex.terrainStyle = [
				`background-color: unset;`,
				`background-size: ${this.isCampaign ? `${Number.isFinite(hex.basePlayerId) ? 'auto 90%' : 'cover'}` : '110%'};`,
				`background-image:
					${Number.isFinite(hex.basePlayerId)
						? `url('/assets/sprites/terrain/base_ro_${PLAYER_CONFIG[hex.basePlayerId].color.toLowerCase()}.gif'), `
						: ``
					}
					url("/assets/sprites/terrain/${this.terrainByType(type)}.png");`
			].join(' ');
		} else {
			hex.terrainStyle = '';
		}
	},

	async generateTerrainFromRMI(campaignData) {
		let rmiName = campaignData.rmi;
		let level = campaignData.level;

		const url = `/assets/ro_maps/${rmiName}`;
		this.addLog(`Generating terrain from RMI: ${rmiName}...`);

		try {
			if (typeof window != 'undefined' && window.history) {
				const url = new URL(window.location.href);
				url.searchParams.set('rmi', rmiName.split('.')[0]);
				window.history.replaceState(null, null, url);
			}

			const img = new Image();
			img.src = url;
			await img.decode();

			const canvas = document.createElement('canvas');
			canvas.width = img.width;
			canvas.height = img.height;
			const ctx = canvas.getContext('2d');
			ctx.drawImage(img, 0, 0);
			const imageData = ctx.getImageData(0, 0, img.width, img.height);

			// Map hexes to image coordinates and sample color
			// background-size: cover logic
			const containerWidth = this.hexGrid.gridWidth;
			const containerHeight = this.hexGrid.gridHeight;
			const containerRatio = containerWidth / containerHeight;
			const imgRatio = img.width / img.height;

			let scale, offsetX = 0, offsetY = 0;
			if (containerRatio > imgRatio) {
				// Container is wider than image (image is cropped vertically)
				scale = containerWidth / img.width;
				offsetY = (img.height * scale - containerHeight) / 2;
			} else {
				// Container is taller than image (image is cropped horizontally)
				scale = containerHeight / img.height;
				offsetX = (img.width * scale - containerWidth) / 2;
			}

			this.determineBaseLocations(this.getRadius());
			const deploymentHexIds = new Set();
			this.players.forEach((_, playerId) => {
				this.calcValidDeploymentHexes(playerId).forEach(id => deploymentHexIds.add(id));
			});

			this.hexes.forEach(hex => {
				// Convert container-space coordinates (hex.trailX/Y) to image-space coordinates
				const imgX = (hex.trailX + offsetX) / scale;
				const imgY = (hex.trailY + offsetY) / scale;

				const px = Math.floor(Math.max(0, Math.min(img.width - 1, imgX)));
				const py = Math.floor(Math.max(0, Math.min(img.height - 1, imgY)));

				const color = this.sampleMeanColor(imageData, px, py, 10);
				const terrainType = this.classifyTerrain(color, hex);
				this.setTerrainType(hex, terrainType);

				if (hex.terrainType == 'LAKE' && deploymentHexIds.has(hex.id)) {
					this.setTerrainType(hex, 'PLAIN');
				}
			});

			this.addLog("RMI Terrain Generation complete.");

			// Update background image of container
			const container = document.querySelector('.hex-grid-campaign-background');
			if (container) {
				container.style.backgroundImage = `url(${url})`;
				container.style.backgroundSize = 'cover';
				container.style.backgroundPosition = 'center';
			}

		} catch (e) {
			this.addLog(`Failed to load RMI: ${e.message}`);
			console.error(e);
		}
	},

	sampleMeanColor(imageData, x, y, size) {
		let r = 0, g = 0, b = 0, count = 0;
		const half = Math.floor(size / 2);

		for (let sy = y - half; sy <= y + half; sy++) {
			for (let sx = x - half; sx <= x + half; sx++) {
				if (sx >= 0 && sx < imageData.width && sy >= 0 && sy < imageData.height) {
					const idx = (sy * imageData.width + sx) * 4;
					r += imageData.data[idx];
					g += imageData.data[idx + 1];
					b += imageData.data[idx + 2];
					count++;
				}
			}
		}

		return [r / count, g / count, b / count];
	},

	rgbToHsv(r, g, b) {
		r /= 255; g /= 255; b /= 255;
		const max = Math.max(r, g, b), min = Math.min(r, g, b);
		let h, s, v = max;
		const d = max - min;
		s = max === 0 ? 0 : d / max;

		if (max === min) {
			h = 0; // achromatic
		} else {
			switch (max) {
				case r: h = (g - b) / d + (g < b ? 6 : 0); break;
				case g: h = (b - r) / d + 2; break;
				case b: h = (r - g) / d + 4; break;
			}
			h /= 6;
		}
		return [h * 360, s, v];
	},

	classifyTerrain(rgb, hex) {
		const [h, s, v] = this.rgbToHsv(rgb[0], rgb[1], rgb[2]);

		// console.log('classifyTerrain', hex?.id, 'h:', h, 's:', s, 'v:', v)

		if (h == 0 && v == 0 && s == 0) return 'MOUNTAIN';
		if (h < 1 && v < 0.3) return 'PLAIN';
		if (s < 0.1 && s < 0.3) return 'TOWER';
		if (s < 0.15) return 'PLAIN';
		if (v < 0.35) return 'MOUNTAIN';

		let minDistance = Infinity;
		let closestTerrain = 'PLAIN';

		for (const [terrain, refHsv] of Object.entries(RMI_TERRAIN_PALETTE).filter(([k, v]) => k != 'MOUNTAIN')) {
			// Hue distance (circular)
			let hDiff = Math.abs(h - refHsv[0]);
			if (hDiff > 180) hDiff = 360 - hDiff;

			// Distance is primarily Hue difference
			const dist = hDiff;

			if (dist < minDistance) {
				minDistance = dist;
				closestTerrain = terrain;
			}
		}

		// console.log('classifyTerrain', hex?.id, h, s, v, closestTerrain)

		// Bias towards PLAIN: If the distance is too large or we're in a "greenish" range, prefer PLAIN
		if (minDistance > 50) return 'PLAIN';

		// Refined check for PLAIN vs FOREST (both are green)
		// Forest is typically more saturated and darker
		if (closestTerrain === 'FOREST' && v > 0.6) return 'PLAIN';

		return closestTerrain;
	},

	generateRouletteTerrain() {
		this.addLog("Generating Roulette Terrain...");
		this.hexes.forEach(x => this.setTerrainType(x, 'PLAIN'));

		const terrainDiceRolls = Array.from({ length: 6 }, () => this.rollDice());
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
				this.setTerrainType(hex, 'PLAIN');
			else
				this.setTerrainType(hex, randomTerrainType);

			this.addLog(`Placed ${randomTerrainType} at [${hex.id}].`);
		}
	},

	generateR8Terrain() {
		this.addLog("Generating R=8 Terrain...");
		this.hexes.forEach(x => this.setTerrainType(x, 'PLAIN'));

		const terrainDiceRolls = Array.from({ length: 6 }, () => this.rollDice());
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
			const roll1Direction = this.rollDice(); // 1-6
			const roll2Distance = this.rollDice(); // 1-6
			const roll3Scatter = this.rollDice(); // 1-6
			const roll4Terrain = this.rollDice(); // 1-6

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
				this.setTerrainType(potentialTerrainHex, terrainType);
				this.addLog(`Placed ${terrainType} at (${potentialTerrainHex.q}, ${potentialTerrainHex.r}).`);
			} else {
				this.addLog(`Skipped terrain #${i+1}: Invalid or out-of-bounds hex generated.`);
			}
		}
	},

	/* --- AUTH METHODS --- */
	async initAuth() {
		try {
			const res = await fetch('/api/config');
			const config = await res.json();
			this.auth.clientId = config.GOOGLE_CLIENT_ID;

			// Debug Bypass: Check URL Params (e.g., ?auth_user=royalgarter&auth_token=123456)
			const urlParams = new URLSearchParams(window.location.search);
			const debugUser = urlParams.get('auth_user');
			const debugToken = urlParams.get('auth_token');

			if (debugUser && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
				this.auth.user = {
					_key: debugUser,
					name: debugUser,
					email: `${debugUser}@localhost`,
					picture: `https://ui-avatars.com/api/?name=${debugUser}`
				};
				this.auth.token = debugToken || 'debug-token';
				this.addLog(`Debug mode: Logged in as ${debugUser}`);
			} else {
				// Check if already logged in (local storage)
				const savedUser = localStorage.getItem('hexdice_user');
				const savedToken = localStorage.getItem('hexdice_token');
				if (savedUser && savedToken) {
					this.auth.user = JSON.parse(savedUser);
					this.auth.token = savedToken;
				}
			}

			// Auto-rejoin room if room param is present
			const roomId = urlParams.get('room');
			if (roomId && this.auth.user) {
				this.joinRoom(roomId);
			}

			// Initialize AudioManager (safe, zero-deps). Preload common SFX if available.
			if (window.AudioManager) {
				try { AudioManager.init(); if (AudioManager.loadDefaults) AudioManager.loadDefaults(); } catch (e) { console.warn('AudioManager init failed', e); }
			}
			this.renderGoogleButtons();
		} catch (e) {
			console.error("Auth init failed", e);
		}
	},

	renderGoogleButtons() {
		if (typeof google === 'undefined' || !this.auth.clientId || this.auth.clientId.includes('___')) return;

		google.accounts.id.initialize({
			client_id: this.auth.clientId,
			callback: window.handleCredentialResponse
		});

		const signInDiv = document.querySelector('.g_id_signin');
		if (signInDiv) {
			google.accounts.id.renderButton(signInDiv, {
				type: 'standard',
				shape: 'pill',
				theme: 'outline',
				text: 'signin',
				size: 'small',
				logo_alignment: 'left'
			});
		}

		setTimeout(() => {
			if (this.auth?.user && this.auth?.token) return;
			google.accounts.id.prompt();
		}, 1e3);
	},

	async handleGoogleAuth(response) {
		this.addLog("Authenticating with Google...");
		try {
			const res = await fetch('/api/auth/google', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ credential: response.credential })
			});
			const data = await res.json();
			if (data.user) {
				this.auth.user = data.user;
				this.auth.token = data.token;
				localStorage.setItem('hexdice_user', JSON.stringify(data.user));
				localStorage.setItem('hexdice_token', data.token);
				this.addLog(`Welcome, ${data.user.name}!`);

				// Sync campaign progress
				if (this.CampaignManager) {
					this.CampaignManager.syncWithServer('PULL');
				}
			} else {
				this.addLog("Login failed.");
			}
		} catch (e) {
			this.addLog("Auth error: " + e.message);
		}
	},

	logout() {
		this.auth.user = null;
		this.auth.token = null;
		localStorage.removeItem('hexdice_user');
		localStorage.removeItem('hexdice_token');
		this.addLog("Logged out.");
		location.reload(); // Refresh to clear Google state
	},

	/* --- ONLINE METHODS --- */
	leaveRoom() {
		if (this.online.mqttClient) {
			this.online.mqttClient.end();
		}
		this.online.roomId = null;
		this.online.status = 'OFFLINE';
		this.online.mqttClient = null;
		this.online.opponent = null;
		this.online.playerIndex = null;
		this.updateURLParams();
		this.addLog("Left online room.");
		location.reload();
	},

	updateURLParams() {
		const url = new URL(window.location.href);
		if (this.online.roomId) {
			url.searchParams.set('room', this.online.roomId);
		} else {
			url.searchParams.delete('room');
		}
		window.history.replaceState({}, '', url);
	},

	async createRoom() {
		if (!this.auth.user) {
			this.addLog("Please login first.");
			return;
		}
		try {
			const res = await fetch('/api/rooms/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId: this.auth.user._key, name: this.auth.user.name })
			});
			const room = await res.json();
			this.online.roomId = room._key;
			this.online.isHost = true;
			this.online.status = 'LOBBY';
			this.online.playerIndex = 0;
			this.updateURLParams();
			this.addLog(`Room created: ${room._key}. Waiting for opponent...`);
			this.connectMQTT();
		} catch (e) {
			this.addLog("Error creating room: " + e.message);
		}
	},

	async joinRoom(roomId) {
		if (!this.auth.user) {
			this.addLog("Please login first.");
			return;
		}
		const id = roomId || prompt("Enter Room ID:");
		if (!id) return;

		try {
			const res = await fetch('/api/rooms/join', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ roomId: id.toUpperCase(), userId: this.auth.user._key, name: this.auth.user.name })
			});
			const room = await res.json();
			if (room.error) {
				this.addLog("Join failed: " + room.error);
				return;
			}
			this.online.roomId = room._key;
			this.online.isHost = room.creator === this.auth.user._key;
			this.online.status = room.status === 'WAITING' ? 'LOBBY' : 'PLAYING';
			this.online.playerIndex = room.players.findIndex(p => p.id === this.auth.user._key);
			this.online.opponent = room.players.find(p => p.id !== this.auth.user._key);
			
			this.updateURLParams();
			this.addLog(`Joined room: ${room._key}. Opponent: ${this.online.opponent?.name || 'Waiting...'}`);
			
			this.connectMQTT();

			// If rejoining an active game, we might need a full state sync.
			// For now, the MQTT buffer/replay and our new state snapshotting should help.
		} catch (e) {
			this.addLog("Error joining room: " + e.message);
		}
	},

	connectMQTT() {
		const broker = 'wss://broker.emqx.io:8084/mqtt';
		this.addLog("Connecting to MQTT...");
		
		const statusTopic = `hexdice/rooms/${this.online.roomId}/status`;
		const options = {
			will: {
				topic: statusTopic,
				payload: JSON.stringify({ userId: this.auth.user._key, status: 'OFFLINE' }),
				qos: 1,
				retain: true
			}
		};

		this.online.mqttClient = mqtt.connect(broker, options);

		this.online.mqttClient.on('connect', () => {
			const topic = `hexdice/rooms/${this.online.roomId}`;
			this.online.mqttClient.subscribe(topic, { qos: 1 });
			this.online.mqttClient.subscribe(statusTopic, { qos: 1 });
			
			// Mark as online
			this.online.mqttClient.publish(statusTopic, JSON.stringify({ userId: this.auth.user._key, status: 'ONLINE' }), { qos: 1, retain: true });
			
			this.addLog("Connected to MQTT.");

			if (!this.online.isHost) {
				this.publishAction('GUEST_JOINED', { name: this.auth.user.name });
			}
		});

		this.online.mqttClient.on('message', (topic, message) => {
			try {
				const payload = JSON.parse(message.toString());
				if (topic.endsWith('/status')) {
					this.handleStatusMessage(payload);
				} else {
					this.handleMQTTMessage(payload);
				}
			} catch (e) {
				console.error("MQTT parse error", e);
			}
		});
	},

	handleStatusMessage(payload) {
		if (payload.userId === this.auth.user._key) return;
		if (payload.status === 'OFFLINE') {
			this.addLog(`⚠️ Opponent ${this.online.opponent?.name || ''} disconnected.`);
		} else if (payload.status === 'ONLINE' && this.online.status === 'PLAYING') {
			this.addLog(`Opponent ${this.online.opponent?.name || ''} is back.`);
		}
	},

	getStateChecksum(returnRaw = false) {
		// Create a simple string representation of the critical game state
		const unitState = this.hexes
			.filter(h => h.unit && !h.unit.isDeath)
			.map(h => `${h.id}:${h.unit.id}:${h.unit.value}:${h.unit.currentArmor}:${h.unit.armorReduction}`)
			.sort() // Ensure order doesn't matter
			.join('|');
		const stateStr = `${this.currentPlayerIndex}:${unitState}:${_seed}`;
		
		if (returnRaw) return stateStr;

		// Simple hash function (djb2)
		let hash = 5381;
		for (let i = 0; i < stateStr.length; i++) {
			hash = (hash * 33) ^ stateStr.charCodeAt(i);
		}
		return (hash >>> 0).toString(16);
	},

	publishAction(type, data) {
		if (!this.online.mqttClient) return;
		const topic = `hexdice/rooms/${this.online.roomId}`;
		const payload = { 
			type, 
			data, 
			sender: this.auth.user._key,
			seq: this.online.nextSentSeq++,
			checksum: this.getStateChecksum() // This now captures the state at publication time
		};
		this.online.mqttClient.publish(topic, JSON.stringify(payload), { qos: 1 });
	},

	handleMQTTMessage(payload) {
		if (payload.sender === this.auth.user._key) return;

		// Sequence check
		if (payload.seq) {
			if (payload.seq <= this.online.lastRecvSeq) {
				console.log("Ignoring out-of-order or duplicate message:", payload.seq);
				return;
			}
			this.online.lastRecvSeq = payload.seq;
		}

		const { type, data, checksum, sender } = payload;
		console.log(`MQTT RECV [${this.auth.user.name}]:`, type, data);

		// Post-action checksum verify
		const verifyChecksum = () => {
			if (checksum && type === 'GAME_ACTION') {
				const localChecksum = this.getStateChecksum();
				if (localChecksum !== checksum) {
					console.error(`DESYNC DETECTED! Local: ${localChecksum}, Remote: ${checksum}`);
					// Diagnostic logging
					console.log("Local critical state:", this.getStateChecksum(true));
					this.addLog("⚠️ Desync detected! Check console for details.");
				}
			}
		};

		switch (type) {
			case 'GUEST_JOINED':
				if (this.online.isHost) {
					this.online.status = 'PLAYING';
					this.online.opponent = { name: data.name, id: sender };
					this.addLog(`Opponent joined: ${data.name}`);
					
					const seed = Math.floor(Math.random() * 1e9);
					setSeed(seed);
					this.publishAction('START_GAME', { seed, hostName: this.auth.user.name });
					this.initOnlineGame();
				}
				break;
			case 'START_GAME':
				setSeed(data.seed);
				this.online.opponent = { name: data.hostName, id: sender };
				this.initOnlineGame();
				break;
			case 'GAME_ACTION':
				this.applyRemoteAction(data, sender);
				verifyChecksum();
				break;
		}
	},

	startOnlineTimer() {
		if (this.online.timerInterval) clearInterval(this.online.timerInterval);
		this.online.turnTimer = 60;
		
		this.online.timerInterval = setInterval(() => {
			if (this.online.status !== 'PLAYING') {
				clearInterval(this.online.timerInterval);
				return;
			}
			
			this.online.turnTimer--;
			if (this.online.turnTimer <= 0) {
				this.addLog("Time's up!");
				if (this.currentPlayerIndex === this.online.playerIndex) {
					this._endTurn();
				}
				this.online.turnTimer = 60; // Reset
			}
		}, 1000);
	},

	async initOnlineGame() {
		this.addLog("Initializing online game...");
		this.isCampaign = false;
		this.playerCount = 2;
		
		const prevStatus = this.online.status;
		this.online.status = 'SYNCING'; // Prevent MQTT noise during auto-setup
		
		await this.resetGame({ isCampaign: false });
		this.players.forEach(p => p.isAI = false);

		// Assign names and IDs
		if (this.online.isHost) {
			if (this.players[0]) {
				this.players[0].name = this.auth.user.name;
				this.players[0].id = this.auth.user._key;
			}
			if (this.players[1]) {
				this.players[1].name = this.online.opponent?.name;
				this.players[1].id = this.online.opponent?.id;
			}
		} else {
			if (this.players[0]) {
				this.players[0].name = this.online.opponent?.name;
				this.players[0].id = this.online.opponent?.id;
			}
			if (this.players[1]) {
				this.players[1].name = this.auth.user.name;
				this.players[1].id = this.auth.user._key;
			}
		}

		this.randomStart();
		this.phase = 'PLAYER_TURN'; // Explicitly set phase
		
		this.online.status = prevStatus;
		this.addLog("Online game ready! Turn: P1");
		this.startOnlineTimer();
	},

	applyRemoteAction(data, sender) {
		const { action, args } = data;
		console.log(`Applying remote action [${this.auth.user.name}]:`, action, args);

		// Referee Check: Ensure it's the sender's turn
		if (this.currentPlayerIndex === this.online.playerIndex) {
			console.warn("Ignoring remote action during local turn:", action);
			return;
		}

		// Optional: Strictly verify sender ID matches the current player's ID
		const expectedSenderId = this.players[this.currentPlayerIndex]?.id;
		if (expectedSenderId && sender !== expectedSenderId) {
			console.warn(`SECURITY: Received action from unexpected sender ${sender}. Expected ${expectedSenderId}.`);
			return;
		}
		
		if (action === 'HEX_CLICK') {
			this._handleHexClick(...args);
		} else if (action === 'ROLL_DICE') {
			this._rollDice(...args);
		} else if (action === 'END_TURN') {
			this._endTurn();
		}
	},

	/* --- INITIALIZATION --- */
	async init() {
		await this.initAuth();
		await this.CampaignManager.init();

		try {
			const response = await fetch('/assets/sets.json');
			this.spriteSets = await response.json();
		} catch (e) {
			console.error("Failed to load sprite sets", e);
		}

		const campaignMapParam = new URLSearchParams(location.search).get('map');
		this.gameplayVersion = parseInt(new URLSearchParams(location.search).get('version')) || 1;
		let campaignData = null;
		if (campaignMapParam) {
			try {
				campaignData = await this.CampaignManager.fetchCampaignMap(campaignMapParam);
				this.addLog(`Loaded Campaign Map: ${campaignData.name}`);
			} catch (e) {
				this.addLog(`Error loading campaign map: ${e.message}`);
			}
		}

		this.playerCount = parseInt(new URLSearchParams(location.search).get('players')) || 2;
		this.preset = new URLSearchParams(location.search).get('preset');
		this.mode = new URLSearchParams(location.search).get('mode') || 'gui';
		if (campaignData) this.playerCount = 2; // Campaign maps are 2-player by default

		// Map size modifier
		const radius = campaignData?.radius || this.getRadius();
		this.generateHexGrid(radius);

		this.determineBaseLocations(radius);
		this.options = new URLSearchParams(location.search).get('options') || this.options || '';

		await this.resetGame({
			isCampaign: !!campaignData || (new URLSearchParams(location.search).get('campaign') == 'true'),
			campaignData: campaignData
		});

		if (this.autochess) {
			this.initAutochess();
		}

		setTimeout(() => window?.AudioManager?.playMusic('opening', {volume: 1}), 3e3);
	},
	async resetGame(opts) {
		if (window.AudioManager) { try { AudioManager.stopMusic(); } catch (e) {} }
		const campaignData = opts?.campaignData;
		this.campaignData = campaignData;
		this.isCampaign = opts?.isCampaign ?? (this.CampaignManager.state.isCampaignActive || !!campaignData);

		this.gameId = this.generateGameId();
		this.syncUrlWithGameId();

		this.currentReplay = {
			metadata: {},
			games: [{
				gameNumber: 1,
				winner: -1,
				winnerReason: "",
				totalTurns: 0,
				moves: []
			}],
			summary: { wins: [0, 0], draws: 0, totalTurns: 0, avgTurnsPerGame: 0 }
		};

		// Crucible Scaling: Every 10 levels, enemy deployment limit increases by 1
		this.deploymentLimit = this.CampaignManager.getDeploymentLimit(campaignData?.deploymentLimit || opts?.deploymentLimit);

		const preset = this.preset && EPIC_PRESETS[this.preset];		if (preset) {
			this.rules.dicePerPlayer = preset.dice.length;
			this.rules.noReroll = preset.noReroll;
			this.addLog(`Applying preset: ${preset.name}`);
		} else {
			this.rules.dicePerPlayer = 12; // Default
			this.rules.noReroll = false;
		}

		this.players = [];
		const usedSkins = new Set();

		for (let i = 0; i < this.playerCount; i++) {
			const isAI = this.CampaignManager.isAIPlayer(i, opts, campaignData);
			let selectedSkin = '';

			if (isAI && this.spriteSets.length > 0) {
				const availableSkins = this.spriteSets.filter(s => !usedSkins.has(s));
				if (availableSkins.length > 0) {
					const ro_skins = availableSkins.filter(x => x.includes('ro_'));
					selectedSkin = this.isCampaign 
						? this.CampaignManager.getAIPlayerSkin(campaignData, availableSkins, ro_skins)
						: availableSkins.cosmic_random();
					usedSkins.add(selectedSkin);
				}
			}

			this.players.push({
				...PLAYER_CONFIG[i],
				dice: [],
				initialRollDone: this.CampaignManager.needsInitialRoll(i, campaignData), // P1 is pre-rolled in campaign, P2 is too if JSON
				baseHexId: null,
				rerollsUsed: 0,
				isEliminated: false,
				selectedSpriteMix: null,
				selectedSpriteSet: selectedSkin,
				isAI: isAI,
				profileName: Object.keys(heuristicProfiles).random()
			});
		}

		// Load Dice from Campaign Data OR Use Legendary Six
		if (this.isCampaign) {
			this.CampaignManager.initCampaignDice(this, campaignData, this.players[0]);

			if (campaignData) {
				this.CampaignManager.initEnemyDice(this, campaignData, this.players[1]);
			} else {
				this.addLog("Campaign Mode: You command the Legendary Six.");
			}
		}

		const radius = campaignData?.radius || this.getRadius();
		this.generateHexGrid(radius);
		this.hexes.forEach(h => {
			h.unitId = null;
			h.unit = null;
			this.setTerrainType(h, 'PLAIN');
		});

		if (this.isCampaign && campaignData?.rmi) {
			await this.setupTerrain();
		}

		// Apply Terrain from Campaign Data
		if (campaignData?.terrain) {
			campaignData.terrain.forEach(t => {
				const [q, r] = t.id.split(',').map(Number);
				const hex = this.getHexByQR(q, r);
				if (hex) this.setTerrainType(hex, t.type);
			});
		}

		this.determineBaseLocations(radius);
		this.phase = (this.isCampaign && !!campaignData) ? 'SETUP_DEPLOY' : 'SETUP_ROLL';
		if (this.phase === 'SETUP_DEPLOY') this.refreshValidDeploymentHexes();
		if (this.isCampaign && campaignData) {
			this.CampaignManager.autoDeployEnemy(this, campaignData);
		}
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
			this.players.forEach(p => this.setPlayerAI(p));
			this.addLog(`Autoplay game started`);
		}

		this.addLog(`New game started with ${this.playerCount} players.`);
		this.players.forEach((_, i) => this.initPlayerSkins(i));
		this.recordMetadata();
	},

	setPlayerAI(player, flag=true) {
		player.isAI = flag;
		player.profileName = player.profileName || Object.keys(heuristicProfiles).random();
	},

	initPlayerSkins(playerId) {
		const player = this.players[playerId];
		if (!player) return;

		if (this.isCampaign) {
			this.CampaignManager.initPlayerSkins(this, playerId);
		}

		if (player.selectedSpriteSet?.includes('mix')) {
			fetch(`/assets/sprites/sets/${player.selectedSpriteSet}/mix.json`)
				.then(r => r.json())
				.then(json => {
					player.selectedSpriteMix = json;
					player.dice.forEach(die => {
						const sprite = json.filter(x => x.includes(`${die.value}_`)).cosmic_random();
						if (sprite) {
							player.sprites = player.sprites || [];
							player.sprites[die.value] = `/assets/sprites/sets/${player.selectedSpriteSet}/${sprite}`;
							die.spriteUrl = player.sprites[die.value];
						}
					});
				})
				.catch(e => console.error("Failed to load sprite mix", e));
		} else {
			player.dice.forEach(die => {
				die.spriteUrl = this.getUnitSpriteUrl(die);
			});
		}
	},

	/* --- HEX GRID --- */
	getRadius(link=location) {
		const urlParams = new URLSearchParams(link?.search || 'http://localhost/');
		const presetKey = urlParams.get('preset');
		const preset = EPIC_PRESETS[presetKey];

		const radius = parseInt(urlParams.get('R')) || preset?.radius || ((this.playerCount <= 3) ? 5 : 6);

		const cls = `radius-${radius}`;
		if (typeof document !== 'undefined' && document.querySelector) {
			let dom = document.querySelector('.hex-grid-container');
			if (dom && !dom.classList?.contains?.(cls)) {
				if ([...dom.classList].find(x => x.includes('radius-')))
					dom.classList.remove([...dom.classList].find(x => x.includes('radius-')));
				dom.classList.add(cls);
			}
		}

		return radius;
	},
	generateHexGrid(radius, padding=1, ratio) {
		this.hexes = [];
		this.hexesQR = {};

		const ADJUSTED_WIDTH = Math.floor(HEX_WIDTH * (ratio || 1));
		const ADJUSTED_HEIGHT = Math.floor(HEX_HEIGHT * (ratio || 1));

		let id = 0;
		for (let q = -radius; q <= radius; q++) {
			for (let r = -radius; r <= radius; r++) {
				// Check if s is also within radius
				if (-q - r < -radius || -q - r > radius) continue;

				const x = ADJUSTED_WIDTH * 3/4 * q;
				const y = ADJUSTED_HEIGHT * (r + q / 2);

				this.hexes.push({
					id, q, r, s: -q-r,
					unitId: null,
					unit: null, // Pre-initialize unit to null for faster access
					visualX: x, visualY: y,
					terrainType: 'PLAIN',
					terrainClass: 'bg-hexplain'
				});
				this.hexesQR[(q * 1e3) + r] = id;

				id++;
			}
		}

		let allX = this.hexes.map(h => h.visualX);
		let allY = this.hexes.map(h => h.visualY);
		let minX = Math.min(...allX);
		let maxX = Math.max(...allX);
		let minY = Math.min(...allY);
		let maxY = Math.max(...allY);
		let gridWidth = maxX - minX + ADJUSTED_WIDTH;
		let gridHeight = maxY - minY + ADJUSTED_HEIGHT; // Approx

		if (typeof window !== 'undefined' && !ratio) {
			const viewWidth = window.innerWidth || (window.screen && window.screen.width);
			const viewHeight = window.innerHeight || (window.screen && window.screen.height);

			if (viewWidth && viewHeight) {
				if ((viewHeight/viewWidth) > (3.99/3)) {
					// console.log('(viewHeight/viewWidth) > (3.99/3)')
					return this.generateHexGrid(radius, padding, (viewWidth * 0.99) / gridWidth);
				}

				if (gridWidth > viewWidth) {
					// console.log('gridWidth > viewWidth')
					return this.generateHexGrid(radius, padding, viewWidth / gridWidth);
				}

				// console.log({gridWidth, viewWidth})

				if (document.querySelectorAll('[id^="game-"]').length) {
					let paddingHeight = [...document.querySelectorAll('[id^="game-"]')].reduce((a, v) => a + v.clientHeight, 0);
					paddingHeight *= 2;

					let delta = viewHeight - paddingHeight;

					if (gridHeight < delta) {
						return this.generateHexGrid(radius, padding, delta / gridHeight);
					} else {
						return this.generateHexGrid(radius, padding, gridHeight / delta);
					}
				}
			}
		}

		const style = `width: ${gridWidth}px; height: ${gridHeight}px;`;

		this.hexGrid = {allX, allY, minX, minY, gridWidth, gridHeight, style};

		let css = '';
		for (let i=0; i<this.hexes.length; i++) {
			this.hexes[i].left = this.hexes[i].visualX - this.hexGrid.minX + padding;
			this.hexes[i].top = this.hexes[i].visualY - this.hexGrid.minY + padding;
			this.hexes[i].width = ADJUSTED_WIDTH - (padding << 1);
			this.hexes[i].height = ADJUSTED_HEIGHT - (padding << 1);

			this.hexes[i].trailX = this.hexes[i].left + (this.hexes[i].width / 2);
			this.hexes[i].trailY = this.hexes[i].top + (this.hexes[i].height / 2);

			css += `.hex-${this.hexes[i].id} { left: ${this.hexes[i].left}px; top: ${this.hexes[i].top}px; width: ${this.hexes[i].width}px; height: ${this.hexes[i].height}px; }\n`;
		}

		if (typeof document !== 'undefined' && document.createElement && document.getElementById) {
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

		if (!hex || !hex.unitId) return null;

		let unit = hex.unit;

		if (!unit || state) {
			const parts = hex.unitId.split('_');
			const playerId = parseInt(parts[0]);
			const diceIndex = parseInt(parts[1]);
			
			// Fallback: search for unit by ID if legacy parse fails
			if (isNaN(playerId) || isNaN(diceIndex)) {
				const s = state || this;
				unit = s.players.flatMap(p => p.dice).find(d => d.id === hex.unitId);
			} else {
				unit = (state || this).players[playerId]?.dice[diceIndex];
			}
		}

		return (unit && !unit.isDeath) ? unit : null;
	},
	getHexQR(hexId) {
		const hex = this.hexes[hexId];
		return hex ? { q: hex.q, r: hex.r } : null;
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
		state = state || this;

		let cls = hex.terrainClass || 'bg-hexdefault';

		if (hex.basePlayerId !== null && hex.basePlayerId !== undefined && !state?.players?.[hex.basePlayerId]?.isEliminated) {
			cls = PLAYER_CONFIG[hex.basePlayerId].bg;
		} else if (state.Autochess?.state?.enabled && state.Autochess?.state?.phase === 'PREPARATION') {
			// Highlight deployment area in Autochess Prep
			const player = state.players[0];
			const baseHex = this.getHex(player.baseHexId, state);
			if (baseHex) {
				const dist = this.axialDistance(baseHex.q, baseHex.r, hex.q, hex.r);
				if (dist <= 2) cls = PLAYER_CONFIG[0].bg;
			}
		}

		// if (state.selectedUnitHexId === hex.id) cls += ' bg-hexselect';
		// if (state.validMovesSet?.has(hex.id)) cls += ' bg-hexmove';
		// if (state.validMergesSet?.has(hex.id)) cls += ' bg-hexmerge';
		// if (state.validTargetsSet?.has(hex.id)) cls += ' bg-hextarget';
		// if (state.dangerHexes?.[hex.id]) cls += ' bg-hexdanger';

		// if (state.phase === 'SETUP_DEPLOY' && state.validDeploymentHexesSet?.has(hex.id)) {
		// 	cls = 'bg-hexdeploy';
		// }

		let hovering = state.hovering;
		if (hovering.hexId && (state.selectedUnitHexId != hovering.hexId)) {
			if (hovering.validMovesSet?.has(hex.id)) cls += ' bg-hexmove';
			else if (hovering.validMergesSet?.has(hex.id)) cls += ' bg-hexmerge';
			else if (hovering.validTargetsSet?.has(hex.id)) cls += ' bg-hextarget';
		}

		return cls;
	},
	hexStyle(hex) {
		let style = [];

		const unit = hex.unit || this.getUnitOnHex(hex.id);
		const terrainStyle = hex.terrainStyle;

		let filter = ``;

		// if (this.hoverUnitHexIdImmediate === hex.id && this.selectedUnitHexId !== hex.id) filter += ' brightness(1.35) drop-shadow(0 0 6px white)';

		if (this.selectedUnitHexId === hex.id) filter += ' sepia(0.5)';
		if (this.validMovesSet?.has(hex.id)) filter += ' brightness(0.5)';
		if (this.validMergesSet?.has(hex.id)) filter += ' saturate(0.5)';
		if (this.validTargetsSet?.has(hex.id)) filter += ' sepia(1)';
		// if (this.dangerHexes?.[hex.id]) filter += ' contrast(0.5)';

		if (this.phase === 'SETUP_DEPLOY' && this.validDeploymentHexesSet?.has(hex.id)) {
			filter += ' sepia(1)';
		}

		if (filter?.length) style.push(`filter: ${filter};`);

		if (unit) {
			const unitUrl = unit.spriteUrl;
			const isAutochess = !!(this.Autochess?.state?.enabled);
			const isPrep = isAutochess && this.Autochess.state.phase === 'PREPARATION';

			let isPlayerDeploymentHex = false;
			if (isPrep) {
				const player = this.players[0];
				const baseHex = this.getHex(player.baseHexId);
				if (baseHex) {
					const dist = this.axialDistance(baseHex.q, baseHex.r, hex.q, hex.r);
					if (dist <= 2) isPlayerDeploymentHex = true;
				}
			}

			const shouldSuppressBg = isAutochess && (Number.isFinite(hex.basePlayerId) || isPlayerDeploymentHex);

			if (!shouldSuppressBg) {
				style.push(`background-color: unset;`);
			}

			style.push(
				`background-size: auto ${(this.isCampaign) ? '90%' : '66%'}, ${Number.isFinite(hex.basePlayerId) ? 'auto 90%' : 'cover'};`,
				`background-image: url("${unitUrl}")
					${(Number.isFinite(hex.basePlayerId) && !isAutochess)
						? `, url('/assets/sprites/terrain/base_ro_${PLAYER_CONFIG[hex.basePlayerId].color.toLowerCase()}.gif')`
						: ``
					}
					${(terrainStyle && !shouldSuppressBg)
						? `, url("/assets/sprites/terrain/${this.terrainByType(hex.terrainType)}.png")`
						: ``
					};`
			);
		} else {
			const isAutochess = !!(this.Autochess?.state?.enabled);
			const isPrep = isAutochess && this.Autochess.state.phase === 'PREPARATION';

			let isPlayerDeploymentHex = false;
			if (isPrep) {
				const player = this.players[0];
				const baseHex = this.getHex(player.baseHexId);
				if (baseHex) {
					const dist = this.axialDistance(baseHex.q, baseHex.r, hex.q, hex.r);
					if (dist <= 2) isPlayerDeploymentHex = true;
				}
			}
			const shouldSuppressBg = isAutochess && (Number.isFinite(hex.basePlayerId) || isPlayerDeploymentHex);

			if (!shouldSuppressBg && terrainStyle) {
				style.push(terrainStyle);
			}

			// Autochess Suppression of base image from CSS class (cleaner board)
			if (shouldSuppressBg) {
				style.push('background-image: none !important;');
			}
		}
		return style.join(' ');
	},
	hexCursor(hex) {
		return 'pointer';
	},
	hexCursorSprite(hex) {
		if (!this.selectedUnitHexId || hex.id === this.selectedUnitHexId) return null;
		const selectedUnit = this.getUnitOnHex(this.selectedUnitHexId);
		if (!selectedUnit) return null;
		const hoveredUnit = hex.unit;
		if (!hoveredUnit) {
			return this.validMovesSet?.has(hex.id) ? '/assets/cursors/cursor_move.png' : null;
		}
		if (hoveredUnit.playerId !== selectedUnit.playerId) {
			// Enemy hex: ranged/oracle use validTargetsSet, melee use validMovesSet
			const isRanged = this.actionMode === 'RANGED_ATTACK' || selectedUnit.value === 2;
			if (isRanged) return this.validTargetsSet?.has(hex.id) ? '/assets/cursors/cursor_arrow.png' : null;
			return this.validMovesSet?.has(hex.id) ? '/assets/cursors/cursor_attack.png' : null;
		}
		// Friendly hex: spell only, and only after a spell has been chosen
		if (this.actionMode === 'SPELLCAST' && this.oracleSelectedSpell && this.validTargetsSet?.has(hex.id)) return '/assets/cursors/cursor_spell.png';
		return null;
	},
	hoverHex(hexId) {
		if (this.phase !== 'PLAYER_TURN') return;

		this.hovering = {};

		this.hovering.hexId = hexId;
		this.hovering.unit = this.getUnitOnHex(hexId);

		if (this.hovering.unit && this.hovering.unit.playerId === this.currentPlayerIndex) {
			this.hovering.validMoves = this.calcValidMoves(hexId);
			this.hovering.validMovesSet = new Set(this.hovering.validMoves);
			this.hovering.validMerges = this.calcValidMoves(hexId, 'MERGE');
			this.hovering.validMergesSet = new Set(this.hovering.validMerges);

			if (this.hovering.unit?.value == 2) {
				this.hovering.validTargets = this.calcValidRangedTargets(hexId, null, true);
				this.hovering.validTargetsSet = new Set(this.hovering.validTargets);
			}

			if (this.hovering.unit?.value == 6) {
				this.hovering.validTargets = this.calcValidSpecialAttackTargets(hexId, null, true);
				this.hovering.validTargetsSet = new Set(this.hovering.validTargets);
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
	autoDeployPreset(preset) {
		const numRows = Math.floor(Math.sqrt(preset.dice.length * 2));

		this.players.forEach((player, playerIdx) => {
			const baseHex = this.getHex(player.baseHexId);
			if (!baseHex) return;

			let diceIdx = 0;
			for (let i = 1; i <= numRows; i++) {
				for (let k = 0; k < i; k++) {
					let targetQ, targetR;
					if (playerIdx === 0) {
						// P0 (Blue): Bottom corner (0, 7)
						// Shifted back 2 hexes: Row 1 now starts at R=8 instead of R=6
						targetQ = -(i - 1) + (2 * k);
						targetR = baseHex.r + 1 - k;
					} else {
						// P1 (Red): Top corner (0, -7)
						// Shifted back 2 hexes: Row 1 now starts at R=-8 instead of R=-6
						targetQ = (i - 1) - (2 * k);
						targetR = baseHex.r - 1 + k;
					}

					const targetHex = this.getHexByQR(targetQ, targetR);
					if (targetHex && diceIdx < player.dice.length) {
						const die = player.dice[diceIdx];
						die.isDeployed = true;
						this.move(die, null, targetHex);
					}
					diceIdx++;
				}
			}
		});
		this.addLog(`Units auto-deployed for ${preset.name}.`);
	},
	getUnitSpriteUrl(unit) {
		if (!unit) return '';
		const player = this.players[unit.playerId];
		if (!player) return '';
		const spriteColor = player.sprite;
		const value = unit.value;

		if (player.sprites?.[value]) return player.sprites[value];

		if (player.selectedSpriteSet) {
			return `/assets/sprites/sets/${player.selectedSpriteSet}/${value}.gif`;
		}

		return (false && this.players[1].isAI) 
			? `/assets/sprites/sets/default/${value}.png`
			: `/assets/sprites/multi_players/d${value}_${spriteColor}.gif`;
	},
	rollInitialDice(playerId) {
		if (this.players[playerId].initialRollDone) return;
		const player = this.players[playerId];
		player.dice = [];

		const preset = this.preset && EPIC_PRESETS[this.preset];

		for (let i = 0; i < this.rules.dicePerPlayer; i++) {
			const roll = (preset && preset.dice) ? preset.dice[i] : (this.rollDice());
			const die = {
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
			};
			die.effectiveArmor = die.armor;
			die.spriteUrl = this.getUnitSpriteUrl(die);
			player.dice.push(die);
		}
		player.initialRollDone = true;
		this.initPlayerSkins(playerId);
		this.recordAction('ROLL_DICE', { unitValue: player.dice.map(d => d.value).join(',') });
		if (preset) {
			this.addLog(`P${playerId + 1} army ready (${preset.name})`);
		} else {
			this.addLog(`P${playerId + 1} rolled: ${player.dice.map(d => d.value).join(', ')}`);
		}

		if (this.players.every(p => p.initialRollDone)) {
			if (preset) {
				this.autoDeployPreset(preset);
				this.phase = 'PLAYER_TURN';
				this.currentPlayerIndex = 0;
				this.addLog("Battle Begins!");
			} else if (this.rules.noReroll) {
				this.phase = 'SETUP_DEPLOY';
				this.currentPlayerIndex = 0;
				this.selectedDieToDeploy = 0;
				this.refreshValidDeploymentHexes();
				this.addLog("Reroll phase skipped.");
			} else {
				this.phase = 'SETUP_REROLL';
				this.currentPlayerIndex = 0; // Player 1 starts reroll
				this.diceToReroll = [];

				if (this.debug?.skipReroll) this.players.forEach(() => this.skipReroll());
			}
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
		return this.players[this.currentPlayerIndex]?.rerollsUsed === 0; // Only one reroll phase
	},
	performReroll() {
		if (!this.canConfirmReroll() || this.diceToReroll.length === 0) {
			this.skipReroll(); // If no dice selected or already rerolled, just skip
			return;
		}
		const player = this.players[this.currentPlayerIndex];
		let rerolledValues = [];
		this.diceToReroll.forEach(diceIndex => {
			const oldVal = player.dice[diceIndex].value;
			const newRoll = this.rollDice();
			player.dice[diceIndex].value = newRoll;
			// Update stats based on new roll
			Object.assign(player.dice[diceIndex], UNIT_STATS[newRoll]);
			player.dice[diceIndex].currentArmor = UNIT_STATS[newRoll].armor;
			player.dice[diceIndex].armorReduction = 0; // Reset this on reroll
			rerolledValues.push(newRoll);

			this.recordAction('REROLL', { unitValue: oldVal, newValue: newRoll, diceIndex: diceIndex });
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
			const preset = this.preset && EPIC_PRESETS[this.preset];
			if (preset) {
				this.autoDeployPreset(preset);
				this.phase = 'PLAYER_TURN';
				this.currentPlayerIndex = 0;
				this.addLog("Battle Begins!");
			} else {
				this.phase = 'SETUP_DEPLOY';
				this.currentPlayerIndex = 0; // Player 1 starts deployment
				this.selectedDieToDeploy = 0;
				this.refreshValidDeploymentHexes();

				if (this.debug?.skipDeploy) {
					this.players.forEach((player, playerIdx) => {
						player.dice.forEach((dice, diceIdx) => {
							this.selectDieToDeploy(diceIdx);
							this.handleHexClick(this.calcValidDeploymentHexes(playerIdx).random());
						});
					});
				}
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
		this.recordAction('DEPLOY', { unitValue: dieToDeploy.value, toHex: targetHex.id });

		this.addLog(`P${player.id + 1} deployed #${dieToDeploy.value} to [${hexId}]`);
		this.selectedDieToDeploy = player.dice.find(x => !x.isDeployed)?.originalIndex;
		this.refreshValidDeploymentHexes();

		// Check if current player has deployed all dice OR reached deployment limit
		const deployedCount = player.dice.filter(d => d.isDeployed).length;
		if (player.dice.every(d => d.isDeployed) || (this.isCampaign && player.id === 0 && deployedCount >= this.deploymentLimit)) {
			// Find next player who hasn't deployed all dice
			const nextDeployPlayer = this.players.find(p => p.id > player.id && p.dice.some(d => !d.isDeployed));

			if (nextDeployPlayer) {
				this.currentPlayerIndex = nextDeployPlayer.id;
				this.selectedDieToDeploy = this.players[this.currentPlayerIndex].dice.findIndex(d => !d.isDeployed);
				this.addLog(`P${this.currentPlayerIndex + 1} turn to deploy`);
				this.refreshValidDeploymentHexes();
			} else {
				this.startGamePlay();
			}
		}
	},
	startGamePlay() {
		this.phase = 'PLAYER_TURN';
		this.currentPlayerIndex = 0; // Player 1 starts the game
		this.trail = {fromHex: null, toHex: null, unit: null, path: []};
		this.trailSpell = {};

		this.resetTurnActionsForPlayer(this.currentPlayerIndex);
		this.addLog("---");
		this.addLog("P1 turn.");

		window?.AudioManager?.playSfx('capture');
		window?.AudioManager?.playMusic('battle');

		if (this.gameplayVersion === 2) {
			this.startFatesCall();
		} else {
			if (this.players[this.currentPlayerIndex].isAI) {
				this.addLog(`[AI] P${this.currentPlayerIndex + 1} turn.`);
				this.performAITurn();
			} else if (this.debug?.autoPlay) {
				this.autoPlay();
			}
		}
	},
	randomStart() {
		// Roll initial dice for all players
		this.players.forEach((p, i) => this.rollInitialDice(i));
		
		// Deploy all dice randomly for all players
		this.players.forEach((player, playerIdx) => {
			this.currentPlayerIndex = playerIdx; // FIX: Ensure current player index matches loop
			player.dice.forEach((dice, diceIdx) => {
				const validHexes = this.calcValidDeploymentHexes(playerIdx);
				if (validHexes.length > 0) {
					this.selectedDieToDeploy = diceIdx;
					this.deployUnit(validHexes.random());
				}
			});
		});
		
		this.currentPlayerIndex = 0; // Reset to P1 turn
		this.addLog(`Random start completed! Player 1's turn.`);
	},
	startRomanceMode() {
		this.addLog("👑 Romance of the Dice Kingdoms - All players are AI!");

		// Set all players as AI
		this.players.forEach(p => this.setPlayerAI(p));

		// Roll initial dice for all players
		this.players.forEach((p, i) => this.rollInitialDice(i));

		// Deploy all dice randomly for all players
		this.players.forEach((player, playerIdx) => {
			this.currentPlayerIndex = playerIdx; // FIX: Ensure current player index matches loop
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
	refreshValidDeploymentHexes() {
		if (this.phase !== 'SETUP_DEPLOY') {
			this.validDeploymentHexesSet?.clear();
			return;
		}
		const hexIds = this.calcValidDeploymentHexes(this.currentPlayerIndex);
		this.validDeploymentHexesSet = new Set(hexIds);
	},

	/* --- DESTINY --- */
	startFatesCall() {
		window?.AudioManager?.playSfx('thunder');
		console.log(`P${this.currentPlayerIndex+1} startFatesCall`);

		let delay = this.players[this.currentPlayerIndex].isAI ? 0 : 1e3;

		this.turnPhase = 'FATE_CALL';
		this.fateRoll = this.rollDice(6, 1e3 + delay);

		if (typeof window !== 'undefined' && window.rollDiceAnimation) {
			setTimeout(() => this.actFatesCall(), 3e3 + delay);
		} else {
			this.actFatesCall();
		}
	},
	actFatesCall() {
		console.log(`P${this.currentPlayerIndex+1} actFatesCall`);

		this.addLog(`🎲 P${this.currentPlayerIndex+1} Phase 1: Fate's Call! Roll: D${this.fateRoll}`);

		const matchingUnits = this.players[this.currentPlayerIndex].dice.filter(d => d.isDeployed && !d.isDeath && d.value === this.fateRoll);
		if (matchingUnits.length === 0) {
			this.addLog(`P${this.currentPlayerIndex+1} No matching units. Moving to Tactical Command.`);
			this.startTacticalCommand();
		} else {
			this.addLog(`P${this.currentPlayerIndex+1} ${matchingUnits.length} units can perform a free Move action.`);
			// In Fate's Call, matching units can move. We don't mark them as having acted yet?
			// The rules say "immediately perform a free Move action".
			// "Phase 2: Choose exactly one friendly unit (even one that moved in Phase 1) to perform any standard action"
			// So Phase 1 moves don't count towards Phase 2's single action.
			
			// We need to manage who has moved in Phase 1.
			matchingUnits.forEach(u => u.canMoveInFatePhase = true);
			
			if (this.players[this.currentPlayerIndex].isAI) {
				// AI should move its matching units
				this.performAIFateMoves();
			}
		}
	},
	checkFinishFatesCall(unit) {
		if (this.gameplayVersion != 2 || this.turnPhase != 'FATE_CALL') return false;

		if (unit) {
			unit.canMoveInFatePhase = false;
			unit.hasMovedOrAttackedThisTurn = false; // It's a "free" move
		}

		this.deselectUnit();

		// Check if any more units can move in Phase 1
		const remaining = this.players[this.currentPlayerIndex].dice
			.filter(d => d.isDeployed && !d.isDeath && d.canMoveInFatePhase);

		if (remaining.length === 0) {
			this.startTacticalCommand();
		}

		return true;
	},
	startTacticalCommand() {
		window?.AudioManager?.playSfx('tactic');
		console.log(`P${this.currentPlayerIndex+1} startTacticalCommand`);

		this.turnPhase = 'TACTICAL_COMMAND';
		this.addLog(`🎲 P${this.currentPlayerIndex+1} Phase 2: Tactical Command. Choose one unit to act.`);
		
		// Reset move flags from Phase 1
		this.players[this.currentPlayerIndex].dice.forEach(d => d.canMoveInFatePhase = false);

		if (this.players[this.currentPlayerIndex].isAI) {
			// For Version 2 AI: Pre-roll Oracle spell so it can plan
			if (this.gameplayVersion === 2) {
				const roll = this.rollDice();

				if (roll === 1 || roll === 4) this.oracleSelectedSpell = 'SHIELD';
				else if (roll === 2 || roll === 5) this.oracleSelectedSpell = 'SWAP';
				else this.oracleSelectedSpell = 'SKIRMISH';
				
				this.addLog(`[AI] 💬 P${this.currentPlayerIndex+1} Oracle channeled: ${this.oracleSelectedSpell}`);
			}
			this.performAITurn();
		} else if (this.debug?.autoPlay) {
			this.autoPlay();
		}
	},
	performAIFateMoves() {
		if (!this.players[this.currentPlayerIndex].isAI) return;

		this.addLog(`[AI] P${this.currentPlayerIndex+1} Phase 1: Planning Fate moves...`);
		
		try {
			if (this.mode === 'headless') {
				while (this.turnPhase === 'FATE_CALL') {
					performAIByHeuristic(this);
				}
			} else {
				performAIByHeuristic(this);
				
				// If still in FATE_CALL, it means the AI performed one move but more matching units remain
				if (this.turnPhase === 'FATE_CALL' && this.players[this.currentPlayerIndex].dice.find(d => d.canMoveInFatePhase == false)) {
					setTimeout(() => this.performAIFateMoves(), 500);
				}
			}
		} catch (e) {
			console.error("AI Error in Phase 1:", e);
			this.addLog(`[AI] P${this.currentPlayerIndex+1} Error in Phase 1: ${e.message}`);
			if (this.turnPhase === 'FATE_CALL') this.startTacticalCommand();
		}
	},

	/* --- GAMEPLAY --- */
	handleHexClick(hexId) {
		if (this.online.status === 'PLAYING') {
			if (this.currentPlayerIndex !== this.online.playerIndex) {
				this.addLog("Wait for opponent's turn.");
				console.log("Turn block: current", this.currentPlayerIndex, "me", this.online.playerIndex);
				return;
			}
		}
		this._handleHexClick(hexId);
		if (this.online.status === 'PLAYING' && this.online.status !== 'SYNCING') {
			this.publishAction('GAME_ACTION', { action: 'HEX_CLICK', args: [hexId] });
		}
	},
	_handleHexClick(hexId) {
		if (this.phase === 'SETUP_DEPLOY') {
			this.deployUnit(hexId);
			return;
		}

		// Autochess manual positioning during PREPARATION phase
		if (this.Autochess.state.enabled && this.Autochess.state.phase === 'PREPARATION') {
			const clickedHex = this.getHex(hexId);
			const unitOnClickedHex = this.getUnitOnHex(hexId);
			
			const player = this.players[0];
			const baseHex = this.getHex(player.baseHexId);
			let isDeploymentHex = false;
			if (baseHex) {
				const dist = this.axialDistance(baseHex.q, baseHex.r, clickedHex.q, clickedHex.r);
				if (dist <= 2) isDeploymentHex = true;
			}

			if (unitOnClickedHex && unitOnClickedHex.playerId === 0) {
				this.selectUnit(hexId);
			} else if (this.selectedUnitHexId !== null && isDeploymentHex) {
				const unit = this.getUnitOnHex(this.selectedUnitHexId);
				if (unit && unit.playerId === 0) {
					const fromHex = this.getHex(this.selectedUnitHexId);
					this.move(unit, fromHex, clickedHex);
					this.deselectUnit();
				}
			} else {
				this.deselectUnit();
			}
			return;
		}

		if (this.phase !== 'PLAYER_TURN') return;

		const clickedHex = this.getHex(hexId);
		const unitOnClickedHex = this.getUnitOnHex(hexId);

		if (unitOnClickedHex && this.canPerformAction(this.selectedUnitHexId, 'RANGED_ATTACK') && unitOnClickedHex.playerId != this?.currentPlayerIndex) {
			this.actionMode = 'RANGED_ATTACK';
			this.validTargets = this.calcValidRangedTargets(this.selectedUnitHexId);
			this.validTargetsSet = new Set(this.validTargets);
		}

		if (this.actionMode) { // If in an action mode like MOVE or ATTACK
			this.completeAction(hexId);
			if (this.actionMode !== 'SKIRMISH_POST_MOVE') {
				this.deselectUnit();
			}
			if (unitOnClickedHex ) {
				if (unitOnClickedHex.playerId === this.currentPlayerIndex) this.selectUnit(hexId);
				this.hoverHex(hexId);
			}
			// In online mode, force an endTurn check if unit moved
			// Note: performMove already calls endTurn in most cases
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

		// Update unit info panel pin: any click on a unit pins it; click on empty hex clears.
		this.unitstat = this.getUnitOnHex(hexId) ? hexId : null;
	},
	selectUnit(hexId, state) {
		if (state) return;
		const unit = this.getUnitOnHex(hexId);

		if (!unit || unit.playerId !== this.currentPlayerIndex) {
			this.deselectUnit();
			return;
		}

		if (this.gameplayVersion === 2) {
			if (this.turnPhase === 'FATE_CALL') {
				if (unit.value !== this.fateRoll || !unit.canMoveInFatePhase) {
					this.addLog(`Only units with value ${this.fateRoll} can move in Phase 1.`);
					this.deselectUnit();
					return;
				}
			} else if (this.turnPhase === 'TACTICAL_COMMAND') {
				if (unit.hasMovedOrAttackedThisTurn) {
					this.addLog("This unit has already acted this turn.");
					this.deselectUnit();
					return;
				}
			}
		} else {
			if (unit.hasMovedOrAttackedThisTurn) {
				this.addLog("This unit has already acted this turn.");
				this.deselectUnit();
				return;
			}
		}

		this.selectedUnitHexId = hexId;
		if (window.AudioManager && typeof window.AudioManager.playUnitSound === 'function') {
			window.AudioManager.playUnitSound(unit.value);
		}
		this.validMoves = this.calcValidMoves(hexId);
		this.validMovesSet = new Set(this.validMoves);
		this.validTargets = []; // Will be calculated if attack action is chosen
		this.validTargetsSet = new Set();
		this.validMerges = this.options.includes('m') ? this.calcValidMoves(this.selectedUnitHexId, 'MERGE') : [];
		this.validMergesSet = new Set(this.validMerges);
		this.dangerHexes = this.calcDangerHex(this.currentPlayerIndex, state);

		// this.addLog(`Selected Unit: Dice ${unit.value} [${unit.range}] at (${this.getHex(hexId).q}, ${this.getHex(hexId).r})`);

		if (this.canPerformAction(this.selectedUnitHexId, 'MOVE')) this.initiateAction('MOVE');

		if (unit.value == 2) {
			this.validTargets = this.calcValidRangedTargets(this.selectedUnitHexId);
			this.validTargetsSet = new Set(this.validTargets);
		}

		if (unit.value == 6) {
			this.validTargets = this.calcValidSpecialAttackTargets(this.selectedUnitHexId);
			this.validTargetsSet = new Set(this.validTargets);
		}
	},
	/**
	 * Initiate Oracle spell selection UI prompt.
	 * Asks player to choose between Shield, Swap, Skirmish spells, or cancel.
	 */
	initiateOracleSpellSelection() {
		if (this.gameplayVersion === 2 && !this.oracleSelectedSpell) {
			const roll = this.rollDice();

			let spell = '';

			if (roll === 1 || roll === 4) spell = 'SHIELD';
			else if (roll === 2 || roll === 5) spell = 'SWAP';
			else spell = 'SKIRMISH';
			
			this.addLog(`💬 Oracle channeled... Roll: D${roll}. Granted: ${spell}!`);
			this.selectOracleSpell(spell);
		} else {
			this.actionMode = 'ORACLE_SPELL_SELECT';
			// this.addLog("Oracle Spell - Choose a spell from the control panel.");
		}
	},
	selectOracleSpell(spell) {
		window?.AudioManager?.playSfx('spell');

		this.oracleSelectedSpell = (this.gameplayVersion === 2 && this.oracleSelectedSpell) ? this.oracleSelectedSpell : spell;
		this.actionMode = 'SPELLCAST';
		this.addLog(`💬 Oracle will cast ${this.oracleSelectedSpell}. Select a friendly unit within Range 2.`);
	},
	deselectUnit(state) {
		state = state || this;

		state.hovering = {}
		state.selectedUnitHexId = null;
		state.validMoves = [];
		state.validMovesSet = new Set();
		state.validTargets = [];
		state.validTargetsSet = new Set();
		state.validMerges = [];
		state.validMergesSet = new Set();
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
		this.validMovesSet = new Set();
		this.validTargets = [];
		this.validTargetsSet = new Set();
		// this.validMerges = [];
		// this.validTargets = [];

		if (actionType === 'MOVE' || actionType === 'MERGE') {
			this.validMoves = this.calcValidMoves(this.selectedUnitHexId, actionType === 'MERGE');
			this.validMovesSet = new Set(this.validMoves);
			if (this.validMoves.length === 0) {
				this.addLog("No valid moves for this unit.");
				// this.cancelAction();
			}
		} else if (actionType === 'RANGED_ATTACK') {
			this.validTargets = this.calcValidRangedTargets(this.selectedUnitHexId);
			this.validTargetsSet = new Set(this.validTargets);
			 if (this.validTargets.length === 0) {
				this.addLog("No valid targets for Ranged Attack.");
				// this.cancelAction();
			}
		} else if (actionType === 'SPECIAL_ATTACK') {
			this.validTargets = this.calcValidSpecialAttackTargets(this.selectedUnitHexId);
			this.validTargetsSet = new Set(this.validTargets);
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
			this.validMovesSet = new Set(this.validMoves);
			 if (this.validMoves.length === 0) {
				this.addLog("No valid targets for Brave Charge.");
				// this.cancelAction();
			}
		} else if (actionType === 'SPELLCAST_SACRIFICE') {
			// Show adjacent enemy Oracles as valid targets
			this.validTargets = this.calcValidSacrificeTargets(this.selectedUnitHexId);
			this.validTargetsSet = new Set(this.validTargets);
			if (this.validTargets.length === 0) {
				this.addLog("No valid targets for Oracle Sacrifice.");
			}
		}
	},
	actionModeMessage() {
		if (this.actionMode === 'MOVE') return "Select a destination hex for your unit.";
		if (this.actionMode === 'MERGE') return "Select a friendly unit to merge with.";
		if (this.actionMode === 'RANGED_ATTACK') return "Select an ranged enemy unit to target.";
		if (this.actionMode === 'SPECIAL_ATTACK') return "Select an adjacent enemy unit to target.";
		if (this.actionMode === 'SPELLCAST') return "Select a friendly unit to cast spell on.";
		if (this.actionMode === 'SPELLCAST_SACRIFICE') return "Select an adjacent enemy unit to transmute (Oracle sacrificed, enemy converted).";
		if (this.actionMode === 'SKIRMISH_POST_MOVE') return "Skirmish success! Select an adjacent hex to move to (or stay put).";
		return "";
	},
	cancelAction() {
		this.actionMode = null;
		this.validMoves = [];
		this.validMerges = [];
		this.validTargets = [];

		if (this.debug?.autoPlay) this._endTurn();
	},
	completeAction(targetHexId) {
		if (!this.actionMode) return;

		const unit = this.getUnitOnHex(this.selectedUnitHexId);
		const target = this.getUnitOnHex(targetHexId);
		const action = this.actionMode;
		this.actionMode = null; // Clear action mode first

		if (action == 'BRAVE_CHARGE_TARGET') {
			this.performBraveCharge(this.selectedUnitHexId, targetHexId);
			this._endTurn();
			return;
		}

		// Tanker Magnetic Pull
		if (action === 'MAGNETIC_PULL_TARGET') {
			this.performMagneticPull(this.selectedUnitHexId, targetHexId);
			this._endTurn();
			return;
		}

		// Oracle Transmute
		if (action === 'SPELLCAST_SACRIFICE' && this.validTargets.includes(targetHexId)) {
			this.performOracleTransmute(this.selectedUnitHexId, targetHexId);
			this._endTurn();
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
				this._endTurn();
				return;
			}
		}

		if (unit.value == 2 && this.validTargets.includes(targetHexId)) {
			this.performRangedAttack(this.selectedUnitHexId, targetHexId);
			this._endTurn();
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

				if (this.checkFinishFatesCall(unit)) return;

				if (action == 'BRAVE_CHARGE') {
					this.actionMode = 'BRAVE_CHARGE_TARGET';
					this.selectedUnitHexId = targetHexId;
					this.validTargets = this.calcValidSpecialAttackTargets(this.selectedUnitHexId);
					this.addLog("Now choose a target of Dice 1 Brave Change");
				} else if (this.actionMode === 'SKIRMISH_POST_MOVE') {
					// Don't end turn yet! Let user pick reposition hex.
				} else {
					this._endTurn();
				}
			}

			return;
		} else if (action === 'SKIRMISH_POST_MOVE' && this.validMoves.includes(targetHexId)) {
			this.performSkirmishPostMove(this.selectedUnitHexId, targetHexId);
			this._endTurn();
			return;
		} else if (this.validMerges.includes(targetHexId)){
			this._endTurn();
			return;
		}

		this.checkFinishFatesCall(unit);

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

		// Campaign Scarred Units cannot use class abilities
		if (this.CampaignManager.isAbilityDisabled(unit)) {
			if (['RANGED_ATTACK', 'SPECIAL_ATTACK', 'SPELLCAST_SACRIFICE'].includes(actionType)) {
				return false;
			}
		}

		switch(actionType) {
			case 'MOVE': return true;
			case 'REROLL': 
				const playerBaseHexId = (state || this).players[unit.playerId].baseHexId;
				return !this.rules.noReroll && this.options.includes('r') && !unit.isRerolled && !unit.isGuarding && (unitHexId === playerBaseHexId);
			case 'GUARD': return true;
			case 'RANGED_ATTACK': return unit.value === 2;
			case 'SPECIAL_ATTACK': return unit.value === 6;
			case 'BRAVE_CHARGE': return unit.value === 1;
			case 'MAGNETIC_PULL': return unit.value === 5 && this.hasPerk(unit, 'tier1', 'B');
			case 'DREADNOUGHT_OVERLOAD': return unit.value === 5 && this.hasPerk(unit, 'tier3', 'B');
			case 'MERGE': return this.options.includes('m');
			case 'SPELLCAST_SACRIFICE':
				// Oracle can transmute any adjacent enemy unit
				if (unit.value !== 6) return false;
				return this.canOracleTransmute(unitHexId, state);
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
			case 'MAGNETIC_PULL':
				// Handled by `initiateAction` through target selection
				break;
			case 'DREADNOUGHT_OVERLOAD':
				this.performDreadnoughtOverload(unitHexId);
				break;
			// Other actions are initiated via `initiateAction`
		}
		// `initiateAction` handles MOVE, RANGED_ATTACK, SPECIAL_ATTACK, MERGE, MAGNETIC_PULL

		this._endTurn();
	},

	/* --- ACTIONS --- */
	move(unit, fromHex, toHex, state) {
		if (!unit) return;

		if (fromHex) {
			unit.lastHexId = fromHex.id; // Store last position
			fromHex.unit = null;
			fromHex.unitId = null;
			this.trail.fromHex = state ? null : fromHex;

			// Track distance moved for perks
			unit.stepsMoved = this.axialDistance(fromHex.q, fromHex.r, toHex.q, toHex.r);

			// Hussar Tier 2 [B] Trample
			if (unit.value === 3 && this.hasPerk(unit, 'tier2', 'B')) {
				const dq = toHex.q - fromHex.q;
				const dr = toHex.r - fromHex.r;
				const pathHexes = [];
				if (unit.stepsMoved === 3) {
					const kneeQ = fromHex.q + Math.round(dq * 0.66);
					const kneeR = fromHex.r + Math.round(dr * 0.66);
					const knee = this.getHexByQR(kneeQ, kneeR, state);
					if (knee) pathHexes.push(knee);

					const firstQ = fromHex.q + Math.round(dq * 0.33);
					const firstR = fromHex.r + Math.round(dr * 0.33);
					const first = this.getHexByQR(firstQ, firstR, state);
					if (first) pathHexes.push(first);
				}

				pathHexes.forEach(h => {
					const target = this.getUnitOnHex(h.id, state);
					if (target && target.playerId !== unit.playerId) {
						this.addLog(`🏇 Trample! ${this.logUnit(unit)} deals 15 damage to ${this.logUnit(target)}.`);
						this.applyDamage(h.id, 15, state);
					}
				});
			}
		}

		if (toHex) {
			toHex.unit = unit;
			toHex.unitId = unit.id;
			unit.hexId = toHex.id;
			this.trail.toHex = state ? null : toHex;
			this.calcDefenderEffectiveArmor(toHex.id, state);

			// Hussar Tier 3 [A] Dragoon: Impact Landing
			if (unit.value === 3 && this.hasPerk(unit, 'tier3', 'A') && unit.stepsMoved === 3) {
				this.getNeighbors(toHex, state).forEach(neighbor => {
					const target = this.getUnitOnHex(neighbor.id, state);
					if (target && target.playerId !== unit.playerId) {
						this.addLog(`🐉 Dragoon! ${this.logUnit(unit)} deals 20 impact damage to ${this.logUnit(target)}.`);
						this.applyDamage(neighbor.id, 20, state);
					}
				});
			}
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
		this.trailSpell = {};
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
		const unitValue = attackerUnit.value;

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
			this.recordAction('MELEE', { unitValue, fromHex: attackerHex.id, toHex: defenderHex.id });
		} else { // Moving to an empty hex
			if (!this.autochess) {
				this.addLog([
					`👣 ${this.logUnit(attackerUnit)} moved `,
					`[${attackerHex.id}]`,
					`->`,
					`[${defenderHex.id}].`
				].join(''), state);
			}

			if (!state && !this.autochess) window?.AudioManager?.playSfx(unitValue == 3 ? 'wing' : unitValue == 4 ? 'horse' : 'move');

			this.move(attackerUnit, attackerHex, defenderHex, state);
			this.recordAction('MOVE', { unitValue, fromHex: attackerHex.id, toHex: defenderHex.id });

			if (this.gameplayVersion === 2 && this.turnPhase === 'FATE_CALL') {
				attackerUnit.hasMovedOrAttackedThisTurn = false;
			} else {
				attackerUnit.hasMovedOrAttackedThisTurn = true;
				attackerUnit.actionsTakenThisTurn++;
			}
			this.deselectUnit(state); // Action complete
		}
		this.checkWinConditions(state);
	},
	/**
	 * Finalize the post-skirmish move to an adjacent hex.
	 * @param {number} unitHexId - Current hex ID of the attacker
	 * @param {number} targetHexId - Destination hex ID
	 */
	performSkirmishPostMove(unitHexId, targetHexId, state) {
		const unit = this.getUnitOnHex(unitHexId, state);
		const fromHex = this.getHex(unitHexId, state);
		const toHex = this.getHex(targetHexId, state);

		if (!unit || !fromHex || !toHex) return;

		if (!state) window?.AudioManager?.playSfx(unit.value == 3 ? 'wing' : unit.value == 4 ? 'horse' : 'move');

		if (unitHexId !== targetHexId) {
			this.addLog(`↪️ ${this.logUnit(unit)} skirmish reposition: [${fromHex.id}]->[${toHex.id}].`);
			this.move(unit, fromHex, toHex);
			this.recordAction('MOVE', { unitValue: unit.value, fromHex: fromHex.id, toHex: toHex.id, subType: 'SKIRMISH_POST_MOVE' });
		} else {
			this.addLog(`↪️ ${this.logUnit(unit)} skirmish reposition: stayed at [${fromHex.id}].`);
			this.recordAction('POSITION', { unitValue: unit.value, fromHex: fromHex.id, toHex: toHex.id, subType: 'SKIRMISH_POST_MOVE' });
		}

		unit.hasMovedOrAttackedThisTurn = true;
		unit.actionsTakenThisTurn++;
		this.deselectUnit();
	},
	performUnitReroll(unitHexId, state) {
		const targetHex = this.getHex(unitHexId, state);
		const unit = this.getUnitOnHex(unitHexId, state);
		if (!unit || unit.hasMovedOrAttackedThisTurn) return;

		const playerBaseHexId = (state || this).players[unit.playerId].baseHexId;
		if (unitHexId !== playerBaseHexId) {
			this.addLog(`${this.logUnit(unit)} cannot reroll outside of its Base.`, state);
			this.deselectUnit(state);
			return;
		}

		const oldVal = unit.value;
		const newRoll = this.rollDice();
		unit.value = newRoll;
		Object.assign(unit, UNIT_STATS[newRoll]); // Update stats
		unit.currentArmor = UNIT_STATS[newRoll].armor;
		// unit.armorReduction = 0; // Reset armor reduction
		unit.isGuarding = 0; // Rerolling removes guard
		unit.isRerolled = true; // Penalty: 0 effective armor until next turn starts
		unit.skirmishBuff = 0;

		unit.hasMovedOrAttackedThisTurn = true;
		unit.actionsTakenThisTurn++;
		this.calcDefenderEffectiveArmor(unitHexId, state);
		this.recordAction('REROLL', { unitValue: oldVal, newValue: newRoll, fromHex: unitHexId });
		this.addLog(`${this.logUnit(unit)} rerolled D${newRoll} [${targetHex.id}]. Penalty: 0 Effective Armor until next turn.`, state);
		this.deselectUnit(state);
		this.checkWinConditions(state);
	},
	performGuard(unitHexId, state) {
		const targetHex = this.getHex(unitHexId, state);
		const unit = this.getUnitOnHex(unitHexId, state);
		if (!unit || unit.hasMovedOrAttackedThisTurn) return;

		if (!state) window?.AudioManager?.playSfx('guard');

		if (unit.isGuarding < 1) unit.isGuarding = 1;
		unit.wasGuarding = false; // Reset fade timer when guarding

		unit.skirmishBuff = 0;

		// Tanker Tier 2 [A] Entrench
		if (unit.value === 5 && this.hasPerk(unit, 'tier2', 'A') && unit.stepsMoved === 0) {
			unit.currentHP = Math.min(unit.maxHP, unit.currentHP + 20);
			this.addLog(`🗻 Entrench! ${this.logUnit(unit)} heals 20 HP.`);
		}

		// Actual armor buff is applied during combat calculation
		unit.hasMovedOrAttackedThisTurn = true;
		unit.actionsTakenThisTurn++;
		this.calcDefenderEffectiveArmor(unitHexId, state);
		this.recordAction('GUARD', { unitValue: unit.value, fromHex: unitHexId });
		this.addLog(`🛡 ${this.logUnit(unit)} guarded [${unitHexId}].`, state);
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

		if (!state) window?.AudioManager?.playSfx('merge');

		this.addLog(`P${mergingUnit.playerId + 1} ${mergingUnit.name} merged ${targetUnit.name} [${mergingHex.id}]->[${targetHex.id}].`, state);

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
		newUnit.effectiveArmor = newUnit.armor;
		newUnit.spriteUrl = this.getUnitSpriteUrl(newUnit);
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
			this._endTurn(state);
		}
		this.checkWinConditions(state);
	},
	performRangedAttack(attackerHexId, targetHexId, state) {
		const attackerUnit = this.getUnitOnHex(attackerHexId, state);

		// Tanker Tier 2 [B] Heavy Ordinance
		if (attackerUnit && attackerUnit.value === 5 && this.hasPerk(attackerUnit, 'tier2', 'B')) {
			attackerUnit.currentHP = Math.max(1, attackerUnit.currentHP - 10);
			this.addLog(`💣 Heavy Ordinance! ${this.logUnit(attackerUnit)} fires at the cost of 10 HP.`);
		}

		this.handleCombat(attackerHexId, targetHexId, 'RANGED_ATTACK', state);
		this.recordAction('RANGED_ATTACK', { unitValue: attackerUnit.value, fromHex: attackerHexId, toHex: targetHexId });
		const attackerUnitRef = this.getUnitOnHex(attackerHexId, state); // Attacker stays on its hex for ranged
		if (attackerUnitRef) {
			attackerUnitRef.hasMovedOrAttackedThisTurn = true;
			attackerUnitRef.actionsTakenThisTurn++;
		}
		this.deselectUnit(state);
		this.checkWinConditions(state);
	},
	performComandConquer(attackerHexId, targetHexId, state) {
		// this.addLog(`Dice 6 at (${this.getHex(attackerHexId, state).q},${this.getHex(attackerHexId, state).r}) performs Special Attack on unit at (${this.getHex(targetHexId, state).q},${this.getHex(targetHexId, state).r}).`, state);
		this.handleCombat(attackerHexId, targetHexId, 'COMMAND_CONQUER', state);
		this.recordAction('SPECIAL_ATTACK', { unitValue: 6, fromHex: attackerHexId, toHex: targetHexId });
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

		// Play spell SFX if available
		if (!state) window?.AudioManager?.playSfx('spell');

		// Oracle Tier 2 [B] Twin Cast
		if (this.hasPerk(oracleUnit, 'tier2', 'B') && ['SHIELD', 'SKIRMISH'].includes(spellType)) {
			const alliesInRange = (state || this).hexes.filter(h => {
				const unit = this.getUnitOnHex(h.id, state);
				if (!unit || unit.playerId !== oracleUnit.playerId || unit.id === targetUnit.id || unit.id === oracleUnit.id) return false;
				const dist = this.axialDistance(oracleHex.q, oracleHex.r, h.q, h.r);
				return dist <= 2;
			});

			if (alliesInRange.length > 0) {
				const randomAllyHex = alliesInRange[Math.floor(random() * alliesInRange.length)];
				this.addLog(`✨ Twin Cast! Spell also affects ${this.logUnit(this.getUnitOnHex(randomAllyHex.id, state))}.`);
				if (spellType === 'SHIELD') this.performShieldSpell(oracleHexId, randomAllyHex.id, state);
				else if (spellType === 'SKIRMISH') this.performSkirmishSpell(oracleHexId, randomAllyHex.id, state);
			}
		}

		if (!state) {
			this.recordAction(`SPECIAL_ATTACK`, { unitValue: 6, fromHex: oracleHexId, toHex: targetHexId, spellType: spellType });
			this.trailSpell = {fromHex: oracleHex, toHex: targetHex, spellType};
			this.trailAttack = {};
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

		if (!state) window?.AudioManager?.playSfx('transmute');

		// Both Oracles are removed
		oracleUnit.isDeath = true;
		targetUnit.isDeath = true;
		oracleHex.unit = null;
		oracleHex.unitId = null;
		targetHex.unit = null;
		targetHex.unitId = null;

		this.addLog(`👼 P${oracleUnit.playerId+1} Oracle sacrificed to eliminate P${targetUnit.playerId+1} Oracle! Both Oracles removed.`, state);

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

		if (!state) window?.AudioManager?.playSfx('shield');

		if (this.autochess) {
			targetUnit.hp = Math.min(targetUnit.maxHP + 20, targetUnit.hp + 20);
			this.addLog(`🔰 Oracle cast Shield! ${this.logUnit(targetUnit)} gained 20 HP Shield.`, state);
			return;
		}

		targetUnit.isGuarding = 2;
		targetUnit.wasGuarding = false; // Reset fade timer when shielding
		targetUnit.skirmishBuff = 0; // Shield cancels Skirmish

		// Oracle Potency: +5 DEF to Shield spell per devotion point in Offensive Path
		if (this.isCampaign) {
			const upgrades = this.CampaignManager.state.upgrades[6];
			targetUnit.shieldBonus = upgrades.atk;
		}

		this.calcDefenderEffectiveArmor(targetHexId, state);
		this.addLog(`🔰 P${oracleUnit.playerId+1} Oracle cast Shield on P${targetUnit.playerId+1} ${targetUnit.name} (${targetHex.q},${targetHex.r}).`, state);
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

		if (!state) window?.AudioManager?.playSfx('swap');

		if (this.autochess) {
			const healAmount = (targetUnit.actionGauge / 100) * (targetUnit.maxHP * 0.5);
			targetUnit.hp = Math.min(targetUnit.maxHP, targetUnit.hp + healAmount);
			targetUnit.actionGauge = 0;
			this.addLog(`💱 Oracle cast Swap! Converted ${this.logUnit(targetUnit)} Action Gauge to ${Math.floor(healAmount)} HP.`, state);
			return;
		}

		// Manually swap positions to avoid the "move clears previous unit" bug
		oracleHex.unit = targetUnit;
		oracleHex.unitId = targetUnit.id;
		targetHex.unit = oracleUnit;
		targetHex.unitId = oracleUnit.id;

		oracleUnit.lastHexId = oracleHexId;
		oracleUnit.hexId = targetHexId;
		targetUnit.lastHexId = targetHexId;
		targetUnit.hexId = oracleHexId;

		this.calcDefenderEffectiveArmor(oracleHexId, state);
		this.calcDefenderEffectiveArmor(targetHexId, state);

		this.addLog(`💱 P${oracleUnit.playerId+1} Oracle swapped with P${targetUnit.playerId+1} ${targetUnit.name} [${oracleHex.id}]<->[${targetHex.id}].`, state);
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

		if (!state) window?.AudioManager?.playSfx('skirmish');

		if (this.autochess) {
			targetUnit.actionGauge = Math.min(100, targetUnit.actionGauge + 50);
			this.addLog(`⚡ Oracle cast Skirmish! ${this.logUnit(targetUnit)} Action Gauge filled by 50%.`, state);
			return;
		}

		targetUnit.skirmishBuff = 2; // Lasts until end of next activation cycle
		targetUnit.isGuarding = 0; // Skirmish cancels Shield

		// Oracle Potency: +5 ATK to Skirmish buff per devotion point in Offensive Path
		if (this.isCampaign) {
			const upgrades = this.CampaignManager.state.upgrades[6];
			targetUnit.potencyBonus = upgrades.atk;
		}

		this.calcDefenderEffectiveArmor(targetHexId, state);
		this.addLog(`⚡ P${oracleUnit.playerId+1} Oracle cast Skirmish on P${targetUnit.playerId+1} ${targetUnit.name} (${targetHex.q},${targetHex.r}). Hit & Run (Atk-1) enabled! Fails lead to elimination.`, state);
	},
	/**
	 * Perform Oracle Transmute action - Oracle sacrifices itself to convert an adjacent enemy unit.
	 * @param {number} oracleHexId - Hex ID of the sacrificing Oracle
	 * @param {number} targetHexId - Hex ID of the enemy unit to transmute
	 * @param {object} state - Optional game state for simulation
	 */
	/**
	 * Perform Oracle Transmute action - Oracle sacrifices itself to convert an adjacent enemy unit.
	 * @param {number} oracleHexId - Hex ID of the sacrificing Oracle
	 * @param {number} targetHexId - Hex ID of the enemy unit to transmute
	 * @param {object} state - Optional game state for simulation
	 */
	performOracleTransmute(oracleHexId, targetHexId, state) {
		const oracleUnit = this.getUnitOnHex(oracleHexId, state);
		const targetUnit = this.getUnitOnHex(targetHexId, state);
		const oracleHex = this.getHex(oracleHexId, state);
		const targetHex = this.getHex(targetHexId, state);

		if (!oracleUnit || oracleUnit.value !== 6 || !targetUnit) {
			this.addLog("Transmute failed: Invalid units.", state);
			return;
		}

		if (oracleUnit.playerId === targetUnit.playerId) {
			this.addLog("Transmute failed: Cannot target friendly unit.", state);
			return;
		}

		const distance = this.axialDistance(oracleHex.q, oracleHex.r, targetHex.q, targetHex.r);
		if (distance > 1) {
			this.addLog("Transmute failed: Target must be adjacent.", state);
			return;
		}

		if (!state) window?.AudioManager?.playSfx('transmute');

		// Oracle T3 [B] Warlock: Does not kill Oracle, costs 80 HP
		const isWarlock = this.hasPerk(oracleUnit, 'tier3', 'B');
		if (isWarlock) {
			if (oracleUnit.currentHP <= 80) {
				this.addLog("Transmute failed: Not enough HP for Warlock spell.");
				return;
			}
			oracleUnit.currentHP -= 80;
			targetUnit.isDeath = true;
			targetHex.unit = null;
			targetHex.unitId = null;
			this.addLog(`🧪 Warlock! ${this.logUnit(oracleUnit)} spends 80 HP to transmute enemy.`);
		} else {
			// Standard sacrifice
			oracleUnit.isDeath = true;
			oracleHex.unit = null;
			oracleHex.unitId = null;
			targetUnit.isDeath = true;
			targetHex.unit = null;
			targetHex.unitId = null;
			this.addLog(`P${oracleUnit.playerId+1} Oracle sacrificed to transmute P${targetUnit.playerId+1} ${targetUnit.name}!`, state);
		}

		// Try to find a reserve die for the player (prefer unused, then dead)
		const player = (state || this).players[oracleUnit.playerId];
		let reserveDie = player.dice.find(d => !d.isDeployed && !d.isDeath);

		if (!reserveDie) {
			reserveDie = player.dice.find(d => d.isDeath && d.value !== 6);
		}

		if (reserveDie) {
			// Place reserve die on targetHex
			reserveDie.isDeath = false;
			reserveDie.isDeployed = true;
			reserveDie.hexId = targetHexId;
			targetHex.unit = reserveDie;
			targetHex.unitId = reserveDie.id;

			// Reroll the new unit
			const newRoll = Math.floor(Math.random() * 6) + 1;
			reserveDie.value = newRoll;

			// Update stats
			const stats = UNIT_STATS[newRoll];
			Object.assign(reserveDie, stats);
			reserveDie.currentArmor = stats.armor;
			reserveDie.effectiveArmor = stats.armor;
			reserveDie.armorReduction = 0;
			reserveDie.isGuarding = 0;

			// Apply penalties
			reserveDie.isRerolled = true; // 0 Effective Armor until next turn
			reserveDie.hasMovedOrAttackedThisTurn = true; // Cannot act this turn
			reserveDie.spriteUrl = this.getUnitSpriteUrl(reserveDie);

			// Warlock perk: melts in 3 turns
			if (isWarlock) {
				reserveDie.isMelting = 3;
				this.addLog(`🔥 Converted unit melts in 3 turns.`);
			}

			if (!state) this.recordAction('SPECIAL_ATTACK', { unitValue: 6, fromHex: oracleHexId, toHex: targetHexId, spellType: 'TRANSMUTE', newValue: newRoll });

			this.addLog(`Transmutation complete! New P${oracleUnit.playerId+1} D${newRoll} created at [${targetHexId}].`, state);
		} else {
			this.addLog(`Transmutation failed: No dice available.`, state);
		}

		oracleUnit.hasMovedOrAttackedThisTurn = true;
		oracleUnit.actionsTakenThisTurn++;
		this.deselectUnit(state);
		this.checkWinConditions(state);
	},

	/**
	 * Perform Oracle Resurrection action.
	 */
	performOracleResurrection(oracleHexId, targetHexId, state) {
		const oracleUnit = this.getUnitOnHex(oracleHexId, state);
		const targetHex = this.getHex(targetHexId, state);
		if (!oracleUnit || !targetHex || targetHex.unitId) return;

		// Once per game
		if (oracleUnit.resurrectUsed) return;
		oracleUnit.resurrectUsed = true;

		if (!state) window?.AudioManager?.playSfx('resurrection');

		const player = (state || this).players[oracleUnit.playerId];
		let deadDie = player.dice.find(d => d.isDeath && d.value !== 6);

		if (deadDie) {
			deadDie.isDeath = false;
			deadDie.isDeployed = true;
			deadDie.hexId = targetHexId;
			deadDie.currentHP = Math.floor(deadDie.maxHP * 0.5);
			targetHex.unit = deadDie;
			targetHex.unitId = deadDie.id;
			this.addLog(`✨ Resurrection! ${this.logUnit(deadDie)} is revived at ${targetHexId}.`);
		}
	},
	/**
	 * Perform Dreadnought Overload (Self-destruct AOE).
	 */
	performDreadnoughtOverload(unitHexId, state) {
		const unit = this.getUnitOnHex(unitHexId, state);
		const hex = this.getHex(unitHexId, state);
		if (!unit || !hex) return;

		if (!state) window?.AudioManager?.playSfx('explode');

		const damage = unit.currentHP;
		this.addLog(`☢️ Dreadnought Overload! ${this.logUnit(unit)} self-destructs for ${damage} damage!`);

		this.getNeighbors(hex, state).forEach(n => {
			if (n && n.unitId) {
				this.applyDamage(n.id, damage, state);
			}
		});

		this.removeUnit(unitHexId, state);
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

		this.addLog(`${this.logUnit(attackerUnit)} charged ${this.logUnit(defenderUnit)} [${attackerHex.id}]->[${defenderHex.id}].`, state);

		// Effect: Remove the Dice 1 unit
		this.removeUnit(attackerHexId, state);
		// Effect: Reduce target enemy unit's armor by 6
		this.applyDamage(targetHexId, 6, state, true); // Apply 6 damage, handle unit removal if armor <= 0

		this._endTurn(state); // End the player's turn after the charge
	},
	performAITurn() {
		// let choice = ['Simple', 'Analyze', 'Random', 'Minimax', 'Greedy'].random();
		// this.addLog(`AI persona: ${choice}`);
		// this['performAI_' + choice]();

		// console.time('performAITurn')
		performAIByWeight(this);

		this.deselectUnit();

		// this.addLog('currentPlayerIndex' + this.currentPlayerIndex);

		// this._endTurn();
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
			case 'TOWER': minRange = 1; maxRange = 2; break;
			case 'MOUNTAIN': minRange = 1; maxRange = 3; break;
		}

		// Archer (Dice 2) gets range +1 if it is currently skirmish
		if (attackerUnit.value === 2 && attackerUnit.skirmishBuff) {
			maxRange += 1;
		}

		// Archer Tier 3 [A] Sniper: Range increases to 3
		if (attackerUnit.value === 2 && this.hasPerk(attackerUnit, 'tier3', 'A')) {
			maxRange = 3;
		}

		// Tanker Tier 2 [B] Heavy Ordinance: Range 2 attack
		if (attackerUnit.value === 5 && this.hasPerk(attackerUnit, 'tier2', 'B')) {
			maxRange = 2;
		}

		// Ensure Archer max range does not exceed 3
		if (attackerUnit.value === 2 && !this.hasPerk(attackerUnit, 'tier3', 'A')) {
			maxRange = Math.min(maxRange, 3);
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

		// Archer Tier 1 [B] Point Blank: Removes engaged restriction
		const isPointBlank = attackerUnit.value === 2 && this.hasPerk(attackerUnit, 'tier1', 'B');

		// Archer & Oracle will not be limited by adjacent enemy unit restriction when stand in Tower or Mountain
		if (isEnemyAdjacent && !isPointBlank && !(attackerHex.terrainType === 'TOWER' || attackerHex.terrainType === 'MOUNTAIN')) return [];

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
			if (targetUnit && targetUnit.playerId !== oracleUnit.playerId) {
				targets.push(neighborHex.id);
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
				case 'FOREST': { if (this.isCampaign && fromHex.terrainType == 'MOUNTAIN') break; else return false; }
				case 'TOWER': { if (this.isCampaign && fromHex.terrainType == 'MOUNTAIN') break; else return false; }
				case 'MOUNTAIN': return false; // Blocked by terrain
				case 'LAKE': break; // LAKE remains transparent, do nothing here
			}

			const intermediateUnit = this.getUnitOnHex(intermediateHex.id, state);
			if (intermediateUnit && !intermediateUnit.isDeath) {
				// Behemoth (Tanker Tier 3A) blocks LoS
				if (intermediateUnit.value === 5 && this.hasPerk(intermediateUnit, 'tier3', 'A')) {
					return false;
				}
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
			const canSwiftCast = this.hasPerk(attackerUnit, 'tier2', 'A');

			if (isEngaged && !isHovering && !canSwiftCast && !(attackerHex.terrainType === 'TOWER' || attackerHex.terrainType === 'MOUNTAIN')) {
				return []; // Cannot cast spells while engaged unless on Tower or Mountain
			}

			(state || this).hexes.forEach(potentialTargetHex => {
				if (!potentialTargetHex || potentialTargetHex.id === attackerHexId) return;

				const dist = this.axialDistance(attackerHex.q, attackerHex.r, potentialTargetHex.q, potentialTargetHex.r);
				if (dist < minRange || dist > range) return;

				// Skip Check Line of Sight for spell
				// if (!this.hasLineOfSight(attackerHex, potentialTargetHex, attackerHexId, state)) return;

				const targetUnit = this.getUnitOnHex(potentialTargetHex.id, state);

				if (targetUnit?.value === 6 && (state || this)?.autochess) return; // In autochess, Oracle won't target other Oracle

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
	/**
	 * Calculate valid targets for Magnetic Pull.
	 */
	calcValidMagneticTargets(tankerHexId, state) {
		const unit = this.getUnitOnHex(tankerHexId, state);
		const hex = this.getHex(tankerHexId, state);
		if (!unit || unit.value !== 5 || !hex) return [];

		let targets = [];
		(state || this).hexes.forEach(h => {
			if (!h || h.id === tankerHexId) return;
			const dist = this.axialDistance(hex.q, hex.r, h.q, h.r);
			if (dist <= 2) {
				const target = this.getUnitOnHex(h.id, state);
				if (target && target.playerId !== unit.playerId) {
					targets.push(h.id);
				}
			}
		});
		return targets;
	},

	/**
	 * Perform Magnetic Pull.
	 */
	performMagneticPull(tankerHexId, targetHexId, state) {
		const tankerUnit = this.getUnitOnHex(tankerHexId, state);
		const targetUnit = this.getUnitOnHex(targetHexId, state);
		const tankerHex = this.getHex(tankerHexId, state);
		const targetHex = this.getHex(targetHexId, state);

		if (!tankerUnit || !targetUnit || !tankerHex || !targetHex) return;

		// Find adjacent hex closest to tanker
		let bestHex = null;
		let minDistance = 99;
		this.getNeighbors(tankerHex, state).forEach(n => {
			if (!n || this.getUnitOnHex(n.id, state)) return;
			const dist = this.axialDistance(n.q, n.r, targetHex.q, targetHex.r);
			if (dist < minDistance) {
				minDistance = dist;
				bestHex = n;
			}
		});

		if (bestHex) {
			this.move(targetUnit, targetHex, bestHex, state);
			this.addLog(`🧲 ${this.logUnit(tankerUnit)} pulled ${this.logUnit(targetUnit)}!`);
		} else {
			this.addLog(`🧲 Pull failed: No adjacent empty hexes.`);
		}

		tankerUnit.hasMovedOrAttackedThisTurn = true;
		tankerUnit.actionsTakenThisTurn++;
		this.deselectUnit(state);
		this.checkWinConditions(state);
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
					let stepCost = 1;
					let effDist = unitStats.distance;
					if (hex.terrainType === 'LAKE') {
						if (!this.isCampaign) {
							break;
						} else {
							stepCost = 2;
							effDist = unitStats.distance - 1;
						}
					}
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
						let stepCost = 1;
						let effDist = unitStats.distance;
						if (hex.terrainType === 'LAKE') {
							if (!this.isCampaign) {
								break;
							} else {
								stepCost = 2;
								effDist = unitStats.distance - 1;
							}
						}
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
					if (hex && (hex.terrainType !== 'LAKE' || this.isCampaign)) possibleMoves.push(hex.id);
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
					let stepCost = 1;
					let effDist = 2;
					if (hex.terrainType === 'LAKE') {
						if (!this.isCampaign) {
							break;
						} else {
							stepCost = 2;
							effDist = 1;
						}
					}
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
					let stepCost = 1;
					let effDist = 2;
					if (hex.terrainType === 'LAKE') {
						if (!this.isCampaign) {
							break;
						} else {
							stepCost = 2;
							effDist = 1;
						}
					}
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
					if (h1 && (h1.terrainType !== 'LAKE' || this.isCampaign)) possibleMoves.push(h1.id);
					if (h2 && (h2.terrainType !== 'LAKE' || this.isCampaign)) possibleMoves.push(h2.id);
				} else if (mod3 == 1) {
					const h1 = this.getHexByQR(startHex.q + -1, startHex.r + 2, state);
					const h2 = this.getHexByQR(startHex.q + 1, startHex.r + -2, state);
					if (h1 && (h1.terrainType !== 'LAKE' || this.isCampaign)) possibleMoves.push(h1.id);
					if (h2 && (h2.terrainType !== 'LAKE' || this.isCampaign)) possibleMoves.push(h2.id);
				} else if (mod3 == 0) {
					const h1 = this.getHexByQR(startHex.q + -1, startHex.r + -1, state);
					const h2 = this.getHexByQR(startHex.q + 1, startHex.r + 1, state);
					if (h1 && (h1.terrainType !== 'LAKE' || this.isCampaign)) possibleMoves.push(h1.id);
					if (h2 && (h2.terrainType !== 'LAKE' || this.isCampaign)) possibleMoves.push(h2.id);
				}
				break;
			case '*': // Dice 2, 5 (Archer, Tanker) - BFS any direction
				this.bfsValidMoves(startHex, unit, isForMerging, state, possibleMoves);
				break;
			case '0': // Dice 6 (Legate) - stationary
				break;
		}

		// In Campaign Mode, LAKE is temporarily considered passable with movement cost = 2
		possibleMoves = [...new Set(possibleMoves.filter(x => x))];
		possibleMoves = possibleMoves.filter(id => (this.getHex(id, state)?.terrainType != 'LAKE') || this.CampaignManager.canTraverseLake());

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

				if (n.terrainType === 'LAKE' && !this.isCampaign) return;

				let costToEnter = 1;
				// let effectiveMaxDistance = maxDistance;

				if (n.terrainType === 'MOUNTAIN') {
					if (maxDistance > 1) {
						costToEnter = 1.5;
						// effectiveMaxDistance = maxDistance - 1;
					}
				}

				const newCost = currentCost + costToEnter;

				if (newCost > maxDistance) return;

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
						if (unit.value !== 2 && unit.value !== 6) {
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
				deploymentHexes.push(neighbor);
				this.getNeighbors(neighbor, state).forEach(n => deploymentHexes.push(n));
			});
		} else {
			// Epic mode (15-21 units): 5-ring wedge-like expansion
			state.hexes.forEach(hex => {
				const distFromBase = this.axialDistance(baseHex.q, baseHex.r, hex.q, hex.r);
				if (distFromBase <= 5) {
					// Check if it's "inward" or at least not way "outward"
					const distFromCenter = this.axialDistance(0, 0, hex.q, hex.r);
					const baseDistFromCenter = this.axialDistance(0, 0, baseHex.q, baseHex.r);
					if (distFromCenter <= baseDistFromCenter) {
						deploymentHexes.push(hex);
					}
				}
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
		if (defenderUnit.isRerolled) {
			if (!state) defenderUnit.effectiveArmor = 0;
			return 0; // Penalty for rerolling
		}

		let effectiveArmor = defenderUnit.currentArmor;

		// Knight Tier 2 [A] Bulwark
		if (defenderUnit.value === 4 && this.hasPerk(defenderUnit, 'tier2', 'A') && defenderUnit.stepsMoved >= 2) {
			effectiveArmor += 20;
		}

		// Knight Tier 3 [A] Templar (Aura DEF)
		const currentPlayers = (state||this).players;
		if (currentPlayers[defenderUnit.playerId]) {
			currentPlayers[defenderUnit.playerId].dice.forEach(d => {
				if (d.value === 4 && !d.isDeath && d.isDeployed && this.hasPerk(d, 'tier3', 'A')) {
					const tHex = (state||this).getHex(d.hexId, state);
					if (tHex && (tHex.q === defenderHex.q || tHex.r === defenderHex.r || tHex.s === defenderHex.s)) {
						effectiveArmor += 15;
					}
				}
			});
		}

		// Tanker Tier 2 [A] Entrench
		if (defenderUnit.value === 5 && this.hasPerk(defenderUnit, 'tier2', 'A') && defenderUnit.isGuarding && defenderUnit.stepsMoved === 0) {
			effectiveArmor += 15;
		}

		if (defenderUnit.isGuarding) effectiveArmor += (this.isCampaign ? 10 : defenderUnit.isGuarding);
		if (this.gameplayVersion !== 2) effectiveArmor -= defenderUnit.armorReduction;

		if (defenderUnit.isScarred) effectiveArmor -= 1;

		switch (defenderHex.terrainType) {
			case 'FOREST':
			case 'TOWER':
			case 'MOUNTAIN':
				effectiveArmor += (this.isCampaign ? 10 : 1);
				break;
			case 'LAKE':
				effectiveArmor -= (this.isCampaign ? 10 : 1);
				break;
		}

		if ((state||this).players[defenderUnit.playerId].baseHexId == defenderHexId)
			effectiveArmor += (this.isCampaign ? 20 : 2);

		const result = Math.max(0, effectiveArmor);
		if (!state) defenderUnit.effectiveArmor = result;
		return result;
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
	// DEPRECATED: replaced by unit info panel (unitPanelData / unitPanelBreakdown / movementDescription).
	// calcUIDiceStat(hexId, state) { ... }

	/* --- UNIT INFO PANEL --- */
	unitPanelHexId() {
		return (this.unitstat != null) ? this.unitstat : this.hoverUnitHexId;
	},
	unitPanelHoverEnter(hexId) {
		clearTimeout(this._unitPanelHoverTimer);
		this.hoverUnitHexIdImmediate = hexId;
		this._unitPanelHoverTimer = setTimeout(() => {
			this.hoverUnitHexId = hexId;
		}, 150);
	},
	unitPanelHoverLeave(hexId) {
		clearTimeout(this._unitPanelHoverTimer);
		if (this.hoverUnitHexIdImmediate === hexId) this.hoverUnitHexIdImmediate = null;
		if (this.hoverUnitHexId === hexId) this.hoverUnitHexId = null;
	},
	unitPanelBreakdown(unit, hex) {
		// Mirrors calcDefenderEffectiveArmor (game.js:3356) but returns components for display.
		// Does NOT mutate unit.effectiveArmor.
		if (!unit || !hex) return null;
		if (unit.isRerolled) {
			return { base: unit.currentArmor, parts: [], total: 0, rerolled: true };
		}
		const parts = [];
		let total = unit.currentArmor;
		if (unit.isGuarding) {
			parts.push({ label: unit.isGuarding == 2 ? 'shield' : 'guard', value: unit.isGuarding });
			total += unit.isGuarding;
		}
		if (this.gameplayVersion !== 2 && unit.armorReduction) {
			parts.push({ label: 'reduction', value: -unit.armorReduction });
			total -= unit.armorReduction;
		}
		if (unit.isScarred) {
			parts.push({ label: 'scarred', value: -1 });
			total -= 1;
		}
		if (hex.terrainType === 'FOREST' || hex.terrainType === 'TOWER' || hex.terrainType === 'MOUNTAIN') {
			parts.push({ label: hex.terrainType.toLowerCase(), value: +1 });
			total += 1;
		}
		if (this.players[unit.playerId]?.baseHexId === hex.id) {
			parts.push({ label: 'on base', value: +2 });
			total += 2;
		}
		return { base: unit.currentArmor, parts, total: Math.max(0, total), rerolled: false };
	},
	unitMovementText(unit) {
		if (!unit) return '';
		const d = unit.distance;
		switch (unit.movement) {
			case '*': return d === 1
				? 'Up to 1 hex, any direction.'
				: `Up to ${d} hexes, any direction (BFS).`;
			case 'L': return 'L-jump (2 straight + 1 offset). Can leap over units.';
			case 'X': return `Up to ${d} hexes along six diagonals. Blocked by units.`;
			default: return `Distance ${d}.`;
		}
	},
	unitBlurb(unit) {
		if (!unit) return '';
		switch (unit.value) {
			case 1: return 'Balanced melee all-rounder.';
			case 2: return 'Ranged. Cannot shoot adjacent enemies (unless on Tower/Mountain). Long-range −1 atk.';
			case 3: return 'Fast L-jumper. Leaps over units.';
			case 4: return 'Diagonal striker. Movement blocked by units in path.';
			case 5: return 'Heavy armor. V1: reflects melee when attacker is depleted while guarding.';
			case 6: return 'Caster. Shield / Swap / Skirmish on friendlies in range 2. Cannot cast while engaged.';
			default: return '';
		}
	},
	unitStatusFlags(unit, hex) {
		if (!unit || !hex) return [];
		const flags = [];
		if (unit.isRerolled) flags.push({ icon: 'R', label: 'Rerolled — 0 armor until next turn', tone: 'warn' });
		if (unit.isGuarding == 2) flags.push({ icon: '⛨', label: 'Shielded (+2)', tone: 'good' });
		else if (unit.isGuarding == 1) flags.push({ icon: '⛉', label: 'Guarding (+1)', tone: 'good' });
		if (unit.skirmishBuff) flags.push({ icon: '⚔', label: 'Skirmish: −1 atk on next attack (range +1 for Archer)', tone: 'info' });
		if (unit.isScarred) flags.push({ icon: '✗', label: 'Scarred (−1 armor)', tone: 'warn' });
		if (this.isUnitEngaged(hex.id)) {
			let label = 'Engaged with adjacent enemy';
			if (unit.value === 2 && hex.terrainType !== 'TOWER' && hex.terrainType !== 'MOUNTAIN') label += ' — cannot ranged attack';
			if (unit.value === 6 && hex.terrainType !== 'TOWER' && hex.terrainType !== 'MOUNTAIN') label += ' — cannot cast spells';
			flags.push({ icon: '⚠', label, tone: 'warn' });
		}
		return flags;
	},
	unitActions(unit, hex) {
		if (!unit || !hex) return [];
		const actions = [];

		actions.push({
			name: 'Move',
			desc: this.unitMovementText(unit) + ' Moving onto an enemy initiates melee combat.',
		});

		actions.push({
			name: 'Guard',
			desc: 'Gain 1 Shield Charge (+1 effective armor). Absorbs one incoming attack without taking armor reduction, then expires.',
		});

		if (this.players[unit.playerId]?.baseHexId === hex.id) {
			actions.push({
				name: 'Reroll',
				desc: 'Reroll this die for a new unit type. Penalty: 0 effective armor until your next turn.',
			});
		}

		if (unit.value === 2) {
			actions.push({
				name: 'Ranged Attack',
				desc: 'Target an enemy 2 hexes away (requires line of sight). Cannot fire if engaged unless on Tower/Mountain. Range 3 with Skirmish/Mountain at −1 attack.',
			});
		}

		if (unit.value === 6) {
			actions.push({
				name: 'Spell · Shield',
				desc: 'Target friendly within range 2 gains 2 Guard Charges (+2 effective armor).',
			});
			actions.push({
				name: 'Spell · Swap',
				desc: 'Exchange positions with a friendly unit within range 2.',
			});
			actions.push({
				name: 'Spell · Skirmish',
				desc: 'Target friendly within range 2 gains Hit & Run on its next attack: −1 attack, win removes target and attacker picks any adjacent empty hex; tie/loss eliminates the attacker. Archer also gains +1 range.',
			});
			actions.push({
				name: 'Transmute (last Oracle only)',
				desc: 'Sacrifice this Oracle to convert an adjacent enemy. The new unit is rerolled and cannot act this turn.',
			});
		}

		return actions;
	},
	unitTerrainText(hex) {
		if (!hex) return { name: '', effect: '' };
		const map = {
			PLAIN: 'Open ground. No effect.',
			FOREST: '+1 armor. Blocks line of sight.',
			LAKE: 'Impassable.',
			TOWER: '+1 armor. Archer can attack adjacent. Blocks LoS.',
			MOUNTAIN: '+1 armor. Archer range extended (1–3). Movement cost ×2 (except Tanker). Blocks LoS.',
		};
		return { name: hex.terrainType || 'PLAIN', effect: map[hex.terrainType] || map.PLAIN };
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
		const validMeleeMoves = this.calcValidMoves(attackerUnit.hexId, false, state);
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
	 * Check if an Oracle can perform Transmute on an adjacent enemy unit.
	 * @param {number} oracleHexId - Hex ID of the Oracle unit
	 * @param {object} state - Optional game state for simulation
	 * @returns {boolean} True if Oracle has at least one adjacent enemy unit
	 */
	canOracleTransmute(oracleHexId, state) {
		const oracleUnit = this.getUnitOnHex(oracleHexId, state);
		const oracleHex = this.getHex(oracleHexId, state);
		if (!oracleUnit || oracleUnit.value !== 6 || !oracleHex) return false;

		// Check if this Oracle is the last unit for its player
		const player = (state || this).players[oracleUnit.playerId];
		const activeUnits = player.dice.filter(d => d.isDeployed && !d.isDeath && d.value != 6);
		if (activeUnits.length) return false;

		// Check if there's an adjacent enemy unit
		return this.getNeighbors(oracleHex, state).some(neighborHex => {
			if (!neighborHex) return false;
			const neighborUnit = this.getUnitOnHex(neighborHex.id, state);
			return neighborUnit && neighborUnit.playerId !== oracleUnit.playerId;
		});
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

		attackerUnit.isGuarding = 0;

		const isSkirmishing = !!attackerUnit.skirmishBuff;
		const distance = this.axialDistance(attackerHex.q, attackerHex.r, defenderHex.q, defenderHex.r);

		// Set combat trail for visual feedback (all combats)
		this.trailAttack = {
			fromHex: attackerHex,
			toHex: defenderHex,
			unit: attackerUnit,
			dist: distance,
			combatType,
		};
		this.trailSpell = {};

		// console.log('handleCombat', this.isCampaign, this.autochess, this.gameplayVersion)
		let sfxSword = 'sword'+[1,2,3].random();

		if (!state) window?.AudioManager?.playSfx(combatType == 'RANGED_ATTACK' ? 'bow' : sfxSword);

		if (this.isCampaign && !this.autochess) {
			if (!state) window?.AudioManager?.playSfx(combatType == 'RANGED_ATTACK' ? 'bow' : 'hit');

			if (this.CampaignManager.handleCombat(this, attackerHexId, defenderHexId, combatType, state)) return;
		} else if (this.gameplayVersion === 2) {
			const combatRoll = this.rollDice();
			
			let attackMod = 0;
			if (isSkirmishing) attackMod -= 1;
			if (attackerUnit.value === 2 && distance === 3) attackMod -= 1;

			const totalAtk = Math.ceil((attackerUnit.attack + attackMod + combatRoll) / 2);
			const defenderEffectiveArmor = this.calcDefenderEffectiveArmor(defenderHexId, state);

			this.addLog(`🎲 ${this.logUnit(attackerUnit)} rolls D${combatRoll} for combat! Attack: ${totalAtk} vs Armor: ${defenderEffectiveArmor}`);

			if (totalAtk > defenderEffectiveArmor) {
				if (!state) window?.AudioManager?.playSfx('hit')
				// Success
				if (this.autochess) {
					this.Autochess.handleCombat(this, attackerUnit, defenderUnit, combatRoll, defenderEffectiveArmor, state);
				} else {
					this.removeUnit(defenderHexId, state);
					this.addLog(`⚔️ ${this.logUnit(attackerUnit)} destroyed ${this.logUnit(defenderUnit)}!`);
				}

				if (isSkirmishing) {
					if (!state) window?.AudioManager?.playSfx('critical')
						
					this.handleSkirmishSuccess(attackerHexId, defenderHexId, state);
					if (this.actionMode === 'SKIRMISH_POST_MOVE') return; // Wait for user input
				} else if (!this.autochess && (combatType === 'MELEE' || combatType === 'COMMAND_CONQUER')) {
					this.move(attackerUnit, attackerHex, defenderHex, state);
				}
			} else {
				// Deflected
				if (!state) window?.AudioManager?.playSfx('deflect');
				if (this.autochess) {
					this.Autochess.handleCombat(this, attackerUnit, defenderUnit, combatRoll, defenderEffectiveArmor, state);
				} else {
					this.addLog(`🛡️ Attack deflected!`);
				}

				if (combatRoll === 1) {
					// Behemoth (Tanker Tier 3A) immunity to fumbles
					if (attackerUnit.value === 5 && this.hasPerk(attackerUnit, 'tier3', 'A')) {
						this.addLog(`🛡️ Behemoth! Immune to Fumble.`);
					} else {
						if (!state) window?.AudioManager?.playSfx('fumble');
						this.addLog(`🩼 FUMBLE! ${this.logUnit(attackerUnit)} destroyed themselves!`);
						if (this.autochess) {
							attackerUnit.hp = 0;
							this.removeUnit(attackerHexId, state);
						} else {
							this.removeUnit(attackerHexId, state);
						}
					}
				} else if (isSkirmishing) {
					if (!state) window?.AudioManager?.playSfx('fumble');
					this.addLog(`🎠 Skirmish failed! ${this.logUnit(attackerUnit)} eliminated.`);
					if (this.autochess) {
						attackerUnit.hp = 0;
						this.removeUnit(attackerHexId, state);
					} else {
						this.removeUnit(attackerHexId, state);
					}
				}
			}
		} else {
			// Version 1 logic (Decisive Dice)
			let attackMod = 0;
			if (isSkirmishing) attackMod -= 1;
			if (attackerUnit.value === 2 && distance === 3) attackMod -= 1;

			const effectiveAttack = Math.max(1, attackerUnit.attack + attackMod);
			const defenderEffectiveArmor = this.calcDefenderEffectiveArmor(defenderHexId, state);
			const defenderBaseArmor = UNIT_STATS[defenderUnit.value].armor;

			const isArmorDepleted = defenderUnit.armorReduction >= defenderBaseArmor;
			const attackWins = defenderUnit.isGuarding ? (effectiveAttack > defenderEffectiveArmor) : (effectiveAttack >= defenderEffectiveArmor);
			const attackerWins = isArmorDepleted || attackWins;

			if (attackerWins) {
				if (!state) window?.AudioManager?.playSfx('hit');

				this.removeUnit(defenderHexId, state);
				if (isSkirmishing) {
					this.handleSkirmishSuccess(attackerHexId, defenderHexId, state);
					if (this.actionMode === 'SKIRMISH_POST_MOVE') return; // Wait for user input
				} else if (combatType === 'MELEE' || combatType === 'COMMAND_CONQUER') {
					this.move(attackerUnit, attackerHex, defenderHex, state);
					this.addLog(`⚔️ ${this.logUnit(attackerUnit)} ${combatType.toLowerCase()} attacked ${this.logUnit(defenderUnit)} [${attackerHex.id}]->[${defenderHex.id}].`, state);
				} else {
					this.addLog(`🏹 ${this.logUnit(attackerUnit)} ${combatType.toLowerCase()} attacked ${this.logUnit(defenderUnit)} [${defenderHex.id}].`, state);
				}
			} else {
				// Failed
				if (isSkirmishing) {
					if (combatType !== 'RANGED_ATTACK') {
						if (!state) window?.AudioManager?.playSfx('fumble');
						this.addLog(`🎠 Skirmish failed! ${this.logUnit(attackerUnit)} has been eliminated.`, state);
						this.removeUnit(attackerHexId, state);
					} else {
						if (!state) window?.AudioManager?.playSfx('deflect');
						this.addLog(`⛓️‍💥 Skirmish failed! ${this.logUnit(attackerUnit)} s armor exhausted.`, state);
						this.applyDamage(attackerHexId, 1, state, false);
					}
				} else {
					if (!state) window?.AudioManager?.playSfx('deflect');
					this.addLog(`🍌 ${this.logUnit(attackerUnit)} attacked ${this.logUnit(defenderUnit)} failed.`, state);
					if (combatType !== 'RANGED_ATTACK') {
						if (attackerUnit.isGuarding <= 1) {
							this.addLog(`⛓️‍💥 Attack failed! Attacker's Armor reduced by 1.`, state);
							this.applyDamage(attackerHexId, 1, state, false);
						}
						if (defenderUnit.value == 5 && defenderUnit.isGuarding > 0) {
							const attackerEffectiveArmor = this.calcDefenderEffectiveArmor(attackerHexId, state);
							if (attackerEffectiveArmor <= 0) {
								if (!state) window?.AudioManager?.playSfx('death');
								this.addLog(`💔 ${this.logUnit(attackerUnit)} received heavy counter damage from ${defenderUnit.name} and has been eliminated`, state);
								this.removeUnit(attackerHexId, state);
							}
						}
					}
					this.addLog(`⛓️‍💥 Attack failed! Defender's Armor damaged by 1.`, state);
					if (defenderUnit.value != 5 && defenderUnit.isGuarding <= 1) {
						this.applyDamage(defenderHexId, 1, state, defenderUnit.isGuarding > 0 ? false : true);
					}
					if (defenderUnit.value == 5 && defenderUnit.isGuarding <= 0) {
						this.applyDamage(defenderHexId, 1, state, false);
					}
				}
			}
		}

		attackerUnit.skirmishBuff = 0;
		attackerUnit.hasMovedOrAttackedThisTurn = true;
		attackerUnit.actionsTakenThisTurn++;

		if (defenderUnit && !defenderUnit.isDeath) defenderUnit.isGuarding = 0;
		this.deselectUnit();
	},
	handleSkirmishSuccess(attackerHexId, defenderHexId, state) {
		const attackerUnit = this.getUnitOnHex(attackerHexId, state);
		const defenderHex = this.getHex(defenderHexId, state);
		const attackerHex = this.getHex(attackerHexId, state);
		if (!state) window?.AudioManager?.playSfx('skirmish');
		this.addLog(`⚔ ${this.logUnit(attackerUnit)} performed a successful Skirmish! Choose a destination adjacent to the target.`, state);

		if (!state) {
			this.actionMode = 'SKIRMISH_POST_MOVE';
			this.selectedUnitHexId = attackerHexId;
			const neighbors = this.getNeighbors(defenderHex);
			this.validMoves = neighbors
				.filter(n => !this.getUnitOnHex(n.id) || n.id === attackerHexId)
				.map(n => n.id);
			if (!this.validMoves.includes(defenderHexId)) this.validMoves.push(defenderHexId);
			if (!this.validMoves.includes(attackerHexId)) this.validMoves.push(attackerHexId);
		}
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
			window?.AudioManager?.playSfx('death');
			this.addLog(`💀 ${this.logUnit(unit)} removed [${this.getHex(hexId, state).id}].`);
		}
		
		const targetPlayer = (state || this).players[unit.playerId];
		const unitInArray = targetPlayer.dice.find(d => d.id === unit.id);
		if (unitInArray) unitInArray.isDeath = true; // Mark as death
		
		const hex = this.getHex(hexId, state);
		hex.unitId = null; // Clear hex
		hex.unit = null;
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

		if (this.isCampaign) {
			if (this.CampaignManager.applyDamage(this, hexId, damage, state)) return;
		}

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
		this._endTurn(state);
		if (!state && this.online.status === 'PLAYING') {
			if (this.currentPlayerIndex !== this.online.playerIndex) {
				// Note: index was flipped by _endTurn, so we check if it's NOT our turn anymore
				this.publishAction('GAME_ACTION', { action: 'END_TURN', args: [] });
			}
			// Push state snapshot to server for reconnection support
			this.pushStateToServer();
		}
	},
	async pushStateToServer() {
		if (this.online.status !== 'PLAYING' || !this.online.roomId) return;
		
		try {
			const gameState = {
				hexes: this.hexes.map(h => ({
					id: h.id,
					terrainType: h.terrainType,
					unit: h.unit ? {
						id: h.unit.id,
						value: h.unit.value,
						playerId: h.unit.playerId,
						currentArmor: h.unit.currentArmor,
						armorReduction: h.unit.armorReduction,
						hasMovedOrAttackedThisTurn: h.unit.hasMovedOrAttackedThisTurn
					} : null
				})),
				currentPlayerIndex: this.currentPlayerIndex,
				seed: _seed,
				phase: this.phase,
				turnNumber: this.turnNumber // If added in future
			};

			await fetch('/api/rooms/state', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ roomId: this.online.roomId, gameState })
			});
		} catch (e) {
			console.error("Failed to push state to server:", e);
		}
	},
	_endTurn(state) {
		let isState = !!state;
		state = state || this;

		if (!isState) this.recordAction('END_TURN');

		// console.log(`P${state.currentPlayerIndex + 1} turn ending...`);

		state.hovering = {};
		state.actionMode = null;
		state.validMoves = [];
		state.validMerges = [];
		state.validTargets = [];

		if (state.phase !== 'PLAYER_TURN') return;

		if (this.gameplayVersion === 2) {
			this.addLog(`P${state.currentPlayerIndex + 1}' turn ended`);
			this.addLog(`---`);
		}

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
		console.log(`Next player: P${state.currentPlayerIndex + 1}`);
		this.resetTurnActionsForPlayer(state.currentPlayerIndex, state);

		this.checkWinConditions(state);
		if (isState) return;

		if (this.online.status === 'PLAYING') {
			this.startOnlineTimer();
		}

		if (this.gameplayVersion === 2) {
			this.startFatesCall();
		} else {
			if (state.phase === 'PLAYER_TURN' && state.players[state.currentPlayerIndex].isAI) {
				setTimeout(() => this.performAITurn(), 500);
			} else if (this.debug?.autoPlay) {
				this.autoPlay();
			}
		}
	},
	resetTurnActionsForPlayer(playerId, state) {
		const player = (state || this).players[playerId];
		player.dice.forEach(die => this.resetUnitTurnState(die, state));
	},

	resetUnitTurnState(unit, state) {
		unit.hasMovedOrAttackedThisTurn = false;
		unit.actionsTakenThisTurn = 0;
		unit.isRerolled = false;
		unit.roundDamageNegated = 0;

		if (unit.venomDuration && unit.venomDuration > 0) {
			this.addLog(`🐍 ${this.logUnit(unit)} takes 10 venom damage.`);
			this.applyDamage(unit.hexId, 10, state);
			unit.venomDuration--;
		}

		// Warlock perk: melting converted units
		if (unit.isMelting && unit.isMelting > 0) {
			unit.isMelting--;
			if (unit.isMelting === 0) {
				this.addLog(`🔥 ${this.logUnit(unit)} melted away.`);
				this.removeUnit(unit.hexId, state);
			} else {
				this.addLog(`🔥 ${this.logUnit(unit)} is melting! (${unit.isMelting} turns left)`);
			}
		}

		if (unit.isDeployed && !unit.isDeath) {
			const hex = this.getHex(unit.hexId, state);

			// Oracle Tier 1 [A] Blessed Aura
			if (unit.value === 6 && this.hasPerk(unit, 'tier1', 'A')) {
				this.getNeighbors(hex, state).forEach(n => {
					const friend = this.getUnitOnHex(n.id, state);
					if (friend && friend.playerId === unit.playerId) {
						friend.currentHP = Math.min(friend.maxHP, friend.currentHP + 10);
					}
				});
			}

			// Oracle Tier 1 [B] Hex
			if (unit.value === 6 && this.hasPerk(unit, 'tier1', 'B')) {
				this.getNeighbors(hex, state).forEach(n => {
					const enemy = this.getUnitOnHex(n.id, state);
					if (enemy && enemy.playerId !== unit.playerId) {
						enemy.armorReduction += 10;
						this.addLog(`🔮 Hex! ${this.logUnit(enemy)} DEF reduced by 10.`);
					}
				});
			}

			this.calcDefenderEffectiveArmor(unit.hexId, state);

			// Decrement skirmish buff
			if (unit.skirmishBuff && unit.skirmishBuff > 0) unit.skirmishBuff--;
		}
	},
	checkWinConditions(state) {
		if (this.phase === 'GAME_OVER') return;

		const activePlayers = (state || this).players.filter(p => !p.isEliminated);

		activePlayers.forEach(p => {
			const activeDice = p.dice.filter(d => d.isDeployed && !d.isDeath).length;
			const baseHex = this.getHex(p.baseHexId, state);
			const unitOnBase = this.getUnitOnHex(baseHex?.id, state);
			const baseCaptured = baseHex && unitOnBase && unitOnBase.playerId !== p.id;

			// Annihilation mode: only eliminate when all dice are gone
			// Normal mode: eliminate when all dice gone OR base captured
			if (activeDice === 0 || (!this.options.includes('a') && baseCaptured)) {
				p.isEliminated = true;
				const reason = activeDice === 0 ? "annihilated" : "base captured";
				this.addLog(`P${p.id + 1} (${p.color}) has been ${reason}!`, state);
			}

			if (baseCaptured && !this.options.includes('a')) {
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
		this.winnerPlayerId = winnerPlayerIndex;

		if (this.currentReplay.games[0]) {
			this.currentReplay.games[0].winner = winnerPlayerIndex;
			this.currentReplay.games[0].winnerReason = message;
			this.currentReplay.games[0].totalTurns = this.turnCount;

			this.currentReplay.summary = {
				wins: this.players.map((_, i) => i === winnerPlayerIndex ? 1 : 0),
				draws: winnerPlayerIndex === -1 ? 1 : 0,
				totalTurns: this.turnCount,
				avgTurnsPerGame: this.turnCount
			};
		}

		if (this.isCampaign) {
			this.CampaignManager.handleGameOver(this, winnerPlayerIndex);
		}

		if (winnerPlayerIndex === -1) { // Draw
			 this.winnerMessage = message;
		} else {
			this.winnerMessage = `P${winnerPlayerIndex + 1} (${this.players[winnerPlayerIndex].color}) wins! ${message}`;
		}

		window?.AudioManager?.playSfx('victory');
		this.addLog(`Game Over: ${this.winnerMessage}`);
	},

	/* --- UTILITIES --- */
	cloneState(game) { // Very low performance
		let data = JSON.parse(JSON.stringify((game || this).$data));

		delete data.trail;
		delete data.trailSpell;
		delete data.messageLog;

		return data;
	},
	hasPerk(unit, tier, option) {
		if (this.autochess) {
			return unit?.perks?.[tier] === option;
		}
		if (!this.isCampaign || unit.playerId !== 0) return false;
		const upgrades = this.CampaignManager.state.upgrades[unit.value];
		return upgrades?.perks[tier] === option;
	},
	logUnit(attackerUnit, state) {
		state = state || this;
		if (!attackerUnit) return '';

		let pl = state.players[attackerUnit.playerId];
		return [
			`P${attackerUnit.playerId+1} ${attackerUnit.name}`,
			(pl?.isAI && pl?.profileName) ? `(${pl?.profileName})` : '',
		].filter(x => x).join(' ');
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
			const logContainer = document.querySelector('#game-log');
			if (logContainer) logContainer.scrollTop = 0;
		});
	},
	generateHDFEN(state = null) {
		const target = state || this;
		
		// Piece Placement
		let piecePlacementTokens = [];
		let emptyCount = 0;

		// Handle re-hydration if we only have playersDice string (minimal state)
		let playerUnits = null;
		if (target.playersDice) {
			playerUnits = {};
			target.playersDice.split(';').forEach(playerStr => {
				if (!playerStr) return;
				const [playerKey, diceData] = playerStr.split(':');
				const playerId = parseInt(playerKey.replace('p', '').replace('Dice', ''));
				if (diceData) {
					diceData.split('|').forEach(unitStr => {
						if (!unitStr) return;
						const parts = unitStr.split('-');
						const value = parseInt(parts[0]);
						const hexId = parseInt(parts[1]);
						const isDeath = parts[2] === 'true' || parts[2] === '1';
						const hasMoved = parts[3] === '1';
						const isGuarding = parts[4] === '1';
						const skirmishBuff = parseInt(parts[5]) || 0;

						if (!isDeath && !isNaN(hexId)) {
							playerUnits[hexId] = { playerId, value, isDeath, hasMovedOrAttackedThisTurn: hasMoved, isGuarding: isGuarding ? 1 : 0, skirmishBuff };
						}
					});
				}
			});
		}

		for (let i = 0; i < this.hexes.length; i++) {
			const hex = this.hexes[i];
			const unit = playerUnits ? playerUnits[hex.id] : hex.unit;

			if (unit) {
				if (emptyCount > 0) {
					piecePlacementTokens.push(emptyCount.toString());
					emptyCount = 0;
				}
				const playerID = unit.playerId;
				const unitValue = unit.value;
				const isMoved = unit.hasMovedOrAttackedThisTurn ? 'M' : 'm';
				const isGuarding = unit.isGuarding > 0 ? 'G' : 'g';
				const isDeath = unit.isDeath ? 'D' : 'd';
				const skirmishBuff = (unit.skirmishBuff || 0).toString().substring(0, 1);

				piecePlacementTokens.push(`${playerID}${unitValue}${isMoved}${isGuarding}${isDeath}${skirmishBuff}`);
			} else {
				emptyCount++;
			}
		}
		if (emptyCount > 0) {
			piecePlacementTokens.push(emptyCount.toString());
		}
		const piecePlacement = piecePlacementTokens.join('/');

		// Active Player
		const activePlayer = target.currentPlayerIndex ?? target.turn ?? 0;

		// Game Phase
		let gamePhase = '';
		const phase = target.phase;
		switch (phase) {
			case 'SETUP_ROLL': gamePhase = 'SR'; break;
			case 'SETUP_REROLL': gamePhase = 'SRR'; break;
			case 'SETUP_DEPLOY': gamePhase = 'SD'; break;
			case 'PLAYER_TURN': gamePhase = 'PT'; break;
			case 'GAME_OVER': gamePhase = 'GO'; break;
			default: gamePhase = '__'; break; // Unknown phase
		}

		// Turn Number
		const turnNumber = target.turnCount ?? 0;

		// Other Flags
		const rules = target.rules || {};
		const options = target.options || '';
		const noRerollFlag = rules.noReroll ? 'r' : '_';
		const annihilationModeFlag = options.includes('a') ? 'a' : '_';
		const mergeModeFlag = options.includes('m') ? 'm' : '_';
		const otherFlags = `${noRerollFlag}${annihilationModeFlag}${mergeModeFlag}`;

		return `${piecePlacement} ${activePlayer} ${gamePhase} ${turnNumber} ${otherFlags}`;
	},
	rollDice(max=6, delay=0) {
		const roll = this._rollDice(max, delay);
		if (this.online.status === 'PLAYING' && this.currentPlayerIndex === this.online.playerIndex) {
			this.publishAction('GAME_ACTION', { action: 'ROLL_DICE', args: [max, delay] });
		}
		return roll;
	},
	_rollDice(max=6, delay=0) {
		this.rollingDice = true;
		const roll = Math.floor(random() * max) + 1;

		if (typeof window !== 'undefined' && window.rollDiceAnimation) {
			if (delay) setTimeout(() => window.rollDiceAnimation(roll), delay);
			else window.rollDiceAnimation(roll);
			setTimeout(() => {this.rollingDice = false;}, 1e3);
		}

		return roll;
	},
};}
