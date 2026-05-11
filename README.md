# HexDice

A strategic hexagonal board game played with dice as soldiers. HexDice blends tactical movement, resource management (dice), and unique class abilities into a fast-paced strategy experience.

- **Play:**
  - [Static Web / For single, campaign / Beta Release](https://hexdice.newsrss.org/)
  - [Online MMO Available / Play with other players / Alpha Release](https://hexdice.phamthanh.me/)
- **Rules:** [Rules](./rules/RULES.md) | [v2.0 Manual](./rules/v2.0.md)
- **Devlog:** [Development Blog](./blog/)

## 🎲 Core Gameplay

*   **Hexagonal Grid:** Tactical positioning on a procedurally generated or hand-crafted hex grid.
*   **Dice as Units:** Each face (1-6) represents a unique class with distinct stats (Attack, Armor, Range) and movement patterns.
*   **Merge & Reroll:** Tactical depth through merging units for strength or rerolling to adapt to the battlefield.
*   **Campaign Mode:** A single-player progression system with unique maps, persistent state, and collectible runes.
*   **Romance Mode:** Spectate AI vs AI battles (Romance of the Dice Kingdoms).
*   **Terrain Effects:** Forests, Lakes, Towers, and Mountains influence movement and combat.

## 🏗 Project Structure

### Frontend & Core Logic
- `game.js`: The heart of the game. An Alpine.js component managing the game state, grid, and combat logic.
- `index.html`: Main entry point. PWA-ready reactive UI.
- `service-worker.js`: Handles offline caching for thousands of assets using chunked loading.

### AI System (`/ai`)
A modular AI system with multiple strategies:
- `ai-heuristic.js`: Primary AI using weight-based evaluation and state simulation.
- `heuristic-profiles.js`: Personality profiles (Aggressive, Balanced, Defensive, Chaos).

### Campaign & World Building (`/campaign`)
- `campaign-manager.js`: Handles level progression, RMI (Resource Management Interface) map loading, and player runes.
- `generator.js`: Procedural map generation for infinite replayability.

### Tools & Simulation
- `server.ts`: Lightweight Deno server for local development.
- `simulate.ts` / `tournament.ts`: Headless Deno scripts for AI benchmarking and game balance analysis.
- `replay.ts`: Tool for replaying recorded matches.

### Assets & Configuration
- `/assets`: Contains sprites, icons, and `assets-manifest.json` for PWA caching.
- `generate-assets-manifest.js`: Utility to keep the PWA manifest up to date.

## 🚀 Getting Started

### Local Development (Deno)
HexDice is designed to run with [Deno](https://deno.land/).

1.  **Start the server:**
    ```bash
    deno run --allow-net --allow-read server.ts
    ```
    *Alternatively, use `npm start` which includes necessary unstable flags for KV storage.*

2.  **Access the game:** Open `http://localhost:1166` in your browser.

### NPM Scripts
The project uses `npm` as a task runner for asset management and automated testing:

-   **Asset Management:**
    -   `npm run manifest:gen`: Updates `assets/assets-manifest.json` by scanning all files in `/assets`. Essential for PWA offline support.
    -   `npm run sprites:gen`: Scans `/assets/sprites/sets/` and updates `assets/sets.json` with the list of available sprite themes.
-   **Simulations & Benchmarking:**
    -   `npm run simulate`: Runs a standard balance simulation between AI profiles.
    -   `npm run tournament:full`: Runs an exhaustive 20-game tournament between all loaded heuristic profiles.
    -   `npm run tournament:mutate`: Runs a genetic-algorithm style simulation with property mutation.
-   **Campaign Tools:**
    -   `npm run campaign:ro_rmi`: Generates campaign map levels based on the RMI (Resource Management Interface) logic.

## 📂 Assets Structure

The `/assets` directory is organized to support a highly customizable and themeable experience:

-   **`/sprites`**: The core visual library.
    -   `/sets`: Contains hundreds of thematic unit sets (e.g., `ro_job`, `aw_static_blue`, `tos_mix`). Each folder typically contains sprites for dice values 1-6.
    -   `/terrain`: Custom textures for Forests, Lakes, and Mountains.
-   **`/ro_maps`**: A collection of static map backgrounds used in Campaign and Romance modes.
-   **`/infographics`**: High-quality splash screens, rule summaries, and recap images.
-   **`/images`**: Essential PWA assets (favicons, manifest icons, logo).
-   **`assets-manifest.json`**: Auto-generated index used by the Service Worker to ensure every image and script is available offline.

## 🧠 Core Logic & Engine Flow

The game engine is encapsulated in the `alpineHexDiceTacticGame` function within `game.js`. It manages state reactively via Alpine.js.

### 1. Initialization & Setup
- `setupTerrain(force)`: Generates the hex grid using either a "Roulette" (sum-of-6) algorithm or by loading an RMI map.
- `rollInitialDice(playerId)`: Generates the starting pool of units (dice faces) for a player.
- `deployUnit(hexId)`: Places a selected die from the pool onto the board, initializing its base stats.

### 2. Interaction Flow (`handleHexClick`)
The primary entry point for all player interaction. It contextually dispatches actions:
- **Phase: SETUP_DEPLOY**: Calls `deployUnit()` on clicked hexes.
- **Phase: PLAYER_TURN**:
    - If no unit is selected: Selects a unit and calls `calcValidMoves()`.
    - If a unit is selected: 
        - If clicking an empty valid hex: Initiates `MOVE`.
        - If clicking an enemy: Initiates `ATTACK`.
        - If clicking self: Deselects.

### 3. Combat & Movement
- `calcValidMoves(unitHexId, isForMerging)`: Calculates reachable hexes based on unit class (Fencer: Any, Hussar: L-shape, Knight: X-shape).
- `handleCombat(attackerHexId, defenderHexId, type)`: The core resolution engine. It compares `attack` vs `armor`, applies terrain modifiers, and handles unit destruction or "Scars" (fatigue).
- `performAction(type, targetHexId)`: Dispatches specific logic for `GUARD`, `REROLL`, `SKIRMISH`, or `SPELLCAST`.

### 4. Special Mechanics
- `performMerge(mergingUnitHexId, targetUnitHexId)`: Combines two units, summing their values and potentially increasing stats.
- `selectOracleSpell(spell)`: Handles the Oracle's (Die 6) unique abilities like `SHIELD` or `SWAP`.

### 5. AI Dispatcher
- `performAI()`: Orchestrates the AI turn. It evaluates the board state using `ai-heuristic.js` and executes the best move series.

## 📜 History & Design
HexDice has undergone hundreds of iterations to balance its unique "Dice Soldiers" mechanic.
- **Design Backlogs:** Check the [`/backlogs`](./backlogs/) directory for balance analysis and feature plans.
- **Rule Evolution:** View the progression of the game in the [`/rules`](./rules/) folder.

## 🛠 Codestyle Guide

To maintain the project's long-term health and readability, please adhere to the following standards:

### Core Philosophy
-   **Surgical Changes:** Modify only what is necessary. Avoid unrelated refactoring or "cleanup" in PRs.
-   **Plan First:** For complex features, draft a plan in `.chat/` before implementation.
-   **Preserve History:** When removing code, comment it out with a `// DEPRECATED` notice instead of deleting it immediately.
-   **Minimalism:** Favor simple, readable logic over complex abstractions. "Less code is less debt."

### Technical Standards
-   **Vanilla JS First:** Avoid adding new frameworks or large libraries. The core game logic should remain dependency-free.
-   **Global Scope Awareness:** Since scripts are loaded via tags, be mindful of naming collisions and the global namespace.
-   **Functional Patterns:** Prefer functional, immutable, and stateless approaches where they improve clarity.

### Formatting & Naming
-   **Indentation:** Use **Tabs**.
-   **Semicolons:** Always use semicolons.
-   **Braces:** Use **One True Brace Style (1TBS)**.
-   **Naming:**
    -   `camelCase`: Variables and functions (e.g., `handleHexClick`).
    -   `UPPER_SNAKE_CASE`: Constants and global configuration (e.g., `UNIT_STATS`).
    -   `_prefix`: Internal or private utility functions.

## 🚀 Future Roadmap: Physical Edition

HexDice is designed with a "Physical-First" philosophy. The digital version serves as a testbed for the core mechanics, which are being refined for a premium physical board game release.

- **Mechanics Testing:** The AI and simulation tools ensure the "Dice Soldiers" classes are balanced for table play.
- **Reserved Rights:** While the source code is licensed under Apache 2.0, the **commercial rights to the "Hex Dice" brand, thematic lore, and physical game production** are reserved by the original author.
- **Community Contributions:** Rules adjustments or balance changes submitted via PRs may be incorporated into the official physical rulebook.

## 🤝 Contributing
Contributions, balance suggestions, and bug reports are welcome! 
*Note: This project follows a "surgical change" philosophy. Keep PRs focused and idiomatic.*

## 📄 License
Licensed under the **Apache License, Version 2.0**. See the [LICENSE](LICENSE) file for the full text. 
The Apache 2.0 license provides an explicit patent grant and protects the "Hex Dice" trade name, ensuring a secure foundation for both open-source contributors and future commercial production.

