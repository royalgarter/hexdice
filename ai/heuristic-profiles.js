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
            advanceBonus: 300,     // Reward for moving closer to enemy objectives
            protectedRangeBonus: 100, // Reward for positioning where allies provide cover

            threatPenalty: -400,   // Penalty for being in range of enemy attacks
            guardPenalty: -500,    // Penalty for guarding (prevents excessive passivity)
            mergeOver6Penalty: -500, // Penalty for merging dice into a value > 6 (loss of value)
            backAndForthPenalty: -1000, // Penalty for repetitive movement loops

            teamPositionWeight: 0.6, // Relative importance of overall team formation
            pressureWeight: 0.5,     // Relative importance of space control (Zone of Control)

            terrainWeights: {
                defenseBonusWeight: 100, // Bonus for holding defensive terrain
                archerTowerBonus: 200,    // Extra range bonus for Archers on Towers
                archerMountainBonus: 300, // Extra range bonus for Archers on Mountains
                mountainMovePenalty: -150, // Cost adjustment for entering Mountains
                losBlockBonus: 150       // Value of using terrain to block Line of Sight
            },

            spells: {
                SPELLCAST_SHIELD: 0.8,   // Relative priority of Shield spell
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
            advanceBonus: 100,     // Low advancement; wants to stay in its "nest"

            guardPenalty: -200,    // Occasional guarding is okay
            mergeOver6Penalty: -100,
            backAndForthPenalty: -200,

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
        minimax: true,             // Kept
        minimaxDepth: 2,
        weights: {
            captureBonus: 8000,    // Objective is a distraction/backup plan
            killBonus: 5000,       // Very high priority on eliminating specific weak units
            attackBonus: 800,
            safeBonus: 600,        // Prefers to end turns hidden or safe after a strike
            threatPenalty: -350,
            protectedRangeBonus: 75,
            friendlySixBonus: 100,
            advanceBonus: 400,     // High mobility; values closing in for the kill

            guardPenalty: -400,
            mergeOver6Penalty: -450,
            backAndForthPenalty: -300,

            teamPositionWeight: 0.3, // Operates as a lone wolf; doesn't need teammates
            pressureWeight: 0.3,     // Doesn't care about zone control, only the target

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
    // 4. BERSERKER - Suicidal Aggression
    // =========================================================================
    berserker: {
        name: "Berserker",
        description: "Bloodthirsty: Rushes forward recklessly. Ignores terrain and safety to kill.",
        priorityOrder: ['kill', 'attack', 'capture', 'position', 'spell', 'dodge'],
        weights: {
            captureBonus: 2000,    // Objective secondary to bloodlust
            killBonus: 8000,       // Massive kill incentive for primary persona
            attackBonus: 2000,     // High aggression even if not lethal
            safeBonus: 0,          // Literally does not care about being safe
            threatPenalty: 0,      // Does not fear enemy attacks or retaliation
            protectedRangeBonus: 0, // No interest in defensive cover
            friendlySixBonus: 0,   // No interest in support proximity
            advanceBonus: 2500,    // Extreme rush incentive to close distance

            guardPenalty: -5000,   // Hates standing still; guarding is for cowards
            mergeOver6Penalty: -100, // Merging is fine if it keeps units alive to kill more
            backAndForthPenalty: -100, // Repetition doesn't bother a berserker

            teamPositionWeight: 0.1, // Doesn't care about formation or synergy
            pressureWeight: -0.8,    // Actively seeks out high-pressure (crowded) hexes

            terrainWeights: {      // Blindly ignores terrain tactics in favor of speed
                defenseBonusWeight: 0,
                archerTowerBonus: 0,
                archerMountainBonus: 0,
                mountainMovePenalty: 0,
                losBlockBonus: 0
            },

            spells: {
                SPELLCAST_SHIELD: 0.1,  // Shielding is too defensive
                SPELLCAST_SWAP: 0.5,    // Swapping is only for positioning
                SPELLCAST_SKIRMISH: 3.0, // Loves skirmish to deal extra damage/attacks
            }
        },
        riskTolerance: 1.0,        // Maximum recklessness
        targetSelection: 'highestValue',
        positioningStyle: 'rush',
        unitSelection: 'highestValue' // Leads the charge with best units
    },

    // =========================================================================
    // 5. TURTLE - Impenetrable Defense
    // =========================================================================
    turtle: {
        name: "Turtle",
        description: "Defensive: Highly cautious. Clusters tightly, shields constantly, refuses risks.",
        priorityOrder: ['dodge', 'spell', 'capture', 'position', 'kill', 'attack'],
        weights: {
            captureBonus: 8000,    // Still wants to win, but very slowly
            killBonus: 500,        // Low priority on killing if it means leaving safety
            attackBonus: 100,      // Very low aggression
            safeBonus: 3000,       // Obsessed with safe hexes to preserve units
            threatPenalty: -1500,  // Terrified of ending turns in enemy threat range
            protectedRangeBonus: 500, // Thrives when units overlap coverage
            friendlySixBonus: 400, // Highly values the protection of an Oracle (Dice 6)
            advanceBonus: 50,      // Barely advances; waits for the enemy to come

            guardPenalty: -50,     // Perfectly happy guarding to boost defense
            mergeOver6Penalty: -20, // Willing to merge to keep HP/Armor high
            backAndForthPenalty: -100, // Repetition is fine if it maintains the wall

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
        minimax: true,             // Kept
        minimaxDepth: 2,
        weights: {
            captureBonus: 10000,   // Strategic focus on the ultimate win condition
            killBonus: 1500,       // Values kills as a means to thin opponent lines
            attackBonus: 300,
            safeBonus: 800,        // High value on positioning units safely for future turns
            threatPenalty: -400,
            protectedRangeBonus: 400,
            friendlySixBonus: 300,
            advanceBonus: 300,

            guardPenalty: -300,
            mergeOver6Penalty: -400,
            backAndForthPenalty: -300,

            teamPositionWeight: 0.9, // Values group synergy for multi-turn setup logic
            pressureWeight: 0.4,     // Space control is important but secondary to synergy

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
        targetSelection: 'highestValue',
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
