# Journey of the Six: The Ragnarok Online Quest Database — Story Mode (Part 3)

In Part 2, we unveiled the Devotion System, the TTK combat overhaul, and the branching class evolutions that turned *Hex Dice* into a full roguelite RPG. But a 161-level campaign across the world of Ragnarok Online had no story — players fought through `prt_fild08` without knowing *why*.

This update, **v3.1**, fixes that. We've built a complete Story Mode powered by an authored quest database using actual Ragnarok Online MVP bosses, regions, and lore.

---

## The Problem: A Silent Journey

After Part 2, the campaign worked mechanically — you fought, upgraded, chose perks, and advanced. But every level was just a map name from `ro_level_rmi.json` with randomly generated enemies. There was no:
- Context for why you were fighting
- Narrative arc across the 161 levels
- Sense of progression through RO's world
- Boss encounters with identity
- Quest objectives beyond "kill everything"

We had 161 map names (Prontera fields, Morroc desert, Geffen plains, Einbroch factories, Manuk wastes, Biolabs), but they were just strings. Each one represents a real location in Ragnarok Online with its own lore, quests, and identity. We needed to bring that to life.

---

## The Strategy: From Map Names to Narrative Arcs

We analyzed the 161 map names in `ro_level_rmi.json` and grouped them into natural geographic progressions:

| Arc | Levels | Regions | RO Lore Basis |
|-----|--------|---------|---------------|
| **The Awakening** | 1–29 | Prontera → Geffen → Morroc → Payon | The starting journey — novice grounds to the bamboo forests |
| **The Crossroads** | 30–62 | Mjolnir → Southern Reaches → Payon Frontier → Deep Desert | Mountain passes, the wilderness, the Pharaoh's tomb |
| **Beyond the Seas** | 63–85 | Brasilis → Holy Lands (Rachel, Veins, Comodo) | New continents, vampire courts, and heretics |
| **Iron and Faith** | 86–137 | Einbroch → Yuno → Rachel Sanctuary → Thor Volcano | Industrial horror, floating cities, divine judgment |
| **The Ancient World** | 138–152 | Dicastes → Manuk → Lasagna | Lost civilizations, prehistoric titans |
| **The End of All Things** | 153–161 | Odin Temple → Biolabs → Nifflheim | Divine trials, the Genesis Project, and the final reckoning |

Each region has:
- A thematic **intro** that sets the scene
- A pool of 2–4 **quest hooks** cycled deterministically per level
- **Enemy flavor** text for the quest log
- An **NPC quest giver** appropriate to the region
- **Boss encounters** every 10 levels using canonical iRO Wiki MVPs

---

## The MVP Boss Design: Real Monsters, Real Lore

The original Part 3 release used custom boss names (Arcane Anomaly, Chemical Behemoth, Corrupted Priestess). These were narrative placeholders. In the v3.2 revision, every boss was replaced with a canonical Ragnarok Online MVP, matched to the map they actually spawn on in iRO, scaled by the same difficulty tiers the iRO Wiki uses.

**Design principles:**
- Low difficulty MVPs appear in early levels (1–40)
- Medium difficulty in mid-game (41–80)
- Mid-High difficulty as the industrial zones begin (81–120)
- High difficulty in the endgame (121–161)
- Each MVP's canonical spawn map matches the campaign region it appears in

### Boss Table — 17 Canonical RO MVPs

| Level | MVP | iRO Difficulty | Canon Spawn | Region Fit |
|-------|-----|---------------|-------------|-----------|
| 10 | Golden Thief Bug | Low | Prontera Culvert 4 | Prontera Fields |
| 20 | Amon Ra | Low | Morroc Pyramid B2F | Morroc Desert |
| 30 | Eddga | Low | Payon Field 10 | Payon Forest |
| 40 | Mistress | Medium | Mt. Mjolnir 4 | Mjolnir Pass |
| 50 | Moonlight Flower | Medium | Payon Cave 5 | Payon Frontier |
| 60 | Pharaoh | Medium | Sphinx 5 | Deep Desert |
| 70 | Drake | Medium | Sunken Ship 2 | Brasilis Coast |
| 80 | Turtle General | Medium | Turtle Island 4 | Holy Lands |
| 90 | Fallen Bishop Hibram | Mid-High | Cursed Monastery 2 | Einbroch Outskirts |
| 100 | Vesper | Mid-High | Juperos Core | Einbroch Industrial |
| 110 | RSX-0806 | High | Mine Dungeon 2 | Einbroch Wastes |
| 120 | Gloom Under Night | Mid-High | Rachel Sanctuary 5 | Yuno Heights |
| 130 | Ifrit | High | Thor's Volcano 3 | Lasagna Canyon |
| 140 | Hardrock Mammoth | High | Manuk Field 3 | Lasagna Village |
| 150 | Valkyrie Randgris | High | Odin Shrine 3 | Temple of Odin |
| 155 | Beelzebub | High | Cursed Monastery 3 | Biolabs |
| 161 | Genesis | Custom/Final | Biolabs Core | Final boss |

