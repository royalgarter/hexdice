#!/usr/bin/env -S deno run --allow-read --allow-env

/**
 * Hex Dice Replay Viewer
 *
 * Load and analyze simulated games step-by-step.
 *
 * Usage:
 *   deno run --allow-read replay.ts <replay_file.json>
 *   deno run --allow-read replay.ts simulations/replay_*.json
 *
 * Commands (interactive mode):
 *   n, next      - Next move
 *   p, prev      - Previous move
 *   g <num>      - Go to game number
 *   t <num>      - Go to turn number
 *   s, state     - Show current state summary
 *   m, moves     - Show last 5 moves
 *   l, logs      - Show last 10 logs
 *   b, board     - Toggle board display
 *   h, help      - Show commands
 *   q, quit      - Exit
 */

import { parse } from "https://deno.land/std@0.208.0/flags/mod.ts";
import { TextLineStream } from "https://deno.land/std@0.208.0/streams/text_line_stream.ts";

// ANSI color codes for terminal output
const COLORS = {
    reset: '\x1b[0m',
    blue: '\x1b[94m',      // Bright blue for Player 1
    red: '\x1b[91m',       // Bright red for Player 2
    bold: '\x1b[1m',
    dim: '\x1b[2m',
};

// Board configuration for R=5
const BOARD_CONFIG = {
    R: 5,                          // Map radius
    monoSpace: 8,                  // Space between hex centers in same row (chars) - matches BOARD_DOT
    rowShift: 4,                   // Horizontal shift between adjacent rows (chars)
    baseCol: 1,                    // Starting column for leftmost hex in widest row
};

// Board template for ASCII rendering (R=5, 21 lines, 91 hexes)
// Matches BOARD_DOT in game.js
const BOARD_DOT = [
  `                     .`,
  `                 .       .`,
  `             .       .       .`,
  `         .       .       .       .`,
  `     .       .       .       .       .`,
  ` .       .       .       .       .       .`,
  `     .       .       .       .       .`,
  ` .       .       .       .       .       .`,
  `     .       .       .       .       .`,
  ` .       .       .       .       .       .`,
  `     .       .       .       .       .`,
  ` .       .       .       .       .       .`,
  `     .       .       .       .       .`,
  ` .       .       .       .       .       .`,
  `     .       .       .       .       .`,
  ` .       .       .       .       .       .`,
  `     .       .       .       .       .`,
  `         .       .       .       .`,
  `             .       .       .`,
  `                 .       .`,
  `                     .`,
].join('\n');

/**
 * Calculate hex positions algorithmically based on BOARD_DOT pattern
 *
 * The hex IDs in game.js are assigned by axial coordinate iteration:
 * for q from -R to +R:
 *   for r from -R to +R:
 *     if s (-q-r) is also in range, assign next hex ID
 *
 * This creates a specific visual pattern where hex IDs don't follow simple row order.
 * For R=5: 21 rows, 91 hexes (IDs 0-90)
 * Column spacing: 8 chars between hex centers
 */
