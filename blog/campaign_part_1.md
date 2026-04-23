# Journey of the Six: Building the Hex Dice Campaign Mode (Part 1)

In this first part of our campaign development diary, we shifted the focus of Hex Dice from a broad tactical skirmisher to a tightly focused, unit-driven campaign called **"Journey of the Six"**. 

The core vision: Instead of a massive, faceless army, players command exactly six legendary dice, each representing a unique class (1: Pawn, 2: Archer, 3: Hussar, 4: Knight, 5: Tank, 6: Oracle).

## The Strategy: Deployment & The "Burden of War"

The most significant shift was moving away from a simple "New Game" loop to a persistent campaign map where your units carry the weight of previous battles. 

We implemented two key systems:
1.  **Deployment Limits:** Each map now has a strict limit (e.g., "Deploy 3," "Deploy 4"). Since you only have one of each class, deciding who stays behind is half the battle.
2.  **Fatigue (The Scar System):**
    *   **Fresh:** Normal stats.
    *   **Fatigued (Used 2 times in a row):** A visual warning in the deployment phase.
    *   **Scarred (Used 3 times in a row):** The unit suffers a **-1 Effective Armor** penalty and **cannot use class-specific abilities** (no range for Archers, no spells for Oracles).
    *   **Resting:** Leaving a die out of a battle completely resets its fatigue, forcing players to rotate their roster.

## Building the Engine: `CampaignManager`

To keep the structure clean, we separated the campaign logic into a dedicated module: `./campaign/campaign-manager.js`.

*   **Persistence:** We used `localStorage` to track unit usage, rune inventory, and current level progress across sessions.
*   **Decoupled Logic:** The `CampaignManager` handles all the "meta-game" calculations (fatigue status, reward granting, level advancement) independently from the main `game.js` engine.

## Procedural Level Generation: The Campaign CLI

To rapidly test and build the campaign, we created a powerful CLI generator (`./campaign/generator.js`). This tool allows us to define levels via command-line arguments:

```bash
node campaign/generator.js \
  --name="Valley of Shadow" \
  --dice="11/21/31/41/51/61" \
  --enemies="12/21/51" \
  --terrain="forest:8,lake:4,mountain:3" \
  --limit=4 \
  --runes="aegis:1,pegasus:1" \
  --output="campaign/level1.json"
```

The generator randomly distributes terrain, sets up enemy forces, and even defines **rewards (runes)** for completing the level.

## Visualizing the Struggle: UI Updates

We updated the game's UI to reflect the new campaign mechanics:
*   **Deployment Menu:** Now shows fatigue status (Fresh, Fatigued, Scarred) with color-coded borders.
*   **Rune Inventory:** Displays the player's stock of single-use consumables (Aegis, Pegasus, Forge).
*   **Progress Tracking:** Shows "Units Deployed: X / Limit" and level names.

## The Campaign Loop: Progression & Rewards

We successfully integrated the full campaign loop into `game.js`:
1.  **Map Loading:** The game can now load specific JSON maps via the `?campaign_map` URL parameter.
2.  **Auto-Deployment:** For JSON maps, the enemy forces are automatically placed in their deployment zone.
3.  **Winning & Rewards:** If Player 1 wins, the `CampaignManager` grants the level's rewards, increments the `currentLevel`, and updates the "Game Over" UI with a **"Next Level"** button.
4.  **Auto-Progression:** Clicking "Next Level" automatically loads the next JSON map (e.g., `level1.json` -> `level2.json`), creating a seamless journey.

## What's Next?

With the foundational systems—Fatigue, Runes, Level Loading, and procedural generation—all operational, the "Journey of the Six" has officially begun. 

In Part 2, we'll dive deeper into the **Rune Equipping** UI and fine-tune the campaign's balance.

*Stay tuned, and may your dice rolls be legendary!*
