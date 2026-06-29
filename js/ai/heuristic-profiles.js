/**
 * Heuristic Strategy Profiles for Hex Dice AI
 * 
 * Target Selections: 'highestValue', 'threatRemoval', 'lowArmor'
 * Positioning Styles: 'balanced', 'rush', 'turtle', 'flank', 'cluster'
 * Unit Selections: 'leastMoved', 'highestValue', 'mostThreatened'
 */

const heuristicProfiles = {
    // =========================================================================
    // 1. BASELINE - Jack of all trades
    // =========================================================================
    baseline: {
        name: "Baseline",
        description: "Balanced: Fundamentally sound, values objectives and combat equally.",
        priorityOrder: ['capture', 'kill', 'attack', 'spell', 'dodge', 'position'],
        weights: {
            captureBonus: 10000,    // Primary objective: Reward for reaching enemy base
            killBonus: 1000,       // Reward for eliminating an enemy unit
            attackBonus: 500,      // Reward for damaging an enemy unit
            safeBonus: 400,        // Reward for ending turn on a non-threatened hex
            friendlySixBonus: 50,  // Reward for staying near a friendly Oracle (Dice 6)
            advanceBonus: 700,     // Reward for moving closer to enemy objectives
            protectedRangeBonus: 100, // Reward for positioning where allies provide cover

            isolationPenalty: 100, // Penalty per hex beyond 3 from nearest ally
            threatPenalty: -400,   // Penalty for being in range of enemy attacks
            guardPenalty: -200,    // Mild penalty — Guard is a valid action now, just not spammable
            mergeOver6Penalty: -500,
            backAndForthPenalty: -1000,

            teamPositionWeight: 0.6, // Relative importance of overall team formation
            pressureWeight: 0.8,     // Space control — lower to prevent friendly-cluster attractor loops

            terrainWeights: {
                defenseBonusWeight: 100, // Bonus for holding defensive terrain
                archerTowerBonus: 200,    // Extra range bonus for Archers on Towers
                archerMountainBonus: 300, // Extra range bonus for Archers on Mountains
                mountainMovePenalty: -150, // Cost adjustment for entering Mountains
                losBlockBonus: 150       // Value of using terrain to block Line of Sight
            },

            spells: {
                SPELLCAST_SHIELD: 1.0,   // Relative priority of Shield spell
                SPELLCAST_SWAP: 0.8,     // Relative priority of Swap spell
                SPELLCAST_SKIRMISH: 1.0, // Relative priority of Skirmish spell
            }
        },
        riskTolerance: 0.5,
        targetSelection: 'highestValue',
        positioningStyle: 'balanced',
        unitSelection: 'leastMoved'
    },

    // =========================================================================
    // 2. RANGER - Ranged Terrain Camper
    // =========================================================================
    ranger: {
        name: "Ranger",
        description: "Artillery: Avoids melee. Fights obsessively for Towers/Mountains to shoot safely.",
        priorityOrder: ['kill', 'position', 'spell', 'attack', 'capture', 'dodge'],
        weights: {
            captureBonus: 4000,    // Objective is to outlast, then capture
            killBonus: 2500,       // Focus on deleting units that approach its nest
            attackBonus: 1000,
            safeBonus: 800,
            threatPenalty: -800,   // Runs away from close combat (prefers distance)
            protectedRangeBonus: 1500, // Thrives shooting over friendly lines from safety
            friendlySixBonus: 100,
            advanceBonus: 400,     // Slightly proactive when no tower available

            isolationPenalty: 60,  // Rangers can spread out to find terrain
            guardPenalty: -200,    // Occasional guarding is okay
            mergeOver6Penalty: -100,
            backAndForthPenalty: -600, // Strong — prevents Tower-to-Tower oscillation

            teamPositionWeight: 0.4,
            pressureWeight: 0.7,     // Values board control from a distance

            terrainWeights: {
                defenseBonusWeight: 200,
                archerTowerBonus: 3000,    // Absolute obsession with Towers for Range+1
                archerMountainBonus: 3000, // Absolute obsession with Mountains for Range+1
                mountainMovePenalty: -50,  // Willing to take move penalty to climb peaks
                losBlockBonus: 400
            },

            spells: {
                SPELLCAST_SHIELD: 0.5,
                SPELLCAST_SWAP: 2.0,       // High Swap priority to steal/rotate Tower spots
                SPELLCAST_SKIRMISH: 1.5,   // Skirmish used to reposition after firing
            }
        },
        riskTolerance: 0.3,
        targetSelection: 'lowArmor', // Snipes the easiest targets
        positioningStyle: 'flank',
        unitSelection: 'leastMoved'
    },

    // =========================================================================
    // 3. ASSASSIN - Minimax Precision Striker
    // =========================================================================
    assassin: {
        name: "Assassin",
        description: "Calculated Killer: Uses deep calculation (Minimax) to find guaranteed weak-point executions.",
        priorityOrder: ['kill', 'capture', 'attack', 'spell', 'dodge', 'position'],
        minimax: true,
        minimaxDepth: 3,
        weights: {
            captureBonus: 8000,    // Objective is a distraction/backup plan
            killBonus: 5000,       // Very high priority on eliminating specific weak units
            attackBonus: 800,
            safeBonus: 600,        // Prefers to end turns hidden or safe after a strike
            threatPenalty: -350,
            protectedRangeBonus: 75,
            friendlySixBonus: 100,
            advanceBonus: 500,     // High mobility; values closing in for the kill

            isolationPenalty: 50,  // Lone wolf — can operate independently but not recklessly
            guardPenalty: -400,
            mergeOver6Penalty: -450,
            backAndForthPenalty: -600, // Prevents stalking oscillation around same target

            teamPositionWeight: 0.3, // Lone wolf — doesn't need teammates
            pressureWeight: 0.7,     // Zone-aware when repositioning between targets

            terrainWeights: {
                defenseBonusWeight: 100,
                archerTowerBonus: 150,
                archerMountainBonus: 200,
                mountainMovePenalty: -50,
                losBlockBonus: 300 // Values line-of-sight blockers for stealthy approaches
            },

            spells: {
                SPELLCAST_SHIELD: 0.5,
                SPELLCAST_SWAP: 1.2,
                SPELLCAST_SKIRMISH: 2.5, // Primary tool for hit-and-run assassinations
            }
        },
        riskTolerance: 0.8,           // High risk, but mitigated by Minimax verifying the outcome
        targetSelection: 'lowArmor',  // Hyper-focuses on deleting weak links
        positioningStyle: 'flank',    // Stalks the edges
        unitSelection: 'highestValue'
    },

    // =========================================================================
    // 4. BERSERKER - Aggressive Trade Fighter
    // =========================================================================
    berserker: {
        name: "Berserker",
        description: "Trade Fighter: Rushes for kills and accepts death as a fair price — but only when the trade is worth it.",
        priorityOrder: ['kill', 'attack', 'capture', 'position', 'spell', 'dodge'],
        weights: {
            captureBonus: 1500,    // Capture is a means, not the primary goal
            killBonus: 2000,       // Primary identity: kills (reduced to prevent single-unit rampages)
            attackBonus: 1000,     // Damage even if not lethal
            safeBonus: 300,        // Small: slightly prefer not dying for nothing
            threatPenalty: -250,   // Small fear — won't charge into 3 enemies with no kill in sight
            protectedRangeBonus: 0,
            friendlySixBonus: 50,  // Slight awareness of Oracle support
            advanceBonus: 500,     // Advances at same pace as others — fights en route

            isolationPenalty: 200, // Can't kill anything alone on the far side of the map
            fatigueWeight: 800,    // Very high: prevents 1 unit acting more than 2 turns in a row
            guardPenalty: -1500,   // Hates guarding but won't die just to avoid it
            mergeOver6Penalty: -200,
            backAndForthPenalty: -300,

            teamPositionWeight: 0.25, // Slight formation awareness — don't charge alone into 3
            pressureWeight: 0.8,      // Seek enemies (positive: move toward them, not into death zones)

            terrainWeights: {      // Mostly ignores terrain but not completely blind
                defenseBonusWeight: 30,
                archerTowerBonus: 50,
                archerMountainBonus: 80,
                mountainMovePenalty: -50,
                losBlockBonus: 0
            },

            spells: {
                SPELLCAST_SHIELD: 0.3,   // Accept shielding a frontline before a charge
                SPELLCAST_SWAP: 0.5,
                SPELLCAST_SKIRMISH: 2.5, // Skirmish to enable a kill trade
            }
        },
        riskTolerance: 0.85,       // High risk, not maximum — trades yes, suicides no
        targetSelection: 'lowArmor', // Pick fights it can WIN — smart trade, not valor die
        positioningStyle: 'rush',
        unitSelection: 'highestValue'
    },

    // =========================================================================
    // 5. TURTLE - Impenetrable Defense
    // =========================================================================
    turtle: {
        name: "Turtle",
        description: "Defensive: Highly cautious. Clusters tightly, shields constantly, refuses risks.",
        priorityOrder: ['capture', 'spell', 'dodge', 'kill', 'position', 'attack'],
        weights: {
            captureBonus: 8000,    // Still wants to win, but very slowly
            killBonus: 800,        // Will kill if an enemy is exposed and adjacent
            attackBonus: 300,      // Some aggression when grouped
            safeBonus: 1200,       // Prefers safe hexes but not at the cost of all progress
            threatPenalty: -800,   // Cautious but not paralyzed — reduced from -1500
            protectedRangeBonus: 500, // Thrives when units overlap coverage
            friendlySixBonus: 400, // Highly values the protection of an Oracle (Dice 6)
            advanceBonus: 400,     // Slow but steady advance as a group

            isolationPenalty: 350, // Must stay grouped — isolated units get captured
            guardPenalty: -100,    // Fine with guarding, but not infinitely
            mergeOver6Penalty: -20,
            backAndForthPenalty: -500, // Prevent wall oscillation

            teamPositionWeight: 1.0, // Demands tight, adjacent formations for mutual support
            pressureWeight: 0.8,     // Prefers low-pressure, controlled space

            terrainWeights: {
                defenseBonusWeight: 500, // Heavy emphasis on holding defensive terrain
                archerTowerBonus: 100,
                archerMountainBonus: 150,
                mountainMovePenalty: -300, // Hates slow movement through mountains
                losBlockBonus: 600   // Loves using terrain to hide from ranged attacks
            },

            spells: {
                SPELLCAST_SHIELD: 3.0, // Spams shield to maximize survivability
                SPELLCAST_SWAP: 1.5,   // Uses Swap to rescue units from bad spots
                SPELLCAST_SKIRMISH: 0.2, // Rarely uses skirmish (too aggressive)
            }
        },
        riskTolerance: 0.05,       // Almost zero risk
        targetSelection: 'threatRemoval', // Only attacks units breaking its wall
        positioningStyle: 'turtle',
        unitSelection: 'mostThreatened'
    },

    // =========================================================================
    // 6. TACTICIAN - Minimax Board Controller
    // =========================================================================
    tactician: {
        name: "Tactician",
        description: "Strategic Thinker: Uses deep calculation (Minimax) to set traps and control the board.",
        priorityOrder: ['capture', 'spell', 'position', 'kill', 'attack', 'dodge'],
        minimax: true,
        minimaxDepth: 3,
        weights: {
            captureBonus: 10000,   // Strategic focus on the ultimate win condition
            killBonus: 1500,       // Values kills as a means to thin opponent lines
            attackBonus: 300,
            safeBonus: 800,        // High value on positioning units safely for future turns
            threatPenalty: -400,
            protectedRangeBonus: 400,
            friendlySixBonus: 300,
            advanceBonus: 300,

            isolationPenalty: 150, // Board control requires coordinated units, not lone wolves
            guardPenalty: -300,
            mergeOver6Penalty: -400,
            backAndForthPenalty: -600,

            teamPositionWeight: 0.9, // Values group synergy for multi-turn setup logic
            pressureWeight: 0.9,     // Board controller needs strong zone awareness

            terrainWeights: {
                defenseBonusWeight: 200,
                archerTowerBonus: 250,
                archerMountainBonus: 350,
                mountainMovePenalty: -100,
                losBlockBonus: 250
            },

            spells: {
                SPELLCAST_SHIELD: 1.0,
                SPELLCAST_SWAP: 2.5,   // Very high priority for Swap to enable complex setups
                SPELLCAST_SKIRMISH: 1.0,
            }
        },
        riskTolerance: 0.4,
        targetSelection: 'threatRemoval', // Eliminate units that threaten the plan, not just big ones
        positioningStyle: 'balanced',
        unitSelection: 'leastMoved'
    },
};

