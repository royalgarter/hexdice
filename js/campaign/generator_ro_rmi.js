const fs = require('fs');
const path = require('path');

const maps = require(__dirname + '/ro_level_rmi.json');
const campaignDir = path.join(__dirname);

function generate() {
	console.log(`Generating ${maps.length} campaign levels...`);

	maps.forEach((map, index) => {
		const levelNum = index + 1;
		const enemyDiceCount = Math.ceil(levelNum / 10 + 2);
		const enemyDice = Array.from({ length: enemyDiceCount }, () => Math.floor(Math.random() * 6) + 1);

		const levelData = {
			name: `Ragnarok Online Level ${levelNum} (${map})`,
			rmi: `${map}.gif`,
			radius: 5,
			deploymentLimit: 3,
			player1Dice: [1, 2, 3, 4, 5, 6],
			enemyDice: enemyDice,
			config: {
				p2AI: true,
				options: "rm"
			}
		};

		const filePath = path.join(campaignDir, `level${levelNum}.json`);
		fs.writeFileSync(filePath, JSON.stringify(levelData, null, 2));
		console.log(`Created ${filePath}`);
	});

	console.log("Done!");
}

generate();
