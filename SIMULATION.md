# Hex Dice CLI Simulation Tools

Command-line tools for simulating and analyzing Hex Dice games with different AI strategies.

## Quick Start

```bash
# Run 10 games: random vs heuristic
deno task simulate -g=10 -t=random,heuristic

# Run 5 games: minimax vs priority (verbose)
deno task simulate -g=5 -t=minimax,priority -v

# View replay statistics
deno task replay simulations/replay_*.json --stats

# Interactive replay viewer
deno task replay simulations/replay_*.json
```

## Simulation Tool (`simulate.ts`)

### Usage

```bash
deno run --allow-all simulate.ts [options]
```

### Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--games <n>` | `-g` | 1 | Number of games to simulate |
| `--type <p1,p2>` | `-t` | random,heuristic | AI types for P1 and P2 |
| `--output <dir>` | `-o` | simulations | Output directory for logs |
| `--depth <n>` | `-d` | 3 | Minimax search depth |
| `--verbose` | `-v` | false | Show detailed move-by-move output |
| `--help` | `-h` | - | Show help message |

### Available AI Types

| Type | Description |
|------|-------------|
| `random` | Random-greedy AI - picks random unit, makes greedy move |
| `heuristic` | Priority-based AI - evaluates moves with tactical heuristics |
| `minimax` | Minimax with alpha-beta pruning - looks ahead multiple turns |
| `priority` | Rule-based priority system - attack > advance > explore > merge |

### Examples

```bash
# Single game: random vs random
deno task simulate

# 100 games for statistical analysis
deno task simulate -g=100 -t=random,heuristic -o=experiments

# Test minimax at different depths
deno task simulate -g=10 -t=minimax,minimax -d=2 -o=depth2
deno task simulate -g=10 -t=minimax,minimax -d=3 -o=depth3

# Verbose output for debugging
deno task simulate -g=1 -t=heuristic,priority -v
```

### Output Files

Two files are generated per simulation run:

1. **Replay JSON** (`replay_<timestamp>.json`)
   - Complete game state history
   - Move-by-move records with state hashes
   - Metadata and summary statistics
   - Format designed for step-by-step replay

2. **Log TXT** (`log_<timestamp>.txt`)
   - Human-readable game results
   - Winner and reason for each game

### Replay JSON Format

```json
{
  "metadata": {
    "date": "2026-04-01T06-18-27-316Z",
    "games": 3,
    "aiTypes": ["random", "heuristic"],
    "minimaxDepth": 3,
    "version": "1.0"
  },
  "games": [
    {
      "gameNumber": 1,
      "winner": 0,
      "winnerReason": "Player 2 captured Player 1's base!",
      "totalTurns": 118,
      "moves": [
        {
          "turn": 0,
          "player": 0,
          "aiType": "random",
          "actionType": "ai",
          "logMessage": "P1 (random) thinking...",
          "stateHash": "base64_encoded_state"
        }
      ]
    }
  ],
  "summary": {
    "p1Wins": 3,
    "p2Wins": 0,
    "draws": 0,
    "totalTurns": 454,
    "avgTurnsPerGame": 151.3
  }
}
```

## Replay Viewer (`replay.ts`)

Interactive tool for analyzing simulated games.

### Usage

```bash
deno run --allow-read replay.ts <replay_file.json> [options]
```

### Options

| Option | Short | Description |
|--------|-------|-------------|
| `--game <n>` | `-g` | Start at specific game number |
| `--turn <n>` | `-t` | Start at specific turn number |
| `--stats` | `-s` | Show statistics and exit |
| `--help` | `-h` | Show help message |

### Interactive Commands

| Command | Description |
|---------|-------------|
| `n`, `next` | Next move |
| `p`, `prev` | Previous move |
| `g <num>` | Go to game number |
| `t <num>` | Go to turn number |
| `s`, `state` | Show current state summary |
| `m`, `moves` | Show last 5 moves |
| `l`, `logs` | Show last 10 log messages |
| `f`, `final` | Jump to game end |
| `0`, `start` | Jump to game start |
| `stats` | Show full statistics |
| `h`, `help` | Show commands |
| `q`, `quit` | Exit |

### Examples

```bash
# View statistics only
deno task replay simulations/replay_xxx.json --stats

# Start at game 2, turn 50
deno task replay simulations/replay_xxx.json -g=2 -t=50

# Interactive analysis
deno task replay simulations/replay_xxx.json
```

## Deno Tasks

Add these to your workflow:

```json
{
  "tasks": {
    "simulate": "deno run --allow-all simulate.ts",
    "replay": "deno run --allow-read replay.ts"
  }
}
```

## Performance Notes

- **Random AI**: ~10-50ms per turn
- **Heuristic AI**: ~50-200ms per turn  
- **Minimax AI**: ~500-2000ms per turn (depth 3)
- **Priority AI**: ~20-100ms per turn

For large simulations (100+ games), use faster AI types or reduce minimax depth.

## Analysis Ideas

1. **Win Rate Analysis**: Run 100+ games to determine AI strength
2. **Turn Efficiency**: Compare average turns to victory
3. **Opening Strategies**: Analyze deployment patterns
4. **Unit Value**: Track which dice values win most often
5. **Positional Play**: Use replay viewer to study key moments

## Troubleshooting

**Game stuck in loop**: Check that AI functions are properly loaded. Run with `-v` to see detailed logs.

**Minimax too slow**: Reduce depth with `-d=2` or use heuristic AI instead.

**Replay file too large**: For long simulations, consider reducing log detail or splitting into multiple runs.
