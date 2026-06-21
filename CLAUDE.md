# Hex Dice — Agent Skill Guide

Tactical hexagon board game. Players command armies of dice (values 1–6 = unit types). Vanilla JS + Alpine.js. No build step — all files served directly.

---

## Quick Start for Agents

**Read these files first, in order:**
1. `rules/RULES.md` — game rules, unit stats table, terrain rules. The authoritative source for game logic.
2. `js/constants.js` — all game constants (`UNIT_STATS`, `PLAYER_CONFIG`, `TERRAIN_CONFIG`, `AXES`, `EPIC_PRESETS`). Read before touching any game logic.
3. `js/game.js` — the entire game engine (~5500 lines). The Alpine.js component `alpineHexDiceTacticGame()` is the app root.
4. `js/campaign/campaign-manager.js` — campaign meta-game (fatigue, devotion, perks, story state).
5. `js/campaign/story-engine.js` — narrative layer (regions, arcs, bosses, dialogue).

**Do not** guess at unit stats, movement patterns, or terrain rules. Read `RULES.md` and `constants.js` first.

---

## Architecture

### Script Load Order (index.html)
```
constants.js          → UNIT_STATS, PLAYER_CONFIG, TERRAIN_CONFIG, AXES, EPIC_PRESETS
autochess.js          → Autochess singleton (RotDK mode)
audio.js              → AudioManager singleton
game.js               → alpineHexDiceTacticGame() — the Alpine.js root component
campaign/campaign-manager.js  → CampaignManager singleton
campaign/story-engine.js      → StoryEngine singleton
ai/heuristic-profiles.js      → heuristicProfiles object
ai/ai-heuristic.js            → AI decision logic
ai/ai.js                      → AI dispatcher
```

All JS is in global scope — no modules, no bundler. Singletons (`CampaignManager`, `StoryEngine`, `Autochess`) are plain objects accessed from anywhere.

### HTML Component System
`index.html` uses Alpine.js `x-init="loadComponent($el, 'name')"` to lazy-load partials from `html/`:
- `html/controller.html` — main game UI (story overlays, quest HUD, setup controls)
- `html/camp.html` — devotion/upgrade screen between campaign levels
- `html/worldmap.html` — campaign world map (arc/region timeline)
- `html/hex-grid.html` — the hex board rendering
- `html/toolbars.html` — action buttons during play
- `html/log.html` — message log panel
- `html/unit-info-panel.html` — hovered unit details
- `html/dice.html` — die roster display
- `html/auth.html` — login UI

### Campaign Data Flow
```
URL ?campaign=true&map=levelN.json
  → CampaignManager.fetchCampaignMap(filename)
    → StoryEngine.get*() methods attach story data
    → returns campaignData object
  → game.js resetGame({ isCampaign: true, campaignData })
    → CampaignManager.initCampaignDice() — player units with upgrades applied
    → CampaignManager.initEnemyDice() — enemy units
    → CampaignManager.autoDeployEnemy() — places enemies on board
    → phase = 'SETUP_DEPLOY'
  → Player deploys, battle starts
  → game.js gameOver() → CampaignManager.handleGameOver()
    → StoryEngine dialogue, advanceLevel(), grantRewards()
  → "Next Level" → loads level(N+1).json
```

---

## Key Files & Their Roles

| File | Role | When to Edit |
|---|---|---|
| `js/constants.js` | Unit stats, terrain config, player colors, hex geometry | Adding new unit types, terrain, or presets |
| `js/game.js` | Game engine: hex grid, movement, combat (V1/V2), Alpine.js state | Core game mechanics, new actions, UI state |
| `js/campaign/campaign-manager.js` | Meta-game: fatigue, devotion points, perks, HP combat, saves | Campaign features, perk effects, save format |
| `js/campaign/story-engine.js` | Narrative: regions, arcs, bosses, NPC dialogue, reward hints | Story queries; thin layer — add data to JSON not here |
| `js/campaign/ro_quest_db.json` | All narrative content: 22 regions, 6 arcs, 12 bosses, 31 dialogue lines | Adding story content, dialogue, NPC lines |
| `js/campaign/ro_level_rmi.json` | RO map names for terrain generation (58 entries) | Changing map visuals per level |
| `html/controller.html` | Battle UI: story intro/outro overlays, quest HUD, story toast, setup buttons | Story UI, battle HUD changes |
| `html/camp.html` | Camp screen: devotion spending, perk selection, NPC dialogue, world map button | Camp/upgrade UI |
| `html/worldmap.html` | Campaign world map timeline | World map display |
| `js/ai/ai.js` | AI dispatcher — calls heuristic/minimax/random | AI behavior |
| `js/ai/heuristic-profiles.js` | Named AI profiles with different priorities | Tuning AI personalities |

