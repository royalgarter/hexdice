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

## Conclusion: From Skirmish to Endurance

With v3.0, *Hex Dice* has found its true identity. By abandoning pure randomness and embracing deterministic, player-crafted progression, the "Journey of the Six" is no longer just a collection of levels—it is a 100-level endurance test that echoes the deep, class-based satisfaction of the games we grew up with.

We’ve moved from the "Skirmish" mentality to the "Endurance" mentality. Forge your path, master your dice, and survive the Crucible.
