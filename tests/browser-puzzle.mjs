/**
 * Browser E2E for the puzzle mode (?puzzle=...): drives the real Alpine game in Chromium.
 *
 * Usage: BASE_URL=http://localhost:1166 CHROMIUM_PATH=... node tests/browser-puzzle.mjs
 * Needs the dev server running (npm start).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:1166';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
let failed = false;
const check = (ok, msg) => { if (!ok) { failed = true; console.error('FAIL:', msg); } else console.log('ok  :', msg); };

const pick = (n, attacker) => {
	for (const d of ['s1', 's2', 'n3_s3', 'n3_s4']) {
		for (const f of fs.readdirSync(`puzzles/pool/${d}`)) {
			if (f === 'index.json' || !f.endsWith('.json')) continue;
			const p = JSON.parse(fs.readFileSync(`puzzles/pool/${d}/${f}`));
			if (p.n === n && p.attacker === attacker && p.firstMove.actionType === 'MOVE') return { entry: `${d}/${p.id}`, p };
		}
	}
};

const open = async (query) => {
	const page = await browser.newPage();
	page.on('pageerror', e => { if (!e.message.includes("'_key'")) errors.push(`PAGEERROR: ${e.message}`); });
	await page.goto(`${BASE_URL}/?${query}`, { waitUntil: 'networkidle', timeout: 30000 });
	await page.waitForFunction(() => window.Alpine && document.querySelector('[x-data]') && window.Alpine.$data(document.querySelector('[x-data]')).puzzle, null, { timeout: 15000 });
	return page;
};
const game = (page, src, arg) => page.evaluate(({ src, arg }) => {
	const g = window.Alpine.$data(document.querySelector('[x-data]'));
	return new Function('g', 'arg', `return (async () => { ${src} })()`)(g, arg);
}, { src, arg });
const playFirstMove = (page, m) => game(page, `g.handleHexClick(arg.fromHex); await new Promise(r => setTimeout(r, 100)); g.handleHexClick(arg.toHex);`, m);
const status = (page) => game(page, `return { s: g.puzzle.status, turns: g.puzzle.turnsUsed, attempts: g.puzzle.attempts, phase: g.phase, cur: g.currentPlayerIndex, fen: g.generateHDFEN() }`);

try {
	for (const attacker of [0, 1]) {
		const { entry, p } = pick(1, attacker);
		const page = await open(`puzzle=${entry}`);
		const st = await status(page);
		check(st.cur === attacker && st.phase === 'PLAYER_TURN', `N=1 attacker ${attacker}: loaded, human seat to move (${entry})`);
		await playFirstMove(page, p.firstMove);
		await page.waitForTimeout(800);
		const done = await status(page);
		check(done.s === 'solved', `N=1 attacker ${attacker}: winning move solves (status ${done.s})`);
		check(await page.locator('#puzzle-hud').getByText('Solved').isVisible(), `N=1 attacker ${attacker}: HUD shows Solved`);
		await page.close();
	}

	{
		const { entry, p } = pick(1, 0);
		const page = await open(`puzzle=${entry}`);
		await game(page, `g.puzzleHint()`);
		check((await game(page, `return g.selectedUnitHexId`)) === p.firstMove.fromHex, 'hint selects the key piece');
		await game(page, `g.puzzleReset()`);
		check((await status(page)).attempts === 2, 'reset bumps attempts');
		await game(page, `g.endTurn()`);
		await page.waitForTimeout(300);
		check((await status(page)).s === 'failed', 'N=1: ending the turn without winning fails');
		check(await page.locator('#puzzle-hud').getByText('Not this time').isVisible(), 'HUD shows failure');
		await game(page, `g.puzzleReset()`);
		check((await status(page)).s === 'playing', 'reset after failure restarts');
		await game(page, `g.puzzleShowSolution()`);
		const sol = await game(page, `return g.puzzle`);
		check(sol.status === 'failed' && sol.note.includes('Solution'), 'show solution marks failed with text');
		await page.close();
	}

	{
		const { entry } = pick(2, 0);
		const page = await open(`puzzle=${entry}`);
		const before = (await status(page)).fen;
		await game(page, `g.endTurn()`); // schedules the AI reply in 500 ms
		await game(page, `g.puzzleReset()`);
		await page.waitForTimeout(1500);
		const after = await status(page);
		check(after.fen === before && after.cur === 0 && after.s === 'playing', 'reset inside the AI delay leaves a clean board');
		await page.close();
	}

	{
		const page = await open('puzzle=daily');
		const st = await game(page, `return { label: g.puzzle.label, n: g.puzzle.data.n }`);
		check(st.label.startsWith('Daily Puzzle ') && st.n >= 1, `daily loads (${st.label})`);
		check(await page.locator('a[href="/?puzzle=daily"]').count() > 0, 'toolbar has the puzzle button');
		await page.close();
	}

	{
		const { p } = pick(1, 0);
		const page = await open('puzzle=daily');
		await page.evaluate(() => localStorage.removeItem('hexdice_puzzle_state'));
		const day = new Date().toISOString().slice(0, 10);
		await game(page, `await g.startPuzzle(arg.p, 'Daily Puzzle ' + arg.day, { day: arg.day })`, { p, day });
		await game(page, `g.puzzleReset()`); // abandoned attempt -> miss
		await playFirstMove(page, p.firstMove);
		await page.waitForTimeout(500);
		const out = await game(page, `return { s: g.puzzle.status, streak: g.puzzleStreak, text: g.puzzleShareText(), rec: JSON.parse(localStorage.getItem('hexdice_puzzle_state')).days[arg.day] }`, { day });
		check(out.s === 'solved' && out.streak === 1, `daily solve records streak 1 (status ${out.s}, streak ${out.streak})`);
		check(out.text.includes('🟥🟩') && out.text.includes(`HexDice Daily ${day}`), 'share text shows miss then hit');
		check(out.rec?.solved === true && out.rec.attempts === 2, 'stored record: solved on attempt 2');
		await game(page, `g.puzzleReset(); await g.puzzleShowSolution()`); // replay after solve must not overwrite the first result
		const again = await game(page, `return JSON.parse(localStorage.getItem('hexdice_puzzle_state')).days[arg.day].solved`, { day });
		check(again === true, 'later replay never overwrites a solved day');
		await page.close();
	}

	{
		const page = await open('puzzle=learn');
		await page.evaluate(() => localStorage.removeItem('hexdice_tutorial'));
		await page.reload({ waitUntil: 'networkidle' });
		await page.waitForFunction(() => window.Alpine.$data(document.querySelector('[x-data]')).puzzle, null, { timeout: 15000 });
		const first = await game(page, `return { label: g.puzzle.label, title: g.puzzle.lesson.title, entry: g.puzzle.lesson.entry, fm: g.puzzle.data.firstMove }`);
		check(first.label === 'Lesson 1/9' && first.title.startsWith('Fencer'), `learn opens lesson 1 (${first.title})`);
		await playFirstMove(page, first.fm);
		await page.waitForTimeout(500);
		check((await status(page)).s === 'solved', 'lesson 1 solves');
		check(await page.getByText('Next lesson').isVisible(), 'Next lesson button appears');
		await game(page, `await g.puzzleNextLesson()`);
		check((await game(page, `return g.puzzle.lesson.index`)) === 1, 'Next lesson loads lesson 2');
		await page.reload({ waitUntil: 'networkidle' });
		await page.waitForFunction(() => window.Alpine.$data(document.querySelector('[x-data]')).puzzle, null, { timeout: 15000 });
		check((await game(page, `return g.puzzle.lesson.index`)) === 1, 'reopening resumes at the first unsolved lesson');
		await page.close();
		const direct = await open('puzzle=learn&lesson=9');
		check((await game(direct, `return g.puzzle.lesson.index`)) === 8, '?lesson=9 jumps straight to the last lesson');
		await direct.close();
	}

	check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
} finally {
	await browser.close();
}
process.exit(failed ? 1 : 0);
