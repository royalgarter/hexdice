const AI_PRESET_EVALUATION_WEIGHTS = {
	GREEDY: {
		note: '1. Greed is good',
		UNIT_COUNT: 150,      // Higher value for each deployed AI unit / Penalty for enemy units
		UNIT_FACTOR: 120,      // Multiplier for unit's dice value (stronger units = more value)
		GUARD: 10,            // Bonus for guarding units
		ADVANCE: 5,           // Points for the whole formation moving closer to opponent's base
		MUTUAL_SUPPORT: 2,    // Bonus for friendly units being adjacent
		BASE_PROTECTION: 20,  // Bonus for AI units protecting their own base
		THREAT: 5,           // Penalty for AI units being threatened
		VULNERABLE: 8,       // Reward for opponent units being vulnerable (potential future attacks)
		MERGE_GT_6: 150,      // Bonus for merging into a unit with value > 6
		BRAVE_CHARGE: 80,      // Reward for potential Brave Charge
		PST_WEIGHT: 30,       // NEW: Aggressively weight the PST
	},
	AGGRESSIVE: {
		note: '2. Aggressive AI (Prioritizes offense, advancing, and taking out threats)',
		UNIT_COUNT: 200,      // Very high value for eliminating enemy units
		UNIT_FACTOR: 150,     // Stronger units for offense are more valued
		GUARD: 5,             // Less emphasis on guarding
		ADVANCE: 25,          // Strong push towards opponent base
		MUTUAL_SUPPORT: 5,    // Small bonus for staying together
		BASE_PROTECTION: 60,  // High importance for defending own base
		THREAT: 3,            // Less fearful of threats, willing to take risks
		VULNERABLE: 8,       // Reduced, as actual kills are now more heavily rewarded via UNIT_COUNT/FACTOR
		MERGE_GT_6: 100,      // Merges are good, but less critical than direct attack
		BRAVE_CHARGE: 150,     // Higher reward for brave charges
		PST_WEIGHT: 40,       // NEW: Very aggressively weight the PST
	},
	DEFENSIVE: {
		note: '3. Defensive/Turtle AI (Focuses on protecting units, consolidating, and surviving)',
		UNIT_COUNT: 120,      // Wants to maintain high unit count
		UNIT_FACTOR: 90,      // Values unit strength, but survival is key
		GUARD: 40,            // High reward for guarding
		ADVANCE: 2,           // Less emphasis on pushing forward
		MUTUAL_SUPPORT: 15,   // High bonus for staying together
		BASE_PROTECTION: 80,  // Extremely high importance for defending own base
		THREAT: 15,           // Very high penalty for threatened units
		VULNERABLE: 3,        // Low reward for attacking unless it's a clear advantage
		MERGE_GT_6: 200,      // High reward for strong defensive units
		BRAVE_CHARGE: 10,      // Brave charges are risky, less desirable
		PST_WEIGHT: 60,       // NEW: Very aggressively weight the PST
	},
	JUGGLING: {
		note: '4. Juggling/Value Maximizer AI (Prioritizes creating high-value units and strategic merges)',
		UNIT_COUNT: 70,       // Unit count is important, but quality over quantity
		UNIT_FACTOR: 150,     // Very high value for unit strength
		GUARD: 15,            // Guards good for protecting high-value units
		ADVANCE: 5,           // Standard positional
		MUTUAL_SUPPORT: 7,    // Moderate bonus for cohesion
		BASE_PROTECTION: 30,  // Moderate importance for defending own base
		THREAT: 7,            // Moderate threat avoidance to protect key units
		VULNERABLE: 7,        // Moderate reward for attacking, but not primary focus
		MERGE_GT_6: 300,      // Extremely high reward for merges > 6
		BRAVE_CHARGE: 50,      // Brave charges are fine for removing threats, but not primary
		PST_WEIGHT: 40,       // NEW: Very aggressively weight the PST
	},
	SWARM: {
		note: '5. Swarm AI (Focuses on deploying many units and overwhelming the opponent with numbers)',
		UNIT_COUNT: 200,      // Extremely high reward for unit count
		UNIT_FACTOR: 50,      // Less emphasis on individual unit strength
		GUARD: 5,             // Not a priority, better to push
		ADVANCE: 10,          // Push forward to get more units on the board
		MUTUAL_SUPPORT: 3,    // Low bonus, as units are meant to spread and overwhelm
		BASE_PROTECTION: 20,  // Less importance, units are expendable
		THREAT: 5,            // Moderate threat, expects some units to be lost
		VULNERABLE: 8,        // Rewards finding openings for mass attacks
		MERGE_GT_6: 50,       // Less important, as units are meant to be numerous
		BRAVE_CHARGE: 60,      // Good for breaking through quickly
		PST_WEIGHT: 10,       // NEW: Low weight, swarm cares less about perfect positioning
	},
	OPPORTUNISTIC: {
		note: '6. Opportunistic AI (Waits for weaknesses, focuses on exploiting vulnerabilities and high-impact plays)',
		UNIT_COUNT: 150,       // Wants units, but will sacrifice for big plays
		UNIT_FACTOR: 100,
		GUARD: 10,            // Guards are good for maintaining position
		ADVANCE: 5,           // Standard positional
		MUTUAL_SUPPORT: 5,    // Standard cohesion
		BASE_PROTECTION: 40,  // Good importance for defending own base
		THREAT: 10,           // Avoids unnecessary threats, preserves units for opportunities
		VULNERABLE: 15,       // High reward for vulnerable enemy units
		MERGE_GT_6: 120,      // Merges are good for stronger units that can exploit
		BRAVE_CHARGE: 150,     // Extremely high reward for Brave Charge opportunities
		PST_WEIGHT: 50,       // NEW: Very aggressively weight the PST
	},
	RANDOMISH: {
		note: '7. Random-ish AI (Weights are low or balanced, relying more on the top-3 random selection)',
		UNIT_COUNT: 1,
		UNIT_FACTOR: 1,
		GUARD: 1,
		ADVANCE: 1,
		MUTUAL_SUPPORT: 1,
		BASE_PROTECTION: 1,
		THREAT: 1,
		VULNERABLE: 1,
		MERGE_GT_6: 1,
		BRAVE_CHARGE: 1,
		PST_WEIGHT: 1,
	},

	getRandomPreset: function(key) {
		if (this[key]) return this[key];

		const keys = Object.keys(this).filter(key => typeof this[key] === 'object'); // Filter out the function itself
		const randomKey = keys[Math.floor(random() * keys.length)];
		return this[randomKey];
	}
};

