#!/usr/bin/env node
/**
 * Decides whether a nightly evolution run beats the champions currently shipped in js/ai/evolved-profiles.js.
 *
 * Usage: node scripts/nightly-compare.js evolution/<newRun> [--margin=0.02]
 * Both sets are scored by validation.json on the same held-out seed block (9,000,000), so heldSeeds is comparable.
 * Improved = more champions pass, or the same number pass and the mean held-out rate rises by more than the margin.
 * Prints IMPROVED / SAME and exits 0 / 3 (any other nonzero = error).
 */
const fs = require('fs');
const path = require('path');

const newRun = process.argv[2];
const marginArg = process.argv.find(a => a.startsWith('--margin='));
const margin = marginArg ? Number(marginArg.split('=')[1]) : 0.02;
if (!newRun) {
	console.error('usage: node scripts/nightly-compare.js evolution/<runId> [--margin=0.02]');
	process.exit(1);
}

const passing = dir => JSON.parse(fs.readFileSync(path.join(dir, 'validation.json'), 'utf8')).filter(v => v.ok);
const mean = list => list.reduce((s, v) => s + v.heldSeeds, 0) / Math.max(1, list.length);

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'ai', 'evolved-profiles.js'), 'utf8');
const shippedRun = (src.match(/from (evolution\/run-[^\s]+)/) || [])[1];
const shipped = shippedRun && fs.existsSync(path.join(shippedRun, 'validation.json')) ? passing(shippedRun) : [];
const fresh = passing(newRun);

console.log(`shipped ${shippedRun || 'none'}: ${shipped.length} pass, mean held-out ${(mean(shipped) * 100).toFixed(1)}%`);
console.log(`new     ${newRun}: ${fresh.length} pass, mean held-out ${(mean(fresh) * 100).toFixed(1)}%`);

const improved = fresh.length >= 2 && (fresh.length > shipped.length || (fresh.length === shipped.length && mean(fresh) > mean(shipped) + margin));
console.log(improved ? 'IMPROVED' : 'SAME');
process.exit(improved ? 0 : 3);
