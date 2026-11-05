/**
 * Browser E2E for the keyboard / screen-reader layer: hex grid roving focus, toolbar buttons, labels, reduced motion.
 *
 * Usage: BASE_URL=http://localhost:1166 CHROMIUM_PATH=... node tests/browser-a11y.mjs   (needs the dev server)
 */
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:1166';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
let failed = false;
const check = (ok, msg) => { if (!ok) { failed = true; console.error('FAIL:', msg); } else console.log('ok  :', msg); };

try {
	const page = await browser.newPage({ reducedMotion: 'reduce' });
	page.on('pageerror', e => { if (!e.message.includes("'_key'")) errors.push(`PAGEERROR: ${e.message}`); });
	await page.goto(`${BASE_URL}/?players=2`, { waitUntil: 'networkidle', timeout: 30000 });
	await page.waitForTimeout(2500);
	await page.evaluate(() => window.Alpine.$data(document.querySelector('[x-data]')).randomStart());
	await page.waitForTimeout(500);

	const hexes = page.locator('.hexagon[role="button"]');
	check(await hexes.count() > 30, `every hex is a button (${await hexes.count()})`);
	check(await page.locator('.hexagon[tabindex="0"]').count() === 1, 'exactly one hex is in the tab order');
	const label = await page.locator('.hexagon[tabindex="0"]').getAttribute('aria-label');
	check(/^Hex -?\d+, -?\d+, \w+/.test(label), `hex label names coordinates and terrain (${label})`);
	check(await page.locator('.hexagon[aria-label*="player"]').count() > 0, 'unit hexes name player, unit and stats');

	await page.locator('.hexagon[tabindex="0"]').focus();
	const startId = await page.evaluate(() => document.activeElement.dataset.id);
	await page.keyboard.press('ArrowRight');
	await page.waitForTimeout(150);
	const moved = await page.evaluate(() => document.activeElement.dataset.id);
	check(moved !== startId && await page.locator('.hexagon[tabindex="0"]').count() === 1, `arrow key moves focus (${startId} -> ${moved})`);
	await page.keyboard.press('ArrowLeft');
	await page.waitForTimeout(150);
	check(await page.evaluate(() => document.activeElement.dataset.id) === startId, 'opposite arrow returns to the start hex');

	const unitHex = page.locator('.hexagon[aria-label*="player 1"]').first();
	await unitHex.focus();
	await page.keyboard.press('Enter');
	await page.waitForTimeout(300);
	check(await unitHex.getAttribute('aria-pressed') === 'true', 'Enter selects the unit (aria-pressed)');

	const toolbar = await page.locator('button[aria-label^="Toggle"]').count();
	check(toolbar >= 3, `toolbar toggles are real buttons with names (${toolbar})`);
	check(await page.locator('a[href="#"]').count() === 0, 'no placeholder href="#" links remain');
	const sfx = page.locator('button[aria-label="Toggle sound effects"]');
	if (await sfx.count()) {
		const before = await sfx.getAttribute('aria-pressed');
		await sfx.focus();
		await page.keyboard.press('Enter');
		check(await sfx.getAttribute('aria-pressed') !== before, 'toolbar toggle flips aria-pressed from the keyboard');
	}
	check(await page.locator('[role="log"][aria-live="polite"]').count() === 1, 'live region announces the latest log message');

	const ring = await page.evaluate(() => {
		document.querySelector('.hexagon[tabindex="0"]').focus();
		return getComputedStyle(document.querySelector('.hexagon[tabindex="0"]'), '::before').backgroundColor;
	});
	check(ring !== 'rgb(102, 102, 102)', `focused hex swaps its border colour (${ring})`);

	const anim = await page.evaluate(() => {
		const el = document.querySelector('.unit-info-panel-hint') || document.querySelector('.cube');
		return el ? getComputedStyle(el).animationName + '|' + getComputedStyle(el).transitionDuration : 'none';
	});
	check(!anim.includes('unitPanelHintBob') && !/0\.6s/.test(anim), `reduced motion drops the bob and cube transition (${anim})`);
	check(errors.length === 0, `no page errors ${errors.join('; ')}`);
	await page.close();
} finally {
	await browser.close();
}
process.exit(failed ? 1 : 0);