const EVALUATION_WEIGHT = AI_PRESET_EVALUATION_WEIGHTS.getRandomPreset('AGGRESSIVE');

function softmax(logits) {
	const highest = Math.max(...logits);
	const shifted = logits.map(score => Math.exp(score - highest));
	const total = shifted.reduce((acc, val) => acc + val, 0);
	return shifted.map(prob => prob / total);
}

const AI_SEARCH_DEPTH = 3; // Depth for the minimax search. Higher values are smarter but slower.

// Simulates the end of a turn for minimax evaluation
function simulateEndTurn(state) {
    const newState = structuredClone(state);
    newState.currentPlayerIndex = (newState.currentPlayerIndex + 1) % newState.players.length;
    // Reset action flags for the new current player
    newState.players[newState.currentPlayerIndex].dice.forEach(d => {
        d.hasMovedOrAttackedThisTurn = false;
    });
    return newState;
}

/**
 * Implements the minimax algorithm with alpha-beta pruning to find the best move.
 * @param {object} GAME - The global game object with utility functions.
 * @param {object} state - The current game state to evaluate.
 * @param {number} depth - The remaining search depth.
 * @param {number} alpha - The alpha value for pruning.
 * @param {number} beta - The beta value for pruning.
 * @param {boolean} isMaximizingPlayer - True if the current player is the AI (maximizer).
 * @returns {number} The evaluated score of the board state.
 */
