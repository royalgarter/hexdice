/**
 * E2E: New Room / Join / rejoin with two browser contexts.
 *
 * Needs a full stack: ArangoDB (ARANGODB_URI), an MQTT broker over websocket
 * (`npm run start:mqtt`, set MQTT=ws://localhost:8883), and the server with
 * DEBUG_AUTH=1 so `?auth_user=` logins are accepted:
 *   DEBUG_AUTH=1 npm start
 *   BASE_URL=http://localhost:1166 node tests/e2e-multiplayer.mjs
 */
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:1166';
const RUN = Date.now().toString(36);
const HOST = `host${RUN}`;
const GUEST = `guest${RUN}`;

const online = (page) => page.evaluate(() => {
	const game = window.Alpine?.$data(document.querySelector('[x-data]'));
	return game && {
		roomId: game.online.roomId,
		status: game.online.status,
		isHost: game.online.isHost,
		playerIndex: game.online.playerIndex,
		opponent: game.online.opponent?.name ?? null,
		players: game.players.map(p => p.name),
	};
});

const waitFor = async (page, pred, label, timeout = 10000) => {
	try {
		await page.waitForFunction(pred, null, { timeout });
	} catch {
		throw new Error(`timeout: ${label}; state=${JSON.stringify(await online(page))}`);
	}
};
const onlineState = '(() => window.Alpine.$data(document.querySelector("[x-data]")).online)()';

let failed = 0;
const check = (cond, msg) => {
	console.log(`${cond ? 'PASS' : 'FAIL'}: ${msg}`);
	if (!cond) failed++;
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
	const hostCtx = await browser.newContext();
	const guestCtx = await browser.newContext();
	const host = await hostCtx.newPage();
	const guest = await guestCtx.newPage();
	const errors = [];
	for (const [name, p] of [['host', host], ['guest', guest]]) {
		p.on('pageerror', e => errors.push(`${name}: ${e.message}`));
	}

	await host.goto(`${BASE_URL}/?autochess=true&auth_user=${HOST}`);
	await guest.goto(`${BASE_URL}/?autochess=true&auth_user=${GUEST}`);

	await host.getByRole('button', { name: 'New Room' }).click();
	await waitFor(host, `${onlineState}.status === 'LOBBY'`, 'host in lobby');
	const hostState = await online(host);
	check(/^[A-Z0-9]{6}$/.test(hostState.roomId), `room id looks valid (${hostState.roomId})`);
	check(hostState.isHost && hostState.playerIndex === 0, 'creator is host, index 0');
	check(new URL(host.url()).searchParams.get('room') === hostState.roomId, 'room id in host URL');

	guest.once('dialog', d => d.accept(hostState.roomId.toLowerCase()));
	await guest.getByRole('button', { name: 'Join' }).click();
	await waitFor(guest, `${onlineState}.status === 'LOBBY' && ${onlineState}.playerIndex === 1`, 'guest joined');
	const guestState = await online(guest);
	check(guestState.roomId === hostState.roomId, 'guest in same room (case-insensitive id)');
	check(guestState.opponent === HOST, 'guest sees host as opponent');
	check(guestState.players.join() === [HOST, GUEST].join(), 'guest roster = [host, guest]');

	// Guest reloads via the shared URL -> rejoin must not duplicate the player
	await guest.goto(`${BASE_URL}/?autochess=true&auth_user=${GUEST}&room=${hostState.roomId}`);
	await waitFor(guest, `${onlineState}.roomId !== null`, 'guest auto-rejoin');
	const rejoined = await online(guest);
	check(rejoined.playerIndex === 1 && rejoined.players.length === 2, 'rejoin keeps index 1, roster size 2');

	// Third user cannot join a bogus room
	const third = await (await browser.newContext()).newPage();
	await third.goto(`${BASE_URL}/?autochess=true&auth_user=third${RUN}`);
	third.once('dialog', d => d.accept('ZZZZZZ'));
	await third.getByRole('button', { name: 'Join' }).click();
	await third.waitForTimeout(1500);
	check((await online(third)).status === 'OFFLINE', 'unknown room id leaves user offline');

	// Host sees the guest, then guest leaves the lobby -> seat freed server-side
	const rosterOf = (p) => p.evaluate(async (id) => {
		const game = window.Alpine.$data(document.querySelector('[x-data]'));
		const r = await fetch('/api/rooms/join', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${game.auth.token}` }, body: JSON.stringify({ roomId: id, name: game.auth.user.name }) });
		return (await r.json()).players?.map(x => x.name);
	}, hostState.roomId);
	await guest.getByRole('button', { name: '[Leave]' }).click();
	await guest.waitForLoadState('load');
	check((await rosterOf(host)).join() === HOST, 'leaving frees the seat');

	check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
} finally {
	await browser.close();
}
process.exit(failed ? 1 : 0);