/**
 * Get a profile by name
 */
function getProfile(name) {
    return heuristicProfiles[name] || heuristicProfiles.baseline;
}

/**
 * Get all profile names
 */
function getProfileNames() {
    return Object.keys(heuristicProfiles);
}

/**
 * Create a mutated copy of a profile
 * @param {string} baseProfileName - Name of the base profile to mutate
 * @param {number} mutationRate - 0-1, how much to mutate weights (0.2 = ±20%)
 */
function mutateProfile(baseProfileName, mutationRate = 0.2) {
    const base = getProfile(baseProfileName);
    const mutated = JSON.parse(JSON.stringify(base)); // Deep clone
    
    mutated.name = `${base.name} (Mutated)`;
    
    // Mutate weights
    for (const key in mutated.weights) {
        if (key === 'terrainWeights' || key === 'spells') {
            for (const subKey in mutated.weights[key]) {
                const original = mutated.weights[key][subKey];
                const variance = original * mutationRate;
                const randomOffset = (Math.random() * 2 - 1) * variance;
                mutated.weights[key][subKey] = Math.round(original + randomOffset);
            }
            continue;
        }
        const original = mutated.weights[key];
        const variance = original * mutationRate;
        const randomOffset = (Math.random() * 2 - 1) * variance; // -variance to +variance
        mutated.weights[key] = Math.round(original + randomOffset);
    }
    
    // Mutate risk tolerance (clamp to 0-1)
    mutated.riskTolerance = Math.max(0, Math.min(1, 
        mutated.riskTolerance + (Math.random() * 0.2 - 0.1)
    ));
    
    // Possibly shuffle priority order (10% chance)
    if (Math.random() < 0.1) {
        // Swap two random priorities
        const i = Math.floor(Math.random() * mutated.priorityOrder.length);
        const j = Math.floor(Math.random() * mutated.priorityOrder.length);
        [mutated.priorityOrder[i], mutated.priorityOrder[j]] = 
        [mutated.priorityOrder[j], mutated.priorityOrder[i]];
    }
    
    return mutated;
}