function minimax(GAME, state, depth, alpha, beta, isMaximizingPlayer) {
    if (depth === 0 || state.phase === 'GAME_OVER') {
        return boardEvaluation(GAME, state);
    }

    const possibleMoves = generateAllPossibleMoves(GAME, state);
    possibleMoves.push({ actionType: 'END_TURN' });

    if (isMaximizingPlayer) {
        let maxEval = -Infinity;
        for (const move of possibleMoves) {
            const stateAfterMove = applyMove(GAME, move, state);
            const stateAfterTurn = simulateEndTurn(stateAfterMove); // Opponent's turn now
            const eval = minimax(GAME, stateAfterTurn, depth - 1, alpha, beta, false);
            maxEval = Math.max(maxEval, eval);
            alpha = Math.max(alpha, eval);
            if (beta <= alpha) break; // Pruning
        }
        return maxEval;
    } else { // Minimizing player
        let minEval = Infinity;
        for (const move of possibleMoves) {
            const stateAfterMove = applyMove(GAME, move, state);
            const stateAfterTurn = simulateEndTurn(stateAfterMove); // AI's turn now
            const eval = minimax(GAME, stateAfterTurn, depth - 1, alpha, beta, true);
            minEval = Math.min(minEval, eval);
            beta = Math.min(beta, eval);
            if (beta <= alpha) break; // Pruning
        }
        return minEval;
    }
}

function performAIByMinimax(GAME) {
	if (GAME.phase !== 'PLAYER_TURN' || !GAME.players[GAME.currentPlayerIndex].isAI) return;

	const currentState = GAME.cloneState();
	const possibleMoves = generateAllPossibleMoves(GAME, currentState);
    possibleMoves.push({ actionType: 'END_TURN' });

	if (possibleMoves.length === 1 && possibleMoves[0].actionType === 'END_TURN') {
		console.log('AI has no other moves, ending turn.');
		applyMove(GAME, possibleMoves[0]);
		return;
	}

	// console.log('AI thinking... Searching with depth:', AI_SEARCH_DEPTH);

	// Evaluate all possible moves using minimax
	possibleMoves.forEach(move => {
		const stateAfterMove = applyMove(GAME, move, currentState);
		let score;
		if (stateAfterMove.phase === 'GAME_OVER') {
			score = boardEvaluation(GAME, stateAfterMove);
		} else {
			const stateAfterTurn = simulateEndTurn(stateAfterMove);
			score = minimax(GAME, stateAfterTurn, AI_SEARCH_DEPTH - 1, -Infinity, Infinity, false); // false for minimizing player
		}
		move.evaluation = score; // Attach score to the move object
	});

	possibleMoves.sort((a, b) => b.evaluation - a.evaluation);
	// console.log('Evaluated moves:', possibleMoves.map(m => ({ move: m, score: m.evaluation })));

	// Use softmax to pick a move, favoring better ones but allowing some randomness
	const probabilities = softmax(possibleMoves.map(x => x.evaluation));
	const randomNumber = random();
	let cumulativeProbability = 0;
	let bestMove = possibleMoves[0]; // Default to best move

	for (let i = 0; i < probabilities.length; i++) {
		cumulativeProbability += probabilities[i];
		if (randomNumber < cumulativeProbability) {
			bestMove = possibleMoves[i];
			break;
		}
	}

	// Execute best move
	if (bestMove) {
		console.log('AI chose move:', bestMove, 'with score:', bestMove.evaluation);
		applyMove(GAME, bestMove);
	} else {
        // This case should not be reached if END_TURN is always an option
		console.error('AI failed to select a move.');
	}
}

