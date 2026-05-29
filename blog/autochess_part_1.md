# Hex Dice Autochess: From Strategic Dice to Action Gauge (Part 1)

The journey of *Hex Dice* has always been about one thing: the tension of the roll. In V1 and V2, we perfected the surgical, turn-based skirmish. But as we looked at the landscape of modern mobile gaming, we realized there was an opportunity to take our "Legendary Six" into a new arena—the asynchronous, high-stakes world of **Autochess**.

This is the story of how we built the **Action Gauge System** and the **Autochess Skill Trees**, transforming *Hex Dice* from a game of direct control into a game of pure strategy and spectacle.

---

## 1. The Pivot: Strategy Over Control

The goal was simple but ambitious: create a mode where players focus on formation and composition rather than moving units hex-by-hex. We wanted to capture the "Super Auto Pets" or "TFT" magic—where the battle is won in the preparation phase.

### The Core Loop
We settled on a 6-round tournament format:
1.  **Preparation Phase:** Arrange your army in the deployment zone.
2.  **Recruitment:** Each round, you earn new units to bolster your ranks.
3.  **Combat:** Units fight automatically using a new, tick-based simulation.

By moving to an auto-battler format, we solved a major mobile pain point: **Decision Paralysis.** Instead of worrying about every move, the player becomes the General, watching their master plan unfold.

---

## 2. The Heartbeat: The Action Gauge (ATB)

The biggest technical challenge was moving away from alternating turns. In a turn-based system, speed is just "how far you move." In Autochess, we needed speed to be "how often you act."

We implemented an **Action Gauge (ATB)** system:
- Each unit has a gauge (0–100%).
- The gauge increments every "tick" based on the unit's **Speed** stat.
- When the gauge hits 100%, the unit triggers its AI behavior—attacking, kiting, or shielding—and resets.

This created a dynamic, simultaneous-feeling combat experience. High-speed units like the **Hussar** now feel like rapid-fire assassins, while the heavy **Tanker** moves with a slow, deliberate, and devastating rhythm.

---

## 3. The Economy: Merging and Veterans

Early in development, our expert panel warned us about the "Win-More" snowball. If winners get more stats, they become un-hittable. We pivoted to a **Merge System**:
- To upgrade a unit, you must collect identical dice.
- Merging two ★1 units creates a **★2 Veteran** with increased HP and Attack.
- This shift rewards economy management and "fishing" for the right units, rather than just winning early RNG battles.

---

## 4. The Autochess Skill Trees: Specialized Evolutions

In Campaign Mode, perks were built for manual control. For Autochess, we needed **Action Gauge Manipulation**. We redesigned the Perk System into a 3-Tier branching tree for each of the six unit classes.

These perks are no longer just stat bumps—they are **behavioral shifts** that interact with the tick-based simulation.

### **The Autochess Mastery Matrix**

1. Fencer (Action Economy Specialist)
 * Tier 1 (5 Pts):
     * [A] Parry: Negates the first 15 damage taken every time the
       Action Gauge resets.
     * [B] Lunge: Deals +20 damage if the Fencer's Action Gauge is
       higher than the target's at the moment of impact.
 * Tier 2 (10 Pts):
     * [A] Riposte: After surviving a hit, instantly gains 20% Action
       Gauge and deals 25% ATK back.
     * [B] Flurry: Each consecutive attack on the same target increases
       Speed by 2 (Max +10) for the round.
 * Tier 3 EVOLUTION (15 Pts):
     * [A] Paladin: Whenever the Paladin attacks, it heals all adjacent
       friendly units for 15% of their Max HP.
     * [B] Blademaster: After an attack, instantly gains 50% Action
       Gauge. If the target was killed, gain 100% instead.

2. Archer (Continuous Pressure)
 * Tier 1 (5 Pts):
     * [A] Eagle Eye: Range +1. Removes the damage penalty for attacking
       at maximum range.
     * [B] Point Blank: Attacks within Range 1-2 grant +10 Speed for the
       next action.
 * Tier 2 (10 Pts):
     * [A] Piercing Arrow: Attacks ignore 40% of target DEF and reduce
       target's Action Gauge by 10%.
     * [B] Slowing Shot: Targets hit have their Speed reduced by 5 for
       200 ticks.
 * Tier 3 EVOLUTION (15 Pts):
     * [A] Sniper: Every 3rd attack deals +100% Damage and freezes the
       target's Action Gauge for 50 ticks.
     * [B] Ranger: "Run & Gun": Gains +20 Speed while moving. Can attack
       mid-movement if a target enters range.

