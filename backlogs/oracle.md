# Unit 6 Revamp: The ORACLE

## **Finalized Profile (v1.5)**

| Dice | Unit | Armor | Attack | Range | Distance | Movement | Notes |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| 6 | **ORACLE** | 1 | 0 | 2 | 1 | * | Spells: Shield, Swap, Mend |

---

## **The "0-1-1-2-3" Mnemonic**
Designed for maximum memorability:
*   **0** - Attack
*   **1** - Armor
*   **1** - Distance (Movement)
*   **2** - Range (For Spells)
*   **3** - Spells in the Kit

---

## **The 3-Spell Kit (Action: Spellcast)**
When activated, the Oracle can perform one of these spells on a **target friendly unit** within **Range 2** (requires Line of Sight):

1.  **Shield**: Target unit immediately enters **Guard Mode** (+1 Effective Armor).
    *   *Tactical Use*: Save a front-line unit's activation by giving them Guard remotely.
2.  **Swap**: The Oracle and the target unit **exchange positions** on the board.
    *   *Tactical Use*: Pull a wounded unit out of danger or "warp" a slow Tanker (5) into the front lines. This is the Oracle's primary survival tool when engaged.
3.  **Mend**: Remove **1 Armor Reduction** from the target unit.
    *   *Tactical Use*: Sustain a high-armor unit (like the Knight or Tanker) against chip damage.

---

## **Design Rationale & Balance**

### **1. Fragility vs. Utility**
The Oracle is a "Glass Support." With **0 Attack**, it cannot defeat units or capture bases alone. With **1 Armor**, it is extremely vulnerable (can only survive one "failed" combat before being depleted). It relies entirely on its friendly units for protection and its **Swap** spell for escape.

### **2. Action Economy**
Because Hex Dice uses **Alternating Activations**, using the Oracle is a high-reward, high-risk choice. Activating the Oracle to Shield or Mend a unit means you are *not* moving a Fencer to attack or positioning a Hussar.

### **3. Engaged Casting**
The Oracle **can cast spells while an enemy is adjacent**. If it couldn't, a single enemy unit could "shut down" the Oracle just by standing next to it. Being able to **Swap** while engaged is its only way to survive a flank.

### **4. Line of Sight (LoS)**
Like the Archer (2), the Oracle requires a clear path to its target. This prevents players from hiding the Oracle behind terrain or deep within a dense cluster of units where it can't be reached.

---

## **Implementation Notes**
*   **Targeting**: Spells only target **friendly** units.
*   **Movement**: BFS 1-step (Standard `*` pattern).
*   **Replacement**: This unit replaces the **Legate** (v1.4) to introduce more dynamic, player-driven tactics over passive aura buffs.
