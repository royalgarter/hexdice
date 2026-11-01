/**
 * E2E: full online Autochess game with two clients making "suicide" moves.
 *
 * Each preparation phase a client pushes its strongest units onto the deployment
 * hexes closest to the enemy base, then readies up. Combat is simulated on the
 * server; the test passes when the game reaches the final round's end, both
 * clients agree on the result, and no more than MAX_MOVES actions were sent.
 *
 * Stack requirements: see tests/e2e-multiplayer.mjs (ArangoDB, MQTT ws broker,
 * server with DEBUG_AUTH=1). Takes up to ~10 min (10 rounds x 60s combat cap).
 *   BASE_URL=http://localhost:1166 node tests/e2e-multiplayer-game.mjs
 */
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:1166';
const MAX_MOVES = Number(process.env.MAX_MOVES) || 200;
const DEADLINE_MS = Number(process.env.DEADLINE_MS) || 14 * 60 * 1000;
const RUN = Date.now().toString(36);
const HOST = `host${RUN}`;
const GUEST = `guest${RUN}`;

const game = (page, fn, arg) => page.evaluate(({ src, arg }) => {
	const g = window.Alpine.$data(document.querySelector('[x-data]'));
	return new Function('g', 'arg', src)(g, arg);
}, { src: `return (${fn.toString()})(g, arg)`, arg });

const snapshot = (page) => game(page, (g) => ({
	status: g.online.status,
	phase: g.Autochess.state.phase,
	round: g.Autochess.state.round,
	maxRound: g.Autochess.state.maxRound,
	wins: g.players.map(p => p.wins),
	dice: g.players.map(p => p.dice.length),
	moves: (window.__moves || []).length,
	ready: !!g.Autochess.state.ready?.[g.auth.user._key],
}));

const instrument = (page) => game(page, (g) => {
	window.__moves = [];
	const orig = g.publishAction.bind(g);
	g.publishAction = (type, data) => { window.__moves.push(type); return orig(type, data); };
});

// Push up to 3 strongest units onto the free deployment hexes nearest the enemy base.
const suicideMoves = (page) => game(page, (g) => {
	const me = g.autochessPlayerIndex;
	const base = g.getHex(g.players[me].baseHexId);
	const enemy = g.players.find((_, i) => i !== me);
	const enemyBase = g.getHex(enemy.baseHexId);
	if (!base || !enemyBase) return 0;
	const dist = (a, b) => g.axialDistance(a.q, a.r, b.q, b.r);
	const zone = g.hexes.filter(h => dist(base, h) <= 2 && !h.unit)
		.sort((a, b) => dist(a, enemyBase) - dist(b, enemyBase));
	const units = g.players[me].dice
		.filter(u => u.hexId != null && u.isDeployed && !u.isDeath)
		.sort((a, b) => (b.hp + b.attack) - (a.hp + a.attack))
		.slice(0, 3);
	let moved = 0;
	for (const u of units) {
		const target = zone.shift();
		if (!target || dist(target, enemyBase) >= dist(g.getHex(u.hexId), enemyBase)) continue;
		g.handleHexClick(u.hexId);
		g.handleHexClick(target.id);
		moved++;
	}
	return moved;
});

