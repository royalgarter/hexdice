# Plan for Implementing Hex Dice FEN (HDFEN) and PGN (HDPGN)

## Objective:
To introduce FEN (Forsyth-Edwards Notation) and PGN (Portable Game Notation) inspired formats for Hex Dice game state and replay, respectively. These formats, HDFEN and HDPGN, will capture the game state and move history in a concise, text-based manner, suitable for AI training and streamlined replay storage.

## Key Files & Context:
*   `game.js`: Contains the core game logic, `alpineHexDiceTacticGame` object which holds the game state (board, units, players, turn, phase), and `UNIT_STATS`.
*   `replay.ts`: Currently loads and displays game replays from JSON files, using a `stateHash` (base64 encoded JSON) to reconstruct board states. `MoveRecord` defines the structure for recorded moves.

## Proposed Solution:

### 1. Hex Dice FEN (HDFEN) Format Design (Board State):
The HDFEN string will represent a complete snapshot of the game board and current turn conditions. It will follow this structure:

`[Piece Placement]/[Active Player]/[Game Phase]/[Turn Number]/[Other Flags]`

*   **1.1. Piece Placement (`[Piece Placement]`):**
    *   This section will describe the units on each hex, respecting the canonical ordering of hexes (by `id` in `this.hexes` array).
    *   **Hex Iteration:** Iterate through `this.hexes` from `id = 0` to `max_hex_id`.
    *   **Unit Encoding:** For each occupied hex, the unit will be represented as:
        `[PlayerID][UnitValue][M/m][G/g][D/d][skirmishBuffValue]`
        *   `PlayerID`: `0`, `1`, `2`... (single digit for up to 10 players)
        *   `UnitValue`: `1` through `6` (matching `UNIT_STATS` value).
        *   `M` (moved) / `m` (not moved) - based on `unit.hasMovedOrAttackedThisTurn`.
        *   `G` (guarding) / `g` (not guarding) - based on `unit.isGuarding > 0`.
        *   `D` (dead) / `d` (not dead) - based on `unit.isDeath`.
        *   `skirmishBuffValue`: `0` through `9` (assuming max single digit buff), based on `unit.skirmishBuff`.
    *   **Empty Hexes:** Consecutive empty hexes will be represented by a number (e.g., `3` for three empty hexes).
    *   **Delimiter:** `/` will separate individual hex entries (unit or empty count).
    *   **Example (conceptual fragment):** `01Mgd0/14mgd1/3/02mgd0` (Player 0 Fencer (Moved, not guarding, not dead, skirmish 0), Player 1 Knight (not moved, guarding, dead, skirmish 1), 3 empty hexes, Player 0 Archer (not moved, not guarding, not dead, skirmish 0))

*   **1.2. Active Player (`[Active Player]`):**
    *   `0` or `1` (corresponding to `currentPlayerIndex`).

*   **1.3. Game Phase (`[Game Phase]`):**
    *   Abbreviated codes: `SR` (SETUP_ROLL), `SD` (SETUP_DEPLOY), `PT` (PLAYER_TURN), `GO` (GAME_OVER).

*   **1.4. Turn Number (`[Turn Number]`):**
    *   An integer representing `turnCount`.

*   **1.5. Other Flags (`[Other Flags]`):**
    *   Concatenated flags for global game options:
        *   `r` for `rules.noReroll` (if true), `_` if false.
        *   `a` for `options` containing 'a' (annihilation mode), `_` otherwise.
        *   `m` for `options` containing 'm' (merge mode), `_` otherwise.
        *   Example: `r_m` (noReroll is true, not annihilation, merge mode is true)

*   **Full HDFEN Example:**
    `01Mgd0/14mgd1/3/02mgd0 0 PT 5 r_m`

### 2. Hex Dice PGN (HDPGN) Format Design (Game History):
This format will encapsulate the game metadata and a sequence of moves.

*   **2.1. Headers:**
    *   Standard PGN tags (`Event`, `Site`, `Date`, `Round`, `White`, `Black`, `Result`).
    *   New Hex Dice specific tags: `[HDFEN "<initial_HDFEN_string>"]` (initial board HDFEN string), `[AIDice "<P0_AI_Type>,<P1_AI_Type>"]` (AI types for each player).
    *   Example:
        ```
        [Event "Campaign Game 1"]
        [Site "Localhost"]
        [Date "2026.05.04"]
        [White "Player 0"]
        [Black "Player 1 (Minimax AI)"]
        [Result "0-1"]
        [HDFEN "01Mgd0/14mgd1/3/02mgd0 0 PT 5 r_m"]
        [AIDice "P0=Human,P1=Minimax"]
        ```

