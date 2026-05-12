# Journey of the Six: The Ragnarok style endless rogue-like (Part 2)

In Part 1 of our campaign diary, we introduced the "Journey of the Six"—a tactical mode where every decision mattered and unit fatigue was the primary strategic lever. While the core idea was strong, we realized as we pushed towards higher levels that the underlying game engine—built for fast-paced, 1-hit-kill skirmishes—could not sustain a 100-level endurance run.

This update, **v3.0**, is our most ambitious overhaul yet. We are moving from a "Skirmish" mentality to a "Roguelite RPG" progression, heavily inspired by our roots in *Ragnarok Online*.

## The Legacy of RO: Class-Based Progression

If you look closely at our class system (Fencer, Archer, Hussar, Knight, Tanker, Oracle), you might notice the DNA of classic MMORPG roles. In designing v3.0, we wanted to capture that feeling of a "Build"—where your specific path through a skill tree defines your identity. 

Just like deciding whether your Acolyte becomes a High Priest or a Monk, our new Perk system makes your choice of path (A or B) the defining moment for your unit’s utility in the Crucible.

## The Math Overhaul: Introducing the TTK System

To solve for "Endless Scaling," we had to change how combat works at a fundamental level. We implemented a Time-To-Kill (TTK) system that transforms *Hex Dice* from a twitch-tactical game into a long-form strategy RPG, mirroring the gear-progression grind found in our favorite legacy MMOs.

### Scaling for Persistence
We shifted our baseline stats by an order of magnitude:
- **Base HP:** All units now start with 100 Max HP.
- **Stat Translation:** All base stats were multiplied by 10. 

This allows us to introduce **micro-progression**. Much like card-based stat increases in classic RPGs, we offer incremental rewards—+5 ATK, +5 DEF—that build up into the powerhouse character you envision.

### The New Damage Formula
Combat needed to feel predictable and punishing. 
> `Damage = 40 + (Attacker ATK - Defender DEF)`

Crucially, we added a **Minimum Damage floor of 10**. This ensures that even the toughest boss monsters can be defeated, preventing the "un-hittable" tank scenarios that often plague gear-dependent RPGs.

---

## The Devotion System: Agency Over RNG

In most Roguelites, progression is driven by random loot. We wanted a system where you are the architect, reminiscent of manual skill-point allocation in *Ragnarok Online*.

Enter the **Devotion System**. You don't "roll" for stats; you *spend* them. You decide if your Knight needs more Defense (Plating) to act as a wall or more Attack (Weaponry) to serve as a breaker. By capping each Dice Class at 15 points, we created a finite "build space" (90 total points for the army). It’s the classic MMO struggle: how do I balance my team's needs with my own desired specialization?

## Branching Paths: The Evolution of Mastery

To avoid linear power creep, we introduced **Class Evolutions** with branching paths. 

This isn't just a stat bump. It's an evolution of your role:
- **Oracle's "High Priest" (Path A):** Adds *Resurrection*, a classic "save-the-party" skill.
- **Oracle's "Warlock" (Path B):** Modifies our *Transmute* skill. Drawing from the high-risk, high-reward nature of RO spells, the Oracle no longer sacrifices themselves, but instead sacrifices their own HP (80!) to turn an enemy into a temporary, decaying ally.

These choices ensure that no two campaigns feel the same. A "Warlock Oracle" requires a completely different playstyle than a "High Priest," giving you the depth of a full party-build experience in a single tactical campaign.

## The Crucible: Facing Endless Pressure

The most common trap in long-form campaigns is "level bloat"—where the game gets easier because the player has become too powerful. To counter this, we designed **The Crucible**.

Mirroring the difficulty spikes of high-level dungeon raids, every 10 levels the enemy deployment limit permanently increases. This 33% increase in enemy action economy forces players to hit their "gear/perk checks" perfectly. If your army isn't built to scale, the Crucible *will* break you.

---

## **The Devotion System (Player Progression)**

