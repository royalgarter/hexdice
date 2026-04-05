#!/usr/bin/env -S deno run --allow-all

import { parse } from "https://deno.land/std@0.208.0/flags/mod.ts";
import { ensureDir } from "https://deno.land/std@0.208.0/fs/ensure_dir.ts";

// Results tracking interfaces
interface MatchupResult {
    profile1: string;
    profile2: string;
    p1Wins: number;
    p2Wins: number;
    draws: number;
    totalGames: number;
    p1WinRate: number;
    p2WinRate: number;
    avgTurns: number;
}

interface ProfileStats {
    name: string;
    totalWins: number;
    totalLosses: number;
    totalDraws: number;
    totalGames: number;
    winRate: number;
    avgTurnsInGames: number;
    winsAsP1: number;
    winsAsP2: number;
}

interface TournamentResults {
    metadata: {
        date: string;
        gamesPerMatchup: number;
        profiles: any[];
        version: string;
    };
    matchups: MatchupResult[];
    standings: ProfileStats[];
    summary: {
        totalGames: number;
        totalTurns: number;
        avgTurnsPerGame: number;
    };
}

// Global state for progress tracking (only used in main process)
let totalGamesScheduled = 0;
let totalGamesCompleted = 0;

function updateGlobalProgress(quiet: boolean, verbose: boolean) {
    if (quiet || verbose) return;
    const pct = totalGamesScheduled > 0 ? Math.round((totalGamesCompleted / totalGamesScheduled) * 100) : 0;
    const barWidth = 40;
    const filled = Math.round((pct / 100) * barWidth);
    const bar = '█'.repeat(filled);
    const empty = '░'.repeat(barWidth - filled);
    Deno.stdout.writeSync(new TextEncoder().encode(`\r  Overall Progress: [${bar}${empty}] ${pct}% (${totalGamesCompleted}/${totalGamesScheduled})`));
}

// Stub browser APIs
function stubBrowserAPIs() {
    if (typeof (globalThis as any).$nextTick === 'undefined') {
        (globalThis as any).$nextTick = (fn: any) => { try { fn(); } catch(e) { /* ignore */ } };
    }
}

// Logger for simulation
class SimulationLogger {
    private verbose: boolean;
    private quiet: boolean;

    constructor(verbose: boolean = false, quiet: boolean = false) {
        this.verbose = verbose;
        this.quiet = quiet;
    }

    log(message: string, type: string = "game") {
        if (this.quiet) return;
        if (this.verbose || type === "result") {
            const prefix = type === "ai" ? "[AI]" : type === "result" ? "[🏆]" : "";
            console.log(`${prefix} ${message}`);
        }
    }
}

