# Game Engine Review - Hex Dice

**Review Date:** 2026-04-01  
**File Reviewed:** `game.js` (1628 lines)  
**Focus Areas:** CALCULATE functions, COMBAT functions

---

## Architecture Overview

The code follows a monolithic game state pattern with all logic encapsulated in `alpineHexDiceTacticGame()`.

### Key Sections

| Section | Line Range | Description |
|---------|------------|-------------|
| Constants & Config | 1-60 | Hex grid, unit stats, axes, player config |
| Initialization | 61-150 | Game setup, reset, hex grid generation |
| UI Styling | 151-280 | Hex coloring, hover effects |
| Setup Phase | 281-500 | Roll, reroll, deploy phases |
| Gameplay | 501-750 | Unit selection, actions, turn flow |
| **CALCULATE** | **1088-1380** | **Valid moves, targets, armor, deployment** |
| **COMBAT** | **1425-1510** | **Melee, ranged, special attack resolution** |
| Turn Management | 1511-1628 | End turn, win conditions, utilities |

---

## Unit Reference

| Dice | Name | Attack | Armor | Range | Distance | Movement |
|------|------|--------|-------|-------|----------|----------|
| 1 | Fencer | 2 | 2 | 0 | 2 | `\|` (primary axis) |
| 2 | Archer | 2 | 0 | 2 | 2 | `*` (any direction) |
| 3 | Hussar | 3 | 0 | 0 | 3 | `L` (knight-like) |
| 4 | Knight | 2 | 1 | 0 | 3 | `X` (diagonal) |
| 5 | Tanker | 1 | 4 | 0 | 1 | `*` (any direction) |
| 6 | Legate | 1 | 5 | 1 | 0 | `0` (stationary) |

---

## COMBAT Functions Review

### `handleCombat(attackerHexId, defenderHexId, combatType, state)`

**Location:** Line 1425

**Purpose:** Core combat resolution for MELEE, RANGED_ATTACK, and COMMAND_CONQUER.

**Current Logic:**
```javascript
const defenderEffectiveArmor = this.calcDefenderEffectiveArmor(defenderHexId, state);

if (defenderUnit.armorReduction >= UNIT_STATS[defenderUnit.value].armor || 
    attackerUnit.attack >= defenderEffectiveArmor) {
    // Attacker wins: remove defender, move attacker (if melee)
} else {
    // Attacker fails: both units take 1 armor reduction
}
```

#### 🔴 Issues Found

1. **Inconsistent armor comparison logic**
   - First condition: `armorReduction >= base_armor` (checks accumulated damage)
   - Second condition: `attack >= effectiveArmor` (includes guard/legate buffs)
   - **Problem:** A unit with 4 base armor, 3 reduction (1 remaining), guarding (+1) has `effectiveArmor = 2`. An attacker with `attack = 1` would fail the second check but pass the first. This creates ambiguity.

2. **Failed attack damages both units** (Lines 1463-1464)
   ```javascript
   this.applyDamage(attackerHexId, 1, state);
   this.applyDamage(defenderHexId, 1, state);
   ```
   - This mechanic isn't clearly documented in rules comments
   - Verify this matches intended game design

3. **Visual trail only set on failed attacks** (Lines 1474-1479)
   ```javascript
   this.trailAttack = {
       fromHex: attackerHex,
       toHex: defenderHex,
       unit: attackerUnit,
       dist: this.axialDistance(...),
   };
   ```
   - Successful attacks don't trigger visual feedback

4. **Redundant combat type check** (Line 1451)
   ```javascript
   if (combatType === 'MELEE' || (combatType === 'COMMAND_CONQUER' && attackerUnit.value === 6))
   ```
   - Only Dice 6 can initiate COMMAND_CONQUER, so the value check is redundant

---

### `applyDamage(hexId, damage=1, state)`

**Location:** Line 1501

**Purpose:** Apply armor reduction damage to a unit.

**Current Logic:**
```javascript
unit.armorReduction += damage;
this.calcDefenderEffectiveArmor(hexId, state);
if ((damage > 1) && unit.effectiveArmor <= 0) this.removeUnit(hexId, state);
```

#### 🔴 Critical Issue

