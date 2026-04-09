#!/usr/bin/env -S deno run --allow-all

import { parse } from "https://deno.land/std@0.208.0/flags/mod.ts";
import { ensureDir } from "https://deno.land/std@0.208.0/fs/ensure_dir.ts";

// Results tracking interfaces
interface MatchupResult {
    profiles: string[];
    wins: number[]; // wins[i] is number of wins for profiles[i]
    draws: number;
    totalGames: number;
    winRates: number[];
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
    winsByPosition: number[]; // Index maps to player seat
}

interface TournamentResults {
    metadata: {
        date: string;
        gamesPerMatchup: number;
        profiles: any[];
        version: string;
        playerCount: number;
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
function stubBrowserAPIs(playerCount: number = 2) {
    if (typeof (globalThis as any).$nextTick === 'undefined') {
        (globalThis as any).$nextTick = (fn: any) => { try { fn(); } catch(e) { /* ignore */ } };
    }
    // Stub location
    const locationStub = {
        search: `?mode=headless&players=${playerCount}`,
        href: `https://hexdice.local/?mode=headless&players=${playerCount}`,
        toString: () => `https://hexdice.local/?mode=headless&players=${playerCount}`
    };
    // Stub document
    const documentStub = {
        getElementById: () => null,
    };
    return { location: locationStub, document: documentStub };
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
async function loadGameEngine(playerCount: number = 2, engineCodes?: Record<string, string>): Promise<any> {
    const { location: locationStub, document: documentStub } = stubBrowserAPIs(playerCount);

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
                mutateProfile: typeof mutateProfile !== 'undefined' ? mutateProfile : null,
            };
        })(location, document);
    `;

    const createModule = new Function('location', 'document', fullCode);
    return createModule(locationStub, documentStub);
}

// Create game instance
function createSimulationGame(logger: SimulationLogger, engine: any) {
    const game = engine.createGame();
    (game as any).$nextTick = (fn: any) => { try { fn(); } catch(e) { /* ignore */ } };
    return game;
}

// Run a single game between N profiles
function runHeuristicGame(
    gameNumber: number,
    profiles: string[],
    verbose: boolean,
    quiet: boolean,
    engine: any,
    seed?: number
): { winner: number | -1; winnerReason: string; totalTurns: number } {
    const logger = new SimulationLogger(verbose, quiet);

    if (seed !== undefined && engine.setRandomSeed) {
        engine.setRandomSeed(seed);
    }

    const game = engine.createGame();
    game.playerCount = profiles.length;

    (game as any).$nextTick = (fn: any) => { try { fn(); } catch(e) { /* ignore */ } };
    (game as any).heuristicProfilesArr = profiles;

    game.debug.quiet = quiet;

    const originalEndTurn = game.endTurn.bind(game);
    game.endTurn = function(state?: any) {
        const originalAIStates = this.players.map((p: any) => p.isAI);
        this.players.forEach((p: any) => p.isAI = false);
        originalEndTurn(state);
        this.players.forEach((p: any, idx: number) => p.isAI = originalAIStates[idx]);
    };

    game.performAITurn = function() {
        const currentPlayerIdx = this.currentPlayerIndex;
        const profileName = profiles[currentPlayerIdx];
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
            for (let i = 0; i < this.playerCount; i++) {
                if (!this.players[i].initialRollDone) {
                    this.rollInitialDice(i);
                }
            }
        }
        if (this.phase === "SETUP_REROLL") {
            for (let i = 0; i < this.playerCount; i++) {
                if (this.players[i].rerollsUsed === 0) {
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
        const winnerMatch = game.winnerMessage.match(/P(\d+)\s*\(.*?\)\s*wins!/);
        if (winnerMatch) {
            winner = parseInt(winnerMatch[1]) - 1;
            winnerReason = game.winnerMessage;
        } else if (game.winnerMessage.toLowerCase().includes("draw") || game.winnerMessage.includes("Mutual")) {
            winner = -1;
            winnerReason = game.winnerMessage;
        }
    }
    logger.log(`Game ${gameNumber} ended: ${winnerReason}`, "result");
    return { winner, winnerReason, totalTurns: turnCount };
}

// Run a matchup between N profiles (multiple games)
async function runMatchup(
    profiles: string[], numGames: number,
    verbose: boolean, quiet: boolean, engine: any, pool?: GameWorkerPool
): Promise<MatchupResult> {
    if (!quiet && !pool) console.log(`\n━━━ ${profiles.join(' vs ')} ━━━`);
    let wins = new Array(profiles.length).fill(0);
    let draws = 0, totalTurns = 0;
    const gamePromises: Promise<any>[] = [];

    for (let i = 1; i <= numGames; i++) {
        const seed = Date.now() + Math.floor(Math.random() * 1000000) + (i * 1000);
        let p: Promise<any>;
        if (pool) {
            p = pool.run({ gameNumber: i, profiles, verbose, quiet, seed });
        } else {
            p = Promise.resolve(runHeuristicGame(i, profiles, verbose, quiet, engine, seed));
        }
        p.then((result) => {
            if (result.winner >= 0 && result.winner < profiles.length) {
                wins[result.winner]++;
            } else {
                draws++;
            }
            totalTurns += result.totalTurns;
            totalGamesCompleted++;
            updateGlobalProgress(quiet, verbose);
        });
        gamePromises.push(p);
    }
    await Promise.all(gamePromises);
    return { 
        profiles, 
        wins, 
        draws, 
        totalGames: numGames, 
        winRates: wins.map(w => w / numGames), 
        avgTurns: totalTurns / numGames 
    };
}

// Calculate profile standings
function calculateStandings(matchups: MatchupResult[], profiles: string[], playerCount: number): ProfileStats[] {
    const stats: Record<string, ProfileStats> = {};
    profiles.forEach(name => {
        stats[name] = { 
            name, totalWins: 0, totalLosses: 0, totalDraws: 0, totalGames: 0, 
            winRate: 0, avgTurnsInGames: 0, 
            winsByPosition: new Array(playerCount).fill(0)
        };
    });

    matchups.forEach(matchup => {
        matchup.profiles.forEach((profileName, index) => {
            const pStats = stats[profileName];
            const pWins = matchup.wins[index];
            const otherWins = matchup.wins.reduce((a, b) => a + b, 0) - pWins;

            pStats.totalWins += pWins;
            pStats.totalLosses += (otherWins);
            pStats.totalDraws += matchup.draws;
            pStats.totalGames += matchup.totalGames;
            pStats.winsByPosition[index] += pWins;
        });
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
    const playerCount = parseInt(args.players) || 2;

    const engineCodes = {
        gameCode: await Deno.readTextFile("./game.js"),
        aiCoreCode: await Deno.readTextFile("./ai/ai.js"),
        aiRandomCode: await Deno.readTextFile("./ai/ai-random.js"),
        aiHeuristicCode: await Deno.readTextFile("./ai/ai-heuristic.js"),
        aiPriorityCode: await Deno.readTextFile("./ai/ai-priority.js"),
        aiMinimaxCode: await Deno.readTextFile("./ai/ai-minimax.js"),
        heuristicProfilesCode: await Deno.readTextFile("./ai/heuristic-profiles.js"),
    };

    const engine = await loadGameEngine(playerCount, engineCodes);
    const availableProfiles = Object.keys(engine.heuristicProfiles);

    let profilesToTest = availableProfiles;
    if (args.profiles) {
        const requested = args.profiles.split(',').map((p: any) => p.trim());
        profilesToTest = availableProfiles.filter(p => requested.includes(p));
    }

    // Generate mutated versions if requested
    const extraMutatedProfiles: Record<string, any> = {};
    if (args.mutate) {
        const rate = parseFloat(args['mutation-rate']) || 0.1;
        const mutatedNames: string[] = [];
        profilesToTest.forEach(baseName => {
            if (engine.mutateProfile) {
                const mutated = engine.mutateProfile(baseName, rate);
                const mutatedName = `${baseName}_m`;
                engine.heuristicProfiles[mutatedName] = mutated;
                extraMutatedProfiles[mutatedName] = mutated;
                mutatedNames.push(mutatedName);
            }
        });
        profilesToTest = [...profilesToTest, ...mutatedNames];
    }

    console.log("╔════════════════════════════════════════╗");
    console.log("║   Heuristic Profile Tournament         ║");
    console.log("╚════════════════════════════════════════╝");
    console.log(`Games per matchup: ${numGames} | Players: ${playerCount} | Profiles: ${profilesToTest.join(', ')} | Parallel: ${parallel}`);
    console.log("");

    await ensureDir(outputDir);
    const pool = parallel > 1 ? new GameWorkerPool(parallel, engineCodes, playerCount, extraMutatedProfiles) : undefined;

    // Helper to get combinations
    const getCombinations = (array: string[], k: number) => {
        const results: string[][] = [];
        const f = (start: number, current: string[]) => {
            if (current.length === k) {
                results.push([...current]);
                return;
            }
            for (let i = start; i < array.length; i++) {
                current.push(array[i]);
                f(i + 1, current);
                current.pop();
            }
        };
        f(0, []);
        return results;
    };

    const profileCombinations = getCombinations(profilesToTest, playerCount);
    const numMatchups = profileCombinations.length;
    totalGamesScheduled = numMatchups * numGames;
    totalGamesCompleted = 0;

    const matchupPromises: Promise<MatchupResult>[] = [];
    for (const combo of profileCombinations) {
        matchupPromises.push(runMatchup(combo, numGames, verbose, quiet, engine, pool));
    }

    if (pool && !quiet) updateGlobalProgress(quiet, verbose);
    const matchups = await Promise.all(matchupPromises);
    if (pool) pool.terminate();
    if (!quiet) console.log("\n\nAll games completed.");

    const standings = calculateStandings(matchups, profilesToTest, playerCount);
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
            version: "1.0",
            playerCount: playerCount
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

    let header = "Profile         | W    | L    | D    | Win%  ";
    for (let i = 0; i < playerCount; i++) {
        header += `| P${i+1}   `;
    }
    console.log("\n" + header);
    console.log("─".repeat(header.length));
    standings.forEach(s => {
        const winPct = (s.winRate * 100).toFixed(1);
        let row = `${s.name.padEnd(15)} | ${s.totalWins.toString().padStart(4)} | ${s.totalLosses.toString().padStart(4)} | ${s.totalDraws.toString().padStart(4)} | ${winPct.padStart(5)}% `;
        for (let i = 0; i < playerCount; i++) {
            row += `| ${s.winsByPosition[i].toString().padStart(4)} `;
        }
        console.log(row);
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
    private playerCount: number;

    private mutatedProfiles: Record<string, any>;

    constructor(size: number, engineCodes: Record<string, string>, playerCount: number, mutatedProfiles?: Record<string, any>) {
        this.size = size;
        this.engineCodes = engineCodes;
        this.playerCount = playerCount;
        this.mutatedProfiles = mutatedProfiles || {};
        this.scriptUrl = new URL(import.meta.url).href;
        for (let i = 0; i < size; i++) {
            this.createWorker(this.mutatedProfiles);
        }
    }

    private createWorker(mutatedProfiles?: Record<string, any>) {
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
        worker.postMessage({ type: 'init', engineCodes: this.engineCodes, playerCount: this.playerCount, mutatedProfiles });
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
        string: ["games", "output", "profiles", "parallel", "mutation-rate", "players"],
        boolean: ["verbose", "quiet", "help", "mutate"],
        alias: { g: "games", o: "output", v: "verbose", q: "quiet", p: "parallel", h: "help", m: "mutate", r: "mutation-rate", pl: "players" },
        default: { games: 1, output: "tournaments", verbose: false, quiet: false, parallel: 1, mutate: false, "mutation-rate": 0.1, players: 2 },
    });

    if (args.help) {
        console.log(`Hex Dice Heuristic Profile Tournament\nUsage: deno run --allow-all tournament.ts [options]`);
        console.log(`Options:
  -g, --games <n>       Games per matchup (default: 1)
  -pl, --players <n>    Number of players per game (2, 3, 4, 6)
  -p, --parallel <n>    Number of parallel workers
  -profiles <list>      Comma-separated list of profiles
  -m, --mutate          Generate mutated versions of profiles
  -v, --verbose         Verbose output`);
        Deno.exit(0);
    }

    runTournament(args).catch(e => { console.error("Tournament failed:", e); Deno.exit(1); });
} else {
    // Worker runner logic
    let engine: any = null;
    (self as any).onmessage = async (e: any) => {
        const { type, engineCodes, playerCount, mutatedProfiles, task } = e.data;
        if (type === 'init') {
            engine = await loadGameEngine(playerCount, engineCodes);
            if (mutatedProfiles) {
                Object.assign(engine.heuristicProfiles, mutatedProfiles);
            }
            (self as any).postMessage({ type: 'ready' });
        } else if (type === 'task') {
            const result = runHeuristicGame(task.gameNumber, task.profiles, task.verbose, task.quiet, engine, task.seed);
            (self as any).postMessage({ type: 'result', result });
        }
    };
}
