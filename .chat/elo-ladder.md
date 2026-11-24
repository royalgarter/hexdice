# Elo ladder for online rooms

## Goal
Rated 2-player online matches with a public leaderboard. Idea from Veilwars (Elo 1500, K=32, counts only after real play).

## Scope today
Online rooms exist only for Autochess, so that is what is rated. The schema is mode-agnostic (`matches.mode`) so a core-game online mode can reuse it.

## Rules
- A room is rated only if created with `rated: true` (checkbox). Exactly 2 distinct accounts, every round played (`roundResults.length >= maxRound`).
- Match winner = most round wins from server-recorded `roundResults` (not `p.wins`: the time-up path never increments it). Equal wins = draw.
- Elo 1500 start, K=40 for the first 20 games else 32. Draw = 0.5.
- Anti-farming: more than 3 rated games between the same pair in 24h are played but unrated (`reason: "pair cap"`).
- Idempotent: `matches` document keyed by room id is the claim; a second finalize is a no-op. Room becomes `FINISHED` with `result`.

## Server
`js/rating.ts` (pure math + `rateMatch`), `js/room-core.ts` (`recordRoundResult`, `matchWinner`, `finalizeMatch`, called from `scheduleAutoAdvance`; `GET /api/leaderboard`, `GET /api/me/rating`; `rated` on create), `server.ts` (`ratings`, `matches` collections). Round results persist in `rooms.gameState.roundResults`.

## Client
Rated checkbox + Ladder button (`html/autochess.html`), `html/ladder.html`, `handleMatchResult` on MQTT topic `hexdice/rooms/<id>/result` (cosmetic: ratings come from the DB, a spoofed message only changes a log line).

## Known gaps (not done)
- No resign/disconnect forfeit: a player who leaves forces no result and the match is simply never finished. Needs a heartbeat.
- Ratings write after the match claim is not transactional (a crash between the two leaves a claimed, unrated match).
- Final-round flow still calls `nextRound` after finalize (existing behaviour, only logs).
- Two Google accounts owned by one person cannot be detected.
- Multi-player (3-6) rooms are not rated.

## Tests
`tests/rating.test.ts` (math, idempotency, pair cap, hook wiring, persistence), `tests/browser-ladder.mjs`.
