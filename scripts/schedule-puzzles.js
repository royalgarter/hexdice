#!/usr/bin/env node
/**
 * Assigns pool puzzles to calendar days -> puzzles/schedule.json
 *
 * Usage: node scripts/schedule-puzzles.js [--start=2026-11-03] [--days=365]
 *
 * - Puzzles that failed the live-defender gate (puzzles/replay-report.json) are skipped.
 * - Weekday ramp: puzzles sorted by (difficulty, n); Monday draws from the easiest seventh, Sunday from the hardest.
 * - Within a band the least recently used puzzle wins, ties broken by a fixed hash, so no repeat happens before the band cycles.
 * - Existing entries are frozen: re-running only appends days after the last one, so growing the pool never reshuffles dates.
 */
const fs = require('fs');
const path = require('path');

const POOL = path.join(__dirname, '..', 'puzzles', 'pool');
const OUT = path.join(__dirname, '..', 'puzzles', 'schedule.json');
const REPORT = path.join(__dirname, '..', 'puzzles', 'replay-report.json');

const arg = (name, def) => (process.argv.find(a => a.startsWith(`--${name}=`)) || '').split('=')[1] || def;
const DAY_MS = 864e5;
const dayNumber = iso => Math.floor(Date.parse(iso + 'T00:00:00Z') / DAY_MS);
const isoOf = n => new Date(n * DAY_MS).toISOString().slice(0, 10);

function hash(str) {
	let h = 2166136261;
	for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
	return h >>> 0;
}

function loadPool() {
	const report = fs.existsSync(REPORT) ? JSON.parse(fs.readFileSync(REPORT, 'utf8')) : {};
	const puzzles = [];
	for (const sub of fs.readdirSync(POOL, { withFileTypes: true })) {
		if (!sub.isDirectory() || ['rejected', 'unverified'].includes(sub.name)) continue;
		for (const f of fs.readdirSync(path.join(POOL, sub.name))) {
			if (!f.endsWith('.json') || f === 'index.json') continue;
			const key = `${sub.name}/${f}`;
			if (report[key] && !report[key].ok) continue;
			const p = JSON.parse(fs.readFileSync(path.join(POOL, key), 'utf8'));
			puzzles.push({ entry: key.replace(/\.json$/, ''), difficulty: p.difficulty, n: p.n });
		}
	}
	return puzzles.sort((a, b) => a.difficulty - b.difficulty || a.n - b.n || hash(a.entry) - hash(b.entry));
}

const pool = loadPool();
const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
const start = existing ? existing.start : arg('start', '2026-11-03');
const entries = existing ? [...existing.entries] : [];
const total = Number(arg('days', 365));

const lastUsed = new Map();
entries.forEach((e, i) => lastUsed.set(e, i));

for (let i = entries.length; i < total; i++) {
	const weekday = (new Date((dayNumber(start) + i) * DAY_MS).getUTCDay() + 6) % 7; // Mon=0
	const lo = Math.floor(weekday * pool.length / 7);
	const hi = Math.max(lo + 1, Math.floor((weekday + 1) * pool.length / 7));
	const band = pool.slice(lo, hi);
	band.sort((a, b) => (lastUsed.get(a.entry) ?? -1) - (lastUsed.get(b.entry) ?? -1) || hash(a.entry) - hash(b.entry));
	entries.push(band[0].entry);
	lastUsed.set(band[0].entry, i);
}

fs.writeFileSync(OUT, JSON.stringify({ version: 1, start, entries }, null, '\t') + '\n');
console.log(`${entries.length} days from ${start} to ${isoOf(dayNumber(start) + entries.length - 1)}, ${new Set(entries).size} distinct puzzles of ${pool.length}`);
