# Hex Dice Autochess Online: Authoritative Architecture & Board Deployment (Part 2)

> **Target Audience:** AI Agentic Code Assistants & Senior Engineers  
> **Context:** This document dissects the online multiplayer architecture of Hex Dice's Autochess mode, focusing on the `deployPlayerUnits` pattern — a frequent source of bugs when extending the codebase.

---

## 1. Architecture Overview: MQTT Pub/Sub with Authoritative Server

Hex Dice uses a lightweight authoritative server pattern:

```
 Client A (Host)          MQTT Broker          Server (Deno)         Client B (Guest)
      |                       |                     |                       |
      |-- publishAction() --->|                     |                       |
      |                       |-- handleRoomAction->|                       |
      |                       |                     |-- validate & mutate   |
      |                       |                     |-- broadcastState() -->|
      |<-- broadcastState() --|                     |                       |
```

**Key Principles:**
- **Clients publish actions** via MQTT topics (`hexdice/rooms/{roomId}`)
- **Server listens** to all messages, **validates**, **executes** game logic, and **broadcasts** the authoritative state
- **Clients apply broadcast state** directly — the client does NOT locally execute game logic in online mode (it defers to the server)
- Combat simulation runs **on the server** and streams incremental state updates back to clients

### The Publish-Execute-Broadcast Cycle

Each autochess action follows this exact flow:

```
IF online (GAME.online?.roomId is truthy):
  → GAME.publishAction('AUTOCHESS_*', data)
  → RETURN (prevent local execution)

ELSE (server-side or single-player):
  → Execute logic directly
  → Mutate GAME state
```

---

## 2. The Board Deployment Pattern (`deployPlayerUnits`)

### Function Signature (Current)

```js
Autochess.deployPlayerUnits(GAME, playerIdx = 0)
```

This function:
1. **Clears only this player's units** from the board (`hex.unit.playerId === playerIdx`)
2. Takes the player's first 6 dice (`player.dice.slice(0, 6)`)
3. Resets each unit's HP, clears `isDeployed`/`hexId`
4. Places them on valid deployment hexes for that player
5. `calcValidDeploymentHexes` already filters enemy-occupied hexes, so deployment is naturally conflict-free

### Callers

All callers are uniform — no flag argument:

```js
// init:
GAME.players.forEach((_, idx) => GAME.Autochess.deployPlayerUnits(GAME, idx));

// nextRound:
GAME.players.forEach((_, idx) => GAME.Autochess.deployPlayerUnits(GAME, idx));

// mergeUnits:
GAME.Autochess.deployPlayerUnits(GAME, playerId);
```

The function is stateless and idempotent: calling it for any player only affects that player's board presence. It never touches other players' hexes.

### Historical Context: Why the `clear` Flag Was Removed

The original version had a `clear` flag: `deployPlayerUnits(GAME, playerIdx, clear = true)`. When `clear=true`, it wiped **all hexes** unconditionally. Callers used `clear: idx === 0` to coordinate clearing:

```js
// OLD pattern — fragile coordination hack
GAME.players.forEach((_, idx) => {
  GAME.Autochess.deployPlayerUnits(GAME, idx, idx === 0);
  // P0: clears all hexes → deploys P0's units
  // P1: skips clear → deploys P1's units on remaining hexes
});
```

**Why this broke in multiplayer:**

`mergeUnits` called `deployPlayerUnits(GAME, playerId, idx === 0)` where `idx` was **undeclared** — it only existed inside the `forEach` callbacks above. In non-strict mode, this leaked to global scope (`undefined === 0` → `false` — accidentally correct by luck). The real issue: `clear=true` wiped the entire board, destroying the other player's manually placed units.

**Why it was masked in single-player:**  
Player 1 is AI (redeployed during combat anyway), so the lost board position went unnoticed.

**The fix:** Remove the `clear` flag. Scope clearing to `hex.unit.playerId === playerIdx`. Each player's deployment is now self-contained, safe to call independently.

---

## 3. Online Action Handling Map

Here is every autochess action and how it flows through the system:

| Action | Client publishes | Server handles | State mutation |
|--------|-----------------|----------------|----------------|
| `AUTOCHESS_RECRUIT` | `recruitUnit()` | `mergeUnits()` → push unit to `player.dice` | Local to player |
| `AUTOCHESS_MERGE` | `mergeUnits()` | `mergeUnits()` → upgrade unit, remove consumed | Local to player |
| `AUTOCHESS_MOVE` | `moveUnit()` | `moveUnit()` → reorder `player.dice` | Local to player |
| `AUTOCHESS_PLACE` | `placeUnit()` | Place unit on hex, clear source hex | Board hex ↔ unit |
| `AUTOCHESS_REROLL` | `rerollRecruits()` | `rerollRecruits()` → regenerate inventory | Local to player |
| `AUTOCHESS_START_COMBAT` | `startCombat()` | Run full combat simulation on server | Board-wide |
| `AUTOCHESS_READY` | `toggleReady()` | Toggle ready flag; start combat when all ready | Per-player flag |
| `AUTOCHESS_NEXT_ROUND` | `nextRound()` | Advance round, regenerate terrain/recruits, redeploy | Board-wide |

---

## 4. State Broadcasting & Client Reconciliation