**Single damage doesn't trigger removal at 0 armor:**
```javascript
if ((damage > 1) && unit.effectiveArmor <= 0)  // BUG: damage > 1 condition
```

**Rule states:** "If a unit's Armor reaches 0, the next attack it suffers, regardless of the attacker's Attack value, automatically defeats it."

**Fix:**
```javascript
if (unit.effectiveArmor <= 0) this.removeUnit(hexId, state);
```

---

## CALCULATE Functions Review

### `calcValidMoves(unitHexId, isForMerging, state)`

**Location:** Line 1169

**Purpose:** Calculate all valid destination hexes for a unit.

#### Movement Patterns

| Pattern | Dice | Behavior |
|---------|------|----------|
| `\|` | 1 | Primary axis forward, 1 step backward |
| `L` | 3 | Knight-like L-shape (12 positions) |
| `X` | 4 | Diagonal axes only |
| `+` | 4 | Primary + adjacent axes (complex) |
| `*` | 2, 5 | BFS any direction |
| `0` | 6 | No movement (stationary) |

#### 🟡 Issues Found

1. **BFS enemy blocking logic is tangled** (Lines 1245-1253)
   ```javascript
   } else if (!isForMerging && unitOnN.playerId !== unit.playerId && !unit.range) {
       possibleMoves.push(n.id);  // Can attack
       // But traversal stops (no nextQ.push)
   }
   ```
   - Correct behavior but hard to read
   - Consider extracting into `canMoveThroughHex()` helper

2. **Magic numbers for deployment expansion** (Lines 1293-1309)
   - Hardcoded offset patterns for `dicePerPlayer <= 9` and `<= 14`
   - Consider data-driven approach with configuration

---

### `calcValidRangedTargets(attackerHexId, state, isHovering)`

**Location:** Line 1088

**Purpose:** Calculate valid targets for Dice 2 (Archer) ranged attacks.

#### 🟡 Issues Found

1. **Adjacent enemy check may be too restrictive** (Lines 1099-1108)
   ```javascript
   let isEnemyAdjacent = false;
   for (let neighborHex of this.getNeighbors(attackerHex, state)) {
       if (targetUnit && targetUnit.playerId !== attackerUnit.playerId) {
           isEnemyAdjacent = true;
           break;
       }
   }
   if (isEnemyAdjacent) return [];  // No ranged attacks allowed
   ```
   - **Question:** Should this prevent attacks if ANY enemy is adjacent, or only if the target is adjacent?
   - Verify against game rules

2. **Line-of-sight duplicate logic** (Lines 1131-1148)
   ```javascript
   // Check with Math.ceil
   checkQ = Math.ceil(attackerHex.q + stepQ * i);
   checkR = Math.ceil(attackerHex.r + stepR * i);
   // ... blocking check ...

   // Check with Math.floor (runs even if ceil blocked)
   checkQ = Math.floor(attackerHex.q + stepQ * i);
   checkR = Math.floor(attackerHex.r + stepR * i);
   ```
   - Should return early if either check finds a blocker
   - Currently both run independently

3. **`isHovering` bypasses enemy validation** (Lines 1115-1118)
   ```javascript
   if ((targetUnit && targetUnit.playerId !== attackerUnit.playerId) || isHovering)
   ```
   - Shows ALL hexes in range during hover (including empty)
   - May be intentional for UI preview, but worth documenting

---

### `calcValidSpecialAttackTargets(attackerHexId, state, isHovering)`

**Location:** Line 1157

**Purpose:** Calculate valid targets for Dice 6 (Legate) Command & Conquer.

**Status:** ✅ Logic appears correct

**Note:** Deprecated Dice 1 Brave Charge logic was properly removed and moved to `calcValidBraveChargeMoves`.

---

### `calcDefenderEffectiveArmor(defenderHexId, state)`

**Location:** Line 1318

**Purpose:** Calculate total effective armor including buffs.

