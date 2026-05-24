/**
 * Hex Dice Campaign Generator CLI
 * Usage: node campaign/generator.js --name="Forest Ambush" --dice="11/21/31/41/51/61" --enemies="22/51" --terrain="forest:5,mountain:2" --output="campaign/level1.json"
 * URL: http://localhost:1166/?options=r&players=2&campaign=true&map=level1.json
 */

const fs = require('fs');

function parseArgs() {
	const args = {};
	process.argv.slice(2).forEach(arg => {
		if (arg.startsWith('--')) {
			const [key, value] = arg.split('=');
			args[key.slice(2)] = value;
		}
	});
	return args;
}

function parseDice(diceStr) {
	if (!diceStr) return [];
	// Format: 13/21/31 (Type 1: 3 units, Type 2: 1 unit, Type 3: 1 unit)
	const units = [];
	diceStr.split('/').forEach(part => {
		const type = parseInt(part[0]);
		const count = parseInt(part.slice(1));
		for (let i = 0; i < count; i++) {
			units.push(type);
		}
	});
	return units;
}

function parseTerrain(terrainStr) {
	if (!terrainStr) return [];
	// Format: forest:5,mountain:2
	const terrain = [];
	terrainStr.split(',').forEach(part => {
		const [type, count] = part.split(':');
		terrain.push({ type: type.toUpperCase(), count: parseInt(count) });
	});
	return terrain;
}

function parseRunes(runeStr) {
	if (!runeStr) return {};
	// Format: aegis:1,pegasus:1
	const runes = {};
	runeStr.split(',').forEach(part => {
		const [type, count] = part.split(':');
		runes[type.toLowerCase()] = parseInt(count);
	});
	return runes;
}

function generateRandomTerrain(radius, terrainDefinitions) {
	const hexIds = [];
	// Generate all valid IDs for radius (excluding bases usually, but let's keep it simple)
	for (let q = -radius; q <= radius; q++) {
		for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
			hexIds.push(`${q},${r}`);
		}
	}

	const terrainMap = [];
	let availableHexes = [...hexIds];

	terrainDefinitions.forEach(def => {
		for (let i = 0; i < def.count; i++) {
			if (availableHexes.length === 0) break;
			const idx = Math.floor(Math.random() * availableHexes.length);
			const hexId = availableHexes.splice(idx, 1)[0];
			terrainMap.push({ id: hexId, type: def.type });
		}
	});

	return terrainMap;
}

function main() {
	const args = parseArgs();

	const name = args.name || "Random Skirmish";
	const radius = parseInt(args.radius) || 5;
	const deploymentLimit = parseInt(args.limit) || 4;
	const p1Dice = parseDice(args.dice || "11/21/31/41/51/61"); // Default: Legendary Six
	const enemyDice = parseDice(args.enemies || "12/21/51");    // Default: 2 Archers, 1 Fencer, 1 Tank
	const terrainDefs = parseTerrain(args.terrain || "forest:3,lake:2,mountain:1");
	const rewards = parseRunes(args.runes || "aegis:1");
	const output = args.output || "campaign/generated_level.json";

	const level = {
		name,
		radius,
		deploymentLimit,
		player1Dice: p1Dice,
		enemyDice,
		terrain: generateRandomTerrain(radius, terrainDefs),
		rewards,
		config: {
			p2AI: true,
			options: 'rm'
		}
	};

	fs.writeFileSync(output, JSON.stringify(level, null, 2));
	console.log(`Campaign level generated: ${output}`);
	console.log(`- Name: ${name}`);
	console.log(`- P1 Units: ${p1Dice.length} (Limit: ${deploymentLimit})`);
	console.log(`- Enemy Units: ${enemyDice.length}`);
}

main();