function boardEvaluation(GAME, state, WEIGHT=EVALUATION_WEIGHT) {
	state = state || GAME;

	if (state.phase === 'GAME_OVER') {
		const aiPlayerIndex = state.currentPlayerIndex;
		
		if (state.winnerPlayerIndex === aiPlayerIndex) return Infinity;
		if (state.winnerPlayerIndex !== null && state.winnerPlayerIndex !== undefined && state.winnerPlayerIndex !== aiPlayerIndex) return -Infinity;
		return 0; // Draw
	}

	const aiPlayerIndex = state.currentPlayerIndex;
	const aiPlayer = state.players[aiPlayerIndex];
	
	// Collect all opponent players
	const opponentIndices = [];
	for (let i = 0; i < state.players.length; i++) {
		if (i !== aiPlayerIndex && !state.players[i].isEliminated) {
			opponentIndices.push(i);
		}
	}

	const aiUnits = aiPlayer.dice.filter(d => d.isDeployed && !d.isDeath);
	
	// Collect all opponent units from all opponents
	let opponentUnits = [];
	for (const oppIdx of opponentIndices) {
		const oppUnits = state.players[oppIdx].dice.filter(d => d.isDeployed && !d.isDeath);
		opponentUnits = opponentUnits.concat(oppUnits);
	}

	let score = 0;

	// 1. Unit Count and Value
	const aiUnitCount = aiUnits.length;
	const opponentUnitCount = opponentUnits.length;
	score += (aiUnitCount * WEIGHT.UNIT_COUNT);
	score -= (opponentUnitCount * WEIGHT.UNIT_COUNT);

	for (let i = 0; i < aiUnitCount; i++) {
		const unit = aiUnits[i];
		score += Math.round(Math.log1p(unit.attack) * WEIGHT.UNIT_FACTOR); // Use log1p to avoid log(0)
		if (unit.isGuarding) score += WEIGHT.GUARD;

		if (unit.value === 6) {
			const neighbors = GAME.getNeighbors(GAME.getHex(unit.hexId, state), state);
			for (let j = 0; j < neighbors.length; j++) {
				const neighbor = neighbors[j];
				const neighborUnit = GAME.getUnitOnHex(neighbor.id, state);
				if (neighborUnit && neighborUnit.playerId === aiPlayerIndex) {
					score += (WEIGHT.GUARD >> 3); // Small bonus for buffing friendly units
				}
			}
		}
	}

	for (let i = 0; i < opponentUnitCount; i++) {
		const unit = opponentUnits[i];
		score -= Math.round(Math.log1p(unit.attack) * WEIGHT.UNIT_FACTOR); // Use log1p
	}

	// 2. Positional Scoring - Formation Advancement
	// Calculate advancement towards all opponent bases
	let aiTotalAdvanceScore = 0;
	for (const oppIdx of opponentIndices) {
		const opponentBaseHex = GAME.getHex(state.players[oppIdx].baseHexId, state);
		if (opponentBaseHex) {
			for (let i = 0; i < aiUnitCount; i++) {
				const unit = aiUnits[i];
				const unitHex = GAME.getHex(unit.hexId, state);
				if (unitHex) {
					const distanceToOpponentBase = GAME.axialDistance(unitHex.q, unitHex.r, opponentBaseHex.q, opponentBaseHex.r);
					aiTotalAdvanceScore += (R * 2 - distanceToOpponentBase); // Reward for being closer
				}
			}
		}
	}
	// Average across number of opponents to avoid double-counting
	if (opponentIndices.length > 0) {
		aiTotalAdvanceScore = aiTotalAdvanceScore / opponentIndices.length;
	}
	score += (aiTotalAdvanceScore * WEIGHT.ADVANCE);

	// 2.5. Positional Scoring - Piece Square Tables
	for (let i = 0; i < aiUnitCount; i++) {
		const unit = aiUnits[i];
		const unitHex = GAME.getHex(unit.hexId, state);
		if (unitHex) {
			score += getHexPSTScore(GAME, unit, unitHex, state) * WEIGHT.PST_WEIGHT; // Add score for AI's units based on position
		}
	}

	for (let i = 0; i < opponentUnitCount; i++) {
		const unit = opponentUnits[i];
		const unitHex = GAME.getHex(unit.hexId, state);
		if (unitHex) {
			score -= getHexPSTScore(GAME, unit, unitHex, state) * WEIGHT.PST_WEIGHT; // Subtract score for Opponent's units
		}
	}


	// 3. Threat and Vulnerability (Existing)
	let totalThreatScore = 0;
	let totalVulnerabilityScore = 0;
	let aiUnitsThreatened = new Set(); // AI units that are currently threatened by opponents
	let opponentUnitsThreatened = new Set(); // Opponent units that are currently threatened by AI

	// Calculate threats to AI units (from all opponent perspectives)
	for (let i = 0; i < aiUnitCount; i++) {
		const aiUnit = aiUnits[i];
		let aiUnitThreat = 0;
		for (let j = 0; j < opponentUnits.length; j++) {
			const opponentUnit = opponentUnits[j];
			// Can opponentUnit attack aiUnit?
			if (GAME.canUnitAttackTarget(opponentUnit, aiUnit, state)) {
				aiUnitsThreatened.add(aiUnit.hexId);
				// Threat value increases with both units' values
				aiUnitThreat += (aiUnit.value + opponentUnit.value);
			}
		}
		totalThreatScore += aiUnitThreat;
	}

	// Calculate vulnerability of opponent units (from AI perspective)
	for (let i = 0; i < opponentUnitCount; i++) {
		const opponentUnit = opponentUnits[i];
		let opponentUnitVulnerability = 0;
		for (let j = 0; j < aiUnitCount; j++) {
			const aiUnit = aiUnits[j];
			// Can aiUnit attack opponentUnit?
			if (GAME.canUnitAttackTarget(aiUnit, opponentUnit, state)) {
				opponentUnitsThreatened.add(opponentUnit.hexId);
				// Vulnerability value increases with both units' values
				// Give higher weight if the opponent unit is also threatening AI units
				opponentUnitVulnerability += (aiUnit.value + opponentUnit.value) * (aiUnitsThreatened.has(opponentUnit.hexId) ? 1.5 : 1);
			}
		}
		totalVulnerabilityScore += opponentUnitVulnerability;
	}

	score -= (totalThreatScore * WEIGHT.THREAT);
	score += (totalVulnerabilityScore * WEIGHT.VULNERABLE);

	// 4. Mutual Support / Cohesion
	let cohesionScore = 0;
	for (let i = 0; i < aiUnitCount; i++) {
		const aiUnit = aiUnits[i];
		const aiUnitHex = GAME.getHex(aiUnit.hexId, state);
		if (aiUnitHex) {
			let friendlyNeighbors = 0;
			for (let neighborHex of GAME.getNeighbors(aiUnitHex, state)) {
				if (neighborHex) {
					const neighborUnit = GAME.getUnitOnHex(neighborHex.id, state);
					if (neighborUnit && neighborUnit.playerId === aiPlayerIndex && neighborUnit.id !== aiUnit.id) {
						friendlyNeighbors++;
					}
				}
			}
			cohesionScore += friendlyNeighbors;
		}
	}
	score += (cohesionScore * WEIGHT.MUTUAL_SUPPORT);

	// 5. Base Protection (Explicit)
	const aiBaseHex = GAME.getHex(aiPlayer.baseHexId, state);
	if (aiBaseHex) {
		let unitsNearAIBase = 0;
		const baseProtectionHexes = [aiBaseHex.id, ...GAME.getNeighbors(aiBaseHex, state).map(h => h.id)].filter(Boolean);
		for (let i = 0; i < baseProtectionHexes.length; i++) {
			const hexId = baseProtectionHexes[i];
			const unit = GAME.getUnitOnHex(hexId, state);
			if (unit && unit.playerId === aiPlayerIndex) {
				unitsNearAIBase++;
			}
		}
		score += (unitsNearAIBase * WEIGHT.BASE_PROTECTION);
	}

	// 6. Merges (AI's perspective)
	for (let i = 0; i < aiUnitCount; i++) {
		const aiUnit = aiUnits[i];
		const validMerges = GAME.calcValidMoves(aiUnit.hexId, true, state); // `true` indicates searching for merge targets
		for (let j = 0; j < validMerges.length; j++) {
			const mergeTargetHexId = validMerges[j];
			const targetUnit = GAME.getUnitOnHex(mergeTargetHexId, state);
			if (targetUnit) {
				const sumValue = aiUnit.value + targetUnit.value;
				let mergeBonus = 0;
				if (sumValue <= 6) {
					mergeBonus = sumValue; // Reward for creating a stable unit
				} else {
					mergeBonus = WEIGHT.MERGE_GT_6 + (sumValue - 6); // Extra bonus for exceeding 6
				}
				score += mergeBonus;
			}
		}
	}

	return score;
}