3. Hussar (High-Speed Striker)
 * Tier 1 (5 Pts):
     * [A] Momentum: Gains +1 ATK for every 5% of current Action Gauge
       when starting an attack move.
     * [B] Evasion: 30% chance to completely negate damage while Action
       Gauge is above 50%.
 * Tier 2 (10 Pts):
     * [A] Hit & Run: After an attack, instantly teleports to the
       furthest valid hex within Range 2 and gains +5 Speed.
     * [B] Trample: Moving through or past an enemy reduces their Action
       Gauge by 30%.
 * Tier 3 EVOLUTION (15 Pts):
     * [A] Dragoon: Landing a jump deals 30 damage to adjacent enemies
       and sets their Action Gauge to 0.
     * [B] Windrider: Upon a kill, instantly refills Action Gauge to
       100% (Max once per 5 seconds).

4. Knight (Tactical Disruptor)
 * Tier 1 (5 Pts):
     * [A] Pincer Strike: If an ally is adjacent to the target, the
       Knight gains +15 Speed for that action.
     * [B] Joust: Attacks push enemies back. If an enemy hits a wall or
       unit, they lose 50% of their current Action Gauge.
 * Tier 2 (10 Pts):
     * [A] Bulwark: While Action Gauge is filling (charging), the Knight
       has +30 DEF.
     * [B] Vanguard: Adjacent enemies have -5 Speed and -10 ATK.
 * Tier 3 EVOLUTION (15 Pts):
     * [A] Templar: Aura: Allies within 2 hexes gain Speed equal to 20%
       of the Templar's current Speed.
     * [B] Dark Knight: Lifesteal: Heals for 50% of damage dealt.
       Attacks also "Vampire" 10% of the target's Action Gauge.

5. Tanker (The Unstoppable Wall)
 * Tier 1 (5 Pts):
     * [A] Spiked Armor: Reflects 20 flat damage to any melee attacker.
     * [B] Magnetic: Every 150 ticks, pulls the nearest enemy within
       Range 3 into an adjacent hex and stuns their Gauge for 20 ticks.
 * Tier 2 (10 Pts):
     * [A] Entrench: Every time the Action Gauge hits 100, if the Tanker
       didn't move, it gains +20 DEF (stacks up to 3 times).
     * [B] Heavy Ordinance: Attacks have Range 2 and deal area damage,
       but reduce the Tanker's Speed by 5 for the next action.
 * Tier 3 EVOLUTION (15 Pts):
     * [A] Behemoth: Max HP doubled. While below 50% HP, Speed is
       increased by 50%.
     * [B] Dreadnought: "Reactor Meltdown": When HP hits 0, explodes for
       100 damage (3-hex radius) and sets all caught Gauges to 0.

6. Oracle (The Gauge Weaver)
 * Tier 1 (5 Pts):
     * [A] Blessed Aura: Every 100 ticks, heals all allies within 2
       hexes for 10 HP.
     * [B] Hex: Every 100 ticks, reduces the DEF of the nearest 2
       enemies by 10.
 * Tier 2 (10 Pts):
     * [A] Haste Cast: Casting a spell (Shield/Skirmish) grants the
       target +10 Speed for 200 ticks.
     * [B] Twin Cast: Spells now hit 3 targets and generate 10% Action
       Gauge for each target hit.
 * Tier 3 EVOLUTION (15 Pts):
     * [A] High Priest: "Divine Intervention": Once per battle, when an
       ally would die, they instead survive at 1 HP and gain 100% Action
       Gauge.
     * [B] Warlock: "Time Warp": Sacrifice 50 HP to instantly set the
       Action Gauge of all allies to 100% and all enemies to 0%. (Once
       per battle).

---

## 5. Technical Highlights: The Combat Hook

One of the neatest tricks in the implementation was the **Combat Hook Interception**. Our base game logic (V1/V2) was designed for instant-kill mechanics. For Autochess, we had to "intercept" the AI's intent. 

When the AI decides to attack, the `applyMove` function checks if Autochess is active. If so, it redirects to our custom `handleCombat` function, which processes the complex HP/Armor/Perk math without breaking the core engine. This "Surgical Redirection" allowed us to build Autochess on top of *Hex Dice* without rewriting the entire game from scratch.

---

## Conclusion: The New Arena

With the Action Gauge and the specialized Skill Trees, *Hex Dice* Autochess has transformed from a prototype into a deep, competitive experience. Whether you are building a **Warlock Oracle** to manipulate time or a **Dreadnought Tanker** to serve as a walking bomb, the "Legendary Six" have never felt more alive.

Stay tuned for Part 2, where we dive into the **AI Heuristics** and the math behind the **TTK (Time-To-Kill) System**.
