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
 *   --output, -o    Output directory for logs (default: simulations)
 *   --depth, -d     Minimax search depth (default: 3)
 *   --verbose, -v   Verbose output (default: false)
 */

import { parse } from "https://deno.land/std@0.208.0/flags/mod.ts";
import { ensureDir } from "https://deno.land/std@0.208.0/fs/ensure_dir.ts";

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
    string: ["games", "type", "output", "depth", "players", "version"],
    boolean: ["verbose", "help"],
    alias: {
        g: "games",
        t: "type",
        o: "output",
        d: "depth",
        v: "verbose",
        h: "help",
        pl: "players",
        ver: "version",
    },
    default: {
        games: 1,
        type: "heuristic,heuristic",
        output: "simulations",
        depth: 3,
        verbose: false,
        players: 2,
        version: 1,
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
  --help, -h           Show this help message

Examples:
  deno run --allow-all simulate.ts -g=10 -t=random,heuristic
  deno run --allow-all simulate.ts -pl=3 -t=random,heuristic,priority
  deno run --allow-all simulate.ts --games=5 --type=minimax,priority --verbose
  deno run --allow-all simulate.ts -g=1 -t=heuristic,heuristic -o=my_logs
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

// Stub browser APIs for headless execution
function stubBrowserAPIs(playerCount: number = 2, version: number = 1) {
	// Stub location
	const locationStub = {
		search: `?mode=headless&players=${playerCount}&version=${version}`,
		href: `https://hexdice.local/?mode=headless&players=${playerCount}&version=${version}`,
		toString: () => `https://hexdice.local/?mode=headless&players=${playerCount}&version=${version}`
	};
	
	// Stub document
	const documentStub = {
		getElementById: () => null,
	};
	
	// Stub $nextTick (Vue.js) - use synchronous execution for simulation
	(globalThis as any).$nextTick = (fn: any) => { 
		try { fn(); } catch(e) { /* ignore */ }
	};

	// Stub fetch for assets
	(globalThis as any).fetch = (url: string) => {
		if (url.includes('sets.json')) {
			return Promise.resolve({
				json: () => Promise.resolve([])
			});
		}
		return Promise.resolve({
			json: () => Promise.resolve({})
		});
	};

	return { location: locationStub, document: documentStub };
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
async function loadGameEngine(playerCount: number = 2, version: number = 1): Promise<any> {
    const { location: locationStub, document: documentStub } = stubBrowserAPIs(playerCount, version);

    let gameCode = await Deno.readTextFile("./game.js");
    const aiCoreCode = await Deno.readTextFile("./ai/ai.js");
    const aiHeuristicCode = await Deno.readTextFile("./ai/ai-heuristic.js");
    const aiHeuristicProfiles = await Deno.readTextFile("./ai/heuristic-profiles.js");
    const campaignManagerCode = await Deno.readTextFile("./campaign/campaign-manager.js");

    // Replace const random with var for override capability
    gameCode = gameCode.replace(
        'const random = () => {return Math.random();const a = new Uint32Array(1);crypto.getRandomValues(a);return a[0] / 4294967296/*2^32*/;}',
        'var random = () => Math.random()'
    );

    // Combine all code with seeded random
    const fullCode = `
        // Seeded random for reproducibility
        const seedValue = ${Date.now()};

        ${campaignManagerCode}
        ${gameCode}
        
        // Override random to be deterministic
        if (typeof setSeed === 'function') {
            setSeed(seedValue);
        }

        ${aiCoreCode}
        ${aiHeuristicProfiles}
        ${aiHeuristicCode}

        // Return exports object
        return {
            createGame: alpineHexDiceTacticGame,
            performAIByHeuristic: typeof performAIByHeuristic !== 'undefined' ? performAIByHeuristic : null,
            generateAllPossibleMoves: typeof generateAllPossibleMoves !== 'undefined' ? generateAllPossibleMoves : null,
            applyMove: typeof applyMove !== 'undefined' ? applyMove : null,
            boardEvaluation: typeof boardEvaluation !== 'undefined' ? boardEvaluation : function() { return 0; },
        };
    `;    
	// Evaluate and get exports using Function constructor
	const createModule = new Function('location', 'document', fullCode);
	
	return createModule(locationStub, documentStub);
}

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

// Main simulation runner
async function runSimulation() {
    const numGames = parseInt(args.games) || 1;
    const typeArg = (args.type as string) || "random,heuristic";
    const outputDir = (args.output as string) || "simulations";
    const minimaxDepth = parseInt(args.depth) || 3;
    const verbose = !!args.verbose;
    const playerCount = parseInt(args.players) || 2;
    
    // Parse AI types
    const types = typeArg.split(",").map((t: string) => t.trim().toLowerCase());
    const aiTypes: string[] = [];
    for (let i = 0; i < playerCount; i++) {
        const t = types[i] || types[types.length - 1] || "random";
        aiTypes.push(AI_TYPES[t] ? t : "random");
    }
    
    console.log("╔════════════════════════════════════════╗");
    console.log("║     Hex Dice CLI Simulation            ║");
    console.log("╚════════════════════════════════════════╝");
    console.log(`Games: ${numGames} | Players: ${playerCount} | AI: ${aiTypes.join(", ")}`);
    console.log("");
    
    // Load game engine
    console.log("Loading game engine...");
    const engine = await loadGameEngine(playerCount, parseInt(args.version));
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
            const gameResult = await runGame(i, aiTypes, minimaxDepth, verbose, engine);
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
}

// Run simulation
runSimulation().catch((error) => {
    console.error("Simulation failed:", error);
    Deno.exit(1);
});