Upon completing a level, the player is awarded **1 Devotion Point**. There is no random stat growth; the player takes this point to the "Camp" and allocates it to a specific Dice Class (1 through 6) to buy a block of stats.

### **The 15-Point Mastery Cap**
To maintain mathematical balance over a 100+ level campaign, a single Dice Class can receive a **maximum of 15 Devotion Points**. (Total army maxes out at 90 points. Levels 91+ can grant a global +5 HP "Camp Morale" buff).

### **Stat Allocation Matrix**
Allocating 1 Devotion Point grants the corresponding stat block below. *Note: Special classes (Hussar/Oracle) have uniquely named upgrades to fit their theme, though they function the same mathematically.*

| Dice Class | ⚔️ Offensive Path | 🛡️ Defensive Path | ❤️ Vitality Path |
| :--- | :--- | :--- | :--- |
| **1 - Fencer** | **Weaponry:** +5 ATK | **Plating:** +5 DEF | **Vigor:** +20 Max HP |
| **2 - Archer** | **Weaponry:** +5 ATK | **Plating:** +5 DEF | **Vigor:** +20 Max HP |
| **3 - Hussar** | **Weaponry:** +5 ATK | **Agility:** +5 DEF *(Dodge)* | **Vigor:** +20 Max HP |
| **4 - Knight** | **Weaponry:** +5 ATK | **Plating:** +5 DEF | **Vigor:** +20 Max HP |
| **5 - Tanker** | **Weaponry:** +5 ATK | **Plating:** +5 DEF | **Vigor:** +20 Max HP |
| **6 - Oracle** | **Potency:** +5 to Spell Power | **Warding:** +5 DEF *(Barrier)* | **Vigor:** +20 Max HP |
*(Oracle Potency rule: Adds +5 DEF to Shield spell, or +5 ATK to Skirmish buff).*

---

## **Class Evolutions (Branching Skill Trees)**

To guarantee endless replayability, perks are not unlocked linearly. For every **5 Devotion Points** invested into a single Dice Class, the player must choose between **Path A** or **Path B**. 
*This choice is permanent for the current campaign run.* At 15 points, the unit evolves into an Advanced Class.

### **Dice 1: Fencer** *(The Balanced Core)*
*   **Tier 1 (5 Pts):** 
    *   **[A] Parry:** Negates the first 15 damage taken each round.
    *   **[B] Lunge:** Deals +15 damage if attacking an enemy currently at full HP.
*   **Tier 2 (10 Pts):**
    *   **[A] Riposte:** After surviving a melee hit, instantly deals 50% of its ATK back to the attacker.
    *   **[B] Flurry:** Minimum chip damage against high-armor targets is increased from 10 to 25.
*   **Tier 3 EVOLUTION (15 Pts):**
    *   **[A] Paladin:** Whenever the Paladin deals damage, it heals all adjacent friendly units for 20 HP.
    *   **[B] Blademaster:** Max movement increases to 3 steps. Can attack an enemy and move 1 step away immediately after.

### **Dice 2: Archer** *(The Zone Controller)*
*   **Tier 1 (5 Pts):**
    *   **[A] High Ground:** Passively ignores the extra-range attack penalty.
    *   **[B] Point Blank:** Removes the "Engaged Restriction." Can shoot even if an enemy is adjacent.
*   **Tier 2 (10 Pts):**
    *   **[A] Piercing Arrow:** Ranged attacks ignore 30% of target DEF.
    *   **[B] Venom Tipped:** Targets hit lose 10 HP at the start of their next 2 turns.
*   **Tier 3 EVOLUTION (15 Pts):**
    *   **[A] Sniper:** Base Range increases to 3. If the Sniper does not move before attacking, it deals +30 Damage.
    *   **[B] Ranger:** Gains "Run & Gun." The Ranger can move 1 step, shoot, and then move 1 step again in the same action.

### **Dice 3: Hussar** *(The Glass Cannon)*
*   **Tier 1 (5 Pts):**
    *   **[A] Momentum:** Gains +20 ATK if it moves its absolute maximum (3 steps) before attacking.
    *   **[B] Evasion:** Takes 50% less damage from Ranged attacks.
