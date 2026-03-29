https://claude.ai/chat/d9f489f7-fb4a-4145-a361-e3ad711d4d2e

Now I have a thorough understanding of **Hex Dice**. Let me convene the expert panel.

---

# 🎲 Hex Dice — Expert Panel Balance Review

*The following is a roundtable critique from a five-member board game design team.*

---

## The Panel

> **Marcus Chen** — Combat Systems Designer (15 yrs, AAA & tabletop)
> **Dr. Elise Vander** — Game Theorist & Balance Analyst
> **Sofia Reinholt** — Movement & Spatial Design Specialist
> **Jake "Cardboard" Torres** — Competitive Playtester & Meta Analyst
> **Priya Nair** — Economy & Setup Designer

---

Here is the at-a-glance unit matrix the panel worked from:---

## 🗣️ Marcus Chen — Combat Systems Designer

**"The combat math is elegant but creates a ruthless power cliff."**

The `Attack = Dice+1`, `Armor = Dice` formula is clean. Every unit one-shots anything strictly below it. But this means the entire game reduces to a strict dominance hierarchy with no rock-paper-scissors tension whatsoever. Let's chart who can kill whom in a single hit:

- **Dice 1 (Atk 2):** kills only Dice 1.
- **Dice 2 (Atk 3):** kills Dice 1–2.
- **Dice 3 (Atk 4):** kills Dice 1–3.
- **Dice 4 (Atk 5):** kills Dice 1–4.
- **Dice 5 (Atk 6):** kills everything, including Dice 6.
- **Dice 6 (Atk 6):** kills Dice 1–5 only. It cannot kill another Dice 6 in one shot... wait, actually it can: Attack 6 ≥ Armor 6 is true. So the attacker always wins in a mirror match. This means whoever swings first in a Dice 6 vs. Dice 6 matchup wins. That's a positional ambush dynamic — interesting, but it makes the first-mover advantage enormous for the highest-tier piece.

**Critical find:** Dice 5 is the only unit that counters Dice 6 *without* needing to close the gap. A ranged Attack 6 vs. Armor 6 resolves in the Dice 5's favor — from safety. Dice 6 has zero response. This is actually a good counter-design, but it makes Dice 5 a mandatory tech pick: every army without a Dice 5 has no reliable answer to a fortified Dice 6.

**The armor erosion mechanic saves low-tier units** — a Dice 1 can chip a Dice 6 down to 0 armor over 6 turns. This is critical for preserving relevance of low rolls, but it takes so many turns that in a fast-closing game (6 dice, 2 players), eroding a Dice 6 is rarely viable.

**Recommendation:** Consider making the attack formula `Attack = Dice + 1` but capping it at 6 (already done), and introducing a "counter-attack" window: when a melee attack *fails* (Atk < Armor), the defender deals 1 armor reduction back to the attacker. This adds bidirectional attrition and makes brawling two heavyweights together actually costly.

---

## 🗣️ Dr. Elise Vander — Game Theorist

**"The Guard + Dice 6 combo is close to a solved win condition."**

Let me walk through what happens when a Dice 6 uses Guard. It gains Armor+1, reaching effective Armor 7. No unit in the game has Attack 7. This means a guarded Dice 6 is **permanently un-killable in a single hit** by any unit — including Dice 5 at range. You must first strip the guard, then attack next turn. And since Guard only drops when the Dice 6 *moves* — which it never does — a Dice 6 in Guard can hold indefinitely.

Now add its aura: all adjacent allies gain Armor+1. A cluster of a Dice 6 + a Dice 4 (now effective Armor 5) + a Dice 3 (now effective Armor 4) creates a fortress block where:
- The Dice 6 is unkillable
- The flankers are much harder to dislodge
- The only units that can one-shot the flankers at all now need to be Dice 4+ (for the Dice 3 flanker) or Dice 5 (for the Dice 4 flanker)

In a 6-dice army, rolling even two 5s or 6s gives you the core of this formation. **If your opponent doesn't have a Dice 5, this cluster has no efficient answer.**

