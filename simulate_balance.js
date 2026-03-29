const units = {
	"1: Infantry": { atk: 3, def: 4, mov: 2, range: 0 },
	"2: Archer (R2)": { atk: 3, def: 2, mov: 2, range: 2 },
	"2: Archer (R3)": { atk: 2, def: 2, mov: 2, range: 3 },
	"3: Knight": { atk: 3, def: 3, mov: 3, range: 0 },
	"4: Assault": { atk: 4, def: 2, mov: 2, range: 0 },
	"5: Tanker": { atk: 2, def: 5, mov: 1, range: 0 },
	"6: Balance": { atk: 2, def: 6, mov: 0, range: 1 }
};

const unitKeys = Object.keys(units);

console.log("### Hex Dice Balance Simulation (Deno)");
console.log("\n### One-Shot Kill (OSK) Matrix");
console.log("Can Attacker kill Defender in 1 hit?");
let header = "| Attacker \\ Defender | " + unitKeys.map(k => k.split(': ')[1]).join(" | ") + " |";
console.log(header);
console.log("| :--- | " + unitKeys.map(() => ":---:").join(" | ") + " |");

for (const aKey of unitKeys) {
	let row = `| ${aKey} |`;
	for (const dKey of unitKeys) {
		if (units[aKey].atk >= units[dKey].def) {
			row += " **YES** |";
		} else {
			row += "  -  |";
		}
	}
	console.log(row);
}

console.log("\n### Attrition: Turns To Kill (TTK)");
console.log("Total activations needed for Attacker to kill Defender (Armor Erosion):");
console.log(header);
console.log("| :--- | " + unitKeys.map(() => ":---:").join(" | ") + " |");

for (const aKey of unitKeys) {
	let row = `| ${aKey} |`;
	for (const dKey of unitKeys) {
		const atk = units[aKey].atk;
		const def = units[dKey].def;
		if (atk >= def) {
			row += " 1 |";
		} else {
			// Formula: (Def - Atk) + 1
			// e.g. Atk 2 vs Def 6:
			// Turn 1: 6 -> 5
			// Turn 2: 5 -> 4
			// Turn 3: 4 -> 3
			// Turn 4: 3 -> 2
			// Turn 5: 2 <= 2 (Kill)
			const ttk = (def - atk) + 1;
			row += ` ${ttk} |`;
		}
	}
	console.log(row);
}

console.log("\n### Unit Summary & Observations");
unitKeys.forEach(k => {
	const u = units[k];
	const oskCount = unitKeys.filter(dk => u.atk >= units[dk].def).length;
	const weakToCount = unitKeys.filter(ak => units[ak].atk >= u.def).length;
	console.log(`- **${k}**: OSK Power: ${oskCount}/${unitKeys.length} | Vulnerability: ${weakToCount}/${unitKeys.length}`);
});
