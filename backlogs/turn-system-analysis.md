# Turn System Analysis: Alternating Activations vs Full Army Activation

## Overview

This document analyzes the current **Alternating Activations** turn structure (one unit per turn) versus a **Full Army Activation** system (all units per turn) for Hex Dice, exploring trade-offs, hybrid approaches, and recommendations.

---

## Current System: Alternating Activations (One Unit Per Turn)

### How It Works
Players take turns in set order. On a player's turn, they activate **one unit** which performs **one action**: Move, Reroll, Guard, Ranged Attack, or Command & Conquer. After the action completes, turn passes to the next player.

### Pros
| Factor | Description |
|--------|-------------|
| **High Engagement** | Both players are constantly making decisions |
| **Tactical Responsiveness** | React to opponent's moves immediately |
| **Balanced Pacing** | Prevents runaway turns where one player dominates |
| **Thematic Fit** | Aligns with "life is adaptation on an ever-changing battlefield" |
| **Reduced Analysis Paralysis** | Smaller decision space per activation |
| **Natural Rhythm** | Mimics back-and-forth combat rhythm typical of dice games |

### Cons
| Factor | Description |
|--------|-------------|
| **Longer Games** | More turns required to achieve objectives |
| **Tracking Complexity** | Must track turn order in 3-6 player games |
| **Player Downtime** | In 4-6 player games, significant wait between activations |

---

## Alternative: Full Army Activation (All Units Per Turn)

### How It Would Work
On your turn, activate **ALL** your units sequentially. Each unit performs one action. After all units act, turn passes to next player.

### Pros
| Factor | Description |
|--------|-------------|
| **Faster Games** | Fewer total turns |
| **Strategic Depth** | Plan complex multi-unit maneuvers |
| **Simpler Turn Tracking** | Clear player phases |
| **Combo Potential** | Set up attacks, then execute them |

### Cons
| Factor | Description |
|--------|-------------|
| **Analysis Paralysis** | Large decision space (8-12 units × 5 actions = 40-60 choices) |
| **Runaway Turns** | One player can eliminate multiple enemies before they respond |
| **Reduced Interaction** | Opponent watches passively during your turn |
| **Oracle Exploitation** | Cast spells on multiple units, then attack with all |
| **Guard Devaluation** | Guard charges become less valuable (can guard entire army, then attack) |

---

## Hybrid Approaches

### 1. Action Point System

**Mechanic:**
- Each player gets **X action points** per turn (e.g., equal to units on board ÷ 2, rounded up)
- Different actions cost different points:
  - Move: 1 AP
  - Guard: 1 AP
  - Reroll: 1 AP
  - Ranged Attack: 2 AP
  - Spellcast: 2 AP
  - Oracle Sacrifice: 1 AP

**Pros:** Flexible, allows partial army activation, scales with army size

**Cons:** Adds complexity, requires AP tracking

**Example:**
- Player with 8 units → 4 AP per turn
- Can: Move 4 units, or Move 2 + Attack 1, or Spellcast 2 units, etc.

---

### 2. Command Phase + Activation Phase

**Mechanic:**
- **Command Phase**: Both players secretly select 2-3 units to activate
- **Activation Phase**: Reveal selections and resolve in initiative order (highest die value goes first)
- Selected units perform actions sequentially

**Pros:** Adds bluffing/psychology element, maintains interaction, reduces downtime

**Cons:** More complex, requires hidden information mechanic

---

### 3. Squad Activation

**Mechanic:**
- Activate **2-3 units per turn** instead of 1
- Player chooses which units and in what order
- Turn passes after squad completes actions

**Pros:** 
- Faster than current system (~50% game time reduction)
- Maintains tactical interaction
- Simple to understand

**Cons:** 
- Still longer than Full Army
- May slightly favor larger armies

**Recommended as optional "Blitz Mode" house rule**

---

### 4. I Go, You Go with Interrupts

**Mechanic:**
- Player A activates all units
- Player B can declare **"Overwatch"** actions during A's turn:
  - When an enemy unit moves adjacent, Player B can immediately attack with an adjacent unit
  - When a unit attacks, Player B can Guard an adjacent friendly unit
- Overwatch uses the unit's action for next turn

**Pros:** Maintains interaction during opponent's turn, adds tactical layer

**Cons:** Complex interrupt resolution, slows down active player's turn

