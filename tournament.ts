#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-net

/**
 * Heuristic Profile Tournament Simulation
 *
 * Simulates games between different heuristic profiles to determine
 * which strategy performs best.
 *
 * Usage:
 *   deno run --allow-all tournament.ts --games=10 --output=logs
 *   deno run --allow-all tournament.ts -g=20 -o=tournaments -v
 *
 * Options:
 *   --games, -g     Number of games per matchup (default: 1)
 *   --output, -o    Output directory for results (default: tournaments)
 *   --verbose, -v   Verbose output (default: false)
 *   --profiles      Comma-separated list of profiles to test (default: all)
 */

import { parse } from "https://deno.land/std@0.208.0/flags/mod.ts";
import { ensureDir } from "https://deno.land/std@0.208.0/fs/ensure_dir.ts";

// Available heuristic profiles
const PROFILE_NAMES = [
    'baseline',
    'berserker',
    'turtle',
    'tactician',
    'swarmer',
    'assassin'
];

// CLI Arguments
const args = parse(Deno.args, {
    string: ["games", "output", "profiles"],
    boolean: ["verbose", "help"],
    alias: {
        g: "games",
        o: "output",
        v: "verbose",
        h: "help",
    },
    default: {
        games: 1,
        output: "tournaments",
        verbose: false,
    },
});

if (args.help) {
    console.log(`
Hex Dice Heuristic Profile Tournament

Usage:
  deno run --allow-all tournament.ts [options]

Options:
  --games, -g <n>      Number of games per matchup (default: 10)
  --output, -o <dir>   Output directory for results (default: tournaments)
  --verbose, -v        Show detailed move-by-move output
  --profiles <list>    Comma-separated profiles to test (default: all)
                       Available: baseline, berserker, turtle, tactician, swarmer, assassin
  --help, -h           Show this help message

Examples:
  deno run --allow-all tournament.ts -g=20
  deno run --allow-all tournament.ts --games=10 --profiles=baseline,berserker,turtle
  deno run --allow-all tournament.ts -g=5 -o=my-tournament -v
`);
    Deno.exit(0);
}

// Tournament results tracking
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
        profiles: string[];
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

// Stub browser APIs
function stubBrowserAPIs() {
    (globalThis as any).location = { search: '?mode=headless' };
    (globalThis as any).document = { getElementById: () => null };
    (globalThis as any).$nextTick = (fn: any) => { try { fn(); } catch(e) { /* ignore */ } };
}

// Logger for simulation
class SimulationLogger {
    private verbose: boolean;

    constructor(verbose: boolean = false) {
        this.verbose = verbose;
    }

    log(message: string, type: string = "game") {
        if (this.verbose || type === "result") {
            const prefix = type === "ai" ? "[AI]" : type === "result" ? "[🏆]" : "";
            console.log(`${prefix} ${message}`);
        }
    }
}

// Load game engine with heuristic profiles
async function loadGameEngine(): Promise<any> {
    stubBrowserAPIs();

    let gameCode = await Deno.readTextFile("./game.js");
    const aiCoreCode = await Deno.readTextFile("./ai/ai.js");
    const aiRandomCode = await Deno.readTextFile("./ai/ai-random.js");
    const aiHeuristicCode = await Deno.readTextFile("./ai/ai-heuristic.js");
    const aiPriorityCode = await Deno.readTextFile("./ai/ai-priority.js");
    const aiMinimaxCode = await Deno.readTextFile("./ai/ai-minimax.js");
    const heuristicProfilesCode = await Deno.readTextFile("./ai/heuristic-profiles.js");

    // Use seeded random for reproducibility
    gameCode = gameCode.replace(
        'const random = () => {return Math.random();const a = new Uint32Array(1);crypto.getRandomValues(a);return a[0] / 4294967296/*2^32*/;}',
        'var random = () => Math.random()'
    );

    const fullCode = `
        var _seed = ${Date.now()};
        var random = () => {
            _seed = (_seed * 9301 + 49297) % 233280;
            return _seed / 233280;
        };

        ${gameCode}
        ${heuristicProfilesCode}
        ${aiCoreCode}
        ${aiRandomCode}
        ${aiHeuristicCode}
        ${aiMinimaxCode}
        ${aiPriorityCode}

        return {
            createGame: alpineHexDiceTacticGame,
            performAIByHeuristic: typeof performAIByHeuristic !== 'undefined' ? performAIByHeuristic : null,
            performAIByRandom: typeof performAIByRandom !== 'undefined' ? performAIByRandom : null,
            performAIByPriority: typeof performAIByPriority !== 'undefined' ? performAIByPriority : null,
            performAIByMinimax: typeof performAIByMinimax !== 'undefined' ? performAIByMinimax : null,
            generateAllPossibleMoves: typeof generateAllPossibleMoves !== 'undefined' ? generateAllPossibleMoves : null,
            applyMove: typeof applyMove !== 'undefined' ? applyMove : null,
            boardEvaluation: typeof boardEvaluation !== 'undefined' ? boardEvaluation : function() { return 0; },
        };
    `;

    const createModule = new Function(fullCode);
    return createModule();
}

