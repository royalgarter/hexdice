#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-net

/**
 * Hex Dice CLI Simulation
 * 
 * Usage:
 *   deno run --allow-all simulate.ts --games=10 --type=random,heuristic --output=logs
 *   deno run --allow-all simulate.ts -g=5 -t=minimax,priority -o=simulations -v
 * 
 * Options:
 *   --games, -g     Number of games to simulate (default: 1)
 *   --type, -t      AI types for P1,P2 (default: random,heuristic)
 *                   In autochess mode: heuristic profile names per player (baseline, berserker, ...)
 *   --output, -o    Output directory for logs (default: simulations)
 *   --depth, -d     Minimax search depth (default: 3)
 *   --verbose, -v   Verbose output (default: false)
 *   --autochess     Run games in Autochess (RotDK) mode
 *   --rounds, -r    Autochess rounds per game (default: AUTOCHESS_CONFIG.MAX_ROUND)
 */

import { parse } from "https://deno.land/std@0.208.0/flags/mod.ts";
import { ensureDir } from "https://deno.land/std@0.208.0/fs/ensure_dir.ts";
import { loadGameEngine } from "./engine-headless.ts";

// AI type mapping
const AI_TYPES: Record<string, string> = {
    random: "heuristic",
    heuristic: "heuristic",
    minimax: "heuristic",
    priority: "heuristic",
    greedy: "heuristic",
};

// CLI Arguments
const args = parse(Deno.args, {
    string: ["games", "type", "output", "depth", "players", "version", "rounds"],
    boolean: ["verbose", "help", "autochess"],
    alias: {
        g: "games",
        t: "type",
        o: "output",
        d: "depth",
        v: "verbose",
        h: "help",
        pl: "players",
        ver: "version",
        a: "autochess",
        r: "rounds",
    },
    default: {
        games: 1,
        type: "heuristic,heuristic",
        output: "simulations",
        depth: 3,
        verbose: false,
        players: 2,
        version: 1,
        autochess: false,
    },
});

if (args.help) {
    console.log(`
Hex Dice CLI Simulation

Usage:
  deno run --allow-all simulate.ts [options]

Options:
  --games, -g <n>      Number of games to simulate (default: 1)
  --type, -t <p1,p2,p3..> AI types for each player (default: random,heuristic)
                       Available: random, heuristic, minimax, priority
  --players, -pl <n>   Number of players (default: 2, supports 2,3,4,6)
  --output, -o <dir>   Output directory for logs (default: simulations)
  --depth, -d <n>      Minimax search depth (default: 3)
  --verbose, -v        Show detailed move-by-move output
  --autochess, -a      Run games in Autochess (RotDK) mode
  --rounds, -r <n>     Autochess rounds per game (default: AUTOCHESS_CONFIG.MAX_ROUND)
  --help, -h           Show this help message

Examples:
  deno run --allow-all simulate.ts -g=10 -t=random,heuristic
  deno run --allow-all simulate.ts -pl=3 -t=random,heuristic,priority
  deno run --allow-all simulate.ts --games=5 --type=minimax,priority --verbose
  deno run --allow-all simulate.ts -g=1 -t=heuristic,heuristic -o=my_logs
  deno run --allow-all simulate.ts --autochess -g=3 -t=baseline,berserker
  deno run --allow-all simulate.ts -a -g=1 -r=5 -v
`);
    Deno.exit(0);
}

// Game logger that captures all messages
class SimulationLogger {
    private logs: GameLogEntry[] = [];
    private verbose: boolean;

    constructor(verbose: boolean = false) {
        this.verbose = verbose;
    }

    log(message: string, type: LogType = "game", fromHex?: number, toHex?: number, unitValue?: number) {
        const entry: GameLogEntry = {
            timestamp: Date.now(),
            type,
            message,
            fromHex,
            toHex,
            unitValue,
        };
        this.logs.push(entry);
        
        if (this.verbose || type === "game" || type === "result" || type === "ai") {
            const prefix = type === "ai" ? "[AI]" : type === "combat" ? "[⚔️]" : type === "result" ? "[🏆]" : "";
            console.log(`${prefix} ${message}`);
        }
    }

