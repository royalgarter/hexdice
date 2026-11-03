/**
 * Browser E2E for evolved AI integration: ?ai= choice, setup picker, and campaign boss mapping.
 *
 * Usage: BASE_URL=http://localhost:1166 CHROMIUM_PATH=... node tests/browser-evolved.mjs   (needs the dev server)
 */
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:1166';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
let failed = false;
const check = (ok, msg) => { if (!ok) { failed = true; console.error('FAIL:', msg); } else console.log('ok  :', msg); };

const open = async (query) => {
	const page = await browser.newPage();
	page.on('pageerror', e => { if (!e.message.includes("'_key'")) errors.push(`PAGEERROR: ${e.message}`); });
	await page.goto(`${BASE_URL}/?${query}`, { waitUntil: 'networkidle', timeout: 30000 });
	await page.waitForTimeout(2500);
	return page;
};
const game = (page, src, arg) => page.evaluate(({ src, arg }) => {
	const g = window.Alpine.$data(document.querySelector('[x-data]'));
	return new Function('g', 'arg', `return (async () => { ${src} })()`)(g, arg);
}, { src, arg });

try {
	{
		const page = await open('players=2&ai=evolved_iron_wall');
		const r = await game(page, `
			g.randomStart();
			g.setPlayerAI(g.players[1]);
			const before = g.players[1].profileName;
			g.endTurn();
			await new Promise(r => setTimeout(r, 4000));
			return { before, after: g.players[1].profileName, explicit: g.players[1].profileExplicit, log: g.messageLog.length };
		`);
		check(r.before === 'evolved_iron_wall' && r.explicit, `?ai= picks the champion (${r.before})`);
		check(r.after === 'evolved_iron_wall', `AI turn keeps the champion instead of falling back to baseline (${r.after})`);
		await page.close();
	}
	{
		const page = await open('players=2');
		check(await page.locator('select[title="Opponent AI"] option').count() >= 9, 'picker lists default + tiers + champions');
		await game(page, `g.randomStart(); g.aiChoice = 'hard'; g.setPlayerAI(g.players[1]);`);
		const name = await game(page, `return g.players[1].profileName`);
		check((await game(page, `return evolvedProfiles && AI_TIERS.hard.includes(arg)`, name)), `hard tier resolves to a hard champion (${name})`);
		await page.close();
	}
	{
		const page = await open('campaign=true&map=level10.json');
		const name = await game(page, `return g.players[1].profileName`);
		const explicit = await game(page, `return g.players[1].profileExplicit`);
		check(name === 'evolved_blood_marathon' && explicit, `level 10 boss uses its mapped champion (${name})`);
		await page.close();
	}
	{
		const page = await open('campaign=true&map=level9.json');
		check(!(await game(page, `return g.players[1].profileExplicit`)), 'non-boss level keeps the old random profile');
		await page.close();
	}
	check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
} finally {
	await browser.close();
}
process.exit(failed ? 1 : 0);