// Create game instance
function createSimulationGame(logger: SimulationLogger, engine: any) {
    const game = engine.createGame();
    (game as any).$nextTick = (fn: any) => { try { fn(); } catch(e) { /* ignore */ } };
    return game;
}

// Calculate state hash
function calculateStateHash(game: any): string {
    const state = {
        p1Dice: game.players[0].dice.map((d: any) => `${d.value}-${d.hexId}-${d.isDeath}`).join("|"),
        p2Dice: game.players[1].dice.map((d: any) => `${d.value}-${d.hexId}-${d.isDeath}`).join("|"),
        turn: game.currentPlayerIndex,
        phase: game.phase,
    };
    return btoa(JSON.stringify(state));
}

// Run a single game between two profiles
function runHeuristicGame(
    gameNumber: number,
    profile1: string,
    profile2: string,
    verbose: boolean,
    engine: any
): { winner: number | -1; winnerReason: string; totalTurns: number } {
    const logger = new SimulationLogger(verbose);

    const game = createSimulationGame(logger, engine);

    // Store profile names
    (game as any).heuristicProfiles = { p1: profile1, p2: profile2 };

    // Override AI turn to use heuristic with specific profile
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

        logger.log(`P${currentPlayerIdx + 1} (${profileName}) thinking...`, "ai");

        try {
            if (engine.performAIByHeuristic) {
                engine.performAIByHeuristic(this, profileName);
            } else {
                logger.log(`AI function not found!`, "error");
                this.endTurn();
            }
        } catch (e) {
            logger.log(`AI error: ${e}`, "error");
            this.endTurn();
        }
    };

    // Handle setup phase
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
                        const randomHex = validHexes[Math.floor(Math.random() * validHexes.length)];
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

    // Set up AI players
    game.players[0].isAI = true;
    game.players[1].isAI = true;

    // Override cloneState
    game.cloneState = function() {
        return {
            players: this.players.map((p: any) => ({
                id: p.id,
                color: p.color,
                dice: p.dice.map((d: any) => ({ ...d })),
                initialRollDone: p.initialRollDone,
                baseHexId: p.baseHexId,
                rerollsUsed: p.rerollsUsed,
                isAI: p.isAI,
            })),
            hexes: this.hexes.map((h: any) => ({ ...h })),
            hexesQR: this.hexesQR,
            phase: this.phase,
            currentPlayerIndex: this.currentPlayerIndex,
            selectedUnitHexId: this.selectedUnitHexId,
            actionMode: this.actionMode,
            validMoves: this.validMoves,
            validTargets: this.validTargets,
            validMerges: this.validMerges,
            trail: { ...this.trail },
            rules: { ...this.rules },
            hexGrid: { ...this.hexGrid },
        };
    };

    let turnCount = 0;
    const maxTurns = 500;

    while (game.phase !== "GAME_OVER" && turnCount < maxTurns) {
        const currentPlayer = game.players[game.currentPlayerIndex];

        if (game.phase === "PLAYER_TURN") {
            if (currentPlayer.isAI) {
                game.performAITurn();
            } else {
                game.endTurn();
            }
        } else {
            game.endTurn();
        }

        turnCount++;
    }

    // Determine winner
    let winner: number | -1 = -1;
    let winnerReason = "Max turns reached";

    if (game.phase === "GAME_OVER") {
        if (game.winnerMessage.includes("Player 1")) {
            winner = 0;
            winnerReason = game.winnerMessage;
        } else if (game.winnerMessage.includes("Player 2")) {
            winner = 1;
            winnerReason = game.winnerMessage;
        } else if (game.winnerMessage.includes("draw") || game.winnerMessage.includes("Mutual")) {
            winner = -1;
            winnerReason = game.winnerMessage;
        }
    }

    logger.log(`Game ${gameNumber} ended: ${winnerReason}`, "result");

    return { winner, winnerReason, totalTurns: turnCount };
}

