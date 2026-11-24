/**
 * Browser E2E for global keyboard shortcuts (G guard, E end turn, Esc deselect, ? help, ignored while typing / on AI turns).
 *
 * Usage: BASE_URL=http://localhost:1166 CHROMIUM_PATH=... node tests/browser-keys.mjs   (needs the dev server)
 */
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:1166';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
let failed = false;
const check = (ok, msg) => { if (!ok) { failed = true; console.error('FAIL:', msg); } else console.log('ok  :', msg); };

try {
	const page = await browser.newPage();
	page.on('pageerror', e => { if (!e.message.includes("'_key'")) errors.push(`PAGEERROR: ${e.message}`); });
	await page.goto(`${BASE_URL}/?players=2`, { waitUntil: 'networkidle', timeout: 30000 });
	await page.waitForTimeout(2500);
	const g = (fn, arg) => page.evaluate(fn, arg);
	await g(() => window.Alpine.$data(document.querySelector('[x-data]')).randomStart());
	await page.waitForTimeout(500);

	await g(() => { const d = window.Alpine.$data(document.querySelector('[x-data]')); d.players.forEach(p => p.isAI = false); });
	const pickUnit = () => g(() => {
		const d = window.Alpine.$data(document.querySelector('[x-data]'));
		const u = d.players[d.currentPlayerIndex].dice.find(x => x.isDeployed && !x.isDeath);
		d.selectUnit ? d.selectUnit(u.hexId) : d.handleHexClick(u.hexId);
		return u.id;
	});

	await page.keyboard.press('?');
	check(await g(() => window.Alpine.$data(document.querySelector('[x-data]')).showKeyHelp) === true, '? opens the help overlay');
	await page.keyboard.press('Escape');
	check(await g(() => window.Alpine.$data(document.querySelector('[x-data]')).showKeyHelp) === false, 'Esc closes the help overlay');

	const unitId = await pickUnit();
	await page.waitForTimeout(200);
	check(await g(() => window.Alpine.$data(document.querySelector('[x-data]')).selectedUnitHexId) !== null, 'unit selected');
	await page.keyboard.press('Escape');
	check(await g(() => window.Alpine.$data(document.querySelector('[x-data]')).selectedUnitHexId) === null, 'Esc deselects the unit');

	await pickUnit();
	await page.keyboard.press('g');
	await page.waitForTimeout(200);
	check(await g((id) => {
		const d = window.Alpine.$data(document.querySelector('[x-data]'));
		return d.players.flatMap(p => p.dice).find(x => x.id === id).isGuarding;
	}, unitId), 'G guards the selected unit');

	const before = await g(() => window.Alpine.$data(document.querySelector('[x-data]')).currentPlayerIndex);
	await g(() => { const i = document.createElement('input'); i.id = 'kbtest'; document.body.appendChild(i); i.focus(); });
	await page.keyboard.press('e');
	check(await g(() => window.Alpine.$data(document.querySelector('[x-data]')).currentPlayerIndex) === before, 'E is ignored while typing in an input');
	await g(() => document.getElementById('kbtest').remove());
	await g(() => document.activeElement.blur());
	await page.keyboard.press('e');
	await page.waitForTimeout(300);
	check(await g(() => window.Alpine.$data(document.querySelector('[x-data]')).currentPlayerIndex) !== before, 'E ends the turn');

	await g(() => { const d = window.Alpine.$data(document.querySelector('[x-data]')); d.players[d.currentPlayerIndex].isAI = true; });
	const aiTurn = await g(() => window.Alpine.$data(document.querySelector('[x-data]')).currentPlayerIndex);
	await page.keyboard.press('e');
	check(await g(() => window.Alpine.$data(document.querySelector('[x-data]')).currentPlayerIndex) === aiTurn, 'E is ignored on an AI turn');

	check(errors.length === 0, `no page errors ${errors.join('; ')}`);
	await page.close();
} finally {
	await browser.close();
}
process.exit(failed ? 1 : 0);
