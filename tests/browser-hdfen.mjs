/**
 * Browser E2E for HDFEN: drives the real Alpine game in Chromium.
 *
 * 1. Random-start a game, read generateHDFEN(), tweak terrain
 * 2. Load a fresh page, loadHDFEN(fen) on the live component
 * 3. Assert round-trip equality, unit counts, DOM hexes rendered, no page errors
 *
 * Usage: BASE_URL=http://localhost:1166 node tests/browser-hdfen.mjs
 */
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:1166';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
let failed = false;
const check = (ok, msg) => { if (!ok) { failed = true; console.error('FAIL:', msg); } else console.log('ok  :', msg); };

const open = async () => {
	const page = await browser.newPage();
	page.on('pageerror', e => { if (!e.message.includes("'_key'")) errors.push(`PAGEERROR: ${e.message}`); });
	await page.goto(`${BASE_URL}/?players=2`, { waitUntil: 'networkidle', timeout: 30000 });
	await page.waitForTimeout(2500);
	return page;
};
const game = (fn, arg) => (page) => page.evaluate(({ src, arg }) => {
	const g = window.Alpine.$data(document.querySelector('[x-data]'));
	return new Function('g', 'arg', `return (async () => { ${src} })()`)(g, arg);
}, { src: fn, arg });

try {
	const a = await open();
	const fen = await game(`
		g.randomStart();
		g.hexes.forEach((h, i) => { if (i % 9 === 0 && !h.unit && h.basePlayerId == null) g.setTerrainType(h, ['FOREST','LAKE','TOWER','MOUNTAIN'][i % 4]); });
		return g.generateHDFEN();
	`)(a);
	console.log('FEN:', fen.slice(0, 90) + '...');
	check(/ R\d+ \S+$/.test(fen), 'FEN has radius + terrain tail');
	const expectedUnits = await game(`return g.players.reduce((n, p) => n + p.dice.filter(d => d.isDeployed && !d.isDeath).length, 0)`)(a);

	const b = await open();
	const out = await game(`
		await g.loadHDFEN(arg);
		await new Promise(r => setTimeout(r, 500));
		return {
			fen: g.generateHDFEN(),
			units: g.players.reduce((n, p) => n + p.dice.filter(d => d.isDeployed && !d.isDeath).length, 0),
			phase: g.phase,
			terrain: g.hexes.filter(h => h.terrainType !== 'PLAIN').length,
			domHexes: document.querySelectorAll('.hex-grid-container [class*="hex"]').length,
			hasStyle: g.hexes.some(h => h.terrainType !== 'PLAIN' && h.terrainStyle),
		};
	`, fen)(b);
	check(out.fen === fen, 'loadHDFEN round-trip identical in live component');
	check(out.units === expectedUnits, `unit count preserved (${out.units}/${expectedUnits})`);
	check(out.phase === 'PLAYER_TURN', `phase restored (${out.phase})`);
	check(out.terrain > 0 && out.hasStyle, `terrain applied (${out.terrain} hexes, styled)`);
	check(out.domHexes > 0, `DOM rendered hexes (${out.domHexes})`);

	// Playable after load: P0 can select a unit and get valid moves
	const playable = await game(`
		const p = g.players[0];
		const u = p.dice.find(d => d.isDeployed && !d.isDeath);
		g.selectUnit ? g.selectUnit(u.hexId) : null;
		return { selected: g.selectedUnitHexId === u.hexId, moves: (g.validMoves || []).length };
	`)(b);
	check(playable.selected, 'unit selectable after load');
	console.log('validMoves for selected unit:', playable.moves);
} catch (e) {
	failed = true;
	console.error('ERROR:', e.message);
} finally {
	await browser.close();
}
if (errors.length) { failed = true; console.error(errors.join('\n')); }
console.log(failed ? 'RESULT: FAILED' : 'RESULT: PASSED');
process.exit(failed ? 1 : 0);
