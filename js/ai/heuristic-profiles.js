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
            advanceBonus: 600,     // Reward for moving closer to enemy objectives
            protectedRangeBonus: 100, // Reward for positioning where allies provide cover

            threatPenalty: -400,   // Penalty for being in range of enemy attacks
            guardPenalty: -200,    // Mild penalty — Guard is a valid action now, just not spammable
            mergeOver6Penalty: -500,
            backAndForthPenalty: -1000,

            teamPositionWeight: 0.6, // Relative importance of overall team formation
            pressureWeight: 0.8,     // Space control — lower to prevent friendly-cluster attractor loops
            focusFireBonus: 120,     // Reward threatening an enemy already threatened by an ally

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
            advanceBonus: 150,     // Slightly proactive when no tower available

            guardPenalty: -200,    // Occasional guarding is okay
            mergeOver6Penalty: -100,
            backAndForthPenalty: -600, // Strong — prevents Tower-to-Tower oscillation

            teamPositionWeight: 0.4,
            pressureWeight: 0.7,     // Values board control from a distance
            focusFireBonus: 150,     // Concentrates fire with allies before enemies close in

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
            advanceBonus: 400,     // High mobility; values closing in for the kill

            guardPenalty: -400,
            mergeOver6Penalty: -450,
            backAndForthPenalty: -600, // Prevents stalking oscillation around same target

            teamPositionWeight: 0.3, // Lone wolf — doesn't need teammates
            pressureWeight: 0.7,     // Zone-aware when repositioning between targets
            focusFireBonus: 200,     // Sets up coordinated executions on tough targets

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
            captureBonus: 5000,    // Base capture remains very high priority
            killBonus: 3000,       // Kills — strong but not all-consuming
            attackBonus: 1500,     // Damage even if not lethal
            safeBonus: 250,        // Small: slightly prefer not dying for nothing
            threatPenalty: -200,   // Small fear — won't charge into 3 enemies with no kill in sight
            protectedRangeBonus: 0,
            friendlySixBonus: 50,  // Slight awareness of Oracle support
            advanceBonus: 1200,    // Aggressive advance but not suicidal

            guardPenalty: -1500,   // Hates guarding but won't die just to avoid it
            mergeOver6Penalty: -200,
            backAndForthPenalty: -300,

            teamPositionWeight: 0.25, // Slight formation awareness — don't charge alone into 3
            pressureWeight: 0.8,      // Seek enemies (positive: move toward them, not into death zones)
            focusFireBonus: 150,      // Piles onto targets allies already engage
            immediateDeathPenalty: -150, // Half fear of dying — trades are the plan
            roleWeights: { kitingAdjacentPenalty: -200, bodyguard: 50 }, // Archers brawl too

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
        priorityOrder: ['dodge', 'spell', 'capture', 'position', 'kill', 'attack'],
        weights: {
            captureBonus: 8000,    // Still wants to win, but very slowly
            killBonus: 500,        // Low priority on killing if it means leaving safety
            attackBonus: 100,      // Very low aggression
            safeBonus: 3000,       // Obsessed with safe hexes to preserve units
            threatPenalty: -1500,  // Terrified of ending turns in enemy threat range
            protectedRangeBonus: 500, // Thrives when units overlap coverage
            friendlySixBonus: 400, // Highly values the protection of an Oracle (Dice 6)
            advanceBonus: 200,     // Cautious advance while maintaining defensive stance

            guardPenalty: -100,    // Fine with guarding, but not infinitely
            mergeOver6Penalty: -20,
            backAndForthPenalty: -500, // Prevent wall oscillation

            teamPositionWeight: 1.0, // Demands tight, adjacent formations for mutual support
            pressureWeight: 0.8,     // Prefers low-pressure, controlled space
            focusFireBonus: 80,      // Mild — only gangs up when already safe
            immediateDeathPenalty: -600, // Doubly terrified of losing any unit
            roleWeights: { kitingAdjacentPenalty: -700, bodyguard: 250, supportAdjacency: 50 },

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

            guardPenalty: -300,
            mergeOver6Penalty: -400,
            backAndForthPenalty: -600,

            teamPositionWeight: 0.9, // Values group synergy for multi-turn setup logic
            pressureWeight: 0.9,     // Board controller needs strong zone awareness
            focusFireBonus: 180,     // Kill-zone setups are its signature play

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
 * Seeded RNG (mulberry32) for reproducible evolution runs. Returns a () => [0,1) function.
 */
function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Weights the AI reads with a `?? default`. Profiles that omit them can't be mutated, so evolution materialises them.
const ROLE_WEIGHT_DEFAULTS = {
    flankerEdge: 20, flankerKillSetup: 200, frontlineCenter: 15,
    supportAdjacency: 30, supportFarPenalty: 40, supportInRange: 60,
    kitingOptimal: 200, kitingSetup: 300, kitingAdjacentPenalty: -500, bodyguard: 150,
};
const TOP_LEVEL_WEIGHT_DEFAULTS = { selfBlockPenalty: -80, immediateDeathPenalty: -300, focusFireBonus: 120 };
const NESTED_WEIGHT_KEYS = ['terrainWeights', 'spells', 'roleWeights'];
const FLOAT_RANGES = { teamPositionWeight: [0, 2], pressureWeight: [0, 2] };
const PRIORITY_SET = ['capture', 'kill', 'attack', 'spell', 'dodge', 'position'];

/**
 * Deep copy with every AI-read weight present, so all of them can evolve.
 */
function completeProfile(profile) {
    const full = JSON.parse(JSON.stringify(profile));
    full.weights = full.weights || {};
    for (const k in TOP_LEVEL_WEIGHT_DEFAULTS) {
        if (full.weights[k] === undefined) full.weights[k] = TOP_LEVEL_WEIGHT_DEFAULTS[k];
    }
    full.weights.roleWeights = Object.assign({}, ROLE_WEIGHT_DEFAULTS, full.weights.roleWeights || {});
    return full;
}

function _clampWeight(key, v, group) {
    if (!Number.isFinite(v)) return 0;
    if (group === 'spells') return Math.max(0, Math.min(4, v));
    if (FLOAT_RANGES[key]) return Math.max(FLOAT_RANGES[key][0], Math.min(FLOAT_RANGES[key][1], v));
    // supportFarPenalty is a positive magnitude that the AI subtracts; every other *Penalty is stored negative
    if (key === 'supportFarPenalty') return Math.max(0, v);
    if (/Penalty$/.test(key)) return Math.min(0, v);
    return Math.max(0, v);
}

/**
 * Force a (possibly mutated/crossed) profile back into legal ranges. Mutates and returns it.
 */
function clampProfile(profile) {
    const w = profile.weights;
    for (const key in w) {
        if (NESTED_WEIGHT_KEYS.includes(key)) {
            for (const sub in w[key]) w[key][sub] = _clampWeight(sub, w[key][sub], key);
            continue;
        }
        w[key] = _clampWeight(key, w[key], null);
    }
    profile.riskTolerance = Math.max(0, Math.min(1, profile.riskTolerance));
    // priorityOrder must stay a permutation of the profile's own priorities (no duplicates, nothing invented)
    const seen = new Set();
    profile.priorityOrder = profile.priorityOrder.filter(p => PRIORITY_SET.includes(p) && !seen.has(p) && seen.add(p));
    return profile;
}

/**
 * Create a mutated copy of a profile
 * @param {string|object} base - Profile name or profile object
 * @param {number} mutationRate - 0-1, how much to mutate weights (0.2 = ±20%)
 * @param {function} rng - () => [0,1); defaults to Math.random. Pass makeRng(seed) for reproducible runs.
 */
function mutateProfile(base, mutationRate = 0.2, rng = Math.random) {
    const baseProfile = typeof base === 'string' ? getProfile(base) : base;
    const mutated = completeProfile(baseProfile);
    
    mutated.name = `${baseProfile.name} (Mutated)`;
    
    // Mutate weights. Small float-scale weights (multipliers < 10) must not be rounded to ints.
    // Zero-valued weights get an absolute nudge, otherwise they could never evolve.
    const mutateValue = (original) => {
        const scale = original === 0 ? (mutationRate * 50) : Math.abs(original) * mutationRate;
        const result = original + (rng() * 2 - 1) * scale;
        return Math.abs(original) < 10 && original !== 0 ? Math.round(result * 100) / 100 : Math.round(result);
    };
    for (const key in mutated.weights) {
        if (NESTED_WEIGHT_KEYS.includes(key)) {
            for (const subKey in mutated.weights[key]) {
                mutated.weights[key][subKey] = mutateValue(mutated.weights[key][subKey]);
            }
            continue;
        }
        mutated.weights[key] = mutateValue(mutated.weights[key]);
    }
    
    mutated.riskTolerance = mutated.riskTolerance + (rng() * 0.2 - 0.1);
    
    // Possibly shuffle priority order (10% chance)
    if (rng() < 0.1) {
        const i = Math.floor(rng() * mutated.priorityOrder.length);
        const j = Math.floor(rng() * mutated.priorityOrder.length);
        [mutated.priorityOrder[i], mutated.priorityOrder[j]] = 
        [mutated.priorityOrder[j], mutated.priorityOrder[i]];
    }
    
    return clampProfile(mutated);
}

/**
 * Uniform crossover: each weight (including nested ones) comes from parent A or B.
 */
function crossoverProfiles(a, b, rng = Math.random) {
    const pa = completeProfile(typeof a === 'string' ? getProfile(a) : a);
    const pb = completeProfile(typeof b === 'string' ? getProfile(b) : b);
    const child = completeProfile(pa);
    child.name = `${pa.name} x ${pb.name}`;
    const pick = (x, y) => (rng() < 0.5 ? x : y);
    for (const key in child.weights) {
        if (NESTED_WEIGHT_KEYS.includes(key)) {
            for (const sub in child.weights[key]) {
                child.weights[key][sub] = pick(pa.weights[key][sub], pb.weights[key]?.[sub] ?? pa.weights[key][sub]);
            }
            continue;
        }
        child.weights[key] = pick(pa.weights[key], pb.weights[key] ?? pa.weights[key]);
    }
    child.riskTolerance = pick(pa.riskTolerance, pb.riskTolerance);
    child.priorityOrder = pick(pa, pb).priorityOrder.slice();
    for (const trait of ['targetSelection', 'positioningStyle', 'unitSelection']) child[trait] = pick(pa[trait], pb[trait]);
    return clampProfile(child);
}

/**
 * Generate a completely random profile
 */
function generateRandomProfile(rng = Math.random) {
    const priorities = ['capture', 'kill', 'attack', 'dodge', 'position'];
    const shuffled = priorities.map(p => [rng(), p]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
    const int = (range, min) => Math.floor(rng() * range) + min;
    const choice = (arr) => arr[Math.floor(rng() * arr.length)];
    
    return clampProfile(completeProfile({
        name: "Random",
        description: "Randomly generated heuristic profile",
        priorityOrder: shuffled,
        weights: {
            captureBonus: int(5000, 5000),
            killBonus: int(1500, 500),
            attackBonus: int(400, 50),
            safeBonus: int(1500, 200),
            threatPenalty: -int(400, 100),
            protectedRangeBonus: int(250, 25),
            friendlySixBonus: int(250, 50),
            advanceBonus: int(90, 10),
            guardPenalty: -int(900, 100),
            mergeOver6Penalty: -int(500, 20),
            backAndForthPenalty: -300,
            teamPositionWeight: 0.1,
            pressureWeight: 0.2,
            focusFireBonus: int(200, 50),
            spells: {
                SPELLCAST_SHIELD: rng() * 2 + 0.3,
                SPELLCAST_SWAP: rng() * 2 + 0.3,
                SPELLCAST_SKIRMISH: rng() * 2 + 0.3
            },
            terrainWeights: {
                defenseBonusWeight: int(200, 50),
                archerTowerBonus: int(300, 50),
                archerMountainBonus: int(400, 50),
                mountainMovePenalty: -int(200, 50),
                losBlockBonus: int(300, 50)
            }
        },
        riskTolerance: rng(),
        targetSelection: choice(['highestValue', 'lowArmor', 'threatRemoval']),
        positioningStyle: choice(['balanced', 'rush', 'turtle', 'flank', 'cluster']),
        unitSelection: choice(['leastMoved', 'highestValue', 'lowestValue', 'mostThreatened'])
    }));
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        heuristicProfiles, 
        getProfile, 
        getProfileNames,
        mutateProfile,
        generateRandomProfile,
        crossoverProfiles,
        completeProfile,
        clampProfile,
        makeRng
    };
}