function getHexPSTScore(GAME, unit, hex, state) { // Piece Square Tables (PSTs) implementation
	let score = 0;
	const { q, r } = hex;
	const unitValue = unit.value;

	score += centralityScore(GAME, hex, unit, state);
	score += advancementScore(GAME, hex, unit, state);
	score += proximityScore(GAME, hex, unit, state);
	score += specialHexBonuses(GAME, hex, unit, state);

	return score;
}

function centralityScore(GAME, hex, unit, state) {
	let score = 0;
	const { q, r } = hex;

	// 1. Centrality (general board control):
	// Units generally prefer to be closer to the center of the board (0,0).
	const centerQ = 0;
	const centerR = 0;
	const distanceFromCenter = GAME.axialDistance(q, r, centerQ, centerR);
	// Reward for being closer to center, scaled (smaller distance = higher score)
	score += (R - distanceFromCenter) * 0.5;

	return score;
}

function advancementScore(GAME, hex, unit, state) {
	let score = 0;
	const { q, r } = hex;
	const unitValue = unit.value;

	const opponentBaseHex = GAME.getHex(state.players[(unit.playerId + 1) % state.players.length].baseHexId, state);

	// A. Advancement toward opponent's base (typically for lower value, more aggressive units)
	if (unitValue <= 3) { // Dice 1, 2, 3 might be more expendable or designed for pushing
		if (opponentBaseHex) {
			const distanceToOpponentBase = GAME.axialDistance(q, r, opponentBaseHex.q, opponentBaseHex.r);
			// Reward for being closer to opponent's base. Max distance is R*2.
			score += (R * 2 - distanceToOpponentBase) * 0.4;
		}
	}

	return score
}

function proximityScore(GAME, hex, unit, state) {
	let score = 0;
	const { q, r } = hex;
	const unitValue = unit.value;

	const playerBaseHex = GAME.getHex(state.players[unit.playerId].baseHexId, state);

	// B. Proximity to own base (typically for higher value, more defensive/control units)
	if (unitValue >= 5) { // Dice 5 (Tanker), 6 (Balance) might prefer more defensive or central-control positions
		if (playerBaseHex) {
			const distanceToOwnBase = GAME.axialDistance(q, r, playerBaseHex.q, playerBaseHex.r);
			// Reward for being closer to own base (smaller distance = higher score)
			score += (R - distanceToOwnBase) * 0.7;
		}
	}

	return score;
}

function specialHexBonuses(GAME, hex, unit, state) {
	let score = 0;
	const { q, r } = hex;
	const unitValue = unit.value;

	// C. Special hex bonuses (e.g., central column, specific choke points):
	// This is an example of a general board feature, independent of specific bases.
	if (Math.abs(q) === 0) { // Bonus for being on the central column (q=0)
		score += 2;
	}
	// You can add more specific hex-ID based bonuses here if your board has unique strategic hexes.
	// Example: if (hex.id === 'central_chokepoint_hex') score += 5;

	return score
}
