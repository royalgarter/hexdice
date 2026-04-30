/**
 * Heuristic Strategy Profiles for Hex Dice AI
 * 
 * Each profile defines:
 * - priorityOrder: Action priority list (highest to lowest)
 * - weights: Scoring bonuses/penalties for various situations
 * - riskTolerance: 0-1 scale (0 = extremely cautious, 1 = reckless)
 * - targetSelection: How to choose among multiple targets
 * - positioningStyle: General positioning preference
 * - unitSelection: Which unit to prioritize for actions
 */

const heuristicProfiles = {
    // =========================================================================
    // BASELINE - Original heuristic behavior
    // =========================================================================
    baseline: {
        name: "Baseline",
        priorityOrder: ['capture', 'kill', 'attack', 'spell', 'dodge', 'position'],
        weights: {
            captureBonus: 10000,
            killBonus: 1000,
            attackBonus: 500,
            safeBonus: 400,
            friendlySixBonus: 50,
            advanceBonus: 500,
            protectedRangeBonus: 100,

            threatPenalty: -400,
            guardPenalty: -500,
            mergeOver6Penalty: -500,
            backAndForthPenalty: -1000,

            teamPositionWeight: 0.6,
            pressureWeight: 0.5,

            terrainWeights: {
                defenseBonusWeight: 100,
                archerTowerBonus: 200,
                archerMountainBonus: 300,
                mountainMovePenalty: -150,
                losBlockBonus: 150
            },

            spells: {
                SPELLCAST_SHIELD: 0.8,
                SPELLCAST_SWAP: 0.8,
                SPELLCAST_SKIRMISH: 1.2,
            }
        },
        riskTolerance: 0.5,
        targetSelection: 'highestValue',
        positioningStyle: 'balanced',
        unitSelection: 'leastMoved'
    },

    // =========================================================================
    // BERSERKER - Aggressive kill-focused strategy
    // =========================================================================
    berserker: {
        name: "Berserker",
        description: "Aggressive: Prioritizes kills over safety, rushes enemy",
        priorityOrder: ['capture', 'kill', 'attack', 'spell', 'dodge', 'position'],
        weights: {
            captureBonus: 10000,
            killBonus: 2000,
            attackBonus: 500,
            safeBonus: 200,
            threatPenalty: -100,
            protectedRangeBonus: 25,
            friendlySixBonus: 50,
            advanceBonus: 800,
            guardPenalty: -1000,
            mergeOver6Penalty: -200,
            backAndForthPenalty: -300,
            teamPositionWeight: 0.4,
            pressureWeight: 0.2,
            terrainWeights: {
                defenseBonusWeight: 50,
                archerTowerBonus: 300,
                archerMountainBonus: 400,
                mountainMovePenalty: -50,
                losBlockBonus: 50
            },
            spells: {
                SPELLCAST_SHIELD: 0.4,
                SPELLCAST_SWAP: 0.6,
                SPELLCAST_SKIRMISH: 2.0,
            }
        },
        riskTolerance: 0.9,
        targetSelection: 'highestValue',
        positioningStyle: 'rush',
        unitSelection: 'highestValue'
    },

    // =========================================================================
    // TURTLE - Defensive safety-focused strategy
    // =========================================================================
    turtle: {
        name: "Turtle",
        description: "Defensive: Safety first, only attacks when safe",
        priorityOrder: ['capture', 'spell', 'dodge', 'position', 'kill', 'attack'],
        weights: {
            captureBonus: 10000,
            killBonus: 800,
            attackBonus: 100,
            safeBonus: 2000,
            threatPenalty: -600,
            protectedRangeBonus: 200,
            friendlySixBonus: 300,
            advanceBonus: 100,
            guardPenalty: -100,
            mergeOver6Penalty: -50,
            backAndForthPenalty: -300,
            teamPositionWeight: 0.7,
            pressureWeight: 0.4,
            terrainWeights: {
                defenseBonusWeight: 300,
                archerTowerBonus: 150,
                archerMountainBonus: 200,
                mountainMovePenalty: -200,
                losBlockBonus: 400
            },
            spells: {
                SPELLCAST_SHIELD: 1.5,
                SPELLCAST_SWAP: 0.8,
                SPELLCAST_SKIRMISH: 0.5,
            }
        },
        riskTolerance: 0.1,
        targetSelection: 'threatRemoval',
        positioningStyle: 'turtle',
        unitSelection: 'mostThreatened'
    },

    // =========================================================================
    // TACTICIAN - Position-focused strategic play
    // =========================================================================
    tactician: {
        name: "Tactician",
        description: "Strategic: Sets up advantageous positions before engaging",
        priorityOrder: ['capture', 'spell', 'position', 'kill', 'attack', 'dodge'],
        weights: {
            captureBonus: 10000,
            killBonus: 1500,
            attackBonus: 300,
            safeBonus: 800,
            threatPenalty: -400,
            protectedRangeBonus: 400,
            friendlySixBonus: 300,
            advanceBonus: 300,
            guardPenalty: -300,
            mergeOver6Penalty: -400,
            backAndForthPenalty: -300,
            teamPositionWeight: 0.9,
            pressureWeight: 0.4,
            terrainWeights: {
                defenseBonusWeight: 200,
                archerTowerBonus: 250,
                archerMountainBonus: 350,
                mountainMovePenalty: -100,
                losBlockBonus: 250
            },
            spells: {
                SPELLCAST_SHIELD: 1.0,
                SPELLCAST_SWAP: 1.5,
                SPELLCAST_SKIRMISH: 1.0,
            }
        },
        riskTolerance: 0.4,           // Moderate-low risk
        targetSelection: 'lowArmor',      // Pick easy fights
        positioningStyle: 'flank',        // Avoid front lines
        unitSelection: 'leastMoved'       // Efficient unit usage
    },

    // =========================================================================
    // ASSASSIN - Precision strike specialist
    // =========================================================================
    assassin: {
        name: "Assassin",
        description: "Precision: Targets weak points and high-value enemies",
        priorityOrder: ['capture', 'kill', 'attack', 'spell', 'dodge', 'position'],
        weights: {
            captureBonus: 10000,
            killBonus: 1800,
            attackBonus: 300,
            safeBonus: 600,
            threatPenalty: -350,
            protectedRangeBonus: 75,
            friendlySixBonus: 100,
            advanceBonus: 250,        // Increased from 60
            guardPenalty: -400,
            mergeOver6Penalty: -450,
            backAndForthPenalty: -300,
            teamPositionWeight: 0.5,
            pressureWeight: 0.3,
            terrainWeights: {
                defenseBonusWeight: 100,
                archerTowerBonus: 150,
                archerMountainBonus: 200,
                mountainMovePenalty: -50,
                losBlockBonus: 200
            },
            spells: {
                SPELLCAST_SHIELD: 0.5,
                SPELLCAST_SWAP: 1.2,
                SPELLCAST_SKIRMISH: 1.5,
            }
        },
        riskTolerance: 0.6,           // Moderate-high risk for good targets
        targetSelection: 'lowArmor',      // Pick easiest kills
        positioningStyle: 'flank',        // Find weak spots
        unitSelection: 'highestValue'     // Use best units for kills
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