Spacing is exactly 10 levels apart (lv 10–150), then 155 and 161 for the Biolabs climax arc. The final boss, Genesis, is the only custom entry — it serves as the campaign's narrative mastermind, the intelligence that funded and guided Beelzebub's project.

---

## The Implementation: 7 Files, 838+ Lines

The Story Mode spans 7 files:

### Data Layer: `js/campaign/ro_quest_db.json`

Pure JSON with five top-level structures:

- **`arcs`** — 6 narrative arcs with level ranges and summaries
- **`regions`** — 22 geographic regions, each with level range, intro, quest hooks, outro, enemy flavor, NPC name, and NPC dialogue lines
- **`levels`** — Per-level overrides for title and quest text (161 entries)
- **`bosses`** — 17 boss encounters, each with name, title, intro, and outro
- **`dialogue`** — Mid-battle event lines: `{ level, type, speaker, text }` where type ∈ `boss_entry | first_blood | half_hp | victory`

Every boss level has at minimum `boss_entry` and `half_hp` dialogue. Key boss fights also have `first_blood` (when the first damage lands) and the final boss has a `victory` line.

### Engine: `js/campaign/story-engine.js` (135 lines)

A thin singleton query layer — no game logic, data only:

- `getLevelInfo(n)` — returns combined region, arc, level, and boss data
- `getIntro(n)` / `getOutro(n)` — narrative text for level start/end
- `getQuest(n)` — the quest objective for the HUD
- `isBossLevel(n)` / `getBossForLevel(n)` — boss encounter detection
- `getArcSummary(n)` — arc name, summary, and progress percentage

Uses deterministic seeding (`Math.sin` trick) to pick quest hooks consistently per level without saving state.

### Integration: `js/campaign/campaign-manager.js`

- `storyState` in campaign save: completed quests, defeated bosses, seen intros
- `fetchCampaignMap()` attaches the full `story` object to every level load
- `handleGameOver()` marks quests complete, records boss kills, fires mid-battle dialogue
- `resetCampaign()` resets story state on new game

### UI Layer: `html/controller.html`

Three components:

1. **Story Intro Overlay** — full-screen modal at level start: region name, level title, pulsing BOSS ENCOUNTER warning (boss levels), narrative text, quest objective, NPC name, "Accept Quest" dismiss button
2. **Story Outro Overlay** — post-victory: quest completion text, reward hint, "Continue" button
3. **Quest Log HUD** — fixed bottom-right during play: current region/arc, active quest, enemy flavor or pulsing boss warning

---

## The Flow: How Story Mode Plays

```
?campaign=true&map=level10.json loads
  → fetchCampaignMap() generates level + attaches story data
  → resetGame() sets showStoryIntro = true

  → PLAYER SEES: Full-screen overlay
      "⚠ BOSS ENCOUNTER"
      "Prontera Fields — The Gilded Horror"
      "The Prontera culverts run deep beneath the city.
       Something has been feeding down there..."
      "Quest: Descend into the culverts and destroy the creature"
      "Kafra Guide awaits your report."
      [Accept Quest]

  → Battle begins. Quest Log HUD visible bottom-right.
  → At first hit: "There it is. We've been losing people to this thing for weeks."
  → At half HP: "Its shell is weakening — keep striking the same spot!"

  → PLAYER WINS
  → Story outro overlay
  → "Continue" → GAME_OVER screen → Next Level
```

---

## Stats (v3.2)

```
Regions:          22
Arcs:             6
Boss encounters:  17 (all canonical iRO Wiki MVPs except final boss)
Dialogue lines:   50+
Authored levels:  161
Boss spacing:     every 10 levels (lv10–150), then lv155 and lv161
Difficulty tiers: Low → Medium → Mid-High → High (matching iRO Wiki)
```

---

## What's Next

With Story Mode complete and properly scaled across all 161 levels, the foundation is solid for:

- **Mid-battle story events** — dialogue already wired; more trigger types (e.g., unit death, turn count) can extend it
- **Camp NPC interactions** — branching dialogue per region when visiting camp
- **Quest rewards** — narrative-driven bonus rewards tied to quest completion
- **World map** — visual campaign progression screen already exists; deepen it with region unlock states

*The Journey continues.*
