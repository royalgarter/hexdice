import { assert, assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

const rules = await Deno.readTextFile("rules/RULES.md");
const constants = await Deno.readTextFile("js/constants.js");

function extractConst(name: string): any {
	const literal = constants.match(new RegExp(`const ${name} = (\\{[\\s\\S]*?\\n\\});`))?.[1];
	assert(literal, `${name} literal not found in js/constants.js`);
	return new Function(`return ${literal}`)();
}

function tableRows(headerStart: string): string[][] {
	const lines = rules.split("\n");
	const start = lines.findIndex((l) => l.startsWith("|") && l.replace(/[|\s]/g, "").startsWith(headerStart));
	assert(start >= 0, `table starting with "${headerStart}" not found in RULES.md`);
	const rows: string[][] = [];
	for (let i = start + 2; i < lines.length && lines[i].startsWith("|"); i++) {
		rows.push(lines[i].split("|").slice(1, -1).map((c) => c.trim().replace(/\*\*|`/g, "")));
	}
	return rows;
}

Deno.test("RULES.md unit table matches UNIT_STATS", () => {
	const stats = extractConst("UNIT_STATS");
	const glyph: Record<string, string> = { X: "ж" };
	const rows = tableRows("DiceUnit");
	assertEquals(rows.length, Object.keys(stats).length, "one row per unit type");
	for (const [dice, name, armor, attack, range, distance, movement] of rows) {
		const u = stats[Number(dice)];
		assert(u, `RULES.md lists dice ${dice} but UNIT_STATS has no such unit`);
		assertEquals(name, u.name, `dice ${dice} name`);
		assertEquals(Number(armor), u.armor, `${u.name} armor`);
		assertEquals(Number(attack), u.attack, `${u.name} attack`);
		assertEquals(Number(range), u.range, `${u.name} range`);
		assertEquals(Number(distance), u.distance, `${u.name} distance`);
		assertEquals(movement, glyph[u.movement] ?? u.movement, `${u.name} movement`);
	}
});

Deno.test("RULES.md terrain table covers every TERRAIN_CONFIG key", () => {
	const terrain = extractConst("TERRAIN_CONFIG");
	const listed = tableRows("TerrainMovementCost").map((r) => r[0]);
	for (const key of Object.keys(terrain)) {
		assert(listed.includes(key), `terrain ${key} missing from RULES.md terrain table`);
	}
	assertEquals(listed.length, Object.keys(terrain).length, "no extra terrain rows");
});

Deno.test("constants.js BIND-EDIT heading exists in RULES.md", () => {
	const heading = constants.match(/BIND-EDIT rules\.md: (.+)/)?.[1]?.trim();
	assert(heading, "BIND-EDIT marker missing from js/constants.js");
	const norm = (t: string) => t.replace(/[#*\\]/g, "").replace(/\s+/g, " ").trim();
	assert(rules.split("\n").some((l) => l.startsWith("#") && norm(l) === norm(heading)), `heading not found in RULES.md: ${heading}`);
});
