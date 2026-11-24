import { assert, assertEquals, assertThrows } from "https://deno.land/std@0.208.0/assert/mod.ts";

// The codec lives at the top of js/game.js (a browser script, no exports): lift that block out and evaluate it.
const game = await Deno.readTextFile("js/game.js");
const start = game.indexOf("const MAP_RADIUS_MIN");
const end = game.indexOf("function alpineHexDiceTacticGame");
assert(start >= 0 && end > start, "map codec block not found in js/game.js");
const constants = await Deno.readTextFile("js/constants.js");
const codes = constants.match(/const HDFEN_TERRAIN_CODES = (\{[^}]*\});/)?.[1];
assert(codes, "HDFEN_TERRAIN_CODES not found");
const { encodeMap, decodeMap, terrainToRle, rleToTerrain, mapHexCount, MAP_RADIUS_MIN, MAP_RADIUS_MAX } = new Function(
	`const HDFEN_TERRAIN_CODES = ${codes};\n${game.slice(start, end)}\nreturn { encodeMap, decodeMap, terrainToRle, rleToTerrain, mapHexCount, MAP_RADIUS_MIN, MAP_RADIUS_MAX };`,
)();

const TYPES = ["PLAIN", "FOREST", "LAKE", "TOWER", "MOUNTAIN"];

Deno.test("round-trips every radius with mixed terrain", () => {
	for (let radius = MAP_RADIUS_MIN; radius <= MAP_RADIUS_MAX; radius++) {
		const terrain = Array.from({ length: mapHexCount(radius) }, (_, i) => TYPES[(i * 7 + (i >> 2)) % TYPES.length]);
		const decoded = decodeMap(encodeMap(radius, terrain));
		assertEquals(decoded.radius, radius);
		assertEquals(decoded.terrain, terrain);
	}
});

Deno.test("hex counts match 3R(R+1)+1", () => {
	assertEquals([5, 6, 8].map(mapHexCount), [91, 127, 217]);
});

Deno.test("an all-plain map is tiny", () => {
	assertEquals(encodeMap(5, Array(91).fill("PLAIN")), "R5:91.");
});

Deno.test("rle helpers are inverse and unknown codes fall back to PLAIN", () => {
	assertEquals(rleToTerrain(terrainToRle(["LAKE", "LAKE", "FOREST"])), ["LAKE", "LAKE", "FOREST"]);
	assertEquals(rleToTerrain("2Z"), ["PLAIN", "PLAIN"]);
});

Deno.test("rejects malformed and hostile codes", () => {
	const bad = [
		"", "R5", "R5:", "5:91.", "R5:90.", "R5:92.", "R2:19.", "R9:271.", "R99:1.", "R5:91X", "R5:91.;alert(1)",
		"R5:<script>", "R5:-1.", "r5:91.", "R5:91.\nR5:91.", "R5:" + "1.".repeat(400),
	];
	for (const code of bad) assertThrows(() => decodeMap(code), Error, undefined, `should reject ${JSON.stringify(code).slice(0, 40)}`);
	assertThrows(() => decodeMap(undefined as unknown as string));
	assertThrows(() => decodeMap(("R5:91." as string).padEnd(700, "x")));
});

Deno.test("accepts a code with surrounding whitespace", () => {
	assertEquals(decodeMap("  R3:37.  ").terrain.length, 37);
});
