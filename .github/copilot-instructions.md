# Copilot Instructions for HexDice

This file gives targeted, repository-specific guidance for GitHub Copilot sessions working on HexDice.

1) Build, test, and lint commands

- Run the dev server (local):
  - deno run --allow-net --allow-read server.ts
  - Recommended (from .vscode tasks): deno run --unstable-kv --allow-net --allow-read --allow-env server.ts
  - To print build/version hash: deno run --unstable-kv --allow-net --allow-read server.ts -- --version
  - Provide ARANGO and GOOGLE env vars when required (ARANGODB_URI, ARANGODB_DATABASE, ARANGODB_USER, ARANGODB_PASSWORD, GOOGLE_CLIENT_ID, PORT).

- Simulation & replay (Deno tasks in deno.json / SIMULATION.md):
  - Single simulation game: deno task simulate -g=1 -t=heuristic,random
  - Full simulate (example): deno task simulate -g=10 -t=random,heuristic
  - Replay interactive viewer: deno task replay <replay_file.json>
  - Replay stats only: deno task replay <replay_file.json> --stats
  - You can also run directly: deno run --allow-all simulate.ts -g=1

- NPM scripts (used as task runner for assets if package.json exists):
  - npm run manifest:gen
  - npm run sprites:gen
  - npm run simulate
  - Check package.json if present for exact scripts.

- Linting / formatting:
  - Use Deno tooling: deno fmt && deno lint (if configured)
  - No repo-specific linter config detected beyond Deno defaults.

- Tests:
  - No automated unit-test suite discovered. Use the simulation tooling for game-level testing. If unit tests are added, prefer `deno test`.


2) High-level architecture (big picture)

- Backend: Lightweight Deno server (server.ts)
  - Serves static frontend assets and exposes simple JSON APIs under /api/* for config, auth (Google ID token verification), and room CRUD and state persistence.
  - Persists user and room data to ArangoDB (configured via environment variables).
  - Produces an application version hash from static assets (used in index.html replacement).

- Frontend: Static site (index.html + game.js + service-worker.js)
  - game.js contains the core engine and Alpine.js reactive component (alpineHexDiceTacticGame).
  - Service worker uses assets-manifest.json for PWA offline caching.
  - Assets live under /assets (sprites, terrain, ro_maps, etc.).

- Core logic & AI:
  - Core engine: game.js (movement, combat, merge, spells, phases).
  - AI: /ai/*.js (ai-heuristic.js, heuristic-profiles.js etc.) and headless simulation tools (simulate.ts, replay.ts) used for benchmarking and balancing.

- Tools & pipelines:
  - generate-assets-manifest.js updates assets-manifest.json used by the service worker.
  - simulate.ts, replay.ts, tournament scripts for balance testing and replay analysis.
  - Optional npm task runner usage for asset-generation scripts (manifest/sprites).


3) Key repository conventions (non-obvious)

- Coding style & formatting: follow GEMINI.md conventions that are present in the repo:
  - Tabs for indentation
  - Semicolons always
  - One True Brace Style (1TBS)
  - camelCase for functions/vars; UPPER_SNAKE_CASE for constants; `_` prefix for internal helpers

- Change discipline:
  - Surgical changes only: small focused PRs; avoid sweeping refactors in the same PR.
  - When removing code, prefer `// DEPRECATED` comments before deleting to preserve history.
  - For larger features, draft a plan under `.chat/<feature>.md` before implementing (project policy).

- Global-scope awareness:
  - Frontend code is loaded via <script> tags; avoid leaking globals or name collisions. Prefer encapsulation where possible.

- Simulations as tests:
  - Simulation tooling (simulate.ts, tournament scripts) acts as the primary automated testbed for gameplay/balance. Use `-g=1` for a single run when debugging.

- Environment & secrets:
  - Do NOT commit secrets. Server credentials are read from env (ARANGO*, GOOGLE_CLIENT_ID). Use a local .env for development (excluded by .gitignore).


4) Files and places Copilot should inspect first for common tasks

- server.ts (backend APIs, env usage, ArangoDB init)
- game.js (core engine and UI logic)
- simulate.ts / replay.ts (simulation, replay formats, CLI options)
- assets/ and assets-manifest.json (PWA cache surface)
- /ai (AI evaluation and profiles)
- rules/, backlogs/, blog/ (design notes and historical decisions)
- deno.json (Deno tasks and config)
- GEMINI.md (project coding conventions)


5) Existing AI-assistant configs to respect

- GEMINI.md: authoritative codestyle and workflow guidance — follow it.
- No CLAUDE.md, .cursorrules, AGENTS.md, or other assistant-rule files were found.


Quick notes for Copilot sessions

- When asked to modify gameplay logic, prefer minimal, reversible changes and include a brief test via simulate.ts or a small replay sample.
- Avoid reorganizing many files in a single change — this repo values incremental, focused PRs.
- When adding new scripts or build steps, add Deno tasks in deno.json if they are runnable via `deno task`.


----

If this file already existed, the recommended improvements would be to capture the Deno task names and the GEMINI.md conventions (tabs/semicolons/1TBS), plus the simulate/replay commands shown here.

