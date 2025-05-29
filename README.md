# HexDice Game

## Overview

HexDice is a strategic board game played on a hexagonal grid. Players deploy dice-represented units, each with unique stats and movement patterns, to capture the opponent's base or eliminate all enemy units. This JavaScript code provides the core game logic for HexDice, including hex grid generation, unit management, turn-based gameplay, combat resolution, and win condition checking.

**Read more:** [Hex Dice - Rules & History](https://docs.google.com/document/d/1Zsh8VRxICV6Mxr7dSQ4wxQl__wt9GAhwg00m8tUTh10/edit?tab=t.0)
**Wiki:** [DeepWiki](https://deepwiki.com/royalgarter/hexdice)


## Features

*   **Hexagonal Grid:** Generates a hexagonal game board with a defined radius.
*   **Unit Deployment:** Allows players to strategically deploy units (dice) onto the board.
*   **Unique Units:** Each die face represents a unit with different armor, attack, range, and movement abilities.
*   **Turn-Based Gameplay:** Implements a turn-based system where players can move, attack, or perform special actions.
*   **Combat System:** Resolves combat between units, taking into account armor, attack values, and special abilities.
*   **Win Conditions:** Determines the winner based on base capture or annihilation of enemy units.
*   **Game States:** Manages different game states such as setup, rerolling, deployment, and gameplay.
*   **Action Modes:** Provides different action modes like move, ranged attack, special attack, and merge.
*   **Logging:** Logs game events and messages to provide feedback to the players.
*	**Merge mechanic**: Combine 2 dices into one, with a new strenght
*   **Reroll mechanic**: Reroll dices on the board

## Technologies Used

*   JavaScript
*   HTML (for UI - see related files)
*   CSS (for styling - see related files)
*   TailwindCSS (see related files)

## Game Logic

### Initialization

*   `init()`: Initializes the game by generating the hex grid, determining base locations, and resetting the game state.
*   `resetGame()`: Resets the game state, clears the board, and prepares for a new game.
*   `generateHexGrid(radius)`: Creates the hexagonal grid structure.
*   `determineBaseLocations()`: Assigns base hexes for each player.

### Gameplay

*   `handleHexClick(hexId)`: Handles a click on a hex, determining whether to deploy a unit, select a unit, move a unit, or initiate an attack.
*   `selectUnit(hexId)`: Selects a unit on the board, calculates valid moves and targets.
*   `deselectUnit()`: Deselects the currently selected unit.
*   `initiateAction(actionType)`: Initiates an action, such as move, ranged attack, or special attack.
*   `completeAction(targetHexId)`: Completes an action by performing the corresponding game logic.
*   `calculateValidMoves(unitHexId, isForMerging)`: Calculates the valid moves for a unit, considering its movement type and obstacles.
*   `performMove(unitHexId, targetHexId)`: Moves a unit from one hex to another, initiating combat if the target hex is occupied by an enemy unit.
*   `handleCombat(attackerHexId, defenderHexId, combatType)`: Resolves combat between two units.
*   `performRangedAttack(attackerHexId, targetHexId)`: Performs a ranged attack.
*   `performSpecialAttack(attackerHexId, targetHexId)`: Performs a special attack.
*   `endTurn()`: Ends the current player's turn and switches to the next player.
*   `checkWinConditions()`: Checks if any win conditions have been met.
*	`performMerge(mergingUnitHexId, targetUnitHexId)`: merge units.
*	`performUnitReroll(unitHexId)`: reroll a unit.

### Setup

*   `rollInitialDice(playerId)`: Rolls initial dice for a player.
*   `toggleRerollSelection(dieIndex)`: Toggles a die for rerolling.
*   `performReroll()`: Rerolls selected dice.
*   `skipReroll()`: Skips the reroll phase.
*   `deployUnit(hexId)`: Deploys a unit onto the board.

### Utilities

*   `getHex(id)`: Retrieves a hex by its ID.
*   `getHexByQR(q, r)`: Retrieves a hex by its axial coordinates.
*   `getUnitOnHex(hexId)`: Retrieves the unit on a hex.
*   `axialDistance(q1, r1, q2, r2)`: Calculates the axial distance between two hexes.
*   `getNeighbors(hex)`: Retrieves the neighboring hexes of a given hex.
*   `addLog(message)`: Adds a message to the game log.

## Getting Started

1.  **Clone the repository:**

    ```bash
    git clone [repository_url]
    cd [repository_directory]
    ```

2.  **Install dependencies:**

    *   If using a framework like Vue or React, install the necessary dependencies.  Since the provided code is just the game logic, this step might involve setting up a project and integrating this code.

3.  **Integrate the game logic:**

    *   Integrate the `game.js` file into your project. You'll need to create a user interface (UI) to interact with the game logic. This will likely involve:
        *   Rendering the hexagonal grid.
        *   Handling user input (e.g., hex clicks, button presses).
        *   Displaying game information (e.g., unit stats, game log).

## UI Implementation (Example - Conceptual)

To use this game logic, you'll need to create a UI. Here's a basic conceptual example using HTML and JavaScript:

```html
<!DOCTYPE html>
<html>
<head>
    <title>HexDice</title>
    <link rel="stylesheet" href="style.css"> <!-- Create a style.css for your styling -->
</head>
<body>
    <div id="game-board">
        <!-- Hex grid will be rendered here -->
    </div>
    <div id="game-log">
        <!-- Game log messages will be displayed here -->
    </div>
    <script src="game.js"></script>
    <script src="ui.js"></script> <!-- Create a ui.js to handle UI interactions -->
</body>
</html>
```

In `ui.js`, you would:

1.  Initialize the game:

    ```javascript
    const gameInstance = game();
    gameInstance.init();
    ```

2.  Render the hex grid:

    ```javascript
    function renderHexGrid() {
        const gameBoard = document.getElementById('game-board');
        gameInstance.hexes.forEach(hex => {
            const hexElement = document.createElement('div');
            hexElement.classList.add('hex'); // Add styling class
            hexElement.style.left = hex.visualX + 'px';
            hexElement.style.top = hex.visualY + 'px';
            hexElement.addEventListener('click', () => gameInstance.handleHexClick(hex.id));
            gameBoard.appendChild(hexElement);
        });
    }
    renderHexGrid();
    ```

3.  Handle hex clicks, button presses, and display game information using the methods provided by the `gameInstance`.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request with your changes.

## License

[MIT License]