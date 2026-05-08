# From Local Skirmish to Global Conquest: The Evolution of Online Mode

The journey of **Hex Dice** has always been about tactical depth and the thrill of the roll. But as any strategist knows, the ultimate challenge isn't a pre-programmed AI—it's the unpredictable brilliance of another human mind. Today, I'm pulling back the curtain on how we brought **Online Mode** to life.

## The Problem: Breaking the Isolation
Hex Dice started as a local-first experience. While the AI provided a solid challenge, the "magic" of board games lies in the shared experience. To bridge this gap, we needed an architecture that was:
1.  **Frictionless:** No one wants to create yet another account.
2.  **Instant:** Moves must feel immediate, not like sending an email.
3.  **Deterministic:** Both players must see the exact same board at all times.

## 1. Identity without the Headache: Google One Tap (GSI)
When choosing an authentication system, we prioritized the user's time. We chose **Google One Tap (GSI)**.
*   **The "Why":** Traditional sign-up forms are where prototypes go to die. GSI allows a player to jump into a room with literally one tap.
*   **The Result:** We get a verified identity (name, email, picture) without managing passwords, and the user gets to play in seconds.

## 2. The Heartbeat: MQTT for Real-time Synchronization
For the game loop, we needed more than just a REST API. We needed a conversation.
*   **The Choice:** **MQTT over WebSockets**.
*   **The "Why":** While raw WebSockets are powerful, MQTT provides a structured **Pub/Sub** model out of the box. Topics like `hexdice/rooms/{roomId}` allow us to isolate game traffic effortlessly. It’s lightweight, handles flaky mobile connections gracefully, and decouples our messaging from the core game logic.
*   **The Implementation:** We used the **EMQX** public broker to ensure high availability. Every click, every roll, and every turn-end is a lightweight packet broadcast to the opponent.

## 3. The Ledger: ArangoDB & arangojs
A game needs a memory. We needed to store user profiles, track active rooms, and eventually, save game histories.
*   **The Choice:** **ArangoDB** using the official `arangojs` library.
*   **The "Why":** ArangoDB is a **multi-model** database. While we currently use it for document storage (Users and Rooms), its graph capabilities are a "future-proof" bet. Imagine visualizing a player's history as a graph of victories and rivals. 
*   **The Logic:** Using the official library ensured we had robust connection pooling and a clean API for our Deno-based backend.

## 4. The Secret Sauce: Determinism and Seeded RNG
The hardest part of online strategy is "Desync". If Player 1 rolls a 6 and Player 2 rolls a 1 on their own machines, the game breaks.
*   **The Solution:** We moved away from `Math.random()` to a **Seedable Linear Congruential Generator (LCG)**. 
*   **The Process:** When a match starts, the Host generates a single `_seed` and broadcasts it. From that moment on, every "random" event—from terrain generation to critical hits—is calculated identically on both machines. We don't sync the *results*; we sync the *intent*.

## The Polished Experience: UI/UX
Finally, we wrapped it in a clear interface. 
*   **Turn Indicators:** Pulsing green for "Your Turn", static gray for "Waiting". 
*   **Identity:** Player indices (P1/P2) are now joined by real names (P1-Alice vs P2-Bob).
*   **Lobby:** A simple, 6-character Room ID system that makes inviting a friend as easy as sending a text.

## Conclusion
Building the online mode for Hex Dice wasn't just about adding code; it was about choosing a stack that stays out of the way of the fun. By combining the speed of MQTT, the simplicity of GSI, and the power of ArangoDB, we've created a battlefield that's ready for anyone, anywhere.

**Ready to test your mettle? Create a room and challenge a friend.**
