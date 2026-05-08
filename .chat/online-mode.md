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
