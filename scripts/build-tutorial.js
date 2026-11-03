#!/usr/bin/env node
/**
 * Builds puzzles/tutorial.json (Daily Puzzle P6): an ordered lesson track picked from the verified pool.
 *
 * Usage: node scripts/build-tutorial.js
 *
 * Each lesson is "the smallest board whose unique winning first move uses <unit/action> at <n> turns", so the
 * lesson isolates one idea. Picks are deterministic (fewest units, then id) and skip puzzles that failed the live-defender gate.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'puzzles');
const report = JSON.parse(fs.readFileSync(path.join(ROOT, 'replay-report.json'), 'utf8'));

const pool = [];
for (const dir of fs.readdirSync(path.join(ROOT, 'pool'), { withFileTypes: true })) {
	if (!dir.isDirectory() || ['rejected', 'unverified'].includes(dir.name)) continue;
	for (const f of fs.readdirSync(path.join(ROOT, 'pool', dir.name))) {
		if (!f.endsWith('.json') || f === 'index.json') continue;
		const key = `${dir.name}/${f}`;
		if (report[key] && !report[key].ok) continue;
		const p = JSON.parse(fs.readFileSync(path.join(ROOT, 'pool', key), 'utf8'));
		pool.push({ entry: key.replace(/\.json$/, ''), p, size: p.units[0] + p.units[1] });
	}
}

const LESSONS = [
	{ unit: 'D1', action: 'MOVE', n: 1, title: 'Fencer: the all-rounder', text: 'You win by moving a unit onto the enemy base or by removing every enemy unit. The Fencer walks up to 2 steps in any direction and hits for 2. One move wins here: find it.' },
	{ unit: 'D3', action: 'MOVE', n: 1, title: 'Hussar: the fast striker', text: 'The Hussar jumps in an L-shape and covers up to 3 hexes, but has no armor. Speed is its weapon: look for the base it can reach in one jump.' },
	{ unit: 'D4', action: 'MOVE', n: 1, title: 'Knight: the diagonal rider', text: 'The Knight moves along six diagonal lines, up to 3 hexes. Check which of its lines ends on the enemy base.' },
	{ unit: 'D5', action: 'MOVE', n: 1, title: 'Tanker: the wall', text: 'The Tanker has armor 4 but moves only 1 hex and attacks for 1. The base is one step away: the hard part is knowing which unit is the one that gets there.' },
	{ unit: 'D2', action: 'MOVE', n: 2, title: 'Archer: two turns', text: 'The Archer shoots 2 hexes away but moves only 1. Now you have 2 turns: the first move sets up the second, and the enemy answers in between.' },
	{ unit: 'D6', action: 'MOVE', n: 2, title: 'Oracle: a support piece', text: 'The Oracle has no attack and no armor, so it never wins a fight, but it still occupies space and can go where it is safe. Plan both turns.' },
	{ unit: 'D6', action: 'SPELLCAST_SWAP', n: 2, title: 'Oracle: Swap', text: 'The Oracle can swap places with a friendly unit within range 2 (not while an enemy is adjacent to it). Swapping teleports a strong piece forward.' },
	{ unit: 'D4', action: 'MOVE', n: 2, title: 'Think two moves ahead', text: 'Not every first move that looks good works: the enemy replies in between. Only one first move forces the win.' },
	{ unit: 'D1', action: 'MOVE', n: 3, title: 'Three turns', text: 'The enemy has three chances to answer. Count the turns it needs to stop you, then find the line that is faster.' },
];

const lessons = LESSONS.map((l, i) => {
	const pick = pool
		.filter(({ p }) => p.firstMove.unit === l.unit && p.firstMove.actionType === l.action && p.n === l.n)
		.sort((a, b) => a.size - b.size || a.entry.localeCompare(b.entry))[0];
	if (!pick) throw new Error(`no puzzle for lesson ${i + 1}: ${l.title}`);
	return { entry: pick.entry, title: l.title, text: l.text, n: l.n };
});

fs.writeFileSync(path.join(ROOT, 'tutorial.json'), JSON.stringify({ version: 1, lessons }, null, '\t') + '\n');
console.log(lessons.map((l, i) => `${i + 1}. ${l.title} -> ${l.entry} (n=${l.n})`).join('\n'));