---

### 5. Action Budget (Scaled by Player Count)

**Mechanic:**
- Each player gets **N activations per turn** where N = number of opponents
  - 2 players: 1 activation each (essentially current system)
  - 3 players: 2 activations per turn
  - 4 players: 3 activations per turn
  - 6 players: 5 activations per turn
- After all players complete their activations in round-robin fashion, new round begins

**Pros:** Scales with player count, maintains balance, reduces downtime in multiplayer

**Cons:** Still slower than Full Army, adds round tracking

---

## Recommendations

### Primary: Retain Alternating Activations

The current **Alternating Activations** system is **well-suited** to Hex Dice because:
1. Matches the game's design philosophy ("dice for everything", tactical depth, deterministic combat)
2. Supports Oracle's tactical positioning (engaged restriction matters more)
3. Guard charges remain valuable
4. Prevents Oracle spellchain abuse (buff entire army then attack)
5. Aligns with Final Fantasy Tactics / Advanced Wars inspiration (alternating turns)

### Optional Variant: Blitz Mode

**House Rule:** Activate **2 units per turn** instead of 1.

- Cuts game time roughly in half
- Maintains tactical interaction
- Simple to implement and explain
- Can be enabled/disabled per game
- **Recommended for experienced players**

### Implementation Priority

| Priority | Variant | Complexity | Target |
|----------|---------|------------|--------|
| **1** | Alternating Activations (Current) | Low | Default |
| **2** | Blitz Mode (2 units/turn) | Low | Optional variant |
| **3** | Action Point System | Medium | Advanced variant |
| **4** | Squad Activation | Low | House rule |
| **5** | Command + Activation Phase | High | Expansion |
| **6** | I Go, You Go with Interrupts | High | Expansion |

---

## Balance Implications

### Guard Charges
| System | Impact |
|--------|--------|
| Alternating Activations | High value - can guard key units reactively |
| Full Army Activation | Low value - opponent attacks after you guard |
| Action Points | Medium value - costs AP to guard vs attack |

### Oracle Spells
| System | Impact |
|--------|--------|
| Alternating Activations | Balanced - must choose between buffing or attacking |
| Full Army Activation | Strong - can buff entire army, then attack |
| Action Points | Balanced - spells cost more AP |

### Ranged Attacks (Archer)
| System | Impact |
|--------|--------|
| Alternating Activations | Balanced - enemy can close distance before your next turn |
| Full Army Activation | Strong - can shoot multiple times before enemy responds |
| Action Points | Balanced - ranged attacks cost more AP |

### Rerolls
| System | Impact |
|--------|--------|
| Alternating Activations | Risky - unit has 0 armor until your next turn |
| Full Army Activation | Safer - can reroll then guard in same turn |
| Action Points | Moderate - must budget AP for reroll + guard |

---

## Next Steps

1. **Playtest Blitz Mode** (2 units/turn) to evaluate:
   - Game duration
   - Player engagement
   - Balance shifts (Oracle power, Guard value, Archer dominance)

2. **Prototype Action Point System** if Blitz Mode is too fast:
   - Test AP costs: Move=1, Guard=1, Reroll=1, Attack=2, Spell=2
   - AP pool = ceiling(units / 2)

3. **Gather Player Feedback** on:
   - Preferred game length
   - Decision complexity tolerance
   - Multiplayer experience (downtime tolerance)

4. **Consider Digital Implementation** (if building web/mobile version):
   - Action Points easier to track digitally
   - Interrupts feasible with UI prompts
   - Can offer multiple turn system options

---

## Appendix: Game Design Philosophy Alignment

From rules.md:
> *"Hex Dice was born from a desire to meld the simplicity of everyday components with deep strategic possibility, creating a casual yet fiercely tactical experience where your dice are the very essence of your command, and life is adaptation on an ever-changing battlefield."*

**Key Design Principles:**
- Simplicity of components → Simplicity of rules
- Tactical depth → Meaningful choices per activation
- Adaptation → Reactive gameplay
- Casual yet fierce → Accessible but competitive

**Turn System Fit:**
- Alternating Activations ✅ Aligns with all principles
- Blitz Mode ✅ Aligns with most, slightly faster
- Action Points ⚠️ Adds complexity, but deepens tactics
- Full Army ❌ Conflicts with "adaptation" (less reactive)