*   **Tier 2 (10 Pts):**
    *   **[A] Hit & Run:** After a kill, may immediately jump 1 step in any direction.
    *   **[B] Trample:** Moving *through* an enemy (via the `L` jump) deals 15 flat damage to them.
*   **Tier 3 EVOLUTION (15 Pts):**
    *   **[A] Dragoon:** *Impact Landing.* When finishing its `L` jump, all adjacent enemies take 20 damage.
    *   **[B] Windrider:** Once per turn, if the Windrider kills an enemy, its action is fully refunded (can act again).

### **Dice 4: Knight** *(The Flanker)*
*   **Tier 1 (5 Pts):**
    *   **[A] Pincer Strike:** +20 Damage if a friendly unit is on the exact opposite hex of the target.
    *   **[B] Joust:** Successful attacks push the enemy 1 hex backward. If blocked by terrain/unit, deals +15 bonus damage.
*   **Tier 2 (10 Pts):**
    *   **[A] Bulwark:** Gains +20 DEF for the round after moving 2 or more steps.
    *   **[B] Vanguard:** Enemies adjacent to the Knight have -10 ATK against any target *except* the Knight.
*   **Tier 3 EVOLUTION (15 Pts):**
    *   **[A] Templar:** Projects an aura. Allies standing in the Knight's 6-diagonal path gain +15 DEF.
    *   **[B] Dark Knight:** Gains Lifesteal. Heals itself for 50% of the damage dealt to enemies.

### **Dice 5: Tanker** *(The Juggernaut)*
*   **Tier 1 (5 Pts):**
    *   **[A] Spiked Armor:** Enemies taking the *Reflected Damage* penalty take an extra 15 flat damage.
    *   **[B] Magnetic:** As an action, pull an enemy within Range 2 into an adjacent hex.
*   **Tier 2 (10 Pts):**
    *   **[A] Entrench:** If it Guards without moving, heals 20 HP and gains +15 DEF.
    *   **[B] Heavy Ordinance:** Gains a Range 2 attack, but using it costs the Tanker 10 HP.
*   **Tier 3 EVOLUTION (15 Pts):**
    *   **[A] Behemoth:** Occupies its hex entirely, blocking enemy Line of Sight. Immune to critical hits. Max HP is permanently doubled.
    *   **[B] Dreadnought:** Unlocks *Overload*. Can self-destruct as an action, dealing damage equal to its remaining HP to all adjacent hexes.

### **Dice 6: Oracle** *(The Sage)*
*   **Tier 1 (5 Pts):**
    *   **[A] Blessed Aura:** Passively heals adjacent allies for 10 HP at the start of its turn.
    *   **[B] Hex:** Enemies starting their turn adjacent to the Oracle permanently lose 10 DEF.
*   **Tier 2 (10 Pts):**
    *   **[A] Swift Cast:** Can safely cast spells even when engaged in melee.
    *   **[B] Twin Cast:** The *Shield* and *Skirmish* spells affect the target AND one random ally within Range 2.
*   **Tier 3 EVOLUTION (15 Pts):**
    *   **[A] High Priest:** Unlocks *Resurrection*. Once per game, target an empty Base hex to revive a destroyed friendly unit with 50% HP.
    *   **[B] Warlock:** Modifies *Transmute (Sacrifice)*. The Oracle no longer dies when casting it. Instead, the spell costs 80 HP, and the newly converted enemy unit lasts only 3 turns before melting.

---

## Conclusion: From Skirmish to Endurance

With v3.0, *Hex Dice* has found its true identity. By abandoning pure randomness and embracing deterministic, player-crafted progression, the "Journey of the Six" is no longer just a collection of levels—it is a 100-level endurance test that echoes the deep, class-based satisfaction of the games we grew up with.

We’ve moved from the "Skirmish" mentality to the "Endurance" mentality. Forge your path, master your dice, and survive the Crucible.
