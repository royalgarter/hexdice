#!/usr/bin/env -S deno run --allow-read --allow-env

/**
 * Hex Dice Replay Viewer
 * 
 * Load and analyze simulated games step-by-step.
 * 
 * Usage:
 *   deno run --allow-read replay.ts <replay_file.json>
 *   deno run --allow-read replay.ts simulations/replay_2026-04-01T12-00-00-000Z.json
 * 
 * Commands (interactive mode):
 *   n, next      - Next move
 *   p, prev      - Previous move
 *   g <num>      - Go to game number
 *   t <num>      - Go to turn number
 *   s, state     - Show current state summary
 *   m, moves     - Show last 5 moves
 *   h, help      - Show commands
 *   q, quit      - Exit
 */

import { parse } from "https://deno.land/std@0.208.0/flags/mod.ts";

const args = parse(Deno.args, {
    string: ["game", "turn"],
    boolean: ["help", "stats"],
    alias: {
        g: "game",
        t: "turn",
        h: "help",
        s: "stats",
    },
});

if (args.help || Deno.args.length === 0) {
    console.log(`
Hex Dice Replay Viewer

Usage:
  deno run --allow-read replay.ts <replay_file.json> [options]

Options:
  --game, -g <n>     Start at specific game number
  --turn, -t <n>     Start at specific turn number
  --stats            Show statistics and exit
  --help, -h         Show this help message

Interactive Commands:
  n, next            - Next move
  p, prev            - Previous move
  g <num>            - Go to game number
  t <num>            - Go to turn number
  s, state           - Show current state summary
  m, moves           - Show last 5 moves
  l, logs            - Show last 10 log messages
  h, help            - Show commands
  q, quit            - Exit

Examples:
  deno run --allow-read replay.ts simulations/replay_xxx.json
  deno run --allow-read replay.ts replay.json -g=2 -t=10
  deno run --allow-read replay.ts replay.json --stats
`);
    Deno.exit(0);
}

interface ReplayData {
    metadata: {
        date: string;
        games: number;
        aiTypes: [string, string];
        minimaxDepth: number;
        version: string;
    };
    games: GameReplay[];
    summary: {
        p1Wins: number;
        p2Wins: number;
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
    fromHex?: number;
    toHex?: number;
    unitValue?: number;
    logMessage: string;
    stateHash: string;
}

class ReplayViewer {
    private data: ReplayData;
    private currentGameIdx: number = 0;
    private currentTurnIdx: number = 0;

    constructor(filePath: string) {
        const content = Deno.readTextFileSync(filePath);
        this.data = JSON.parse(content) as ReplayData;
    }

    get currentGame(): GameReplay {
        return this.data.games[this.currentGameIdx];
    }

    get currentMove(): MoveRecord | null {
        if (this.currentTurnIdx < 0 || this.currentTurnIdx >= this.currentGame.moves.length) {
            return null;
        }
        return this.currentGame.moves[this.currentTurnIdx];
    }

    goToGame(gameNumber: number): boolean {
        const idx = this.data.games.findIndex(g => g.gameNumber === gameNumber);
        if (idx >= 0) {
            this.currentGameIdx = idx;
            this.currentTurnIdx = 0;
            return true;
        }
        return false;
    }

    goToTurn(turnNumber: number): boolean {
        if (turnNumber >= 0 && turnNumber < this.currentGame.moves.length) {
            this.currentTurnIdx = turnNumber;
            return true;
        }
        return false;
    }

    nextMove(): boolean {
        if (this.currentTurnIdx < this.currentGame.moves.length - 1) {
            this.currentTurnIdx++;
            return true;
        }
        return false;
    }

    prevMove(): boolean {
        if (this.currentTurnIdx > 0) {
            this.currentTurnIdx--;
            return true;
        }
        return false;
    }