/**
 * Generate a completely random profile
 */
function generateRandomProfile() {
    const priorities = ['capture', 'kill', 'attack', 'dodge', 'position'];
    const shuffled = priorities.sort(() => Math.random() - 0.5);
    
    return {
        name: "Random",
        description: "Randomly generated heuristic profile",
        priorityOrder: shuffled,
        weights: {
            captureBonus: Math.floor(Math.random() * 5000) + 5000,
            killBonus: Math.floor(Math.random() * 1500) + 500,
            attackBonus: Math.floor(Math.random() * 400) + 50,
            safeBonus: Math.floor(Math.random() * 1500) + 200,
            threatPenalty: Math.floor(Math.random() * -400) - 100,
            protectedRangeBonus: Math.floor(Math.random() * 250) + 25,
            friendlySixBonus: Math.floor(Math.random() * 250) + 50,
            advanceBonus: Math.floor(Math.random() * 90) + 10,
            guardPenalty: Math.floor(Math.random() * -900) - 100,
            mergeOver6Penalty: Math.floor(Math.random() * 600) - 500,
            backAndForthPenalty: -300,
            teamPositionWeight: 0.1,
            pressureWeight: 0.2,
            terrainWeights: {
                defenseBonusWeight: Math.floor(Math.random() * 200) + 50,
                archerTowerBonus: Math.floor(Math.random() * 300) + 50,
                archerMountainBonus: Math.floor(Math.random() * 400) + 50,
                mountainMovePenalty: Math.floor(Math.random() * -200) - 50,
                losBlockBonus: Math.floor(Math.random() * 300) + 50
            }
        },
        riskTolerance: Math.random(),
        targetSelection: ['highestValue', 'lowArmor', 'threatRemoval'][Math.floor(Math.random() * 3)],
        positioningStyle: ['balanced', 'rush', 'turtle', 'flank', 'cluster'][Math.floor(Math.random() * 5)],
        unitSelection: ['leastMoved', 'highestValue', 'lowestValue', 'mostThreatened'][Math.floor(Math.random() * 4)]
    };
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        heuristicProfiles, 
        getProfile, 
        getProfileNames,
        mutateProfile,
        generateRandomProfile
    };
}