    getLogs(): GameLogEntry[] {
        return this.logs;
    }

    clear() {
        this.logs = [];
    }
}

type LogType = "game" | "ai" | "combat" | "result" | "error" | "move";

interface GameLogEntry {
    timestamp: number;
    type: LogType;
    message: string;
    fromHex?: number;
    toHex?: number;
    unitValue?: number;
}

interface ReplayData {
    metadata: {
        date: string;
        games: number;
        aiTypes: string[];
        minimaxDepth: number;
        version: string;
        playerCount: number;
    };
    games: GameReplay[];
    summary: {
        wins: number[]; // Index maps to player seat
        draws: number;
        totalTurns: number;
        avgTurnsPerGame: number;
    };
}

interface GameReplay {
    gameNumber: number;
    winner: number | -1;
    winnerReason: string;
    totalTurns: number;
    moves: MoveRecord[];
}

interface MoveRecord {
    turn: number;
    player: number;
    aiType: string;
    actionType: string;
    logMessage: string;
    stateHash: string;
    fromHex?: number;
    toHex?: number;
    unitValue?: number;
}

// Create a game instance with logging
function createSimulationGame(logger: SimulationLogger, aiType: string, engine: any) {
    const game = engine.createGame();
    
    // Add $nextTick to game instance (Vue.js compatibility)
    (game as any).$nextTick = (fn: any) => { 
        try { fn(); } catch(e) { /* ignore */ }
    };
    
    return game;
}

