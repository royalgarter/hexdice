# Hex Dice Gameplay Balance v1.5 (The "Specialty Stat" Update)

This update overhauls the unit stats to move from a linear power hierarchy to a role-based system. The stats are designed to be intuitive and tied to the unit's dice value.

## Core Change: Specialty Stats

Every unit is built on a base profile (Atk 3 / Def 2 / Mov 2) and specializes based on its dice value.

| Dice | Unit | Atk | Armor | Move | Range | Memory Rule |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **#1** | **Infantry** | 3 | **3** | 2 | 0 | **Balanced:** High armor for a low roll. |
| **#2** | **Archer** | **2** | **2** | **2** | **2** | **The Quad-2:** All stats are 2. |
| **#3** | **Knight** | 3 | 2 | **3** | 0 | **3 is for 3 Steps:** High mobility + Jump. |
| **#4** | **Assault** | **4** | 2 | 2 | 0 | **4 is for 4 Attack:** The heavy hitter. |
| **#5** | **Tanker** | 2 | **5** | 1 | 0 | **5 is for 5 Defense:** Slow blocker. |
| **#6** | **Balance** | 2 | **6** | 0 | 1 | **6 is for 6 Defense:** Immovable Glacier. |

---

## Unit Roles & Tactical Meta

### 1. The Reliable Core (#1 Infantry)
*   **Role:** Frontline Blocker.
*   **Niche:** With 3 Armor, it survives hits from Archers (#2), Knights (#3), and Tankers (#5). It prevents the opponent from sniping your backline.

### 2. The Sniper (#2 Archer)
*   **Role:** Skirmisher.
*   **Niche:** The "Quad-2" makes it easy to remember. Its Range 2 lets it pick off Glass Cannons (#3 and #4) from safety. It is weak to Infantry (#1).

### 3. The Diver (#3 Knight)
*   **Role:** Flanker / Harasser.
*   **Niche:** 3 Movement and the ability to jump over units makes it the ultimate threat to unprotected Archers or wounded units.

### 4. The Tank-Cracker (#4 Assault)
*   **Role:** Shock Troop.
*   **Niche:** 4 Attack is the magic number. It's the only unit that can one-shot an Infantry (#1) and it makes sieging Tankers (#5/6) much faster.

### 5. The Anchor (#5 Tanker)
*   **Role:** Chokepoint Defender.
*   **Niche:** 5 Armor is extremely difficult to break. It forces the opponent to commit multiple units or multiple turns to clear a path.

### 6. The Glacier (#6 Balance)
*   **Role:** Fortress / Support.
*   **Niche:** 6 Armor makes it a permanent landmark. It cannot move normally, but it provides a **+1 Armor Aura** to adjacent allies and can "crawl" forward if it wins a combat at Range 1.

---

## Combat Dynamics
*   **OSK (One-Shot Kill):** Only happens when Attack ≥ Armor.
*   **Armor Erosion:** When Attack < Armor, both units suffer -1 Armor reduction. This makes high-armor units (#5, #6) eventual targets of attrition.
*   **Strategic Rerolls:** Players no longer just "reroll for high numbers." They reroll to get the specific role their army needs (e.g., "I need an Assault to break that Tanker").