// Run a matchup between two profiles (multiple games)
function runMatchup(
    profile1: string,
    profile2: string,
    numGames: number,
    verbose: boolean,
    engine: any
): MatchupResult {
    console.log(`\n━━━ ${profile1} vs ${profile2} ━━━`);

    let p1Wins = 0;
    let p2Wins = 0;
    let draws = 0;
    let totalTurns = 0;

    for (let i = 1; i <= numGames; i++) {
        if (verbose) {
            console.log(`\n  Game ${i}/${numGames}`);
        }

        const result = runHeuristicGame(i, profile1, profile2, verbose, engine);

        if (result.winner === 0) p1Wins++;
        else if (result.winner === 1) p2Wins++;
        else draws++;

        totalTurns += result.totalTurns;

        if (!verbose) {
            const bar1 = '█'.repeat(Math.round((p1Wins / i) * 20));
            const bar2 = '█'.repeat(Math.round((p2Wins / i) * 20));
            console.log(`\r  Progress: ${i}/${numGames} | ${profile1}: ${p1Wins} ${bar1} | ${profile2}: ${p2Wins} ${bar2} | Draws: ${draws}`);
        }
    }

    if (!verbose) console.log();

    return {
        profile1,
        profile2,
        p1Wins,
        p2Wins,
        draws,
        totalGames: numGames,
        p1WinRate: p1Wins / numGames,
        p2WinRate: p2Wins / numGames,
        avgTurns: totalTurns / numGames,
    };
}

// Calculate profile standings
function calculateStandings(matchups: MatchupResult[], profiles: string[]): ProfileStats[] {
    const stats: Record<string, ProfileStats> = {};

    // Initialize stats for each profile
    profiles.forEach(name => {
        stats[name] = {
            name,
            totalWins: 0,
            totalLosses: 0,
            totalDraws: 0,
            totalGames: 0,
            winRate: 0,
            avgTurnsInGames: 0,
            winsAsP1: 0,
            winsAsP2: 0,
        };
    });

    // Aggregate results
    matchups.forEach(matchup => {
        const p1 = stats[matchup.profile1];
        const p2 = stats[matchup.profile2];

        p1.totalWins += matchup.p1Wins;
        p1.totalLosses += matchup.p2Wins;
        p1.totalDraws += matchup.draws;
        p1.totalGames += matchup.totalGames;
        p1.winsAsP1 += matchup.p1Wins;

        p2.totalWins += matchup.p2Wins;
        p2.totalLosses += matchup.p1Wins;
        p2.totalDraws += matchup.draws;
        p2.totalGames += matchup.totalGames;
        p2.winsAsP2 += matchup.p2Wins;
    });

    // Calculate win rates
    profiles.forEach(name => {
        const s = stats[name];
        s.winRate = s.totalGames > 0 ? s.totalWins / s.totalGames : 0;
    });

    // Sort by win rate
    return profiles
        .map(name => stats[name])
        .sort((a, b) => b.winRate - a.winRate);
}