// Load all game and AI code
// Calculate state hash for replay
function calculateStateHash(game: any): string {
    const playersDice = game.players.map((p: any, i: number) =>
        `p${i}Dice:` + p.dice.map((d: any) => {
            const hasMoved = d.hasMovedOrAttackedThisTurn ? 1 : 0;
            const isGuarding = d.isGuarding > 0 ? 1 : 0;
            const skirmish = d.skirmishBuff || 0;
            return `${d.value}-${d.hexId}-${d.isDeath}-${hasMoved}-${isGuarding}-${skirmish}`;
        }).join("|")
    ).join(";");

    const state = {
        playersDice,
        currentPlayerIndex: game.currentPlayerIndex,
        phase: game.phase,
        turnCount: game.turnCount,
        noReroll: game.rules?.noReroll,
        options: game.options || '',
    };
    return btoa(JSON.stringify(state));
}
// Run a single game simulation
async function runGame(
    gameNumber: number,
    aiTypes: string[],
    minimaxDepth: number,
    verbose: boolean,
    engine: any
): Promise<GameReplay> {
    const logger = new SimulationLogger(verbose);

    // Create fresh game instance with stubs
    const game = engine.createGame();
    game.playerCount = aiTypes.length;

    // Add $nextTick to game instance (Vue.js compatibility)
    (game as any).$nextTick = (fn: any) => { 
        try { fn(); } catch(e) { /* ignore */ }
    };

    // Store AI types for use in performAITurn
    (game as any).aiTypes = aiTypes;
    
    // Override AI turn to use specified AI type per player
    const aiFunctions = {
        random: engine.performAIByHeuristic,
        heuristic: engine.performAIByHeuristic,
        minimax: engine.performAIByHeuristic,
        priority: engine.performAIByHeuristic,
    };

    // Store original endTurn to call after override
    const originalEndTurn = game.endTurn.bind(game);
    
    // Override endTurn to disable setTimeout for AI (we handle it in the game loop)
    game.endTurn = function(state?: any) {
        // Temporarily disable isAI to prevent setTimeout in endTurn
        const originalAIStates = this.players.map((p: any) => p.isAI);
        this.players.forEach((p: any) => p.isAI = false);
        
        originalEndTurn(state);
        
        // Restore AI flags
        this.players.forEach((p: any, idx: number) => p.isAI = originalAIStates[idx]);
    };

    game.performAITurn = function() {
        const currentPlayerIdx = this.currentPlayerIndex;
        const aiType = aiTypes[currentPlayerIdx];
        const aiFunc = aiFunctions[aiType as keyof typeof aiFunctions] || engine.performAIByHeuristic;

        logger.log(`P${currentPlayerIdx + 1} (${aiType}) thinking...`, "ai");

        try {
            if (aiFunc) {
                aiFunc(this);
            } else {
                logger.log(`AI function for ${aiType} not found!`, "error");
                this.endTurn();
            }
        } catch (e) {
            logger.log(`AI error: ${e}`, "error");
            this.endTurn();
        }
    };

    // Handle setup phase automatically
    game.handleSetupPhase = function() {
        if (this.phase === "SETUP_ROLL") {
            for (let i = 0; i < this.playerCount; i++) {
                if (!this.players[i].initialRollDone) {
                    logger.log(`P${i + 1} rolling initial dice`, "game");
                    this.rollInitialDice(i);
                }
            }
        }
        
        if (this.phase === "SETUP_REROLL") {
            for (let i = 0; i < this.playerCount; i++) {
                if (this.players[i].rerollsUsed === 0) {
                    logger.log(`P${i + 1} skipping reroll`, "game");
                    this.currentPlayerIndex = i;
                    this.skipReroll();
                }
            }
        }
        
        if (this.phase === "SETUP_DEPLOY") {
            for (let playerIdx = 0; playerIdx < this.playerCount; playerIdx++) {
                const player = this.players[playerIdx];
                this.currentPlayerIndex = playerIdx;
                
                while (player.dice.some((d: any) => !d.isDeployed)) {
                    const validHexes = this.calcValidDeploymentHexes(playerIdx);
                    const undeployedDice = player.dice.filter((d: any) => !d.isDeployed);
                    
                    if (undeployedDice.length > 0 && validHexes.length > 0) {
                        const die = undeployedDice[0];
                        const dieIndex = player.dice.indexOf(die);
                        this.selectDieToDeploy(dieIndex);
                        const randomHex = validHexes[Math.floor(Math.random() * validHexes.length)];
                        logger.log(`P${playerIdx + 1} deploying D${die.value} to hex ${randomHex}`, "move");
                        this.deployUnit(randomHex);
                    } else {
                        break;
                    }
                }
            }
            this.startGamePlay();
        }
    };

    // Hook into game.addLog to capture internal logs in our logger
    const originalAddLog = game.addLog.bind(game);
    game.addLog = function(msg: string, state: any) {
        let type: LogType = "game";
        let fromHex: number | undefined;
        let toHex: number | undefined;
        let unitValue: number | undefined;

        if (msg.includes("moved")) {
            type = "move";
            const match = msg.match(/D(\d+).*?\[(\d+)\]->\[(\d+)\]/);
            if (match) {
                unitValue = parseInt(match[1]);
                fromHex = parseInt(match[2]);
                toHex = parseInt(match[3]);
            }
        } else if (msg.includes("deployed")) {
            type = "move";
            const match = msg.match(/deployed #(\d+) to \[(\d+)\]/);
            if (match) {
                unitValue = parseInt(match[1]);
                toHex = parseInt(match[2]);
            }
        } else if (msg.includes("attacked")) {
            type = "combat";
            const match = msg.match(/D(\d+).*?\[(\d+)\]->\[(\d+)\]/); // Melee
            if (match) {
                unitValue = parseInt(match[1]);
                fromHex = parseInt(match[2]);
                toHex = parseInt(match[3]);
            } else {
                const rangedMatch = msg.match(/D(\d+).*?\[(\d+)\]/); // Ranged
                if (rangedMatch) {
                    unitValue = parseInt(rangedMatch[1]);
                    fromHex = parseInt(rangedMatch[2]);
                }
            }
        } else if (msg.includes("sacrificed") || msg.includes("eliminated") || msg.includes("removed")) {
            type = "combat";
        } else if (msg.includes("rerolled")) {
            type = "move";
            const match = msg.match(/D(\d+).*?\[(\d+)\]/);
            if (match) {
                unitValue = parseInt(match[1]);
                fromHex = parseInt(match[2]);
            }
        } else if (msg.includes("guarded")) {
            type = "move";
            const match = msg.match(/D(\d+).*?\[(\d+)\]/);
            if (match) {
                unitValue = parseInt(match[1]);
                fromHex = parseInt(match[2]);
            }
        } else if (msg.includes("merged")) {
            type = "move";
            const match = msg.match(/D(\d+).*?\[(\d+)\]->\[(\d+)\]/);
            if (match) {
                unitValue = parseInt(match[1]);
                fromHex = parseInt(match[2]);
                toHex = parseInt(match[3]);
            }
        } else if (msg.includes("cast")) {
            type = "move";
        }

        logger.log(msg, type, fromHex, toHex, unitValue);
        originalAddLog(msg, state);
    };

    // Initialize game and run setup
    await game.init();
    game.gameplayVersion = parseInt(args.version);
    game.handleSetupPhase();
    
    // NOW set up AI players
    game.players.forEach((p: any) => p.isAI = true);
    
    game.cloneState = function() {
        return {
            players: this.players.map((p: any) => ({
                id: p.id, color: p.color, dice: p.dice.map((d: any) => ({ ...d })),
                initialRollDone: p.initialRollDone, baseHexId: p.baseHexId, rerollsUsed: p.rerollsUsed, isAI: p.isAI,
            })),
            hexes: this.hexes.map((h: any) => ({ ...h })),
            hexesQR: this.hexesQR, phase: this.phase, currentPlayerIndex: this.currentPlayerIndex,
            selectedUnitHexId: this.selectedUnitHexId, actionMode: this.actionMode,
            validMoves: this.validMoves, validTargets: this.validTargets, validMerges: this.validMerges,
            trail: { ...this.trail }, rules: { ...this.rules }, hexGrid: { ...this.hexGrid },
        };
    };
    
    const moves: MoveRecord[] = [];
    let turnCount = 0;
    const maxTurns = 500;
    
    // Run game loop
    while (game.phase !== "GAME_OVER" && turnCount < maxTurns) {
        const actingPlayerIndex = game.currentPlayerIndex;
        const currentPlayer = game.players[actingPlayerIndex];
        const currentAIType = aiTypes[actingPlayerIndex];
        const stateBeforeHash = calculateStateHash(game);

        // Get last log count to detect new logs
        const lastLogCount = logger.getLogs().length;

        // Execute turn
        if (game.phase === "PLAYER_TURN") {
            if (currentPlayer.isAI) {
                game.performAITurn();
            } else {
                // Human player - just end turn for simulation
                logger.log(`P${actingPlayerIndex + 1} (human) - auto ending turn`, "game");
                game.endTurn();
            }
        } else {
            // Unknown phase - end turn to progress
            game.endTurn();
        }

        // Record move if any action happened
        const newLogs = logger.getLogs().slice(lastLogCount);
        const actionLog = newLogs.find(l => l.type === "combat") || 
                          newLogs.find(l => l.type === "move") || 
                          newLogs.find(l => l.type === "ai");

        moves.push({
            turn: turnCount,
            player: actingPlayerIndex,
            aiType: currentAIType,
            actionType: actionLog?.type || "unknown",
            logMessage: newLogs.map(l => l.message).join("; "),
            stateHash: stateBeforeHash,
            fromHex: actionLog?.fromHex,
            toHex: actionLog?.toHex,
            unitValue: actionLog?.unitValue,
        });

        turnCount++;
    }
    
    // Determine winner
    let winner: number | -1 = -1;
    let winnerReason = "Max turns reached";

    if (game.phase === "GAME_OVER") {
        // Match "P1", "P2", etc. from winner message
        const winnerMatch = game.winnerMessage.match(/P(\d+)\s*\(.*?\)\s*wins!/);
        if (winnerMatch) {
            winner = parseInt(winnerMatch[1]) - 1; // Convert P1->0, P2->1, etc.
            winnerReason = game.winnerMessage;
        } else if (game.winnerMessage.toLowerCase().includes("draw") || game.winnerMessage.includes("Mutual")) {
            winner = -1;
            winnerReason = game.winnerMessage;
        }
    }
    
    logger.log(`Game ${gameNumber} ended: ${winnerReason}`, "result");
    
    return {
        gameNumber,
        winner,
        winnerReason,
        totalTurns: turnCount,
        moves,
    };
}

// Run a single Autochess game (round-based auto-battler, all players AI-driven)
async function runAutochessGame(
    gameNumber: number,
    profileNames: string[],
    rounds: number,
    verbose: boolean,
    engine: any
): Promise<GameReplay> {
    const logger = new SimulationLogger(verbose);

    const game = engine.createGame();
    game.playerCount = profileNames.length;
    (game as any).$nextTick = (fn: any) => { try { fn(); } catch(e) { /* ignore */ } };

    // Capture engine logs
    const originalAddLog = game.addLog.bind(game);
    game.addLog = function(msg: string, ...rest: any[]) {
        if (typeof msg === 'string') logger.log(msg, msg.includes('💀') || msg.includes('⚔️') ? 'combat' : 'game');
        try { originalAddLog(msg, ...rest); } catch(e) { /* ignore */ }
    };

    // location stub contains autochess=true → game.init() calls initAutochess()
    await game.init();

    const AC = game.Autochess;
    const cfg = engine.AUTOCHESS_CONFIG || { ROUND_TIME_LIMIT: 60, WIN_REROLLS: 2, LOSS_REROLLS: 1, MAX_ROUND: 10 };
    const knownProfiles = Object.keys(engine.heuristicProfiles || {});

    game.players.forEach((p: any, idx: number) => {
        p.isAI = true;
        p.wins = p.wins || 0;
        // Only set a fixed team profile if a real profile name was given;
        // otherwise Autochess falls back to per-class profiles (baseline/ranger/assassin/...)
        if (knownProfiles.includes(profileNames[idx])) p.profileName = profileNames[idx];
    });

    const moves: MoveRecord[] = [];
    const maxTicks = (cfg.ROUND_TIME_LIMIT || 60) * 10;

    // Synchronous combat resolution — replaces Autochess.runSimulation's
    // setInterval/DOM-renderer loop, which is real-time and browser-bound.
    const runCombatRound = (): number => {
        AC.state.phase = 'COMBAT';
        AC.state.roundTimer = 0;
        AC.prepareCombat(game);

        let winner: any = null;
        let resolvedByHP = true;
        for (let t = 0; t < maxTicks; t++) {
            AC.simulateStep(game);
            const alive = game.players.filter((p: any) => p.dice.some((u: any) => u.hexId && u.isDeployed && !u.isDeath));
            if (alive.length <= 1) {
                winner = alive[0] || null;
                resolvedByHP = false;
                break;
            }
        }

        if (resolvedByHP) {
            // Timeout: resolve by total remaining HP (mirrors Autochess.resolveTimeout)
            const hps = game.players.map((p: any) =>
                p.dice.filter((u: any) => u.hexId && u.isDeployed && !u.isDeath).reduce((s: number, u: any) => s + u.hp, 0));
            const maxHP = Math.max(...hps);
            const leaders = hps.map((h: number, i: number) => i).filter((i: number) => hps[i] === maxHP);
            winner = (maxHP > 0 && leaders.length === 1) ? game.players[leaders[0]] : null;
            logger.log(`TIME UP! Resolving by total HP: [${hps.join(', ')}]`, 'game');
        }

        game.players.forEach((p: any) => {
            const isWinner = winner && p.id === winner.id;
            AC.state.rerolls[p.id] = isWinner ? cfg.WIN_REROLLS : cfg.LOSS_REROLLS;
            if (isWinner) p.wins++;
        });
        AC.state.lastWinnerId = winner ? winner.id : null;
        AC.state.phase = 'RECAP';
        return winner ? game.players.indexOf(winner) : -1;
    };

    // Auto-play the preparation phase for every player: recruit, merge duplicates, redeploy.
    const autoPreparation = () => {
        game.players.forEach((p: any, idx: number) => {
            while ((AC.state.inventories[p.id] || []).length > 0) {
                AC.recruitUnit(game, idx, 0);
            }
            let merged = true;
            while (merged) {
                merged = false;
                for (const u of p.dice) {
                    if ((u.veteranLevel || 0) >= 3) continue;
                    const partner = p.dice.find((o: any) => o !== u && o.value === u.value && (o.veteranLevel || 0) === (u.veteranLevel || 0));
                    if (partner) {
                        AC.mergeUnits(game, idx, u.id, partner.id);
                        // Pick a random perk for the newly unlocked tier
                        const tier = `tier${u.veteranLevel}`;
                        if (u.perks && !u.perks[tier]) u.perks[tier] = engine.random() < 0.5 ? 'A' : 'B';
                        merged = true;
                        break;
                    }
                }
            }
            AC.deployPlayerUnits(game, idx);
        });
    };

    const totalRounds = Math.min(rounds, cfg.MAX_ROUND || rounds);
    for (let r = 1; r <= totalRounds; r++) {
        const winnerIdx = runCombatRound();
        const scores = game.players.map((p: any, i: number) => `P${i + 1}:${p.wins}`).join(' ');
        logger.log(`Round ${r}/${totalRounds}: ${winnerIdx >= 0 ? `P${winnerIdx + 1} (${profileNames[winnerIdx]}) wins` : 'Draw'} | Score: ${scores}`, 'result');

        moves.push({
            turn: r,
            player: winnerIdx,
            aiType: winnerIdx >= 0 ? profileNames[winnerIdx] : 'draw',
            actionType: 'AUTOCHESS_ROUND',
            logMessage: `Round ${r}: ${winnerIdx >= 0 ? `P${winnerIdx + 1} wins` : 'Draw'} (${scores})`,
            stateHash: calculateStateHash(game),
        });

        if (r < totalRounds) {
            AC.nextRound(game); // round++, roulette terrain, recruits, redeploy, phase=PREPARATION
            autoPreparation();
        }
    }

    // Final winner: most round wins (tie → draw)
    const winCounts = game.players.map((p: any) => p.wins || 0);
    const best = Math.max(...winCounts);
    const leaders = winCounts.map((_: number, i: number) => i).filter((i: number) => winCounts[i] === best);
    const winner = leaders.length === 1 ? leaders[0] : -1;
    const winnerReason = winner >= 0
        ? `P${winner + 1} (${profileNames[winner]}) wins the autochess tournament ${winCounts.join('-')}!`
        : `Draw (${winCounts.join('-')})`;

    logger.log(`Game ${gameNumber} ended: ${winnerReason}`, 'result');

    return {
        gameNumber,
        winner,
        winnerReason,
        totalTurns: totalRounds,
        moves,
    };
}

// Main simulation runner
async function runSimulation() {
    const numGames = parseInt(args.games) || 1;
    const typeArg = (args.type as string) || "random,heuristic";
    const outputDir = (args.output as string) || "simulations";
    const minimaxDepth = parseInt(args.depth) || 3;
    const verbose = !!args.verbose;
    const playerCount = parseInt(args.players) || 2;
    const autochess = !!args.autochess;

    // Load game engine
    console.log("Loading game engine...");
    const engine = await loadGameEngine(playerCount, parseInt(args.version), autochess);

    // Parse AI types (autochess mode: heuristic profile names per player)
    const types = typeArg.split(",").map((t: string) => t.trim().toLowerCase());
    const aiTypes: string[] = [];
    const knownProfiles = Object.keys(engine.heuristicProfiles || {});
    for (let i = 0; i < playerCount; i++) {
        const t = types[i] || types[types.length - 1] || "random";
        if (autochess) {
            aiTypes.push(knownProfiles.includes(t) ? t : "per-class");
        } else {
            aiTypes.push(AI_TYPES[t] ? t : "random");
        }
    }

    const rounds = parseInt(args.rounds) || engine.AUTOCHESS_CONFIG?.MAX_ROUND || 10;

    console.log("╔════════════════════════════════════════╗");
    console.log(autochess
        ? "║   Hex Dice CLI Simulation (Autochess)  ║"
        : "║     Hex Dice CLI Simulation            ║");
    console.log("╚════════════════════════════════════════╝");
    console.log(`Games: ${numGames} | Players: ${playerCount} | AI: ${aiTypes.join(", ")}${autochess ? ` | Rounds: ${rounds}` : ''}`);
    console.log("");
    console.log("Engine loaded.");
    console.log("");
    
    // Ensure output directory exists
    await ensureDir(outputDir);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const replayData: ReplayData = {
        metadata: {
            date: timestamp,
            games: numGames,
            aiTypes,
            minimaxDepth,
            version: "1.0",
            playerCount
        },
        games: [],
        summary: {
            wins: new Array(playerCount).fill(0),
            draws: 0,
            totalTurns: 0,
            avgTurnsPerGame: 0,
        },
    };
    
    // Run games
    for (let i = 1; i <= numGames; i++) {
        console.log(`\n━━━ Game ${i}/${numGames} ━━━`);

        try {
            const gameResult = autochess
                ? await runAutochessGame(i, aiTypes, rounds, verbose, engine)
                : await runGame(i, aiTypes, minimaxDepth, verbose, engine);
            replayData.games.push(gameResult);            
            // Update summary
            if (gameResult.winner >= 0 && gameResult.winner < playerCount) {
                replayData.summary.wins[gameResult.winner]++;
            } else {
                replayData.summary.draws++;
            }
            
            replayData.summary.totalTurns += gameResult.totalTurns;
        } catch (error) {
            console.error(`Game ${i} failed:`, error);
            replayData.games.push({
                gameNumber: i,
                winner: -1,
                winnerReason: `Error: ${error}`,
                totalTurns: 0,
                moves: [],
            });
        }
    }
    
    // Calculate averages
    replayData.summary.avgTurnsPerGame = replayData.summary.totalTurns / numGames;
    
    // Print summary
    console.log("\n");
    console.log("╔════════════════════════════════════════╗");
    console.log("║           Simulation Summary           ║");
    console.log("╚════════════════════════════════════════╝");
    for (let i = 0; i < playerCount; i++) {
        console.log(`P${i + 1} (${aiTypes[i]}): ${replayData.summary.wins[i]} wins`);
    }
    console.log(`Draws: ${replayData.summary.draws}`);
    console.log(`Avg turns/game: ${replayData.summary.avgTurnsPerGame.toFixed(1)}`);
    
    // Save replay data
    const replayFile = `${outputDir}/replay_${timestamp}.json`;
    await Deno.writeTextFile(replayFile, JSON.stringify(replayData, null, 2));
    console.log(`\n📄 Replay saved to: ${replayFile}`);
    
    // Save detailed log
    const logFile = `${outputDir}/log_${timestamp}.txt`;
    const logContent = replayData.games.map((g) => 
        `Game ${g.gameNumber}: ${g.winnerReason}`
    ).join("\n");
    await Deno.writeTextFile(logFile, logContent);
    console.log(`📝 Log saved to: ${logFile}`);

    // Exit explicitly — engine code schedules browser-style timers (audio, hit effects)
    // that would otherwise keep the Deno event loop alive.
    Deno.exit(0);
}

// Run simulation
runSimulation().catch((error) => {
    console.error("Simulation failed:", error);
    Deno.exit(1);
});