// Load game engine with heuristic profiles
async function loadGameEngine(engineCodes?: Record<string, string>): Promise<any> {
    stubBrowserAPIs();

    let gameCode: string, aiCoreCode: string, aiRandomCode: string, aiHeuristicCode: string, aiPriorityCode: string, aiMinimaxCode: string, heuristicProfilesCode: string;

    if (engineCodes) {
        gameCode = engineCodes.gameCode;
        aiCoreCode = engineCodes.aiCoreCode;
        aiRandomCode = engineCodes.aiRandomCode;
        aiHeuristicCode = engineCodes.aiHeuristicCode;
        aiPriorityCode = engineCodes.aiPriorityCode;
        aiMinimaxCode = engineCodes.aiMinimaxCode;
        heuristicProfilesCode = engineCodes.heuristicProfilesCode;
    } else {
        gameCode = await Deno.readTextFile("./game.js");
        aiCoreCode = await Deno.readTextFile("./ai/ai.js");
        aiRandomCode = await Deno.readTextFile("./ai/ai-random.js");
        aiHeuristicCode = await Deno.readTextFile("./ai/ai-heuristic.js");
        aiPriorityCode = await Deno.readTextFile("./ai/ai-priority.js");
        aiMinimaxCode = await Deno.readTextFile("./ai/ai-minimax.js");
        heuristicProfilesCode = await Deno.readTextFile("./ai/heuristic-profiles.js");
    }

    gameCode = gameCode.replace(
        'const random = () => {return Math.random();const a = new Uint32Array(1);crypto.getRandomValues(a);return a[0] / 4294967296/*2^32*/;}',
        'var random = () => _internalRandom()'
    );

    const fullCode = `
        return (function(location, document) {
            var _seed = ${Date.now()};
            var _internalRandom = () => {
                _seed = (_seed * 9301 + 49297) % 233280;
                return _seed / 233280;
            };
            var setRandomSeed = (s) => { _seed = s; };

            ${gameCode}
            ${heuristicProfilesCode}
            ${aiCoreCode}
            ${aiRandomCode}
            ${aiHeuristicCode}
            ${aiMinimaxCode}
            ${aiPriorityCode}

            return {
                createGame: alpineHexDiceTacticGame,
                setRandomSeed: setRandomSeed,
                random: () => _internalRandom(),
                performAIByHeuristic: typeof performAIByHeuristic !== 'undefined' ? performAIByHeuristic : null,
                performAIByRandom: typeof performAIByRandom !== 'undefined' ? performAIByRandom : null,
                performAIByPriority: typeof performAIByPriority !== 'undefined' ? performAIByPriority : null,
                performAIByMinimax: typeof performAIByMinimax !== 'undefined' ? performAIByMinimax : null,
                generateAllPossibleMoves: typeof generateAllPossibleMoves !== 'undefined' ? generateAllPossibleMoves : null,
                applyMove: typeof applyMove !== 'undefined' ? applyMove : null,
                boardEvaluation: typeof boardEvaluation !== 'undefined' ? boardEvaluation : function() { return 0; },
                heuristicProfiles: typeof heuristicProfiles !== 'undefined' ? heuristicProfiles : {},
            };
        })(location, document);
    `;

    const createModule = new Function('location', 'document', fullCode);
    return createModule({ search: '?mode=headless' }, { getElementById: () => null });
}

// Create game instance
function createSimulationGame(logger: SimulationLogger, engine: any) {
    const game = engine.createGame();
    (game as any).$nextTick = (fn: any) => { try { fn(); } catch(e) { /* ignore */ } };
    return game;
}

// Run a single game between two profiles
function runHeuristicGame(
    gameNumber: number,
    profile1: string,
    profile2: string,
    verbose: boolean,
    quiet: boolean,
    engine: any,
    seed?: number
): { winner: number | -1; winnerReason: string; totalTurns: number } {
    const logger = new SimulationLogger(verbose, quiet);

    if (seed !== undefined && engine.setRandomSeed) {
        engine.setRandomSeed(seed);
    }

    const game = createSimulationGame(logger, engine);
    (game as any).heuristicProfiles = { p1: profile1, p2: profile2 };

    game.debug.quiet = quiet;

    const originalEndTurn = game.endTurn.bind(game);
    game.endTurn = function(state?: any) {
        const ai0 = this.players[0].isAI;
        const ai1 = this.players[1].isAI;
        this.players[0].isAI = false;
        this.players[1].isAI = false;
        originalEndTurn(state);
        this.players[0].isAI = ai0;
        this.players[1].isAI = ai1;
    };

    game.performAITurn = function() {
        const currentPlayerIdx = this.currentPlayerIndex;
        const profileName = currentPlayerIdx === 0 ? profile1 : profile2;
        if (verbose) logger.log(`P${currentPlayerIdx + 1} (${profileName}) thinking...`, "ai");
        try {
            if (engine.performAIByHeuristic) {
                engine.performAIByHeuristic(this, profileName, verbose);
            } else {
                this.endTurn();
            }
        } catch (e) {
            this.endTurn();
        }
    };

    game.handleSetupPhase = function() {
        if (this.phase === "SETUP_ROLL") {
            for (let i = 0; i < 2; i++) {
                if (!this.players[i].initialRollDone) {
                    this.rollInitialDice(i);
                }
            }
        }
        if (this.phase === "SETUP_REROLL") {
            for (let i = 0; i < 2; i++) {
                if (this.players[i].rerollsUsed === 0) {
                    this.currentPlayerIndex = i;
                    this.skipReroll();
                }
            }
        }
        if (this.phase === "SETUP_DEPLOY") {
            for (let playerIdx = 0; playerIdx < 2; playerIdx++) {
                const player = this.players[playerIdx];
                this.currentPlayerIndex = playerIdx;
                while (player.dice.some((d: any) => !d.isDeployed)) {
                    const validHexes = this.calcValidDeploymentHexes(playerIdx);
                    const undeployedDice = player.dice.filter((d: any) => !d.isDeployed);
                    if (undeployedDice.length > 0 && validHexes.length > 0) {
                        const die = undeployedDice[0];
                        const dieIndex = player.dice.indexOf(die);
                        this.selectDieToDeploy(dieIndex);
                        const r = engine.random ? engine.random() : Math.random();
                        const randomHex = validHexes[Math.floor(r * validHexes.length)];
                        this.deployUnit(randomHex);
                    } else {
                        break;
                    }
                }
            }
            this.startGamePlay();
        }
    };

    game.init();
    game.handleSetupPhase();

    game.players[0].isAI = true;
    game.players[1].isAI = true;

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

    let turnCount = 0;
    const maxTurns = 500;
    while (game.phase !== "GAME_OVER" && turnCount < maxTurns) {
        if (game.phase === "PLAYER_TURN" && game.players[game.currentPlayerIndex].isAI) {
            game.performAITurn();
        } else {
            game.endTurn();
        }
        turnCount++;
    }

    let winner: number | -1 = -1;
    let winnerReason = "Max turns reached";
    if (game.phase === "GAME_OVER") {
        if (game.winnerMessage.includes("Player 1")) { winner = 0; winnerReason = game.winnerMessage; }
        else if (game.winnerMessage.includes("Player 2")) { winner = 1; winnerReason = game.winnerMessage; }
        else { winner = -1; winnerReason = game.winnerMessage; }
    }
    logger.log(`Game ${gameNumber} ended: ${winnerReason}`, "result");
    return { winner, winnerReason, totalTurns: turnCount };
}