function calculateHexPositions(): Record<number, { row: number, col: number }> {
    const positions: Record<number, { row: number, col: number }> = {};
    const R = BOARD_CONFIG.R;

    // Generate hex grid using the same axial coordinate algorithm as game.js
    const hexGrid: Array<{ id: number; q: number; r: number; s: number }> = [];
    let id = 0;
    for (let q = -R; q <= R; q++) {
        for (let r = -R; r <= R; r++) {
            const s = -q - r;
            if (s >= -R && s <= R) {
                hexGrid.push({ id, q, r, s });
                id++;
            }
        }
    }

    // Map hex IDs to visual rows based on axial coordinates
    // Visual row is determined by the pixel Y position: y = HEX_HEIGHT * (r + q / 2)
    // Hexes with the same (r + q/2) value are on the same visual row
    // We group by (2*r + q) to avoid floating point, then sort
    const rowMap = new Map<number, number[]>();
    for (const hex of hexGrid) {
        const visualRowKey = 2 * hex.r + hex.q;
        if (!rowMap.has(visualRowKey)) {
            rowMap.set(visualRowKey, []);
        }
        rowMap.get(visualRowKey)!.push(hex.id);
    }

    // Sort rows by visual row key (top to bottom)
    const sortedRowKeys = Array.from(rowMap.keys()).sort((a, b) => b - a);

    // Build rowHexIds array from sorted rows
    const rowHexIds: Array<number[]> = sortedRowKeys.map(key => {
        const hexIds = rowMap.get(key)!;
        // Sort hexes within each row by column (right to left for rendering)
        return hexIds.sort((a, b) => {
            const hexA = hexGrid.find(h => h.id === a)!;
            const hexB = hexGrid.find(h => h.id === b)!;
            return hexB.q - hexA.q;
        });
    });

    // Calculate board dimensions dynamically based on R
    // Visual row keys range from -2R to +2R, so total rows = 4R + 1
    const totalRows = rowHexIds.length;
    const maxHexId = R === 5 ? 90 : (2 * R + 1) * (2 * R + 1) - 1; // Max hex ID for this R

    // Calculate maxCol based on the widest row
    // For the staggered hex layout, max hexes in a visual row = R + 1
    // maxCol = baseCol + (maxHexesInRow - 1) * monoSpace
    const maxHexesInRow = R + 1;
    const maxCol = BOARD_CONFIG.baseCol + (maxHexesInRow - 1) * BOARD_CONFIG.monoSpace;

    for (let row = 0; row < rowHexIds.length; row++) {
        const hexIds = rowHexIds[row];
        const validHexIds = hexIds.filter(id => id <= maxHexId);

        if (validHexIds.length > 0) {
            // Calculate start column based on number of hexes in this row
            // Center the hexes in the row based on maxCol
            const numHexes = validHexIds.length;
            const rowWidth = (numHexes - 1) * BOARD_CONFIG.monoSpace;
            const startCol = BOARD_CONFIG.baseCol + (maxCol - BOARD_CONFIG.baseCol - rowWidth) / 2;

            for (let i = 0; i < validHexIds.length; i++) {
                const hexId = validHexIds[i];
                const col = startCol + i * BOARD_CONFIG.monoSpace;
                positions[hexId] = { row, col };
            }
        }
    }

    return positions;
}

