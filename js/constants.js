// deno-lint-ignore-file
const R = 5; // Map size radius
const HEX_SIZE = 60; // pixels
const HEX_WIDTH = HEX_SIZE;
const HEX_HEIGHT = HEX_SIZE * Math.sqrt(3) / 2; // Height of one equilateral triangle half

const EPIC_PRESETS = {
	'E_21': {
		name: 'Standard 21 Dices',
		radius: R,
		noReroll: true,
		dice: [
		     3,
		    3,3,
		   4,6,4,
		  2,2,2,2,
		 4,1,2,1,4,
		1,1,5,5,1,1
		],
	},
	'E_15': {
		name: 'Quick Mode 15 Dices',
		radius: R,
		noReroll: true,
		dice: [
		    3,
		   3,3,
		  4,6,4,
		 2,2,2,2,
		1,1,5,1,1
		],
	}
};

// BIND-EDIT rules.md: ### **4. Dice Soldiers (Unit Types)**
const UNIT_STATS = {
	1: { name: "Fencer", attack: 2, armor: 2, range: 0, distance: 2, movement: '*' },
	2: { name: "Archer", attack: 2, armor: 1, range: 2, distance: 1, movement: '*' },
	3: { name: "Hussar", attack: 3, armor: 0, range: 0, distance: 3, movement: 'L' },
	4: { name: "Knight", attack: 2, armor: 1, range: 0, distance: 3, movement: 'X' },
	5: { name: "Tanker", attack: 1, armor: 4, range: 0, distance: 1, movement: '*' },
	6: { name: "Oracle", attack: 0, armor: 0, range: 2, distance: 1, movement: '*' },
};

const AXES = [
	{i: 0, q: +1, r: -1, name: '2h'},
	{i: 1, q: +1, r: +0, name: '4h'},
	{i: 2, q: +0, r: +1, name: '6h'},
	{i: 3, q: -1, r: +1, name: '8h'},
	{i: 4, q: -1, r: +0, name: '10h'},
	{i: 5, q: +0, r: -1, name: '12h'},
];

const PLAYER_PRIMARY_AXIS = {
	1: [ AXES[5] ],
	2: [ AXES[5], AXES[2] ],
	3: [ AXES[5], AXES[3], AXES[1] ],
	4: [ AXES[4], AXES[3], AXES[0], AXES[1] ],
	// 5: [ AXES[5], AXES[3], AXES[0], AXES[2], AXES[4] ],
	6: [ AXES[5], AXES[2], AXES[0], AXES[3], AXES[4], AXES[1] ],
};

const PLAYER_CONFIG = [
	{ id: 0, color: 'Blue', sprite: 'blue', bg: 'bg-hexblue', logColor: 'text-blue-700' },
	{ id: 1, color: 'Red', sprite: 'red', bg: 'bg-hexred', logColor: 'text-red-700' },
	{ id: 2, color: 'Green', sprite: 'green', bg: 'bg-hexgreen', logColor: 'text-green-700' },
	{ id: 3, color: 'Purple', sprite: 'purple', bg: 'bg-hexpurple', logColor: 'text-purple-700' },
	{ id: 4, color: 'Black', sprite: 'shadow', bg: 'bg-hexwhite', logColor: 'text-gray-700' },
	{ id: 5, color: 'Yellow', sprite: 'sepia', bg: 'bg-hexyellow', logColor: 'text-yellow-700' },
];

const TERRAIN_CONFIG = {
	'PLAIN': { color: 'Plain', bg: 'bg-hexplain', logColor: 'text-gray-500' },
	'FOREST': { color: 'Forest', bg: 'bg-hexforest', logColor: 'text-green-800' },
	'LAKE': { color: 'Lake', bg: 'bg-hexlake', logColor: 'text-blue-500' },
	'TOWER': { color: 'Tower', bg: 'bg-hextower', logColor: 'text-purple-600' },
	'MOUNTAIN': { color: 'Mountain', bg: 'bg-hexmountain', logColor: 'text-gray-700' },
};

// Autochess Balance Configuration
const AUTOCHESS_CONFIG = {
	BASE_HP: 100,
	WIN_REROLLS: 2,
	LOSS_REROLLS: 1,
	VETERAN_ATK_BONUS: 2,      // Temporary bonus for surviving units (per round survived)
	VETERAN_HP_BONUS: 50,      // Temporary bonus for surviving units (per round survived)
	ENEMY_COUNT_BASE: 3,
	ENEMY_COUNT_GROWTH: 0.5,   // Round * 0.5 additional units
	ENEMY_STAT_GROWTH: 0.2,    // Round * 0.2 additional ATK/ARMOR for enemies
	ROUND_TIME_LIMIT: 60,      // Seconds
	MAX_ROUND: 10,
};

const RMI_TERRAIN_PALETTE = {
	'PLAIN':    [50, 0.6, 0.7], // Grass Green Hue (approx 80-120)
	'FOREST':   [120, 0.7, 0.4], // Darker Green Hue
	'LAKE':     [235, 0.6, 0.6], // Blue Hue
	'TOWER':    [280, 0.6, 0.6], // Purple Hue
	'MOUNTAIN': [30, 0.5, 0.5],  // Brown/Orange Hue
};

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
