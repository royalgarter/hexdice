# Hex Dice Devlog: Introducing Version 2 - Destiny Dice

The battlefield is evolving. While **Decisive Dice** (Version 1) brought deterministic, chess-like precision to the hex grid, **Destiny Dice** (Version 2) introduces a layer of organized chaos, shifting the game from pure calculation to tactical risk management.

## The Winds of Fate: Two-Phase Turn Structure

Version 2 completely overhauls how you command your forces. A turn is split into two distinct phases:

### Phase 1: Fate's Call
At the start of every turn, a **Fate Die (1D6)** is rolled. Every friendly unit on the board whose value matches this roll gains a **free Move action**.
- **Swarm Mentality:** Since multiple units move for "free," the game now rewards Group Formations. The AI prioritizes creating defensive walls or surrounding high-value targets during this phase.
- **Setup Play:** The goal isn't necessarily to kill, but to reposition units into "Lethal Zones" where a Phase 2 unit can secure a base or kill with maximum support.

### Phase 2: Tactical Command
After the Fate moves, you perform a standard action (Move, Attack, Guard, or Spell) with **exactly one** unit. This is your deliberate, tactical choice.

## From Calculation to Probability: The New Combat Math

In Version 1, combat was deterministic. In Version 2, it is a calculated gamble:

**Total ATK = ceil((Unit ATK + Combat Roll) / 2)**

- **The Roll:** Every attack triggers a 1D6 combat roll. If `Total ATK > Defender Armor`, the target is destroyed.
- **The Fumble:** Beware the roll of **1**. If an attack fails (Total ATK <= Armor) on a roll of 1, the attacker is **immediately destroyed**.
- **Risk Assessment:** High-value units (like Knights) are now more fragile. The AI has evolved to become more risk-averse with its elites, often using "fodder" (Fencers/Archers) to take risky 50/50 gambles.

## Randomized Spells: The Oracle's Chaos

The Oracle (D6) has seen their power restricted. They now channel a random spell:
- **1 or 4:** Shield
- **2 or 5:** Swap
- **3 or 6:** Skirmish

The AI has moved from proactive spellcasting to **Adaptive Spellcasting**. It won't decide "I want to cast Shield." Instead, it evaluates the board for all three possibilities, activating the Oracle only if the average utility of the potential spells is high. If a spell like "Swap" would be disastrous, it will often forgo the Oracle entirely to avoid friendly fire.

## AI Evolution: Thinking in Expected Value (EV)

To keep up with Version 2, the AI has been upgraded to a "Gambler-Tactician." It no longer asks "Can I kill this?" but rather:
**Expected Value = (Win Prob * Target Value) - (Fumble Prob * Self Value)**

### AI "Personalities" in V2
| Personality | Strategy |
| :--- | :--- |
| **The Gambler** | Always takes the shot if P(Win) > 30%. Ignores Fumble risks. |
| **The Tactician** | Only attacks if P(Win) > 70%. Uses Phase 1 to build "Bodyguard" walls. |
| **The Chaos Lord** | Prioritizes Oracles. Relies on "luck-sacking" the right spell. |
| **The Conservative** | Only uses Phase 2 for "Guard" or "Base Defense" unless a 100% win is available. |

## Playtest Findings

During our simulations, we've observed that:
1. **D5 (Tanks)** are significantly more terrifying due to their high armor, making them hard to deflect.
2. **Phase 1 maneuvers** often determine the winner, with "burst movement" effectively doubling a unit's threat range.
3. **Fumbles** are common enough that every roll feels significant, creating dramatic swings where a weak defender can accidentally destroy an attacker.

Version 2 is currently in beta and can be accessed by adding `?version=2` to your game URL. Prepare your dice—fate awaits!
