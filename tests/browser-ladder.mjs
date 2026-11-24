/**
 * Browser E2E for the Elo ladder UI (API mocked): ladder panel, own rating, empty state, rated room checkbox -> create body,
 * and the match-result message.
 *
 * Usage: BASE_URL=http://localhost:1166 CHROMIUM_PATH=... node tests/browser-ladder.mjs   (needs the dev server)
 */
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:1166';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
let failed = false;
const check = (ok, msg) => { if (!ok) { failed = true; console.error('FAIL:', msg); } else console.log('ok  :', msg); };

const open = async (query) => {
	const page = await (await browser.newContext({ serviceWorkers: 'block' })).newPage();
	page.on('pageerror', e => { if (!e.message.includes("'_key'")) errors.push(`PAGEERROR: ${e.message}`); });
	await page.goto(`${BASE_URL}/${query}`, { waitUntil: 'networkidle', timeout: 30000 });
	await page.waitForTimeout(2500);
	return page;
};
const game = (page, fn, arg) => page.evaluate(`(${fn.toString()})(window.Alpine.$data(document.querySelector('[x-data]')), ${JSON.stringify(arg ?? null)})`);
const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

try {
	const page = await open('?autochess=true&players=2');

	// Empty ladder
	await page.route('**/api/leaderboard**', r => r.fulfill(json({ players: [] })));
	await game(page, d => d.openLadder());
	await page.waitForTimeout(300);
	check(await page.locator('[role="dialog"][aria-label="Ladder"]').isVisible(), 'ladder dialog opens');
	check(/No rated matches yet/.test(await page.locator('[role="dialog"][aria-label="Ladder"]').innerText()), 'empty ladder explains how to get on it');
	await page.keyboard.press('Escape');
	check(await game(page, d => d.ladder.open) === false, 'Esc closes the ladder');

	// Populated ladder + own rating
	await page.unroute('**/api/leaderboard**');
	await page.route('**/api/leaderboard**', r => r.fulfill(json({ players: [
		{ name: 'Alice', elo: 1632, games: 14, wins: 10, losses: 3, draws: 1 },
		{ name: 'Bob', elo: 1488, games: 9, wins: 3, losses: 6, draws: 0 },
	] })));
	await page.route('**/api/me/rating', r => r.fulfill(json({ elo: 1511, games: 4, wins: 2, losses: 2, draws: 0 })));
	await game(page, d => { d.auth.token = 'tok'; d.auth.user = { _key: 'me', name: 'Me' }; d.openLadder(); });
	await page.waitForTimeout(400);
	const text = await page.locator('[role="dialog"][aria-label="Ladder"]').innerText();
	check(/Alice[\s\S]*1632[\s\S]*Bob[\s\S]*1488/.test(text), 'ladder lists players in order with Elo');
	check(/10\/3\/1/.test(text), 'ladder shows W/L/D');
	check(/You:\s*1511/.test(text), 'ladder shows my own rating when logged in');

	// Server failure
	await page.unroute('**/api/leaderboard**');
	await page.route('**/api/leaderboard**', r => r.fulfill({ status: 500, body: 'boom' }));
	await game(page, d => d.openLadder());
	await page.waitForTimeout(300);
	check(/Could not load/.test(await page.locator('[role="alert"]').first().innerText().catch(() => '')), 'a failing ladder shows an error instead of hanging');
	await game(page, d => { d.ladder.open = false; });

	// Rated checkbox goes into the create request
	let createBody = null;
	await page.route('**/api/rooms/create', async r => {
		createBody = JSON.parse(r.request().postData());
		await r.fulfill(json({ _key: 'ABC123', creator: 'me', players: [{ id: 'me', name: 'Me', color: 'Blue' }], status: 'WAITING', rated: createBody.rated, secret: 's' }));
	});
	await game(page, d => { d.connectMQTT = () => {}; d.rankedRoom = true; });
	await page.getByRole('button', { name: 'New Room' }).first().click();
	await page.waitForTimeout(400);
	check(createBody?.rated === true, 'ticking Rated sends rated:true when creating the room');
	check(await game(page, d => d.online.rated) === true, 'room is marked rated on the client');
	check(await page.getByText('Rated', { exact: true }).first().isVisible(), 'room header shows the Rated badge');

	// Match result message
	await game(page, d => d.handleMatchResult({ winnerId: 'me', rounds: 10, rating: { rated: true, deltas: { me: 18 } } }));
	check((await game(page, d => d.messageLog.map(m => m.message).join('|'))).includes('You won the match! Rating +18.'), 'win message includes the rating change');
	await game(page, d => d.handleMatchResult({ winnerId: 'other', rounds: 10, rating: { rated: true, deltas: { me: -18 } } }));
	check((await game(page, d => d.messageLog.map(m => m.message).join('|'))).includes('Rating -18.'), 'loss message shows a negative change');
	await game(page, d => d.handleMatchResult({ winnerId: null, rounds: 10, rating: { rated: false, reason: 'pair cap' } }));
	check((await game(page, d => d.messageLog[0].message)).includes('draw') && !(await game(page, d => d.messageLog[0].message)).includes('Rating'), 'unrated draw shows no rating change');

	check(errors.length === 0, `no page errors ${errors.join('; ')}`);
	await page.close();
} finally {
	await browser.close();
}
process.exit(failed ? 1 : 0);