**Current Logic:**
```javascript
let effectiveArmor = defenderUnit.currentArmor;
if (defenderUnit.isGuarding) effectiveArmor++;

// Legate adjacent buff
this.getNeighbors(...).forEach(neighbor => {
    const neighborUnit = this.getUnitOnHex(neighbor.id, state);
    if (neighborUnit?.playerId === defenderUnit.playerId && neighborUnit.value === 6) {
        effectiveArmor++;
    }
});
effectiveArmor -= defenderUnit.armorReduction;
defenderUnit.effectiveArmor = Math.max(0, effectiveArmor);
return defenderUnit.effectiveArmor;
```

#### 🟡 Issue Found

**Side-effect mutation:**
- Sets `defenderUnit.effectiveArmor` as a side effect (Line 1331)
- Could cause stale data if armor changes between calculations
- **Recommendation:** Return value only, don't mutate unit object

---

### `calcValidBraveChargeMoves(unitHexId, state)`

**Location:** Line 1341

**Purpose:** Calculate valid positions for Dice 1 (Fencer) Brave Charge.

**Current Logic:**
- Checks positions along primary axis up to `distance` steps
- For each position, checks if any adjacent hex has enemy with effective armor >= 6

#### 🟡 Issue Found

**Missing backward movement option:**
- `calcValidMoves` case `|` allows 1 step backward (Line 1203)
- `calcValidBraveChargeMoves` only checks forward primary axis
- **Inconsistency:** Fencer should be able to Brave Charge from backward position too

---

### `calcValidDeploymentHexes(playerId, state)`

**Location:** Line 1280

**Purpose:** Calculate valid hexes for unit deployment during setup.

**Status:** ✅ Logic appears correct

**Note:** Uses expanding rings based on `dicePerPlayer` count:
- <= 6: Base + adjacent only
- <= 9: Base + adjacent + 2 special offsets
- <= 14: Base + 2-ring expansion

---

## Issue Summary

| Severity | Function | Issue | Recommended Fix |
|----------|----------|-------|-----------------|
| 🔴 High | `applyDamage` | Single damage doesn't remove units at 0 armor | Remove `damage > 1` condition |
| 🔴 High | `handleCombat` | Armor comparison logic is ambiguous | Separate "armor depleted" from "attack beats armor" |
| 🟡 Medium | `calcValidRangedTargets` | Adjacent enemy check may be too restrictive | Verify rules, possibly check target adjacency only |
| 🟡 Medium | `calcValidBraveChargeMoves` | Missing backward movement option | Add backward axis check |
| 🟡 Medium | `calcDefenderEffectiveArmor` | Side-effect mutation | Return value only, no mutation |
| 🟢 Low | `handleCombat` | Visual trail only on failed attacks | Set trail for all combats |
| 🟢 Low | `calcValidMoves` | BFS enemy blocking logic tangled | Extract helper function |
| 🟢 Low | `calcValidDeploymentHexes` | Magic numbers for deployment patterns | Data-driven configuration |

---

## Recommendations

### Priority 1 (Critical Fixes)

1. **Fix `applyDamage` removal condition**
   ```javascript
   // Before
   if ((damage > 1) && unit.effectiveArmor <= 0) this.removeUnit(hexId, state);
   
   // After
   if (unit.effectiveArmor <= 0) this.removeUnit(hexId, state);
   ```

2. **Clarify combat win conditions**
   ```javascript
   // Separate armor depletion from attack comparison
   const isArmorDepleted = defenderUnit.armorReduction >= defenderUnit.armor;
   const attackWins = attackerUnit.attack >= defenderEffectiveArmor;
   
   if (isArmorDepleted || attackWins) { /* attacker wins */ }
   ```

### Priority 2 (Logic Improvements)

3. **Extract line-of-sight helper**
   ```javascript
   hasLineOfSight(fromHex, toHex, state) {
       // Extracted from calcValidRangedTargets
   }
   ```

4. **Fix Brave Charge backward movement**
   - Add backward axis check to match standard movement rules

5. **Remove side-effect from `calcDefenderEffectiveArmor`**
   - Delete `defenderUnit.effectiveArmor = ...` line
   - Update callers to use return value

### Priority 3 (Code Quality)

6. **Add combat type validation**
   - Ensure only valid attacker types can initiate each combat type

7. **Document deployment pattern magic numbers**
   - Add comments explaining the offset calculations

8. **Add JSDoc comments**
   - Document parameters, return values, and side effects for all CALCULATE and COMBAT functions