---

## Game State (game.js)

Key Alpine.js properties on the root object:

```js
phase          // 'SETUP_ROLL' | 'SETUP_REROLL' | 'SETUP_DEPLOY' | 'PLAYER_TURN' | 'GAME_OVER'
players[]      // each: { dice[], baseHexId, isAI, selectedSpriteSet, ... }
hexes[]        // flat array indexed by id; each: { id, q, r, unit, unitId, terrainType, basePlayerId }
isCampaign     // boolean — gates all campaign-specific code paths
campaignData   // null | { name, rmi, level, enemyDice, story, rewards, ... }
currentPlayerIndex
selectedUnitHexId
actionMode     // null | 'RANGED_ATTACK' | 'SPELLCAST' | 'SKIRMISH_POST_MOVE'
showStoryIntro / showStoryOutro / showWorldMap  // overlay visibility flags
storyToast     // null | { speaker, text } — auto-dismisses after 4s
```

**Units** (in `player.dice[]`):
```js
{ id, value, playerId, hexId, attack, armor, maxHP, currentHP,
  isDeployed, isDeath, isGuarding, skirmishBuff, fatigueStatus, isScarred,
  spriteUrl, perks: { tier1, tier2, tier3 } }
```

**Combat versions:**
- **V1 (Decisive Dice):** Deterministic. `Effective Armor = Unit Armor + Terrain + Guard - Reduction`. Attack wins if `ATK >= Effective Armor` (not guarding) or `ATK > Effective Armor` (guarding).
- **V2 (Destiny Dice):** Probabilistic. `Total ATK = ceil((Unit ATK + Combat Die) / 2)`. Fumble on Combat Die = 1 and deflected.
- **Campaign V3:** HP-based. `Damage = max(10, 40 + ATK - DEF)`. All units start at 100 HP.

---

## Campaign System

### Fatigue States
- `FRESH` (usage 0–1): full stats
- `FATIGUED` (usage 2): visual warning only
- `SCARRED` (usage ≥3): -1 Effective Armor, class abilities disabled
- `RESTING` (not deployed): resets usage to 0

### Devotion Points
- 1 point per level cleared
- Spent at Camp screen (3 paths per unit: ATK +5, DEF +5, HP +20)
- Max 15 points per unit class
- Every 5 points: choose a perk (tier1/tier2/tier3, option A or B)
- Perks are permanent per run, checked via `game.hasPerk(unit, 'tier1', 'A')`

### Story Data (ro_quest_db.json)
Top-level keys: `arcs`, `regions`, `levels`, `bosses`, `dialogue`
- `regions[].npcDialogue[]` — Camp screen NPC lines (seeded per level)
- `regions[].rewardHint` — text shown in victory outro
- `dialogue[]` — mid-battle events: `{ level, type, speaker, text }` where type ∈ `boss_entry | first_blood | half_hp | victory`

### Campaign State (localStorage key: `hexdice_campaign_state`)
```js
{
  currentLevel, devotionPoints, unitUsage{1-6}, recoveryLevels{1-6},
  runes: { aegis, pegasus, forge },
  upgrades: { 1-6: { atk, def, hp, points, perks: { tier1, tier2, tier3 } } },
  storyState: { completedQuests{}, bossesDefeated[], seenIntros{} }
}
```

---

## Coding Rules (from GEMINI.md)

### Workflow
- **Plan first** — before implementing a feature, draft a plan in `.chat/<feature_name>.md`
- **Iterate** — implement step-by-step; avoid large sweeping modifications
- **Preserve code** — when removing code, comment it out with a `// DEPRECATED: <reason>` notice instead of deleting it outright

### Style
- **Vanilla JS only** — no frameworks, no jQuery, no new npm packages
- **Global scope** — all JS loaded via `<script>` tags, no `import`/`export`
- **Tabs** for indentation, **semicolons** always, **1TBS** braces
- **camelCase** for variables/functions, **UPPER_SNAKE_CASE** for constants/globals, **`_prefix`** for internal/private functions
- **Early returns** over nested conditions
- **No comments** unless the WHY is non-obvious (hidden constraint, subtle invariant, workaround)
- **Minimal changes** — only modify code relevant to the current task
- **No new abstractions** unless the task explicitly requires them
- **TODOs** — mark issues in existing code with a `// TODO:` prefix, never silently skip them
- **DRY** — no code duplication; extract only when duplication is real, not speculative
- All new narrative content → `ro_quest_db.json` only; `StoryEngine` stays a thin query layer
- New Alpine.js UI state → add to `game.js` alongside existing `showStoryIntro`/`showStoryOutro`
- New HTML components → add to `html/` and wire via `loadComponent` in `index.html`
- Campaign-only code paths are always gated by `if (this.isCampaign)` or `if (!state)` (simulation guard)
- Simulation guard: `if (!state)` means "real game, not AI simulation" — never fire side effects (audio, UI) inside simulation