// Generate hex positions
const HEX_POSITIONS = calculateHexPositions();

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
  b, board           - Toggle board display
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
    private gameState: Map<number, { value: number; playerId: number; isDeath: boolean }> = new Map();
    private showBoard: boolean = true;

    constructor(data: ReplayData) {
        this.data = data;
    }

    static async load(filePath: string): Promise<ReplayViewer> {
        try {
            const content = await Deno.readTextFile(filePath);
            const data = JSON.parse(content) as ReplayData;
            return new ReplayViewer(data);
        } catch (e) {
            throw new Error(`Failed to load or parse replay file: ${e}`);
        }
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

    /**
     * Reconstruct game state from state hash at current turn
     */
    reconstructGameState() {
        this.gameState = new Map();

        if (this.currentTurnIdx >= 0 && this.currentTurnIdx < this.currentGame.moves.length) {
            const move = this.currentGame.moves[this.currentTurnIdx];
            try {
                const state = JSON.parse(atob(move.stateHash));

                // Parse playersDice (format: p0Dice:val-hex-death|...;p1Dice:val-hex-death|...)
                if (state.playersDice) {
                    const players = state.playersDice.split(';');
                    players.forEach((playerStr: string) => {
                        const [pLabel, diceStr] = playerStr.split(':');
                        const playerId = parseInt(pLabel.replace('p', '').replace('Dice', ''), 10);
                        
                        if (diceStr) {
                            diceStr.split('|').forEach((entry: string) => {
                                if (entry) {
                                    const [value, hexId, isDeath] = entry.split('-');
                                    this.gameState.set(parseInt(hexId, 10), {
                                        value: parseInt(value, 10),
                                        playerId: playerId,
                                        isDeath: isDeath === 'true',
                                    });
                                }
                            });
                        }
                    });
                }
            } catch (e) {
                // Failed to parse state, show empty board
            }
        }
    }

    /**
     * Render ASCII board with current unit positions (with ANSI colors)
     */
    renderBoard(): string {
        const boardLines = BOARD_DOT.split('\n');
        const result: string[] = [];

        // Build a map of positions to units (with colors)
        const unitAtPosition: Map<string, { display: string; colored: string }> = new Map();
        for (const [hexId, unit] of this.gameState.entries()) {
            if (unit.isDeath) continue;
            const pos = HEX_POSITIONS[hexId];
            if (pos) {
                const key = `${pos.row},${pos.col}`;
                const display = unit.playerId === 0 ? `B${unit.value}` : `R${unit.value}`;
                const color = unit.playerId === 0 ? COLORS.blue : COLORS.red;
                const colored = `${color}${display}${COLORS.reset}`;
                unitAtPosition.set(key, { display, colored });
            }
        }

        // Render each line, replacing hex positions with colored unit markers
        for (let row = 0; row < boardLines.length; row++) {
            let line = boardLines[row];

            // Sort positions by column (right to left) to avoid offset issues when replacing
            const positionsInRow = Array.from(unitAtPosition.entries())
                .filter(([posKey]) => posKey.startsWith(`${row},`))
                .sort((a, b) => {
                    const colA = parseInt(a[0].split(',')[1]);
                    const colB = parseInt(b[0].split(',')[1]);
                    return colB - colA; // Right to left
                });

            for (const [posKey, unit] of positionsInRow) {
                const c = parseInt(posKey.split(',')[1]);
                if (c < line.length - 2) {
                    // Replace 3 chars at position with colored unit marker
                    const before = line.substring(0, c);
                    const after = line.substring(c + 3);
                    // Pad colored display to maintain alignment (color codes don't count for display width)
                    const padding = Math.max(0, 3 - unit.display.length);
                    line = before + unit.colored + ' '.repeat(padding) + after;
                }
            }
            result.push(line);
        }

        return result.join('\n');
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
        console.log("\n");
        console.log("╔════════════════════════════════════════╗");
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

        // Reconstruct and render board
        if (this.showBoard) {
            this.reconstructGameState();
            const board = this.renderBoard();

            console.log("\n");
            console.log("╔════════════════════════════════════════╗");
            console.log(`║  Game ${game.gameNumber}/${this.data.games.length}  Turn ${this.currentTurnIdx}/${game.totalTurns}`);
            console.log("╚════════════════════════════════════════╝");

            // Show board
            console.log("\n" + board);

            // Legend with colors
            console.log(`\nLegend: ${COLORS.blue}B1-B6${COLORS.reset} = Player 1 (Blue), ${COLORS.red}R1-R6${COLORS.reset} = Player 2 (Red)`);
        } else {
            console.log("\n");
            console.log("╔════════════════════════════════════════╗");
            console.log(`║  Game ${game.gameNumber}/${this.data.games.length}  Turn ${this.currentTurnIdx}/${game.totalTurns}`);
            console.log("╚════════════════════════════════════════╝");
        }

        if (move) {
            const playerColor = move.player === 0 ? COLORS.blue : COLORS.red;
            console.log(`\n${playerColor}Player: P${move.player + 1}${COLORS.reset} (${move.aiType})`);
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
        console.log("  b, board      - Toggle board display");
        console.log("  f, final      - Jump to game end");
        console.log("  0, start      - Jump to game start");
        console.log("  stats         - Show full statistics");
        console.log("  h, help       - Show commands");
        console.log("  q, quit       - Exit");
    }

    async runInteractive() {
        console.log("\n");
        console.log("╔════════════════════════════════════════╗");
        console.log("║     Hex Dice Replay Viewer             ║");
        console.log("╚════════════════════════════════════════╝");
        console.log(`Loaded: ${this.data.metadata.games} games`);
        console.log(`P1 (${this.data.metadata.aiTypes[0]}) vs P2 (${this.data.metadata.aiTypes[1]})`);
        console.log("\nType 'help' for commands (keys: n, p, b, s, q, ...)\n");

        // Go to specified game/turn if provided
        if (args.game) {
            const gameNum = parseInt(args.game as string, 10);
            if (this.goToGame(gameNum)) {
                console.log(`Jumped to Game ${gameNum}`);
            }
        }
        if (args.turn) {
            const turnNum = parseInt(args.turn as string, 10);
            if (this.goToTurn(turnNum)) {
                console.log(`Jumped to Turn ${turnNum}`);
            }
        }

        this.showCurrentState();

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        
        while (true) {
            await Deno.stdout.write(encoder.encode("\n> "));
            
            Deno.stdin.setRaw(true);
            const buffer = new Uint8Array(1024);
            const nread = await Deno.stdin.read(buffer);
            Deno.stdin.setRaw(false);

            if (nread === null) break;
            
            const input = decoder.decode(buffer.subarray(0, nread)).trim();
            if (!input) continue;

            // Handle Ctrl+C (ETX)
            if (buffer[0] === 3) {
                console.log("\nGoodbye!");
                return;
            }

            const parts = input.split(/\s+/);
            let cmd = parts[0];
            let arg = parts[1];

            // If it's a single character command that might need an argument but didn't get one
            // or if we want to allow multi-character commands to work via raw mode (they won't unless pasted)
            // Most users will type 'n', 'p', 'b', 's', 'q'
            
            // Special handling for commands that need more input (g, t)
            if ((cmd === "g" || cmd === "t" || cmd === "game" || cmd === "turn") && !arg) {
                await Deno.stdout.write(encoder.encode(cmd + " "));
                const line = await this.readLine();
                if (line) arg = line.trim();
            }

            switch (cmd) {
                case "n":
                case "next":
                    if (this.nextMove()) {
                        this.showCurrentState();
                    } else {
                        console.log("\nAlready at end of game");
                    }
                    break;

                case "p":
                case "prev":
                case "previous":
                    if (this.prevMove()) {
                        this.showCurrentState();
                    } else {
                        console.log("\nAlready at start");
                    }
                    break;

                case "g":
                case "game":
                    if (arg) {
                        const gameNum = parseInt(arg);
                        if (this.goToGame(gameNum)) {
                            console.log(`\nJumped to Game ${gameNum}`);
                            this.showCurrentState();
                        } else {
                            console.log(`\nGame ${gameNum} not found`);
                        }
                    } else {
                        console.log(`\nCurrent: Game ${this.currentGame.gameNumber}`);
                    }
                    break;

                case "t":
                case "turn":
                    if (arg) {
                        const turnNum = parseInt(arg);
                        if (this.goToTurn(turnNum)) {
                            console.log(`\nJumped to Turn ${turnNum}`);
                            this.showCurrentState();
                        } else {
                            console.log(`\nTurn ${turnNum} out of range (0-${this.currentGame.moves.length - 1})`);
                        }
                    } else {
                        console.log(`\nCurrent: Turn ${this.currentTurnIdx}`);
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

                case "b":
                case "board":
                    this.showBoard = !this.showBoard;
                    console.log(`\nBoard display: ${this.showBoard ? 'ON' : 'OFF'}`);
                    this.showCurrentState();
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
                    console.log("\nGoodbye!");
                    return;

                default:
                    console.log(`\nUnknown command: ${cmd}. Type 'help' for commands.`);
            }
        }
    }

    private async readLine(): Promise<string | null> {
        const buffer = new Uint8Array(1024);
        const n = await Deno.stdin.read(buffer);
        if (n === null) return null;
        return new TextDecoder().decode(buffer.subarray(0, n));
    }
}

// Main
const replayFile = Deno.args[0];

if (!replayFile) {
    console.error("Error: No replay file specified");
    Deno.exit(1);
}

try {
    const viewer = await ReplayViewer.load(replayFile);

    if (args.stats) {
        viewer.showStats();
    } else {
        await viewer.runInteractive();
    }
} catch (error) {
    console.error(error.message || `Error loading replay: ${error}`);
    Deno.exit(1);
}
