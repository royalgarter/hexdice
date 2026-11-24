/**
 * Browser E2E for undo of the last whole turn vs the AI (human action + AI reply are taken back).
 *
 * Usage: BASE_URL=http://localhost:1166 CHROMIUM_PATH=... node tests/browser-undo.mjs   (needs the dev server)
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
	const game = '(window.Alpine.$data(document.querySelector("[x-data]")))';
	await g(() => { const d = window.Alpine.$data(document.querySelector('[x-data]')); d.setPlayerAI(d.players[1]); d.randomStart(); });
	await page.waitForTimeout(500);

	check(await g(() => window.Alpine.$data(document.querySelector('[x-data]')).players[1].isAI) === true, 'P2 is the AI');
	check(await g(() => window.Alpine.$data(document.querySelector('[x-data]')).canUndo) === false, 'no undo before any turn has been played');

	const start = await g(() => {
		const d = window.Alpine.$data(document.querySelector('[x-data]'));
		return { sum: d.getStateChecksum(), turn: d.turnCount, log: d.messageLog.length };
	});

	// Human acts: guard a unit (one action ends the turn in V1), then wait for the AI to reply and hand the turn back.
	await g(() => {
		const d = window.Alpine.$data(document.querySelector('[x-data]'));
		const u = d.players[0].dice.find(x => x.isDeployed && !x.isDeath);
		d.handleHexClick(u.hexId);
		d.performAction('GUARD', u.hexId);
	});
	await page.waitForFunction(() => {
		const d = window.Alpine.$data(document.querySelector('[x-data]'));
		return d.currentPlayerIndex === 0 && d.turnCount >= 2;
	}, null, { timeout: 30000 });
	const after = await g(() => {
		const d = window.Alpine.$data(document.querySelector('[x-data]'));
		return { sum: d.getStateChecksum(), canUndo: d.canUndo, turn: d.turnCount };
	});
	check(after.sum !== start.sum, 'state changed after my turn + AI reply');
	check(after.canUndo === true, 'undo is offered on my next turn');
	check(await page.locator('button[aria-label="Undo last turn"]').isVisible(), 'undo button is visible');

	await page.keyboard.press('u');
	await page.waitForTimeout(300);
	const undone = await g(() => {
		const d = window.Alpine.$data(document.querySelector('[x-data]'));
		return {
			sum: d.getStateChecksum(), turn: d.turnCount, canUndo: d.canUndo, player: d.currentPlayerIndex,
			guards: d.players[0].dice.filter(x => x.isGuarding).length,
			consistent: d.hexes.every(h => !h.unit || (h.unit.hexId === h.id && h.unitId === h.unit.id)),
		};
	});
	check(undone.sum === start.sum, `U restores the exact board (${undone.sum === start.sum ? 'checksum match' : `${undone.sum} != ${start.sum}`})`);
	check(undone.turn === start.turn && undone.player === 0, 'turn counter and active player restored');
	check(undone.guards === 0, 'my guard action is gone');
	check(undone.consistent, 'hex <-> unit links are consistent');
	check(undone.canUndo === false, 'undo is single level');

	// Play on after undoing: the game must still work.
	await g(() => {
		const d = window.Alpine.$data(document.querySelector('[x-data]'));
		const u = d.players[0].dice.find(x => x.isDeployed && !x.isDeath);
		d.handleHexClick(u.hexId);
		d.performAction('GUARD', u.hexId);
	});
	await page.waitForFunction(() => {
		const d = window.Alpine.$data(document.querySelector('[x-data]'));
		return d.currentPlayerIndex === 0 && d.turnCount >= 2;
	}, null, { timeout: 30000 });
	check(await g(() => window.Alpine.$data(document.querySelector('[x-data]')).canUndo) === true, 'game continues and undo is offered again');

	// Hotseat (two humans) never offers undo.
	await g(() => { window.Alpine.$data(document.querySelector('[x-data]')).players.forEach(p => p.isAI = false); });
	check(await g(() => window.Alpine.$data(document.querySelector('[x-data]')).canUndo) === false, 'no undo in hotseat (both humans)');

	check(errors.length === 0, `no page errors ${errors.join('; ')}`);
	await page.close();
} finally {
	await browser.close();
}
process.exit(failed ? 1 : 0);