// Run a matchup between two profiles (multiple games)
async function runMatchup(
    profile1: string, profile2: string, numGames: number,
    verbose: boolean, quiet: boolean, engine: any, pool?: GameWorkerPool
): Promise<MatchupResult> {
    if (!quiet && !pool) console.log(`\n━━━ ${profile1} vs ${profile2} ━━━`);
    let p1Wins = 0, p2Wins = 0, draws = 0, totalTurns = 0;
    const gamePromises: Promise<any>[] = [];

    for (let i = 1; i <= numGames; i++) {
        const seed = Date.now() + Math.floor(Math.random() * 1000000) + (i * 1000);
        let p: Promise<any>;
        if (pool) {
            p = pool.run({ gameNumber: i, profile1, profile2, verbose, quiet, seed });
        } else {
            p = Promise.resolve(runHeuristicGame(i, profile1, profile2, verbose, quiet, engine, seed));
        }
        p.then((result) => {
            if (result.winner === 0) p1Wins++;
            else if (result.winner === 1) p2Wins++;
            else draws++;
            totalTurns += result.totalTurns;
            totalGamesCompleted++;
            updateGlobalProgress(quiet, verbose);
        });
        gamePromises.push(p);
    }
    await Promise.all(gamePromises);
    return { profile1, profile2, p1Wins, p2Wins, draws, totalGames: numGames, p1WinRate: p1Wins / numGames, p2WinRate: p2Wins / numGames, avgTurns: totalTurns / numGames };
}

// Calculate profile standings
function calculateStandings(matchups: MatchupResult[], profiles: string[]): ProfileStats[] {
    const stats: Record<string, ProfileStats> = {};
    profiles.forEach(name => {
        stats[name] = { name, totalWins: 0, totalLosses: 0, totalDraws: 0, totalGames: 0, winRate: 0, avgTurnsInGames: 0, winsAsP1: 0, winsAsP2: 0 };
    });
    matchups.forEach(matchup => {
        const p1 = stats[matchup.profile1], p2 = stats[matchup.profile2];
        p1.totalWins += matchup.p1Wins; p1.totalLosses += matchup.p2Wins; p1.totalDraws += matchup.draws; p1.totalGames += matchup.totalGames; p1.winsAsP1 += matchup.p1Wins;
        p2.totalWins += matchup.p2Wins; p2.totalLosses += matchup.p1Wins; p2.totalDraws += matchup.draws; p2.totalGames += matchup.totalGames; p2.winsAsP2 += matchup.p2Wins;
    });
    profiles.forEach(name => { stats[name].winRate = stats[name].totalGames > 0 ? stats[name].totalWins / stats[name].totalGames : 0; });
    return profiles.map(name => stats[name]).sort((a, b) => b.winRate - a.winRate);
}