// Main tournament runner
async function runTournament() {
    const numGames = parseInt(args.games as string) || 10;
    const outputDir = (args.output as string) || "tournaments";
    const verbose = !!args.verbose;

    // Parse profiles to test
    let profilesToTest = PROFILE_NAMES;
    if (args.profiles) {
        const requested = (args.profiles as string).split(',').map(p => p.trim().toLowerCase());
        profilesToTest = PROFILE_NAMES.filter(p => requested.includes(p));
        if (profilesToTest.length === 0) {
            console.error("No valid profiles specified. Available:", PROFILE_NAMES.join(', '));
            Deno.exit(1);
        }
    }

    console.log("╔════════════════════════════════════════╗");
    console.log("║   Heuristic Profile Tournament         ║");
    console.log("╚════════════════════════════════════════╝");
    console.log(`Games per matchup: ${numGames}`);
    console.log(`Profiles: ${profilesToTest.join(', ')}`);
    console.log(`Verbose: ${verbose}`);
    console.log("");

    // Load game engine
    console.log("Loading game engine...");
    const engine = await loadGameEngine();
    console.log("Engine loaded.\n");

    // Ensure output directory exists
    await ensureDir(outputDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const results: TournamentResults = {
        metadata: {
            date: timestamp,
            gamesPerMatchup: numGames,
            profiles: profilesToTest,
            version: "1.0",
        },
        matchups: [],
        standings: [],
        summary: {
            totalGames: 0,
            totalTurns: 0,
            avgTurnsPerGame: 0,
        },
    };

    // Run all matchups (round-robin)
    for (let i = 0; i < profilesToTest.length; i++) {
        for (let j = i + 1; j < profilesToTest.length; j++) {
            const matchup = runMatchup(
                profilesToTest[i],
                profilesToTest[j],
                numGames,
                verbose,
                engine
            );
            results.matchups.push(matchup);
            results.summary.totalGames += matchup.totalGames;
            results.summary.totalTurns += matchup.avgTurns * matchup.totalGames;
        }
    }

    // Calculate standings
    results.standings = calculateStandings(results.matchups, profilesToTest);
    results.summary.avgTurnsPerGame = results.summary.totalTurns / results.summary.totalGames;

    // Print standings
    console.log("\n");
    console.log("╔════════════════════════════════════════╗");
    console.log("║         Tournament Standings           ║");
    console.log("╚════════════════════════════════════════╝");
    console.log("");
    console.log("Profile         | W    | L    | D    | Win%  | W(P1)| W(P2)");
    console.log("────────────────|──────|──────|──────|───────|──────|──────");

    results.standings.forEach(s => {
        const winPct = (s.winRate * 100).toFixed(1);
        console.log(
            `${s.name.padEnd(15)} | ${s.totalWins.toString().padStart(4)} | ${s.totalLosses.toString().padStart(4)} | ${s.totalDraws.toString().padStart(4)} | ${winPct.padStart(5)}% | ${s.winsAsP1.toString().padStart(4)} | ${s.winsAsP2.toString().padStart(4)}`
        );
    });

    console.log("");
    console.log(`Total games: ${results.summary.totalGames}`);
    console.log(`Avg turns/game: ${results.summary.avgTurnsPerGame.toFixed(1)}`);

    // Save results
    const resultsFile = `${outputDir}/tournament_${timestamp}.json`;
    await Deno.writeTextFile(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\n📄 Results saved to: ${resultsFile}`);

    // Save standings as CSV
    const csvFile = `${outputDir}/standings_${timestamp}.csv`;
    const csvContent = [
        ['Profile', 'Wins', 'Losses', 'Draws', 'TotalGames', 'WinRate', 'WinsAsP1', 'WinsAsP2'].join(','),
        ...results.standings.map(s =>
            [s.name, s.totalWins, s.totalLosses, s.totalDraws, s.totalGames, s.winRate.toFixed(4), s.winsAsP1, s.winsAsP2].join(',')
        )
    ].join('\n');
    await Deno.writeTextFile(csvFile, csvContent);
    console.log(`📊 Standings CSV saved to: ${csvFile}`);

    // Save matchup details
    const matchupFile = `${outputDir}/matchups_${timestamp}.txt`;
    const matchupContent = results.matchups.map(m =>
        `${m.profile1} vs ${m.profile2}: ${m.p1Wins}-${m.p2Wins}-${m.draws} (Win rates: ${(m.p1WinRate * 100).toFixed(1)}% - ${(m.p2WinRate * 100).toFixed(1)}%)`
    ).join('\n');
    await Deno.writeTextFile(matchupFile, matchupContent);
    console.log(`📝 Matchup details saved to: ${matchupFile}`);
}

// Run tournament
runTournament().catch((error) => {
    console.error("Tournament failed:", error);
    Deno.exit(1);
});
