# Map maker + shareable maps

## Goal
Players paint terrain on a board, play it vs the AI, and share it as a URL. Logged-in players keep a saved list. Idea from Veilwars (user-made maps), minus its admin approval and gallery.

## Format
`R<radius>:<run-length terrain>`, e.g. `R5:45.1M10.1F8.1F25.`. Codes are the existing `HDFEN_TERRAIN_CODES` (`. F L T M`), hex order is `generateHexGrid` order. All-plain R5 = `R5:91.`. The RLE helpers (`terrainToRle`, `rleToTerrain`) are shared with HDFEN so puzzles and maps cannot drift.

## Safety (codes come from URLs and saved lists)
`decodeMap` rejects: non-matching pattern, length > 600, radius outside 3-8, run counts that do not sum to `3R(R+1)+1`, unknown codes. Bases are forced to PLAIN after `determineBaseLocations`, so a shared map cannot put a lake under a base.

## Flow
- `?cm=<code>`: `init()` decodes into `customMap`; `resetGame` applies it to non-campaign games (so Practice/Random keep the shared map). Bad code: ignored, notice logged after `resetGame` (which clears the log).
- Editor (`html/mapmaker.html`, state `mapMaker` in `game.js`): brush, radius 3-8, click/drag paint, bases locked, Share (copies link), Play vs AI, Save/Load/Delete.
- Saving: `/api/user/data` key `maps` (existing KV, `Authorization: Bearer <token>`), max 20 maps, requires login. Sharing and playing need no login.
- Not `?map=`: that param already means campaign level.

## Out of scope
Public gallery, moderation, custom base positions, multiplayer boards with a custom map, map thumbnails.

## Tests
`tests/map-codec.test.ts` (round-trips, hostile codes), `tests/browser-mapmaker.mjs` (load, hostile `cm`, paint/drag, base lock, share round-trip, login-gated save with mocked KV, play-test).