### Full vs Light State

The server broadcasts different levels of detail depending on the phase:

```js
function broadcastState(roomId, game, full = false) {
  if (full || phase !== 'COMBAT') {
    // Send everything: players, dice, hexes with full unit references
    state.players = game.players.map(p => ({ id, name, wins, dice }));
    state.hexes = game.hexes.map(h => ({ id, unitId, unit, terrainType }));
  } else {
    // Combat streaming: only dynamic unit data
    state.units = game.players.flatMap(p => p.dice.map(d => ({
      id, hexId, hp, actionGauge, isDeath
    })));
  }
}
```

- **Preparation/Recap phases:** Full state (all dice, all hexes, inventory, rerolls)
- **Combat phase:** Lightweight streaming (only HP, gauge, position, death status)

### Client-Side Application

When a client receives the broadcast state, it replaces local state wholesale:

```js
// Client-side pseudo-code:
game.players = state.players  // Full replacement
game.hexes = state.hexes      // Full replacement
// For combat streaming, only UPDATE unit fields by ID
state.units.forEach(u => {
  const localUnit = findUnit(game, u.id);
  if (localUnit) Object.assign(localUnit, u);
});
```

---

## 5. Pitfalls & Design Guidelines for AI Agents

### 🚨 Rule 1: Never clear the board during a player-scoped action

`surgical` updates are preferred over `deployPlayerUnits` during per-player actions:

| Action | Correct approach |
|--------|-----------------|
| Merge | Clear only the consumed unit's hex (`hex.unit = null`) |
| Recruit | Place unit in first empty deployment hex |
| Place | Set/clear specific hexes, no loop over all hexes |

Calling `deployPlayerUnits(..., true)` from any player-scoped action is **always wrong in multiplayer**.

### 🚨 Rule 2: Check the `GAME.online?.roomId` guard

Every autochess function that mutates state must follow the pattern:

```js
myFunction(GAME, ...args) {
  if (GAME.online?.roomId) {
    GAME.publishAction('AUTOCHESS_MY_ACTION', { ...args });
    return; // ← CRITICAL: prevent local execution
  }
  // ... server/single-player logic ...
}
```

Omitting the `return` causes **double execution** — the server runs the logic AND the client runs it locally. The client's local state is then overwritten by the server's broadcast, causing visual glitches.

### 🚨 Rule 3: Avoid undeclared variable leaks

The `mergeUnits` bug (`idx === 0` where `idx` is undeclared) is a classic JavaScript pitfall in non-strict mode. Always verify that variables used inside a function are either:
- Parameters of that function
- Declared locally (`const`/`let`/`var`)
- Properties of `GAME` or another passed-in object

### 🚨 Rule 4: The `clear` parameter is a design smell

The `deployPlayerUnits` function's `clear` flag is a **coordination hack** that works only because `init()` and `nextRound()` call it in a specific order within a `forEach` loop. This pattern:

```js
GAME.players.forEach((_, idx) => {
  GAME.Autochess.deployPlayerUnits(GAME, idx, idx === 0);
});
```

**Is not stateless.** It relies on `player[0]` running first and clearing the board. If the order changes or if a single player's deployment is triggered independently (like in `mergeUnits`), the invariant breaks.

**Applied fix:** The `clear` parameter was removed entirely. `deployPlayerUnits` now scopes clearing to `hex.unit.playerId === playerIdx` — it never touches other players' hexes. `calcValidDeploymentHexes` already filters enemy-occupied hexes, so deployment is conflict-free. All callers are now uniform: `deployPlayerUnits(GAME, idx)`. No `clear` flag anywhere.

---

## 6. Fixes Applied

| Issue | File | Before | After |
|-------|------|--------|-------|
| `deployPlayerUnits` clears all hexes | `autochess.js` | `clear` parameter with global clear | Player-scoped clear: `hex.unit.playerId === playerIdx` |
| `mergeUnits` undeclared `idx` | `autochess.js:237` | `deployPlayerUnits(GAME, playerId, playerId === 0)` | `deployPlayerUnits(GAME, playerId)` |
| `init()`/`nextRound()` fragile flag | `autochess.js` | `deployPlayerUnits(GAME, idx, idx === 0)` | `deployPlayerUnits(GAME, idx)` |
| Enemy units visible during online prep | `game.js`, `hex-grid.html` | All units rendered on hex grid | Sprite & UI cloaked via `isAutochessOnlinePrep` + `hex.unit.playerId` filter |

---

## 7. Architecture Decision: Why No Client-Side Prediction

Hex Dice Autochess deliberately avoids client-side prediction. The rationale:

- **Combat is fully automated** — there is no player input during combat, so there is no "feel" penalty from latency
- **Preparation phase actions are infrequent** (recruit, merge, place) — 100-200ms server round-trip is imperceptible
- **Simplicity** — no reconciliation, no rollback, no conflict resolution
- **Deno server** runs the exact same JS code as the client (`engine-server.ts` evals `game.js` + `autochess.js`), so there should be zero divergence between local and server logic

If client-side prediction were ever needed (e.g., for real-time movement), the checksum verification in `handleMQTTMessage` provides a desync detection foundation.

---

*"The clearest code is the code you don't need to write — but if you must write it, make sure it only touches what it owns."*
