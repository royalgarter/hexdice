# Undo last turn (vs AI)

## Goal
Take back my last turn and the AI reply. Idea from Veilwars (Ctrl+Z within a turn). Veilwars undoes plain moves; Hex Dice V1 resolves one action per turn, so the useful unit is a whole turn.

## Design
- Two snapshots: `_undoCur` (start of this human turn) and `_undoPrev` (start of the previous human turn). `_captureUndo()` runs in `startGamePlay` and at the end of `_endTurn` when the turn passes to the human.
- `undoTurn()` restores `_undoPrev`: players (JSON), hex unit links (derived from restored dice), `currentPlayerIndex`, `turnCount`, `turnPhase`, message log, `_seed`, replay move count. Then `_undoCur = snapshot`, `_undoPrev = null` (single level).
- `canUndo` requires: V1, PLAYER_TURN, exactly one human, human to move, not campaign/puzzle/autochess/online, a snapshot exists.
- UI: `↩ UNDO` button in `html/controller.html`, key `U`, help entry.

## Out of scope
V2 (fate phases + dice animation), campaign (HP/rewards/quest counters), online (MQTT checksum includes the seed), undo after game over.

## Test
`tests/browser-undo.mjs`: checksum after undo equals checksum at the start; guard action gone; hex/unit links consistent; single level; game continues; hotseat has no undo.