    showStats() {
        console.log("\n╔════════════════════════════════════════╗");
        console.log("║        Replay Statistics               ║");
        console.log("╚════════════════════════════════════════╝");
        console.log(`Date: ${this.data.metadata.date}`);
        console.log(`Total Games: ${this.data.metadata.games}`);
        console.log(`AI Types: P1=${this.data.metadata.aiTypes[0]} vs P2=${this.data.metadata.aiTypes[1]}`);
        console.log(`Minimax Depth: ${this.data.metadata.minimaxDepth}`);
        console.log("");
        console.log("Results:");
        console.log(`  P1 Wins: ${this.data.summary.p1Wins} (${(this.data.summary.p1Wins / this.data.metadata.games * 100).toFixed(1)}%)`);
        console.log(`  P2 Wins: ${this.data.summary.p2Wins} (${(this.data.summary.p2Wins / this.data.metadata.games * 100).toFixed(1)}%)`);
        console.log(`  Draws: ${this.data.summary.draws} (${(this.data.summary.draws / this.data.metadata.games * 100).toFixed(1)}%)`);
        console.log("");
        console.log(`Avg Turns/Game: ${this.data.summary.avgTurnsPerGame.toFixed(1)}`);
        console.log(`Total Turns: ${this.data.summary.totalTurns}`);
        
        // Game by game breakdown
        console.log("\nGame Results:");
        this.data.games.forEach(g => {
            const winner = g.winner === 0 ? "P1" : g.winner === 1 ? "P2" : "Draw";
            console.log(`  Game ${g.gameNumber}: ${winner} (${g.totalTurns} turns)`);
        });
    }

    showCurrentState() {
        const game = this.currentGame;
        const move = this.currentMove;
        
        console.log("\n╔════════════════════════════════════════╗");
        console.log(`║  Game ${game.gameNumber}/${this.data.games.length}  Turn ${this.currentTurnIdx}/${game.totalTurns}`);
        console.log("╚════════════════════════════════════════╝");
        
        if (move) {
            console.log(`Player: P${move.player + 1} (${move.aiType})`);
            console.log(`Action: ${move.actionType}`);
            if (move.logMessage) {
                console.log(`Log: ${move.logMessage}`);
            }
        } else if (game.moves.length === 0) {
            console.log("No moves recorded");
        } else {
            console.log("Game ended");
            console.log(`Winner: ${game.winner === 0 ? "P1" : game.winner === 1 ? "P2" : "Draw"}`);
            console.log(`Reason: ${game.winnerReason}`);
        }
    }

    showRecentMoves(count: number = 5) {
        const start = Math.max(0, this.currentTurnIdx - count + 1);
        const moves = this.currentGame.moves.slice(start, this.currentTurnIdx + 1);
        
        console.log("\nRecent Moves:");
        moves.forEach((m, i) => {
            const marker = (start + i === this.currentTurnIdx) ? "▶" : " ";
            console.log(`  ${marker} T${m.turn}: P${m.player + 1}(${m.aiType}) ${m.actionType}`);
        });
    }

    showRecentLogs(count: number = 10) {
        const start = Math.max(0, this.currentTurnIdx - count + 1);
        const moves = this.currentGame.moves.slice(start, this.currentTurnIdx + 1);
        
        console.log("\nRecent Logs:");
        moves.forEach((m, i) => {
            const marker = (start + i === this.currentTurnIdx) ? "▶" : " ";
            const logPreview = m.logMessage.substring(0, 60) + (m.logMessage.length > 60 ? "..." : "");
            console.log(`  ${marker} T${m.turn}: ${logPreview}`);
        });
    }

    showHelp() {
        console.log("\nCommands:");
        console.log("  n, next       - Next move");
        console.log("  p, prev       - Previous move");
        console.log("  g <num>       - Go to game number");
        console.log("  t <num>       - Go to turn number");
        console.log("  s, state      - Show current state");
        console.log("  m, moves      - Show last 5 moves");
        console.log("  l, logs       - Show last 10 logs");
        console.log("  f, final      - Jump to game end");
        console.log("  0, start      - Jump to game start");
        console.log("  h, help       - Show commands");
        console.log("  q, quit       - Exit");
    }

