# Online Mode Implementation Plan

This document outlines the plan for implementing an online 2-player mode for Hex Dice using MQTT, Google One Tap Signin, and ArangoDB.

## Architecture

### Frontend
- **Framework:** Alpine.js (existing)
- **Communication:** MQTT over WebSockets (using `mqtt.js`)
- **Authentication:** Google One Tap Signin

### Backend (Deno)
- **API:** REST for Auth and Room management.
- **Database:** ArangoDB for user profiles and game state persistence.
- **MQTT Broker:** External (e.g., HiveMQ, Shiftr.io) or self-hosted (Mosquitto).

## Data Schema

### User (ArangoDB)
```json
{
  "_key": "google_sub_id",
  "email": "user@example.com",
  "name": "User Name",
  "picture": "url",
  "stats": {
    "wins": 0,
    "losses": 0
  }
}
```

### Game Room (ArangoDB)
```json
{
  "_key": "room_id",
  "player1": "user_id_1",
  "player2": "user_id_2",
  "status": "WAITING | PLAYING | FINISHED",
  "gameState": { ... },
  "createdAt": "timestamp"
}
```

## MQTT Message Schema

Topic: `hexdice/rooms/{room_id}`

Messages:
- `JOIN`: `{ type: 'JOIN', playerId: 'id', name: '...' }`
- `SYNC_START`: `{ type: 'SYNC_START', seed: '...', players: [...] }`
- `ACTION`: `{ type: 'ACTION', action: 'MOVE | ATTACK | ...', data: { ... } }`
- `CHAT`: `{ type: 'CHAT', message: '...' }`

## Implementation Phases

### Phase 1: Authentication & User Profiles
1. Integrate Google One Tap Signin in `index.html`.
2. Add backend endpoint `/api/auth/google` to verify tokens.
3. Setup ArangoDB and store user information.

### Phase 2: Room Management
1. Add "Online Play" button to the main menu.
2. Implement room creation with random IDs.
3. Use ArangoDB to manage room state and player pairing.

### Phase 3: MQTT Synchronization
1. Add MQTT client to `game.js`.
2. Synchronize the random seed for deterministic game logic (dice rolls, terrain).
3. Update `handleHexClick` and action methods to publish actions to MQTT.
4. Listen for MQTT messages and apply them to the local game state.

### Phase 4: Online UI & UX
1. Add lobby UI to wait for opponent.
2. Add "Opponent's Turn" indicators.
3. Handle reconnections by fetching the latest state from ArangoDB.

### Phase 5: Verification & Testing
1. Test with multiple clients.
2. Verify state consistency across clients.
3. Benchmark ArangoDB and MQTT performance.

## Security Considerations
- Validate all incoming MQTT messages on the client side (basic checks).
- In a production environment, a backend "referee" should validate moves.
- Protect API endpoints with JWT (derived from Google Auth).

---

Here are the 5 architectural upgrades I recommend for maximum stability:

1. State Checksumming (The "Anti-Desync" Shield)
The Problem: Determinism is fragile. A single bug in a specific unit's logic or a
missed MQTT packet will cause a "Silent Desync"—where Player A thinks they won, but
Player B sees a different board.
The Upgrade: Every MQTT GAME_ACTION should include a stateHash.
 * How: Before sending an action, calculate a small hash of the entire game state
   (e.g., a string of all unit positions and HP).
 * Validation: The receiver calculates their own hash after applying the move. If
   they don't match, the game pauses and triggers a "Full State Re-sync" from the
   Host.

2. Message Sequencing (Handling the "Chaos" of the Net)
The Problem: MQTT over WebSockets usually ensures order, but logic timing or
reconnection bursts can lead to "Race Conditions."
The Upgrade: Add a sequenceId to every message.
 * The Logic: If a client receives Message #10 but the last one processed was #8, it
   must buffer #10 and wait for #9. This prevents "teleporting" units or actions
   being applied to the wrong turn.

3. Reconnection "Catch-up" Logic
The Problem: Currently, a page refresh is a "soft reset."
The Upgrade: Implement a Snapshot & Replay system.
 * Persistence: Every 5 turns, the Host should POST a full game state snapshot to the
   /api/rooms/state endpoint we created.
 * The Catch-up: When a player joins/re-joins an active room, the server sends the
   latest snapshot + the MQTT broker (if using a persistent one) "replays" the missed
   messages. This makes the game "unbreakable" even on flaky mobile data.

4. The "Referee" Pattern (Security)
The Problem: Currently, the client simply trusts the MQTT message. A user could
technically open the console and type this.publishAction('GAME_ACTION', { action:
'KILL_ALL', ... }).
The Upgrade: Client-side "Authoritative Check."
 * The Logic: Even in a Peer-to-Peer model, the receiving client must act as a
   "Referee." Before applying a remote action, it must run canPerformAction(). If the
   move is illegal (e.g., an Archer moving 10 spaces), the client rejects it and
   flags a "Desync/Cheat" error.

5. Last Will and Testament (LWT) & Heartbeats
The Problem: How do you know if your opponent closed their laptop or just has high
ping?
The Upgrade: Utilize MQTT's LWT feature.
 * How: When connecting, the client sets a "Last Will" message on the topic
   hexdice/rooms/{roomId}/status with the payload OFFLINE.
 * The Result: If the client disconnects abruptly, the Broker automatically publishes
   that "OFFLINE" message. The opponent immediately sees "Opponent Disconnected"
   instead of staring at a "Waiting..." screen forever.

---

Immediate "Low-Hanging Fruit" Upgrades:
If you want to improve stability right now without a full refactor:
 1. QoS 1: Set MQTT Quality of Service to 1 (At Least Once delivery).
 2. Turn Timer: Add a 60-second countdown. If it hits zero, the active player
    automatically "Ends Turn" to prevent "Griefing" (where a losing player simply
    stops clicking to stall the game).
 3. Action Acknowledgement: When Player B receives a move from Player A, send back a
    small ACK message. If Player A doesn't get an ACK within 2 seconds, they should
    retry the send.

Summary: Your foundation is solid. By adding Checksums and Sequence IDs, you make the
game engine "Self-Healing."