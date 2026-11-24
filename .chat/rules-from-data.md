# Rules page from live data

## Goal
The Unit table on `rules.html` can never disagree with the game. Idea from Veilwars, whose rules page is computed from the published ruleset and fails a test when a rule is undocumented.

## Constraint
`rulesHash()` (`js/rules-regression.ts`) hashes `rules/RULES.md` + `js/constants.js`. Editing either marks the evolved AI champions stale (re-score needed). So this change touches **neither file**.

## Deviation from first plan
- Planned a new `js/rules-data.js` with terrain cost/defense/LoS. Dropped: those numbers live only in `game.js` logic and `RULES.md`, so a new file would be a third copy, not a source of truth.
- Kept: unit stats (the one real single source: `UNIT_STATS`) are rendered live; terrain stays prose, but a test pins its keys to `TERRAIN_CONFIG`.

## Design
- `rules.html`: after markdown renders, fetch `/js/constants.js` as text, extract the `const UNIT_STATS = {...}` literal, evaluate it, rewrite the Armor/Attack/Range/Distance/Movement cells of the Dice/Unit table by dice value (Notes untouched). Movement glyph `X` shows as `ж`. Failure leaves the markdown table as written.
- Worked V1 combat example under the Combat section: Hussar vs Fencer on FOREST, with and without Guard, numbers from `UNIT_STATS`.
- `tests/rules-docs.test.ts` (`npm run test:rules`): parse the RULES.md unit table and compare to `UNIT_STATS`; every `TERRAIN_CONFIG` key has a row in the terrain table; BIND-EDIT heading exists in RULES.md.

## Files
`rules.html`, `tests/rules-docs.test.ts`, `package.json`.
