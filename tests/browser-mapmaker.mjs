/**
 * Browser E2E for the map maker: ?cm= shared maps (valid, hostile), editor painting, share link round-trip,
 * play-test, and login-gated saving (the /api/user/data endpoint is mocked).
 *
 * Usage: BASE_URL=http://localhost:1166 CHROMIUM_PATH=... node tests/browser-mapmaker.mjs   (needs the dev server)
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
const data = (page, fn, arg) => page.evaluate(`(${fn.toString()})(window.Alpine.$data(document.querySelector('[x-data]')), ${JSON.stringify(arg ?? null)})`);

try {
	// 1. A valid shared map: all lake, so base protection is observable.
	let page = await open('?players=2');
	const lakeCode = await page.evaluate(() => encodeMap(5, Array(91).fill('LAKE')));
	check(lakeCode === 'R5:91L', `all-lake R5 code is compact (${lakeCode})`);
	await page.close();

	page = await open(`?players=2&cm=${encodeURIComponent(lakeCode)}`);
	let s = await data(page, d => ({
		count: d.hexes.length,
		lakes: d.hexes.filter(h => h.terrainType === 'LAKE').length,
		baseTerrain: d.players.map(p => d.hexes[p.baseHexId].terrainType),
		map: !!d.customMap,
	}));
	check(s.count === 91 && s.map, 'shared map is loaded (91 hexes)');
	await page.getByText('Practice').first().click();
	await page.waitForTimeout(500);
	s = await data(page, d => ({
		lakes: d.hexes.filter(h => h.terrainType === 'LAKE').length,
		baseTerrain: d.players.map(p => d.hexes[p.baseHexId].terrainType),
		ai: d.players[1].isAI,
	}));
	check(s.lakes === 89 && s.baseTerrain.every(t => t === 'PLAIN'), `Practice keeps the shared map but forces bases plain (${s.lakes} lakes, bases ${s.baseTerrain})`);
	check(s.ai, 'Practice still sets up the AI opponent');
	await page.close();

	// 2. Hostile / broken codes are ignored, game still starts on the default board.
	for (const bad of ['garbage', 'R5:90.', 'R99:1.', 'R5:91.%3Cscript%3E']) {
		page = await open(`?players=2&cm=${bad}`);
		s = await data(page, d => ({ map: d.customMap, count: d.hexes.length, log: d.messageLog.map(m => m.message).join('|') }));
		check(s.map === null && s.count === 91 && /Shared map ignored/.test(s.log), `bad code "${bad}" is ignored with a notice`);
		await page.close();
	}

	// 3. Editor: open, paint, base protection, share link.
	page = await open('?players=2');
	await page.getByRole('button', { name: '[🗺️ Map Maker]', exact: true }).click();
	await page.waitForTimeout(300);
	check(await page.locator('[role="dialog"][aria-label="Map maker"]').isVisible(), 'Map Maker button opens the editor');
	check(await page.locator('[role="dialog"][aria-label="Map maker"] button[aria-label^="Hex "]').count() === 91, 'editor shows 91 hexes at radius 5');

	await page.getByRole('button', { name: 'Mountain' }).click();
	const center = page.locator('button[aria-label="Hex 0, 0, Plain"]');
	await center.click();
	check(await page.locator('button[aria-label="Hex 0, 0, Mountain"]').count() === 1, 'clicking a hex paints the brush terrain');
	const baseCell = page.locator('button[aria-label^="Hex 0, 4, base of player"], button[aria-label^="Hex 0, -4, base of player"]').first();
	await baseCell.click({ force: true });
	const baseSet = await data(page, d => d.mapMaker.terrain.filter(t => t !== 'PLAIN').length);
	check(baseSet === 1, 'clicking a base hex does not paint it');

	await page.getByRole('button', { name: 'Forest' }).click();
	const box = await page.locator('button[aria-label="Hex 1, 0, Plain"]').boundingBox();
	const next = await page.locator('button[aria-label="Hex 2, -1, Plain"]').boundingBox();
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(next.x + next.width / 2, next.y + next.height / 2, { steps: 4 });
	await page.mouse.up();
	check(await data(page, d => d.mapMaker.terrain.filter(t => t === 'FOREST').length) >= 2, 'dragging paints several hexes');

	await page.getByRole('button', { name: 'Share link' }).click();
	const shareUrl = await page.locator('input[aria-label="Share link"]').inputValue();
	check(/[?&]cm=R5(%3A|:)/.test(shareUrl), `share link carries the map (${shareUrl.slice(0, 80)})`);
	const painted = await data(page, d => d.mapMaker.terrain);

	// 4. Round trip: opening the share link in a fresh page reproduces the exact terrain.
	const other = await browser.newPage();
	other.on('pageerror', e => { if (!e.message.includes("'_key'")) errors.push(`PAGEERROR: ${e.message}`); });
	await other.goto(shareUrl.replace(/^https?:\/\/[^/]+/, BASE_URL), { waitUntil: 'networkidle', timeout: 30000 });
	await other.waitForTimeout(2500);
	const loaded = await data(other, d => d.hexes.map(h => h.terrainType));
	check(JSON.stringify(loaded) === JSON.stringify(painted), 'share link round-trips the exact terrain in a fresh page');
	await other.close();

	// 5. Saving needs login.
	await page.getByRole('button', { name: 'Save' }).click();
	check(/Log in/.test(await data(page, d => d.mapMaker.notice)), 'saving while logged out points to login');

	// 6. Saving while logged in goes to /api/user/data key "maps" (mocked).
	const posts = [];
	await page.route('**/api/user/data**', async route => {
		const req = route.request();
		if (req.method() === 'POST') {
			posts.push(JSON.parse(req.postData()));
			await route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
		} else {
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: [{ name: 'Old', code: 'R3:37.', updatedAt: 'x' }, { name: 'Bad', code: 'nope', updatedAt: 'x' }] }) });
		}
	});
	await data(page, d => { d.auth.token = 'test-token'; d.auth.user = { name: 'T' }; d.openMapMaker(); });
	await page.waitForTimeout(400);
	check(await page.getByRole('button', { name: 'Old', exact: true }).count() === 1, 'saved maps list loads for a logged-in user');
	await page.getByRole('textbox', { name: 'Map name' }).fill('My Arena');
	await page.getByRole('button', { name: 'Save' }).click();
	await page.waitForTimeout(300);
	check(posts.length === 1 && posts[0].key === 'maps' && posts[0].value.some(m => m.name === 'My Arena' && m.code === shareUrl.match(/cm=([^&]+)/)[1].replace('%3A', ':')), 'save posts the map under key "maps"');
	check(posts[0].value.length === 3, 'save appends to the existing list (not replace)');

	await page.getByRole('button', { name: 'Old', exact: true }).click();
	check(await data(page, d => d.mapMaker.radius) === 3, 'loading a saved map switches radius and terrain');
	await page.getByRole('button', { name: 'Bad', exact: true }).click();
	check(/invalid/.test(await data(page, d => d.mapMaker.notice)) && await data(page, d => d.mapMaker.radius) === 3, 'a corrupt saved map is rejected without changing the editor');
	await page.getByRole('button', { name: 'Delete Old' }).click();
	await page.waitForTimeout(300);
	check(posts.length === 2 && !posts[1].value.some(m => m.name === 'Old'), 'delete removes it and posts the new list');

	// 7. Play-test applies the edited map and starts a game vs AI.
	await data(page, d => d.mmReset(5));
	await page.getByRole('button', { name: 'Lake' }).click();
	await page.locator('button[aria-label="Hex 0, 0, Plain"]').click();
	await page.getByRole('button', { name: /Play vs AI/ }).click();
	await page.waitForTimeout(600);
	s = await data(page, d => ({ open: d.mapMaker.open, lake: d.getHexByQR(0, 0).terrainType, ai: d.players[1].isAI, phase: d.phase }));
	check(!s.open && s.lake === 'LAKE' && s.ai, `Play vs AI closes the editor and uses the map (${JSON.stringify(s)})`);

	// 8. Escape closes the editor and does not trigger game keys.
	await data(page, d => d.openMapMaker());
	await page.keyboard.press('Escape');
	check(await data(page, d => d.mapMaker.open) === false, 'Esc closes the editor');

	check(errors.length === 0, `no page errors ${errors.join('; ')}`);
	await page.close();
} finally {
	await browser.close();
}
process.exit(failed ? 1 : 0);
