/**
 * Browser smoke test for Hex Dice using Playwright (Chromium).
 *
 * Drives the real UI: loads the page, clicks [Practice] then [Random],
 * and asserts every player has rolled and deployed all dice.
 *
 * Usage:
 *   npm run test:browser                     # default http://localhost:1166/?players=2
 *   BASE_URL=http://localhost:1166 node tests/browser-smoke.mjs "?players=2&version=2"
 *
 * Requires a server on BASE_URL (see README "Browser Testing").
 */
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:1166';
const SEARCH = process.argv[2] || '?players=2';

const getGameState = (page) => page.evaluate(() => {
	const el = document.querySelector('[x-data]');
	const game = window.Alpine?.$data(el);
	if (!game) return { error: 'Alpine game component not found' };
	return {
		phase: game.phase,
		players: game.players.map(p => ({
			rolled: p.initialRollDone,
			dice: p.dice.length,
			deployed: p.dice.filter(d => d.isDeployed).length,
			isAI: !!p.isAI,
		})),
	};
});

const browser = await chromium.launch();
const page = await browser.newPage();

const errors = [];
page.on('pageerror', e => {
	// "_key" errors come from auth/online code when running on a static file server (no /auth endpoint)
	if (!e.message.includes("'_key'")) errors.push(`PAGEERROR: ${e.message}`);
});
page.on('console', m => {
	// Auth/network noise is expected on a static file server — only track game errors
	if (m.type() === 'error' && !m.text().includes('Failed to load resource')) {
		errors.push(`CONSOLE: ${m.text()}`);
	}
});

let failed = false;
try {
	await page.goto(`${BASE_URL}/${SEARCH}`, { waitUntil: 'networkidle', timeout: 30000 });
	await page.waitForTimeout(3000); // let lazy-loaded html/ components mount

	const practice = page.locator('button', { hasText: 'Practice' });
	if (await practice.count() === 0) throw new Error('[Practice] button not found — controller.html did not load');
	await practice.first().click();
	await page.waitForTimeout(1500);
	console.log('After [Practice]:', JSON.stringify(await getGameState(page)));

	const random = page.locator('button', { hasText: 'Random' });
	if (await random.count() > 0 && await random.first().isVisible()) {
		await random.first().click();
	} else {
		// Preset URLs auto-start the battle, Random button is hidden — that's fine
		console.log('[Random] not visible (preset auto-start?), skipping click');
	}
	await page.waitForTimeout(1500);

	const state = await getGameState(page);
	console.log('After [Random]:', JSON.stringify(state));

	if (state.error) throw new Error(state.error);
	if (state.phase !== 'PLAYER_TURN') throw new Error(`Expected phase PLAYER_TURN, got ${state.phase}`);
	state.players.forEach((p, i) => {
		if (!p.rolled) throw new Error(`P${i + 1} did not roll`);
		if (p.dice === 0 || p.deployed !== p.dice) throw new Error(`P${i + 1} deployed ${p.deployed}/${p.dice} dice`);
	});
} catch (e) {
	failed = true;
	console.error('FAIL:', e.message);
}

if (errors.length) console.log('JS errors captured:', errors.slice(0, 10));
await browser.close();
console.log(failed ? '❌ Browser smoke test FAILED' : '✅ Browser smoke test PASSED');
process.exit(failed ? 1 : 0);
