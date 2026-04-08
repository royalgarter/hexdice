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
        description: "Balanced: Kill → Position → Attack → Dodge",
        priorityOrder: ['capture', 'kill', 'position', 'attack', 'dodge'],
        weights: {
            captureBonus: 10000,
            killBonus: 1200,
            attackBonus: 100,
            safeBonus: 500,
            threatPenalty: -250,
            protectedRangeBonus: 100,
            friendlySixBonus: 150,
            advanceBonus: 80,
            guardPenalty: -500,
            mergeOver6Penalty: -500,
            backAndForthPenalty: -300,
            teamPositionWeight: 0.7,
            pressureWeight: 0.3
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
        priorityOrder: ['capture', 'kill', 'position', 'attack', 'dodge'],
        weights: {
            captureBonus: 10000,
            killBonus: 2000,
            attackBonus: 500,
            safeBonus: 200,
            threatPenalty: -100,
            protectedRangeBonus: 25,
            friendlySixBonus: 50,
            advanceBonus: 150,
            guardPenalty: -1000,
            mergeOver6Penalty: -200,
            backAndForthPenalty: -300,
            teamPositionWeight: 0.3,
            pressureWeight: 0.1
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
        priorityOrder: ['capture', 'dodge', 'position', 'kill', 'attack'],
        weights: {
            captureBonus: 10000,
            killBonus: 500,
            attackBonus: 50,
            safeBonus: 2000,
            threatPenalty: -500,
            protectedRangeBonus: 200,
            friendlySixBonus: 300,
            advanceBonus: 20,
            guardPenalty: -100,
            mergeOver6Penalty: -50,
            backAndForthPenalty: -300,
            teamPositionWeight: 0.6,
            pressureWeight: 0.3
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
        priorityOrder: ['capture', 'position', 'kill', 'attack', 'dodge'],
        weights: {
            captureBonus: 10000,
            killBonus: 1500,
            attackBonus: 200,
            safeBonus: 500,
            threatPenalty: -300,
            protectedRangeBonus: 400,
            friendlySixBonus: 300,
            advanceBonus: 120,
            guardPenalty: -300,
            mergeOver6Penalty: -400,
            backAndForthPenalty: -300,
            teamPositionWeight: 0.8,
            pressureWeight: 0.3
        },
        riskTolerance: 0.4,           // Moderate-low risk
        targetSelection: 'lowArmor',      // Pick easy fights
        positioningStyle: 'flank',        // Avoid front lines
        unitSelection: 'leastMoved'       // Efficient unit usage
    },

    // =========================================================================
    // SWARMER - Merge-focused unit value maximizer
    // =========================================================================
    swarmer: {
        name: "Swarmer",
        description: "Merge-focused: Creates high-value units through merging",
        priorityOrder: ['capture', 'kill', 'position', 'attack', 'dodge'],
        weights: {
            captureBonus: 10000,
            killBonus: 1200,
            attackBonus: 150,
            safeBonus: 400,
            threatPenalty: -200,
            protectedRangeBonus: 100,
            friendlySixBonus: 150,
            advanceBonus: 30,         // Slow, methodical advance
            guardPenalty: -200,
            mergeOver6Penalty: 200,   // Bonus for merging over 6!
            backAndForthPenalty: -300,
            teamPositionWeight: 0.5,
            pressureWeight: 0.3
        },
        riskTolerance: 0.3,           // Cautious with valuable units
        targetSelection: 'highestValue',
        positioningStyle: 'cluster',      // Stay together for merges
        unitSelection: 'lowestValue'      // Sacrifice low units for merges
    },

    // =========================================================================
    // ASSASSIN - Precision strike specialist
    // =========================================================================
    assassin: {
        name: "Assassin",
        description: "Precision: Targets weak points and high-value enemies",
        priorityOrder: ['capture', 'kill', 'attack', 'dodge', 'position'],
        weights: {
            captureBonus: 10000,
            killBonus: 1800,
            attackBonus: 300,
            safeBonus: 600,
            threatPenalty: -350,
            protectedRangeBonus: 75,
            friendlySixBonus: 100,
            advanceBonus: 60,
            guardPenalty: -400,
            mergeOver6Penalty: -450,
            backAndForthPenalty: -300,
            teamPositionWeight: 0.5,
            pressureWeight: 0.3
        },
        riskTolerance: 0.6,           // Moderate-high risk for good targets
        targetSelection: 'lowArmor',      // Pick easiest kills
        positioningStyle: 'flank',        // Find weak spots
        unitSelection: 'highestValue'     // Use best units for kills
    },

    // =========================================================================
    // VANGUARD - Front-line map control specialist
    // =========================================================================
    vanguard: {
        name: "Vanguard",
        description: "Front-line pusher: Aggressively pushes for ground, values map control",
        priorityOrder: ['capture', 'position', 'kill', 'attack', 'dodge'],
        weights: {
            captureBonus: 10000,
            killBonus: 1200,
            attackBonus: 200,
            safeBonus: 400,
            threatPenalty: -200,
            protectedRangeBonus: 100,
            friendlySixBonus: 150,
            advanceBonus: 150,        // High advancement bonus
            guardPenalty: -400,
            mergeOver6Penalty: -300,
            backAndForthPenalty: -400, // Extra penalty for retreating
            teamPositionWeight: 0.6,    // Strong focus on collective advancement
            pressureWeight: 0.3
        },
        riskTolerance: 0.7,
        targetSelection: 'highestValue',
        positioningStyle: 'rush',
        unitSelection: 'leastMoved'
    },

    // =========================================================================
    // SNIPER - Cautious long-range specialist
    // =========================================================================
    sniper: {
        name: "Sniper",
        description: "Cautious assassin: Stays safe, takes shots from distance, hates being touched",
        priorityOrder: ['capture', 'dodge', 'attack', 'kill', 'position'],
        weights: {
            captureBonus: 10000,
            killBonus: 1500,
            attackBonus: 1000,       // Values ranged harass even if not lethal
            safeBonus: 2000,         // Extremely values safety
            threatPenalty: -800,     // Hates being threatened
            protectedRangeBonus: 150,
            friendlySixBonus: 200,
            advanceBonus: 20,
            guardPenalty: -200,
            mergeOver6Penalty: -500,
            backAndForthPenalty: -200,
            teamPositionWeight: 0.4,
            pressureWeight: 0.3
        },
        riskTolerance: 0.1,          // Very low risk
        targetSelection: 'lowArmor',
        positioningStyle: 'flank',
        unitSelection: 'mostThreatened'
    },

    // =========================================================================
    // JUGGERNAUT - Heavy formation specialist
    // =========================================================================
    juggernaut: {
        name: "Juggernaut",
        description: "Moving fortress: Slow, methodical, indestructible formation",
        priorityOrder: ['capture', 'kill', 'position', 'attack', 'dodge'],
        weights: {
            captureBonus: 10000,
            killBonus: 1200,
            attackBonus: 150,
            safeBonus: 800,
            threatPenalty: -150,     // Not very bothered by threats due to armor
            protectedRangeBonus: 400, // Extremely values being grouped
            friendlySixBonus: 500,    // Extremely values Legate protection
            advanceBonus: 30,         // Slow advancement
            guardPenalty: -100,       // Willing to guard
            mergeOver6Penalty: -100,
            backAndForthPenalty: -300,
            teamPositionWeight: 0.8,    // Maximum focus on team formation
            pressureWeight: 0.3
        },
        riskTolerance: 0.3,
        targetSelection: 'threatRemoval',
        positioningStyle: 'turtle',
        unitSelection: 'highestValue'
    },

    // =========================================================================
    // STALKER - Precision flanking specialist
    // =========================================================================
    stalker: {
        name: "Stalker",
        description: "Precision hunter: Flanks and eliminates threats one by one",
        priorityOrder: ['capture', 'kill', 'dodge', 'attack', 'position'],
        weights: {
            captureBonus: 10000,
            killBonus: 2500,         // Extremely high value on kills
            attackBonus: 400,
            safeBonus: 600,
            threatPenalty: -400,
            protectedRangeBonus: 50,
            friendlySixBonus: 100,
            advanceBonus: 80,
            guardPenalty: -600,
            mergeOver6Penalty: -400,
            backAndForthPenalty: -500, // Prefers to keep moving
            teamPositionWeight: 0.3,
            pressureWeight: 0.3
        },
        riskTolerance: 0.8,          // High risk for high reward kills
        targetSelection: 'highestValue',
        positioningStyle: 'flank',
        unitSelection: 'highestValue'
    }
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
            pressureWeight: 0.2
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
