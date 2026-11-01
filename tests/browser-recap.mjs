/**
 * Browser test (no server, no DB, no broker): the Autochess RECAP panel.
 *
 * Serves the repo from disk through Playwright request interception, forces the
 * RECAP phase and asserts that the Continue button is the top element at its
 * centre (the fixed #game-log used to cover it) and that the winner is looked
 * up by player id (online ids are user-id strings, not array indexes).
 *
 *   node tests/browser-recap.mjs        (CHROMIUM_PATH overrides the browser)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.gif': 'image/gif' };

let failed = 0;
const check = (cond, msg) => {
	console.log(`${cond ? 'PASS' : 'FAIL'}: ${msg}`);
	if (!cond) failed++;
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
	for (const online of [false, true]) {
		const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
		const errors = [];
		page.on('pageerror', e => errors.push(e.message));
		await page.route('http://app.test/**', (route) => {
			const u = new URL(route.request().url());
			if (u.pathname === '/api/config') return route.fulfill({ json: { GOOGLE_CLIENT_ID: 'x', MQTT: 'ws://127.0.0.1:1' } });
			const f = path.join(ROOT, u.pathname === '/' ? 'index.html' : u.pathname);
			if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: '{}' });
			let body = fs.readFileSync(f);
			if (u.pathname === '/') body = Buffer.from(body.toString().replaceAll('___VERSION___', 'dev').replaceAll('___MQTT___', 'ws://127.0.0.1:1').replaceAll('___GOOGLE_CLIENT_ID___', 'x'));
			return route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body });
		});
		await page.goto('http://app.test/?autochess=true&auth_user=zed');
		await page.waitForFunction(() => window.Alpine?.$data(document.querySelector('[x-data]'))?.players?.length >= 2);

		await page.evaluate((online) => {
			const g = window.Alpine.$data(document.querySelector('[x-data]'));
			if (online) {
				g.players[0].id = 'user-abc'; g.players[0].name = 'Alice';
				g.players[1].id = 'user-def'; g.players[1].name = 'Bob';
			}
			g.Autochess.state.phase = 'RECAP';
			g.Autochess.state.lastResult = 'WIN';
			g.Autochess.state.lastWinnerId = g.players[1].id;
		}, online);

		const button = page.getByRole('button', { name: 'Continue' });
		await button.waitFor({ state: 'visible' });
		const topIsButton = await button.evaluate(btn => {
			const rc = btn.getBoundingClientRect();
			return document.elementFromPoint(rc.x + rc.width / 2, rc.y + rc.height / 2) === btn;
		});
		const label = online ? 'online' : 'offline';
		check(topIsButton, `${label}: Continue button is not covered`);
		const recap = (await page.locator('#game-autochess').innerText()).replace(/\s+/g, ' ');
		check(recap.includes(online ? 'Bob won this round' : 'Player 2 won this round'), `${label}: winner name resolved (${recap.match(/\S+(?: \S+)? won this round/)?.[0]})`);
		check(errors.length === 0, `${label}: no page errors ${errors.join(' | ')}`);
		await page.close();
	}
} finally {
	await browser.close();
}
process.exit(failed ? 1 : 0);
