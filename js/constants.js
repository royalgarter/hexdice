// deno-lint-ignore-file
const R = 5; // Map size radius
const HEX_SIZE = 60; // pixels
const HEX_WIDTH = HEX_SIZE;
const HEX_HEIGHT = HEX_SIZE * Math.sqrt(3) / 2; // Height of one equilateral triangle half

const HEXDICE_CDN = 'https://cdn.rwatimes.io/hexdice';
window.HEXDICE_CDN = HEXDICE_CDN;

const EPIC_PRESETS = {
	'E_21': {
		name: 'Standard 21 Dices',
		radius: R,
		noReroll: true,
		dice: [
		     2,
		    3,3,
		   3,6,3,
		  2,2,2,2,
		 4,1,4,1,4,
		1,5,1,1,5,1
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
	{ id: 0, color: 'Blue', sprite: 'yellow', bg: 'bg-hexblue', logColor: 'text-blue-700' },
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

const EMPIRES = {
	'Aztec': 	{ unit: 1, flag: '🇲🇽', alias: 'Persian 🇮🇷', name: `Taka Warrior [D1-${UNIT_STATS[1].name}]`, buff: '+1 Armor' },
	'Briton': 	{ unit: 2, flag: '🇬🇧', alias: 'Celtic 🇬🇧', name: `Longbow Ranger [D2-${UNIT_STATS[2].name}]`, buff: '+1 Range' },
	'Mongol': 	{ unit: 3, flag: '🇲🇳', alias: 'Greek 🇬🇷', name: `Thessalian Wings [D3-${UNIT_STATS[3].name}]`, buff: 'Hit & Run' },
	'Japan': 	{ unit: 4, flag: '🇯🇵', alias: 'Babylon 🇮🇶', name: `Charging Chariot [D4-${UNIT_STATS[4].name}]`, buff: 'Evasion' },
	'Roman': 	{ unit: 5, flag: '🇮🇹', alias: 'Roman 🇮🇹', name: `Testudo March [D5-${UNIT_STATS[5].name}]`, buff: 'Auto-Guard' },
	'Egypt': 	{ unit: 6, flag: '🇪🇬', alias: 'Egyptian 🇪🇬', name: `Pharaoh Reach [D6-${UNIT_STATS[6].name}]`, buff: '+1 Spell Range' },
};

const EMPIRE_STATIC_DIR_MAP = {
	'Aztec': 'emp_d1persian',
	'Briton': 'emp_d2celtic',
	'Mongol': 'emp_d3greek',
	'Japan': 'emp_d4babylon',
	'Roman': 'emp_d5roman',
	'Egypt': 'emp_d6egyptian',
};

const EMPIRE_DIR_MAP = {
	'Aztec': 'aztecs',
	'Briton': 'britons',
	'Mongol': 'mongols',
	'Japan': 'japanese',
	'Roman': 'romans',
	'Egypt': 'egyptians',
};

const PLAYER_EMPIRE_COLOR_MAP = {
	'blue': 'blue',
	'red': 'red',
	'green': 'green',
	'purple': 'purple',
	'black': 'gray',
	'yellow': 'yellow',
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

const EXT_SOUNDS = '.ogg,.mp3,.wav'.split(',');

const SFX_NAMES = 'attack,bow,capture,critical,death,deflect,explode,final_hit,fumble,guard,hit,horse,merge,move,resurrection,shield,skirmish,spell,swap,tactic,thunder,transmute,victory,wing'.split(',');

const BATTLE_PLAYLIST = 'Human_1,Human_2,Human_3,Human_4,Human_5,Orc_1,Orc_2,Orc_3,Orc_4,Orc_5'.split(',');
const QUEUE_PLAYLIST = 'Human_Defeat,Human_Victory,Mission_Briefing,Orc_Defeat,Orc_Victory,Title_Theme'.split(',');

const UNIT_SOUNDS = {
    '1': 'Hpissed3,Hpissed4,Hpissed5,Hpissed6,Hpissed7,Hready,Hwhat1,Hwhat2,Hwhat3,Hwhat4,Hwhat5,Hwhat6,Hwrkdone,Hyessir1,Hyessir2,Hyessir3,Hyessir4,Hdead,Hdempis7,Hhelp1,Hhelp2,Hpissed1,Hpissed2'.split(','),
    '2': 'Epissed1,Epissed2,Epissed3,Eready,Ewhat1,Ewhat2,Ewhat3,Ewhat4,Eyessir1,Eyessir2,Eyessir3,Eyessir4'.split(','),
    '3': 'Griffon1,Griffon2,Grwhat'.split(','),
    '4': 'Knpissd1,Knpissd2,Knpissd3,Knready,Knwhat1,Knwhat2,Knwhat3,Knwhat4,Knyessr1,Knyessr2,Knyessr3,Knyessr4'.split(','),
    '5': 'Pkatak1,Pkpissd1,Pkpissd2,Pkpissd3,Pkready,Pkwhat1,Pkwhat2,Pkwhat3,Pkwhat4,Pkyessr1,Pkyessr2,Pkyessr3,Pkyessr4'.split(','),
    '6': 'Wzpissd1,Wzpissd2,Wzpissd3,Wzready,Wzwhat1,Wzwhat2,Wzwhat3,Wzyessr1,Wzyessr2,Wzyessr3'.split(','),
};

// Global Dice Logic
window.hexdice_version = document.querySelector('meta#hexdice_version').content;console.log('hexdice_version', hexdice_version)

window.currentX = 15;
window.currentY = 15;
window.rollDiceAnimation = function(targetNumber) {
	const cube = document.getElementById('cube');
	if (!cube) return;

	const rotations = [
		[0, 0],      // 1
		[0, -90],    // 2
		[0, 180],    // 3
		[0, 90],     // 4
		[-90, 0],    // 5
		[90, 0]      // 6
	];

	const [targetX, targetY] = rotations[targetNumber - 1];

	currentX += 360 * (Math.floor(Math.random() * 3) + 2) + targetX - (currentX % 360);
	currentY += 360 * (Math.floor(Math.random() * 3) + 2) + targetY - (currentY % 360);

	cube.style.transform = `rotateX(${currentX}deg) rotateY(${currentY}deg)`;
};

window.handleCredentialResponse = (response) => {
	Alpine.$data(document.querySelector('body'))?.handleGoogleAuth?.(response);
};

// Register the service worker
if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/service-worker.js?v=' + window.hexdice_version)
			.then(registration => {
				console.log('ServiceWorker registration successful with scope: ', registration.scope);
				
				// Check for updates
				registration.addEventListener('updatefound', () => {
					const newWorker = registration.installing;
					newWorker.addEventListener('statechange', () => {
						if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
							console.log('New version available. Reload to update.');
						}
					});
				});
			})
			.catch(error => {
				console.log('ServiceWorker registration failed: ', error);
			});
	});
}