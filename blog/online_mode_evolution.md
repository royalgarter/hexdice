# From Local Skirmish to Global Conquest: The Evolution of Online Mode

The journey of **Hex Dice** has always been about tactical depth and the thrill of the roll. But as any strategist knows, the ultimate challenge isn't a pre-programmed AI—it's the unpredictable brilliance of another human mind. Today, I'm pulling back the curtain on how we brought **Online Mode** to life, moving from a fragile prototype to a robust, production-ready engine.

## The Problem: Breaking the Isolation
Hex Dice started as a local-first experience. To bridge the gap to global play, we needed an architecture that was:
1.  **Frictionless:** No one wants to create yet another account.
2.  **Instant:** Moves must feel immediate, not like sending an email.
3.  **Robust:** Distributed systems are chaotic; we needed to handle latency and desync.

## 1. Identity without the Headache: Google One Tap (GSI)
We prioritized the user's time by choosing **Google One Tap (GSI)**.
*   **The "Why":** Traditional sign-up forms are where prototypes go to die. GSI allows a player to jump into a room with literally one tap.
*   **The Result:** verified identity without managing passwords. For developers, we even added a `localhost` bypass (using `?auth_user=`) to keep testing cycles lightning fast.

## 2. The Heartbeat: MQTT for Real-time Synchronization
*   **The Choice:** **MQTT over WebSockets**.
*   **The "Why":** Raw WebSockets are powerful, but MQTT provides a structured **Pub/Sub** model and features like **Last Will and Testament (LWT)** out of the box.
*   **The Implementation:** We used the **EMQX** public broker. Every click and roll is a lightweight packet broadcast. If a player closes their tab, the broker automatically notifies the opponent via LWT: *"⚠️ Opponent disconnected."*

## 3. The Ledger: ArangoDB & arangojs
*   **The Choice:** **ArangoDB** via the official `arangojs` library.
*   **The "Why":** It handles our users and rooms with ease, and its multi-model nature means we can eventually turn player match histories into a rich victory graph.

## 4. The Secret Sauce: Determinism and Seeded RNG
Desync is the enemy of strategy. If Player 1 rolls a 6 and Player 2 rolls a 1 locally, the game breaks.
*   **The Solution:** A **Seedable Linear Congruential Generator (LCG)**. 
*   **The Twist:** We discovered that asynchronous "cosmetic" loading (like unit skins) was consuming the seed at different times, causing divergence. We solved this by splitting our RNG: `random()` for deterministic tactical logic, and `cosmic_random()` (pure `Math.random`) for non-essential visuals.

## 5. Built for Stability: The Robustness Layer
Moving beyond the MVP, we added three layers of "unbreakable" logic:
*   **Sequence Tracking:** Every message has a unique ID. If packets arrive out of order or duplicates appear due to network blips, the engine simply filters them out.
*   **State Checksumming:** After every move, the engine generates a hash of all unit positions and health. If the hashes don't match across clients, it flags a desync immediately.
*   **The "Referee" Pattern:** Don't trust, verify. Every remote action is checked against local rules (`canPerformAction`) before execution to prevent cheating or logic errors.

## The Polished Experience: UI/UX
Finally, we wrapped it in a clear interface. 
*   **Turn Indicators:** Pulsing green for "Your Turn", plus a **60s Turn Timer** to keep the game moving.
*   **Identity:** Player indices are replaced by real names (e.g., `P1-Alice`).
*   **Lobby:** A simple, 6-character Room ID system that makes inviting a friend as easy as sending a text.

## Conclusion
Building the online mode for Hex Dice wasn't just about adding communication; it was about mastering the chaos of the network. By combining the speed of MQTT, the simplicity of GSI, and a multi-layered stability approach, we've created a battlefield that's not just fast, but fundamentally reliable.

**Ready to test your mettle? Create a room and challenge a friend.**
