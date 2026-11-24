# Keyboard Shortcuts

## Goal
Play a full turn without the mouse. Idea taken from Veilwars (E end turn, C capture, R repair, W wait, Ctrl+Z undo).

## Non-goals
Rebinding UI, gamepad, touch gestures. Hex focus navigation (Enter/Space/arrows) is untouched: `hexKeydown` in `js/game.js`.

## Design
- One `@keydown.window="handleGlobalKey($event)"` on the `<body>` root in `index.html`.
- `handleGlobalKey` early-returns for: typing targets (input/textarea/select/contenteditable), Ctrl/Meta/Alt combos, auto-repeat, story/world-map overlays, autochess, puzzles (only `Esc` and `?`), AI turns, online turns that are not mine, phases other than `PLAYER_TURN`.
- Every key calls the same method its toolbar button calls, behind the same `canPerformAction` check, so keys can never do more than buttons.

| Key | Action | Same as |
|---|---|---|
| `G` | Guard selected unit | `performAction('GUARD')` |
| `R` | Reroll (at base) | `performAction('REROLL')` |
| `A` | Ranged attack | `initiateAction('RANGED_ATTACK')` |
| `1` `2` `3` | Oracle Shield / Swap / Skirmish | `selectOracleSpell` |
| `M` | Merge | `initiateAction('MERGE')` |
| `T` | Transmute | `initiateAction('SPELLCAST_SACRIFICE')` |
| `Esc` | Cancel action, else deselect | `cancelAction()` |
| `F` | End Fate (V2) | `startTacticalCommand()` |
| `E` | End turn | `endTurn()` |
| `?` | Toggle shortcut help | `showKeyHelp` |

`U` (undo) is added by the undo feature, not here.

## Files
`js/game.js` (handler + `showKeyHelp`), `index.html` (listener), `html/controller.html` (`aria-keyshortcuts`, titles), `html/toolbars.html` (help button/overlay), `tests/browser-keys.mjs`.

## Test
Playwright: select a unit, press `G`, assert unit guarding; `Esc` deselects; `E` passes the turn; keys ignored while an input is focused and on AI turns.