let failed = 0;
const check = (cond, msg) => {
	console.log(`${cond ? 'PASS' : 'FAIL'}: ${msg}`);
	if (!cond) failed++;
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
try {
	const host = await (await browser.newContext()).newPage();
	const guest = await (await browser.newContext()).newPage();
	for (const [name, p] of [['host', host], ['guest', guest]]) {
		p.on('pageerror', e => errors.push(`${name}: ${e.message}`));
	}
	await host.goto(`${BASE_URL}/?autochess=true&auth_user=${HOST}`);
	await guest.goto(`${BASE_URL}/?autochess=true&auth_user=${GUEST}`);

	await host.getByRole('button', { name: 'New Room' }).first().click();
	await host.waitForFunction(() => window.Alpine.$data(document.querySelector('[x-data]')).online.status === 'LOBBY');
	const roomId = await game(host, g => g.online.roomId);
	guest.once('dialog', d => d.accept(roomId));
	await guest.getByRole('button', { name: 'Join' }).first().click();
	await guest.waitForFunction(() => window.Alpine.$data(document.querySelector('[x-data]')).online.status === 'LOBBY');
	await host.waitForFunction(() => window.Alpine.$data(document.querySelector('[x-data]')).players.length >= 2, null, { timeout: 15000 });

	await instrument(host);
	await instrument(guest);
	await host.getByRole('button', { name: 'Start Game' }).click();

	const started = (p) => p.waitForFunction(() => {
		const g = window.Alpine.$data(document.querySelector('[x-data]'));
		return g.Autochess.state.phase === 'PREPARATION' && g.players.length >= 2 && g.players.every(pl => pl.dice.length > 0);
	}, null, { timeout: 20000 });
	await Promise.all([started(host), started(guest)]);
	check(true, 'game started: both clients in PREPARATION with armies');

	const t0 = Date.now();
	const actedRound = { host: 0, guest: 0 };
	const sawCombat = new Set();
	let totalMoves = 0;
	let finished = false;
	let last = {};
	let lastSig = '';
	let clickWarned = false;

	while (Date.now() - t0 < DEADLINE_MS) {
		const [h, g] = await Promise.all([snapshot(host), snapshot(guest)]);
		last = { h, g };
		const sig = `${h.phase}/${h.round}|${g.phase}/${g.round}`;
		if (sig !== lastSig) {
			lastSig = sig;
			console.log(`[${Math.round((Date.now() - t0) / 1000)}s] host=${h.phase}#${h.round} guest=${g.phase}#${g.round} wins=${JSON.stringify(h.wins)} moves=${h.moves + g.moves}`);
		}
		totalMoves = h.moves + g.moves;
		if (h.phase === 'COMBAT') sawCombat.add(h.round);
		if (totalMoves >= MAX_MOVES) break;
		if (h.round > h.maxRound && g.round > g.maxRound) { finished = true; break; }

		for (const [name, page, s] of [['host', host, h], ['guest', guest, g]]) {
			if (s.phase === 'PREPARATION' && actedRound[name] !== s.round) {
				actedRound[name] = s.round;
				await suicideMoves(page);
				await game(page, g => g.toggleAutochessReady());
			}
		}
		if (h.phase === 'RECAP' && h.round <= h.maxRound) {
			// Server auto-advances after 5s; clicking Continue exercises AUTOCHESS_NEXT_ROUND too.
			await host.getByRole('button', { name: 'Continue' }).click({ timeout: 1000 }).catch((e) => {
				if (!clickWarned) console.log(`note: Continue click failed (${e.message.split('\n')[0]})`);
				clickWarned = true;
			});
		}
		await host.waitForTimeout(500);
	}

	console.log(`state: ${JSON.stringify(last)} elapsed=${Math.round((Date.now() - t0) / 1000)}s moves=${totalMoves}`);
	check(last.h?.status === 'PLAYING' && last.g?.status === 'PLAYING', `both clients are PLAYING (host=${last.h?.status}, guest=${last.g?.status})`);
	check(finished, `game reached the end (round > ${last.h?.maxRound})`);
	check(totalMoves < MAX_MOVES, `finished within move cap (${totalMoves}/${MAX_MOVES})`);
	check(sawCombat.size >= (last.h?.maxRound || 10), `combat ran every round (${[...sawCombat].join(',')})`);
	check(JSON.stringify(last.h?.wins) === JSON.stringify(last.g?.wins), `clients agree on wins ${JSON.stringify(last.h?.wins)}`);
	check(last.h?.wins.reduce((a, b) => a + b, 0) > 0, 'at least one round had a winner');
	check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
} finally {
	await browser.close();
}
process.exit(failed ? 1 : 0);
