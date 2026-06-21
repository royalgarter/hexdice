# Journey of the Six: The Ragnarok Online Quest Database — Story Mode (Part 3)

In Part 2, we unveiled the Devotion System, the TTK combat overhaul, and the branching class evolutions that turned *Hex Dice* into a full roguelite RPG. But a 60-level campaign across the world of Ragnarok Online had no story — players fought through `prt_fild08` without knowing *why*.

This update, **v3.1**, fixes that. We've built a complete Story Mode powered by an authored quest database inspired by actual Ragnarok Online quests, regions, and boss encounters.

## The Problem: A Silent Journey

After Part 2, the campaign worked mechanically — you fought, upgraded, chose perks, and advanced. But every level was just a map name from `ro_level_rmi.json` with randomly generated enemies. There was no:
- Context for why you were fighting
- Narrative arc across the 60 levels
- Sense of progression through RO's world
- Boss encounters with identity
- Quest objectives beyond "kill everything"

We had the 60 map names (Prontera fields, Morroc desert, Geffen plains, Einbroch factories, Nifflheim wastes, Biolabs), but they were just strings. Each one represents a real location in Ragnarok Online with its own lore, quests, and identity. We needed to bring that to life.

## The Strategy: From Map Names to Narrative Arcs

We analyzed the 58 map names in `ro_level_rmi.json` and grouped them into natural geographic progressions:

| Arc | Levels | Regions | RO Lore Basis |
|-----|--------|---------|---------------|
| **The Awakening** | 1–10 | Prontera → Payon → Morroc → Geffen → Mjolnir | The starting journey — novice grounds through the mountain pass |
| **The Crossroads** | 11–20 | Southern reaches → Morroc deep → Geffen borderlands | Mid-level wilderness, the orcish threat, the Pharaoh's awakening |
| **Beyond the Seas** | 21–30 | Brasilis → Yuno → Rachel → Veins → Comodo | New continents, floating cities, vampire courts, and heretics |
| **The Ancient World** | 31–40 | Dicastes → Lasagna → Manuk → Splendide | Lost civilizations, dinosaur plains, buried war machines |
| **Iron and Faith** | 41–49 | Einbroch → Gates of Hell → Odin Temple | Industrial horror meets divine judgment |
| **The End of All Things** | 50–58 | Nifflheim → Biolabs | Death realm and the final Genesis experiment |

Each region has:
- A thematic **intro** that sets the scene
- A pool of 2–4 **quest hooks** cycled deterministically per level
- **Enemy flavor** text for the quest log
- An **NPC quest giver** appropriate to the region
- **Boss encounters** at every 5th level with hand-authored intros/outros

## The Implementation: 7 Files, 838 Lines

The entire Story Mode was implemented across 7 files in one commit (`44d85d7`):

### Data Layer: `js/campaign/ro_quest_db.json` (526 lines)

The quest database is pure JSON with three top-level structures:

- **`arcs`** — 6 narrative arcs defining the campaign's story structure
- **`regions`** — 22 geographic regions, each with level range, intro text, quest hooks, outro text, enemy flavor, and NPC name
- **`levels`** — Per-level overrides for title, quest text, and NPC (58 entries)
- **`bosses`** — 12 boss encounters at levels 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, and 58

Each level's content is assembled from its region's template (intro + a deterministicly picked quest hook) with optional per-level overrides. Boss levels replace the intro entirely with the boss encounter's custom text.

### Engine: `js/campaign/story-engine.js` (135 lines)

A singleton module following `CampaignManager`'s pattern:

- `init()` — fetches and caches `ro_quest_db.json`
- `getLevelInfo(n)` — returns combined region, arc, level, and boss data
- `getIntro(n)` / `getOutro(n)` — returns narrative text for level start/end
- `getQuest(n)` — returns the quest objective
- `getTitle(n)` / `getRegionName(n)` / `getArcName(n)` — display helpers
- `isBossLevel(n)` / `getBossForLevel(n)` — boss encounter detection
- `getArcSummary(n)` — arc name, summary, and progress percentage

Uses deterministic seeding (`Math.sin` trick) to ensure quest hooks are consistent per level without randomness.

### Integration: `js/campaign/campaign-manager.js` (81 lines added)