**Recommendation:** Guard should have a limited duration — 1 round, or until attacked once. Alternatively, Ranged Attack (Dice 5) should ignore Guard bonus — the flavor being that artillery punches through fortifications.

---

## 🗣️ Sofia Reinholt — Movement & Spatial Design

**"Movement archetypes are well-differentiated, but two units feel stranded."**

The movement designs are genuinely creative for a hex grid. Let me rate each:

**Dice 1 (straight line, 3 fwd/1 bk):** Thematic as infantry. Good for base rushes. However, it can *only* advance on its own primary axis — it cannot reposition laterally at all. On a hex board where flanking is everything, a unit with zero lateral movement is a sitting duck after its opening charge. It becomes purely a forward pawn or an armor-eroding sacrificial piece. Useful, but very narrow.

**Dice 2 (diagonal X, 3 steps):** Excellent flanker. The diagonal-only movement creates a beautiful "color-binding" effect on the hex grid — it can only reach roughly half the board's hexes from any given position. This is an underappreciated constraint that the designer may not have fully considered. Across a long game, a Dice 2 can be permanently cut off from certain hexes it would need to occupy.

**Dice 3 (L-jump, can jump friendlies):** The standout design. Unpredictable, hard to block, synergizes with dense formations. The jump-over-friendlies rule is strong — this unit becomes significantly more powerful the more units are on the board, as it can snake through your own lines. In a 6-dice army this is less potent; in an 8-dice army it becomes a serious threat.

**Dice 4 (cross/+, 2 steps):** Well-rounded but the 2-step distance feels insufficient compared to Dice 1–3's 3-step range. For a mid-tier unit with solid armor and attack, the reduced mobility makes it feel less agile than cheaper units. The "up to 1 step to any adjacent hex" clause does add flexibility for micro-positioning.

**Dice 5 (1-step adjacent + range 2–3):** The 1-step movement is the main balancing lever on what is otherwise the strongest unit in the game. It works — but it means Dice 5 absolutely needs protection. A Dice 3 or Dice 2 acting as a blocker is critical. The "dead zone" at range 1 (cannot attack adjacent) is a strong design choice — it creates interesting push-pull dynamics.

**Dice 6 (immobile unless winning combat):** Immobility-as-flavor is great. The "moves on win" rule for Special Attack is clever — it gives it a slow, grinding advance. However, since it cannot move freely, its placement at deployment is permanent unless it's actively attacking. **This makes deployment of Dice 6 the single most impactful decision in the game.** A badly placed Dice 6 is worthless; a well-placed one near the center or a chokepoint is dominant.

**Recommendation:** Give Dice 1 a single lateral step option (1 hex sideways) to allow minimal repositioning. Cap Dice 3's jump at "jump over friendly only, not over enemies" — this is already the rule, but ensure it's enforced consistently to prevent abuse.

---

## 🗣️ Jake "Cardboard" Torres — Competitive Meta Analyst

**"The meta will solve around Dice 5. Fast."**

Let me think about this from a tournament-level perspective. In any army, the ideal unit is one that:
1. Can kill the strongest enemy unit
2. Has survival tools
3. Has mobility or range

Dice 5 ticks all three boxes. Attack 6 kills everything. Armor 5 is second highest. Range 2–3 keeps it safe. The only weakness is Mobility 1.

In a standard 6-dice army, the probability of rolling at least one Dice 5 is about 67% (1 − (5/6)^6). Two or more Dice 5s? About 26%. Any competitive player will burn both rerolls trying to get there. **The reroll economy is essentially "try to get Dice 5s."**

Meanwhile Dice 1 and Dice 2 are so weak that experienced players will always reroll them. The "choose ⅓ of dice to reroll" rule (2 rerolls in a 6-dice game) means players spend rerolls upgrading their weakest pieces, not diversifying. This creates convergent army compositions:

- **Everyone wants:** Dice 5, Dice 6, Dice 4
- **Nobody wants:** Dice 1, Dice 2 (cannon fodder only)
- **Dice 3** is situationally good — the jump is uniquely powerful

In a 2-player 6-dice game, the player who rolls more 5s and 6s almost certainly wins. The game's randomness is frontloaded at setup, with the remainder being mostly deterministic. This is fine for a casual game, but the luck-to-skill ratio sits at about 60/40 in setup's favor right now.

**Recommendations:**
- Consider a "draft" variant where players roll all dice but take turns picking units from a shared pool — this removes luck from setup entirely.
- Or increase rerolls to ½ of dice (3 out of 6) to give more agency.
- Or make Dice 1 and 2 have a unique power (e.g., Dice 1 can carry another unit, Dice 2 cannot be targeted by ranged attacks) so they're not always "reroll me."

---

## 🗣️ Priya Nair — Economy & Setup Designer

**"The Base Capture win condition creates degenerate rushing strategies."**

In a 2-player game, the Base Capture win condition (move any unit onto the opponent's base hex) is a potentially game-breaking shortcut. A Dice 1 Infantry with 3 forward steps can cross enormous distances very quickly on a 12-hex-diameter board. Let me estimate: if the bases are ~10 hexes apart and a Dice 1 moves 3 steps per activation, it only needs 4 activations to cross the board unobstructed.

With Alternating Activations (each player activates 1 unit per turn), a Dice 1 rushing down the center lane might reach the opponent's base in 4 turns, during which the opponent gets 4 activations of their own. If they don't have a blocker in the right spot, the game ends turn 4. This is a **glass cannon opener** that may feel like it bypasses the tactical depth the game promises.

The fact that the base is the opponent's *deployment zone* means their starting units are naturally there at turn 1. But by mid-game, if a player over-commits units forward, their base can be open. This is arguably good strategy, but the game gives no "respawn" or garrison mechanic to compensate.

**Also flagging:** the 3-player and multiplayer win conditions are purely "last player standing." With aggressive elimination, a player who gets targeted early by two opponents has essentially no counterplay. King-making is a significant risk.

**Recommendations:**
- Add a "garrison token" on the base hex that functions as an immovable defender (Armor 3, no attack) — flavorfully a fortification. This makes base rushes require more commitment.
- For multiplayer: consider a point-scoring system (1 point per enemy unit eliminated, 3 points for base capture) and play to X points, reducing kingmaking dynamics.

---

## 📊 Summary Verdict

---

## 🔧 Top 3 Priority Fixes (Panel Consensus)

**Fix 1 — Nerf Dice 5 (Critical):** Reduce its attack to 5 so it can no longer one-shot Dice 6 (Armor 6). This preserves Dice 6's fortress role and makes Dice 5 excellent (kills Dice 1–5) but not the universal "I win" button. Alternatively, make Dice 5's ranged attack cause armor erosion rather than instant kill when hitting Dice 6.

**Fix 2 — Limit Guard Duration (Critical):** Guard should last until end of opponent's next full turn, OR until the guarding unit is successfully attacked once (the guard token absorbs the hit). This prevents permanent invincibility while keeping the tactical "brace for impact" flavor.

**Fix 3 — Address Dice 1 & 2 Reroll Trap (Moderate):** Give each a secondary power that makes them worth keeping. Suggestion: Dice 1 can move through hexes occupied by friendly units (ghost-soldier routing). Dice 2 cannot be targeted by Ranged Attack (its diagonal mobility makes it hard to track — anti-artillery flavor). These passive rules cost nothing at the table but give players a reason to consider keeping low rolls.

---

**Overall:** Hex Dice has a genuinely clever core — using the dice face as both identity and stat is elegant, and the movement archetypes are inventive for a hex grid. The main issues are a single dominant unit (Dice 5), an unbreakable defensive combo (Guard + Dice 6), and frontloaded luck. None of these are structural flaws — they're all tunable without rethinking the game. This is a strong v1.0 with a clear path to v1.1.