*   **2.2. Move Text (`[Move Text]`):**
    *   Each move entry will represent a `MoveRecord` from the replay.
    *   **Move Notation:** `[TurnNumber]. [PlayerID][UnitValue][ActionType][FromQR][ToQR][OptionalTargetQR]`
        *   `TurnNumber`: `MoveRecord.turn`.
        *   `PlayerID`: `MoveRecord.player`.
        *   `UnitValue`: `MoveRecord.unitValue`.
        *   `ActionType`:
            *   `M`: Move (fromHex toHex)
            *   `A`: Attack (fromHex toHex - attacker, targetHex - defender)
            *   `D`: Deploy (toHex)
            *   `R`: Reroll (unitValue)
            *   `Me`: Merge (fromHex toHex - merge target)
            *   `S`: Spellcast (fromHex toHex - caster, targetHex - spell target)
        *   `FromQR`: Axial coordinates `(q,r)` for `MoveRecord.fromHex`. We need a helper to convert `hexId` to `q,r`.
        *   `ToQR`: Axial coordinates `(q,r)` for `MoveRecord.toHex`.
        *   `OptionalTargetQR`: Axial coordinates `(q,r)` for attack/spell targets (if applicable).
    *   **Example Move:** `1. 01M(0,0)-(1,-1)` (Player 0, Fencer, Moves from (0,0) to (1,-1))
    *   **Example Attack:** `5. 14A(2,0)-(1,0)T(0,0)` (Player 1, Knight, Attacks from (2,0) to (1,0) targeting (0,0))
    *   **Example Deploy:** `2. 03D(0,1)` (Player 0, Hussar, Deploys to (0,1))

## Implementation Steps:

1.  **`game.js` modifications:**
    *   **Create `generateHDFEN()` method:**
        *   Add a new method `generateHDFEN()` to the `alpineHexDiceTacticGame` object.
        *   This method will iterate through the `this.hexes` array to construct the Piece Placement string.
        *   It will need helper functions to convert `hexId` to `(q,r)` and to properly encode unit flags (M/m, G/g, D/d, skirmishBuffValue).
        *   It will then assemble the full HDFEN string using `currentPlayerIndex`, `phase`, `turnCount`, and other flags (`rules.noReroll`, `options`).
    *   **Coordinate Conversion Helper:** Implement a utility function (e.g., `getHexQR(hexId)`) within `alpineHexDiceTacticGame` that returns the `(q,r)` coordinates for a given `hexId`. This will be useful for HDPGN as well.

2.  **`replay.ts` modifications (or new utility script `generate_hdpgn.ts`):**
    *   **HDPGN Generation Utility:** Create a new Deno script (e.g., `generate_hdpgn.ts`) or extend `replay.ts` to:
        *   Load a `.json` replay file.
        *   Iterate through `GameReplay` objects.
        *   For each game:
            *   Generate PGN headers, including the initial HDFEN string for the starting board. This initial HDFEN could be derived from the `stateHash` of the first `MoveRecord`.
            *   Iterate through `MoveRecord` objects and translate them into HDPGN move notation.
            *   Output the HDPGN to a file or console.
    *   **Coordinate Conversion:** Ensure the `hexId` to `(q,r)` conversion is available and used for HDPGN move notation.

## Verification & Testing:

1.  **Unit Tests for `generateHDFEN()`:**
    *   Create various board setups (empty, partially deployed, full, with different unit flags).
    *   Assert that `generateHDFEN()` produces the expected HDFEN string for each setup. This can be done by creating a test game state and calling the method.
2.  **HDPGN Generation Test:**
    *   Run the HDPGN generation script on existing `.json` replay files (e.g., in the `simulations/` directory).
    *   Manually inspect the generated `.hdpgn` files to ensure they correctly represent the game history and board states.
    *   Verify that the `MoveRecord` data is accurately translated into the HDPGN move format, including correct (q,r) coordinates.
3.  **Round-trip Test (future, for parsing):**
    *   (Once parsing functionality is implemented) Generate an HDFEN string, parse it back into a game state object, and verify that the reconstructed state matches the original.

This plan addresses the user's request for FEN/PGN-like formats and incorporates the chosen level of detail for HDFEN.