- Added `storyState` to the campaign state tracking completed quests, defeated bosses, and seen intros
- `init()` now calls `StoryEngine.init()` on startup
- `fetchCampaignMap()` attaches the full story object (`campaignData.story`) to every level — including region, title, quest, intro, outro, NPC, arc, enemy flavor, boss info
- `handleGameOver()` marks quests complete, tracks boss kills, and records seen intros
- `getLevelStory(n)` helper for Alpine.js templates
- `resetCampaign()` resets story state on new game

### UI Layer: `html/controller.html` (68 lines added)

Three new UI components:

1. **Story Intro Overlay** — Full-screen modal at level start showing:
   - Region name and level title
   - Pulsing BOSS ENCOUNTER warning for boss levels
   - Narrative intro text
   - Quest objective and NPC name
   - "Accept Quest" button to dismiss

2. **Story Outro Overlay** — Post-victory modal showing:
   - Quest completion text
   - Narrative outro with world repercussions
   - "Continue" button to proceed to game-over screen

3. **Quest Log HUD** — Fixed bottom-right display during gameplay:
   - Current region and arc name
   - Active quest objective
   - Enemy flavor text (regular levels) or pulsing boss warning

### Camp Integration: `html/camp.html` (28 lines added)

The devotion/upgrade screen now shows:
- Current arc name and summary
- Level range with completion percentage
- Quest count and bosses slain counter

### Game Loop: `js/game.js` (9 lines added)

- `showStoryIntro` and `showStoryOutro` Alpine.js properties
- `resetGame()` sets `showStoryIntro = true` when campaign data has story content
- `gameOver()` sets `showStoryOutro = true` on player victory

### Script Loading: `index.html` (1 line added)

Added story-engine.js script tag with cache-busting version string.

## The Flow: How Story Mode Plays

```
?campaign=true&map=level1.json loads
  → fetchCampaignMap() generates level + attaches story data
  → resetGame() sets showStoryIntro = true
  
  → PLAYER SEES: Full-screen overlay
      "Prontera Fields"
      "The Road to Prontera"
      "The sun rises over the plains outside the capital..."
      "Quest: Clear the eastern road of strange creatures"
      "Kafra Guide awaits your report."
      [Accept Quest]
  
  → Battle begins, Quest Log HUD visible bottom-right
  
  → PLAYER WINS
  → Story outro overlay shows completion text
  → "Continue" → GAME_OVER screen with Next Level button
  
  → Camp screen shows arc progress:
      "The Awakening — Level 2/10 (20%)"
      "Quests: 1 completed"
```

## Boss Milestones

Every 5th level is a boss encounter with custom narrative:

| Level | Boss | Title |
|-------|------|-------|
| 5 | Arcane Anomaly | The Living Spell |
| 10 | Maya — Golden Bug | Queen of the Dead Pass |
| 15 | Orc Hero | Warlord of Mjolnir |
| 20 | Pharaoh | Undying King of the Sands |
| 25 | Corrupted Priestess | The False Prophet |
| 30 | Moonlight Flower | The Nightmare Blossom |
| 35 | Elemental Titan | Splendide's Heart |
| 40 | Earth Abomination | What Was Buried |
| 45 | Chemical Behemoth | Einbroch's Worst Creation |
| 50 | Valkyrie Randgris | Fallen Seraph |
| 55 | Ifrit | Lord of the Inferno |
| 58 | Genesis | The First and the Last |

Boss levels replace the campaign map name with the boss's name and title, and the intro overlay shows a special boss warning with pulsing red text.

## Stats

```
Files changed:  7
Insertions:     838
Deletions:      10
New data:       526 lines of authored quest content
New engine:     135 lines of story logic
New UI:         96 lines of story overlay and HUD templates
Arcs:           6
Regions:        22
Bosses:         12
Authored levels: 58
```

## What's Next

With Story Mode live, players now have context for their 60-level journey across Ragnarok Online's world. The foundation is in place for deeper narrative features:

- **Mid-battle story events** — dialogue that triggers at combat thresholds
- **Camp NPC interactions** — branching dialogue when visiting camp between levels
- **Quest rewards** — narrative-driven bonus rewards tied to quest completion
- **World map** — visual campaign progression screen showing the journey across regions

*Stay tuned — the Journey continues.*
