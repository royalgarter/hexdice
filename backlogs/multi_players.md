
https://fireemblem.fandom.com/wiki/List_of_classes_in_Fire_Emblem_Fates
https://fireemblemwiki.org/wiki/Category:Fates_map_animations

# Multi players plan

╭─────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Ready to start implementation?                                                                              │
│                                                                                                             │
│ Plan for 3-4 Players Support                                                                                │
│                                                                                                             │
│ The goal is to modify game.js and index.html to support more than 2 players (specifically 3 and 4).         │
│                                                                                                             │
│ Objectives                                                                                                  │
│  - Generalize player management.                                                                            │
│  - Dynamic base location assignment for up to 6 players (as supported by PLAYER_PRIMARY_AXIS).              │
│  - Update setup and deployment flow to iterate through all players.                                         │
│  - Update win conditions for multi-player games.                                                            │
│  - Update UI and sprites for additional players.                                                            │
│                                                                                                             │
│ Key Files & Context                                                                                         │
│  - game.js: Core game logic, state management, and movement/combat rules.                                   │
│  - index.html: UI rendering and style definitions.                                                          │
│  - assets/sprites/fe_fates_6_players/: Contains unit sprites for Blue, Red, Green, and Purple players.      │
│                                                                                                             │
│ Implementation Steps                                                                                        │
│                                                                                                             │
│ 1. Generalize Player Initialization                                                                         │
│  - Define PLAYER_CONFIG with colors and sprite suffixes:                                                    │
│  1   const PLAYER_CONFIG = [                                                                                │
│  2     { id: 0, color: 'Blue', sprite: 'blue', bg: 'bg-hexblue', logColor: 'text-blue-500' },               │
│  3     { id: 1, color: 'Red', sprite: 'red', bg: 'bg-hexred', logColor: 'text-red-500' },                   │
│  4     { id: 2, color: 'Green', sprite: 'green', bg: 'bg-hexgreen', logColor: 'text-green-500' },           │
│  5     { id: 3, color: 'Purple', sprite: 'purple', bg: 'bg-hexpurple', logColor: 'text-purple-500' },       │
│  6   ];                                                                                                     │
│  - Modify init() to read playerCount from URL parameter players (default to 2).                             │
│  - Update resetGame() to initialize the players array based on playerCount.                                 │
│  - Each player will have an isEliminated: false property.                                                   │
│                                                                                                             │
│ 2. Generalize Base Locations                                                                                │
│  - Update determineBaseLocations():                                                                         │
│    - Loop from 0 to this.players.length - 1.                                                                │
│    - Use PLAYER_PRIMARY_AXIS[this.players.length][i] to find the primary axis for each player.              │
│    - Set hex.basePlayerId = i and remove isP1Base/isP2Base.                                                 │
│    - Clear basePlayerId on all hexes before assigning.                                                      │
│                                                                                                             │
│ 3. Update Setup Flow                                                                                        │
│  - rollInitialDice(playerId): Already takes playerId.                                                       │
│  - nextPlayerSetupRerollOrDeploy():                                                                         │
│    - For Reroll: Transition through all players (0 to n-1).                                                 │
│    - For Deploy: Transition through all players (0 to n-1).                                                 │
│  - deployUnit(hexId): Transition through all players sequentially.                                          │
│                                                                                                             │
│ 4. Generalize Win Conditions                                                                                │
│  - Update checkWinConditions(state):                                                                        │
│    - Check for base capture: If any hex with basePlayerId !== null is occupied by an enemy, the base owner  │
│      is marked isEliminated = true.                                                                         │
│    - Check for annihilation: If a non-eliminated player has no active (non-death) units, they are marked    │
│      isEliminated = true.                                                                                   │
│    - The game ends when only one non-eliminated player remains (winner) or zero (draw).                     │
│                                                                                                             │
│ 5. Update UI and Styling                                                                                    │
│  - CSS (index.html):                                                                                        │
│    - Add .bg-hexgreen { background-color: #26de81; } (or similar) and .bg-hexpurple { background-color:     │
│      #a55eea; }.                                                                                            │
│    - Add Tailwind-lite theme variables for --color-hexgreen and --color-hexpurple.                          │
│  - Hex Rendering (game.js):                                                                                 │
│    - Update hexColor() to use hex.basePlayerId to determine base background color.                          │
│    - Update hexStyle() to use PLAYER_CONFIG[unit.playerId].sprite and the new sprite path                   │
│      fe_fates_6_players/d${value}_${sprite}.gif.                                                            │
│  - Message Log (index.html):                                                                                │
│    - Generalize log entry colors to support all players.                                                    │
│                                                                                                             │
│ 6. AI Considerations                                                                                        │
│  - The AI logic (performAIByWeight) should work as it evaluates the board for the current player.           │
│                                                                                                             │
│ Verification & Testing                                                                                      │
│  - Test 2-player game to ensure no regressions.                                                             │
│  - Test 3-player game by adding ?players=3 to URL.                                                          │
│  - Test 4-player game by adding ?players=4 to URL.                                                          │
│  - Verify base locations are correctly placed for each player count.                                        │
│  - Verify unit sprites match the player's color.                                                            │
│  - Verify win conditions correctly eliminate players and end the game.                                      │
│                                                                        