---

## Common Patterns

### Simulation guard
```js
removeUnit(hexId, state) {
    if (!state) {
        // Only fire in real game, not AI simulation
        window?.AudioManager?.playSfx('death');
        this.showStoryDialogue(...);
    }
}
```

### Campaign-only logic
```js
if (this.isCampaign) {
    this.CampaignManager.doSomething(...);
}
```

### Hex lookup (O(1))
```js
this.getHex(hexId)         // by numeric id (array index)
this.getHexByQR(q, r)      // by axial coords (hashmap)
this.getUnitOnHex(hexId)   // returns null if dead or empty
```

### Seeded randomness
```js
// Game-seeded (reproducible, used for game logic):
this.rollDice()             // uses seeded random()
array.random()              // uses seeded random()

// True random (used for cosmetics only):
Math.random()
array.cosmic_random()
```

### Adding a new campaign perk effect
1. Add description to `CampaignManager.PERK_DESCRIPTIONS[classId][tier][A|B]`
2. Add effect to `CampaignManager.handleCombat()` or `performCampaignCombat()` or `applyDamage()`
3. Check with `game.hasPerk(unit, 'tier1', 'A')` — returns boolean

### Adding story content
Only touch `ro_quest_db.json`. All methods in `StoryEngine` are query-only. `CampaignManager.fetchCampaignMap()` assembles the `story` object passed to the game.

### Alpine.js reactivity
State is reactive via Alpine.js proxy. Mutate arrays/objects directly — no need for `$set`. Use `Object.assign(this.state, newData)` to preserve reactivity on nested objects.

---

## URL Parameters

| Param | Values | Effect |
|---|---|---|
| `campaign=true` | boolean | Enables campaign mode |
| `map=levelN.json` | filename | Loads campaign level N |
| `players=2\|3\|4\|6` | int | Player count |
| `version=1\|2` | int | V1 Decisive / V2 Destiny combat |
| `R=5\|6\|8` | int | Hex grid radius |
| `options=rmca` | string flags | r=reroll, m=merge, c=campaign, a=annihilation |
| `preset=E_21` | key | Epic Chess preset |
| `mode=debug\|auto\|coordinate` | string | Debug modes |
| `auth_user=name` | string | Debug login (localhost only) |
| `room=ID` | string | Auto-join online room |

---

## File Structure

```
hexdice/
├── index.html              # App shell, script tags, Alpine.js init
├── js/
│   ├── constants.js        # All game constants
│   ├── game.js             # Engine + Alpine.js component (~5500 lines)
│   ├── audio.js            # AudioManager singleton
│   ├── autochess.js        # RotDK autochess mode
│   ├── campaign/
│   │   ├── campaign-manager.js   # Meta-game state & combat
│   │   ├── story-engine.js       # Narrative query layer
│   │   ├── ro_quest_db.json      # All story content
│   │   ├── ro_level_rmi.json     # Map names per level
│   │   └── generator.js          # CLI level generator
│   └── ai/
│       ├── ai.js                 # AI dispatcher
│       ├── ai-heuristic.js       # Main heuristic AI
│       ├── ai-minimax.js         # Minimax AI
│       ├── ai-random.js          # Random AI
│       └── heuristic-profiles.js # Named AI personalities
├── html/                   # Alpine.js HTML partials (lazy-loaded)
│   ├── controller.html     # Battle UI + story overlays + quest HUD
│   ├── camp.html           # Devotion screen
│   ├── worldmap.html       # Campaign world map
│   ├── hex-grid.html       # Board rendering
│   ├── toolbars.html       # Action buttons
│   ├── log.html            # Message log
│   ├── unit-info-panel.html
│   ├── dice.html
│   └── auth.html
├── rules/
│   └── RULES.md            # Authoritative game rules
├── assets/
│   ├── sprites/            # Unit/terrain GIFs and PNGs
│   ├── ro_maps/            # Ragnarok Online map images for terrain generation
│   ├── style.css
│   └── litewind.css        # Tailwind-lite utility CSS
├── blog/                   # Development diary (read for context)
├── server.ts               # Deno HTTP server
└── GEMINI.md               # Coding conventions (source of truth)
```