// Main tournament runner
async function runTournament(args: any) {
    const numGames = parseInt(args.games) || 10;
    const outputDir = args.output || "tournaments";
    const verbose = !!args.verbose;
    const quiet = !!args.quiet;
    const parallel = parseInt(args.parallel) || 1;

    const engineCodes = {
        gameCode: await Deno.readTextFile("./game.js"),
        aiCoreCode: await Deno.readTextFile("./ai/ai.js"),
        aiRandomCode: await Deno.readTextFile("./ai/ai-random.js"),
        aiHeuristicCode: await Deno.readTextFile("./ai/ai-heuristic.js"),
        aiPriorityCode: await Deno.readTextFile("./ai/ai-priority.js"),
        aiMinimaxCode: await Deno.readTextFile("./ai/ai-minimax.js"),
        heuristicProfilesCode: await Deno.readTextFile("./ai/heuristic-profiles.js"),
    };

    const engine = await loadGameEngine(engineCodes);
    const availableProfiles = Object.keys(engine.heuristicProfiles);

    let profilesToTest = availableProfiles;
    if (args.profiles) {
        const requested = args.profiles.split(',').map((p: any) => p.trim().toLowerCase());
        profilesToTest = availableProfiles.filter(p => requested.includes(p));
    }

    console.log("╔════════════════════════════════════════╗");
    console.log("║   Heuristic Profile Tournament         ║");
    console.log("╚════════════════════════════════════════╝");
    console.log(`Games per matchup: ${numGames} | Profiles: ${profilesToTest.join(', ')} | Parallel: ${parallel}`);
    console.log("");

    await ensureDir(outputDir);
    const pool = parallel > 1 ? new GameWorkerPool(parallel, engineCodes) : undefined;

    const numMatchups = (profilesToTest.length * (profilesToTest.length - 1)) / 2;
    totalGamesScheduled = numMatchups * numGames;
    totalGamesCompleted = 0;

    const matchupPromises: Promise<MatchupResult>[] = [];
    for (let i = 0; i < profilesToTest.length; i++) {
        for (let j = i + 1; j < profilesToTest.length; j++) {
            matchupPromises.push(runMatchup(profilesToTest[i], profilesToTest[j], numGames, verbose, quiet, engine, pool));
        }
    }
    if (pool && !quiet) updateGlobalProgress(quiet, verbose);
    const matchups = await Promise.all(matchupPromises);
    if (pool) pool.terminate();
    if (!quiet) console.log("\n\nAll games completed.");

    const standings = calculateStandings(matchups, profilesToTest);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    
    // Get full profile details for the results
    const fullProfiles = profilesToTest.map(name => {
        const profile = engine.heuristicProfiles[name] || {};
        return { name, ...profile };
    });

    const results: TournamentResults = { 
        metadata: { 
            date: timestamp, 
            gamesPerMatchup: numGames, 
            profiles: fullProfiles, 
            version: "1.0" 
        }, 
        matchups, 
        standings, 
        summary: { 
            totalGames: totalGamesScheduled, 
            totalTurns: matchups.reduce((a, b) => a + b.avgTurns * b.totalGames, 0), 
            avgTurnsPerGame: 0 
        } 
    };
    results.summary.avgTurnsPerGame = results.summary.totalTurns / results.summary.totalGames;

    console.log("\nProfile         | W    | L    | D    | Win%  | W(P1)| W(P2)");
    console.log("────────────────|──────|──────|──────|───────|──────|──────");
    standings.forEach(s => {
        const winPct = (s.winRate * 100).toFixed(1);
        console.log(`${s.name.padEnd(15)} | ${s.totalWins.toString().padStart(4)} | ${s.totalLosses.toString().padStart(4)} | ${s.totalDraws.toString().padStart(4)} | ${winPct.padStart(5)}% | ${s.winsAsP1.toString().padStart(4)} | ${s.winsAsP2.toString().padStart(4)}`);
    });

    const resultsFile = `${outputDir}/tournament_${timestamp}.json`;
    await Deno.writeTextFile(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\n📄 Results saved to: ${resultsFile}`);
}

/**
 * Pool of workers for running games in parallel
 */
class GameWorkerPool {
    private workers: Set<Worker> = new Set();
    private idleWorkers: Worker[] = [];
    private queue: { data: any; resolve: (v: any) => void; reject: (e: any) => void }[] = [];
    private engineCodes: Record<string, string>;
    private scriptUrl: string;
    private size: number;

    constructor(size: number, engineCodes: Record<string, string>) {
        this.size = size;
        this.engineCodes = engineCodes;
        this.scriptUrl = new URL(import.meta.url).href;
        for (let i = 0; i < size; i++) {
            this.createWorker();
        }
    }

    private createWorker() {
        const worker = new Worker(this.scriptUrl, { type: "module" });
        worker.onmessage = (e) => {
            const msg = e.data;
            if (msg.type === 'ready') {
                this.idleWorkers.push(worker);
                this.process();
            } else if (msg.type === 'result') {
                this.handleResult(worker, msg.result);
            }
        };
        worker.onerror = (e) => {
            this.handleError(worker, e);
        };
        worker.postMessage({ type: 'init', engineCodes: this.engineCodes });
        this.workers.add(worker);
    }

    private handleResult(worker: Worker, result: any) {
        const current = (worker as any).current;
        if (current) current.resolve(result);
        (worker as any).current = null;
        this.idleWorkers.push(worker);
        this.process();
    }

    private handleError(worker: Worker, err: any) {
        const current = (worker as any).current;
        if (current) {
            current.reject(err);
            (worker as any).current = null;
        }
        
        this.workers.delete(worker);
        const idleIdx = this.idleWorkers.indexOf(worker);
        if (idleIdx > -1) this.idleWorkers.splice(idleIdx, 1);
        
        try { worker.terminate(); } catch(_) { /* ignore */ }

        if (this.workers.size < this.size) {
            this.createWorker();
        }
    }

    private process() {
        while (this.idleWorkers.length > 0 && this.queue.length > 0) {
            const worker = this.idleWorkers.pop()!;
            const task = this.queue.shift()!;
            (worker as any).current = task;
            worker.postMessage({ type: 'task', task: task.data });
        }
    }

    run(data: any): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queue.push({ data, resolve, reject });
            this.process();
        });
    }

    terminate() {
        this.workers.forEach((w) => w.terminate());
        this.workers.clear();
        this.idleWorkers = [];
    }
}

// Entry point
const isWorker = typeof (globalThis as any).WorkerGlobalScope !== "undefined";

if (import.meta.main && !isWorker) {
    const args = parse(Deno.args, {
        string: ["games", "output", "profiles", "parallel"],
        boolean: ["verbose", "quiet", "help"],
        alias: { g: "games", o: "output", v: "verbose", q: "quiet", p: "parallel", h: "help" },
        default: { games: 1, output: "tournaments", verbose: false, quiet: false, parallel: 1 },
    });

    if (args.help) {
        console.log(`Hex Dice Heuristic Profile Tournament\nUsage: deno run --allow-all tournament.ts [options]`);
        Deno.exit(0);
    }

    runTournament(args).catch(e => { console.error("Tournament failed:", e); Deno.exit(1); });
} else {
    // Worker runner logic
    let engine: any = null;
    (self as any).onmessage = async (e: any) => {
        const { type, engineCodes, task } = e.data;
        if (type === 'init') {
            engine = await loadGameEngine(engineCodes);
            (self as any).postMessage({ type: 'ready' });
        } else if (type === 'task') {
            const result = runHeuristicGame(task.gameNumber, task.profile1, task.profile2, task.verbose, task.quiet, engine, task.seed);
            (self as any).postMessage({ type: 'result', result });
        }
    };
}