    runInteractive() {
        console.log("\n╔════════════════════════════════════════╗");
        console.log("║     Hex Dice Replay Viewer             ║");
        console.log("╚════════════════════════════════════════╝");
        console.log(`Loaded: ${this.data.metadata.games} games`);
        console.log(`P1 (${this.data.metadata.aiTypes[0]}) vs P2 (${this.data.metadata.aiTypes[1]})`);
        console.log("\nType 'help' for commands\n");

        // Go to specified game/turn if provided
        if (args.game && typeof args.game === "number") {
            if (this.goToGame(args.game)) {
                console.log(`Jumped to Game ${args.game}`);
            }
        }
        if (args.turn && typeof args.turn === "number") {
            if (this.goToTurn(args.turn)) {
                console.log(`Jumped to Turn ${args.turn}`);
            }
        }

        this.showCurrentState();

        // Read-eval loop
        const readLine = (): string | null => {
            const buf = new Uint8Array(1024);
            Deno.stdin.readSync(buf);
            const line = new TextDecoder().decode(buf).trim();
            return line || null;
        };

        while (true) {
            Deno.stdout.writeSync(new TextEncoder().encode("\n> "));
            const input = readLine();
            if (!input) continue;

            const parts = input.split(/\s+/);
            const cmd = parts[0]?.toLowerCase();
            const arg = parts[1];

            switch (cmd) {
                case "n":
                case "next":
                    if (this.nextMove()) {
                        this.showCurrentState();
                    } else {
                        console.log("Already at end of game");
                    }
                    break;

                case "p":
                case "prev":
                case "previous":
                    if (this.prevMove()) {
                        this.showCurrentState();
                    } else {
                        console.log("Already at start");
                    }
                    break;

                case "g":
                case "game":
                    if (arg) {
                        const gameNum = parseInt(arg);
                        if (this.goToGame(gameNum)) {
                            console.log(`Jumped to Game ${gameNum}`);
                            this.showCurrentState();
                        } else {
                            console.log(`Game ${gameNum} not found`);
                        }
                    } else {
                        console.log(`Current: Game ${this.currentGame.gameNumber}`);
                    }
                    break;

                case "t":
                case "turn":
                    if (arg) {
                        const turnNum = parseInt(arg);
                        if (this.goToTurn(turnNum)) {
                            console.log(`Jumped to Turn ${turnNum}`);
                            this.showCurrentState();
                        } else {
                            console.log(`Turn ${turnNum} out of range (0-${this.currentGame.moves.length - 1})`);
                        }
                    } else {
                        console.log(`Current: Turn ${this.currentTurnIdx}`);
                    }
                    break;

                case "s":
                case "state":
                    this.showCurrentState();
                    break;

                case "m":
                case "moves":
                    this.showRecentMoves();
                    break;

                case "l":
                case "logs":
                    this.showRecentLogs();
                    break;

                case "f":
                case "final":
                case "end":
                    this.currentTurnIdx = this.currentGame.moves.length - 1;
                    this.showCurrentState();
                    break;

                case "0":
                case "start":
                    this.currentTurnIdx = 0;
                    this.showCurrentState();
                    break;

                case "stats":
                    this.showStats();
                    break;

                case "h":
                case "help":
                    this.showHelp();
                    break;

                case "q":
                case "quit":
                case "exit":
                    console.log("Goodbye!");
                    return;

                default:
                    console.log(`Unknown command: ${cmd}. Type 'help' for commands.`);
            }
        }
    }
}

// Main
const replayFile = Deno.args[0];

if (!replayFile) {
    console.error("Error: No replay file specified");
    Deno.exit(1);
}

try {
    const viewer = new ReplayViewer(replayFile);
    
    if (args.stats) {
        viewer.showStats();
    } else {
        viewer.runInteractive();
    }
} catch (error) {
    console.error(`Error loading replay: ${error}`);
    Deno.exit(1);
}
