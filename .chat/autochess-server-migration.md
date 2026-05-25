# Plan: Server-Side Autochess Engine

## Objective:
Move the Autochess game engine computation from the client to the server to support multiplayer integrity and future room-based play.

## Architecture:
1.  **Server-Side Engine**: A Deno-based authoritative engine that runs the Autochess simulation.
2.  **MQTT Communication**: Use MQTT (broker.emqx.io) for real-time synchronization between clients and the server.
3.  **State Management**:
    *   Client sends `AUTOCHESS_ACTION` (Recruit, Merge, Start Round).
    *   Server validates actions against current room state.
    *   Server computes simulation steps during `COMBAT` phase.
    *   Server broadcasts `AUTOCHESS_STATE` and `AUTOCHESS_STEP` messages.
    *   Client renders based on server-provided state.

## Implementation Steps:

### 1. Server MQTT Integration
*   Add MQTT client to `server.ts` using `https://deno.land/x/mqtt/mod.ts` or `npm:mqtt`.
*   Server listens to `hexdice/rooms/+/actions` topics.

### 2. Authority Engine
*   Create `server/autochess-authority.ts`.
*   This will load `js/game.js`, `js/autochess.js`, and AI scripts (similar to `js/simulate.ts`).
*   Manage a pool of active room engines.

### 3. Room State Update
*   Update ArangoDB room schema to include Autochess-specific state if needed (or keep it in-memory on the server for active sessions).
*   Add `gameType: 'AUTOCHESS'` to room initialization.

### 4. Client Refactor
*   Modify `js/autochess.js` to optionally delegate logic to the server when in a room.
*   Update `js/game.js` to handle authoritative state updates for Autochess.

### 5. Verification
*   Test single-player Autochess (still local or server-backed?).
*   Test multi-player Autochess with two tabs.

## Phases:
- **Phase 1**: Server MQTT and basic room tracking.
- **Phase 2**: Porting Autochess simulation to server.
- **Phase 3**: Client-server handshake and action validation.
- **Phase 4**: Real-time combat streaming.
