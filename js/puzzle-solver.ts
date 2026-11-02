/**
 * Hex Dice puzzle solver — proves "player 0 wins within N own moves" against every defence.
 *
 * Scope (v1): V1 Decisive rules (deterministic), 2 players. Excluded from the move set:
 * SPELLCAST_SACRIFICE (mutates unit value/stats, not covered by the snapshot) and MERGE (disabled in the move generator).
 * The defender may also pass (END_TURN), because the manual End Turn button makes passing legal.
 */

export interface PuzzleMove {
	actionType: string;
	unitHexId?: number;
	targetHexId?: number;
}

export interface SolveResult {
	win: boolean;
	winningFirstMoves: PuzzleMove[];
	nodes: number;
	/** true when maxNodes was hit; `win`/`winningFirstMoves` are then unreliable */
	aborted: boolean;
}

class BudgetExceeded extends Error {}

const DEFENDER_PASS: PuzzleMove = { actionType: 'END_TURN' };

export function solvePuzzle(engine: any, game: any, n: number, maxNodes = Infinity): SolveResult {
	const attacker = game.currentPlayerIndex;
	const table = new Map<string, boolean>();
	let nodes = 0;

	// Silence engine chatter and stop log/replay buffers growing across millions of nodes.
	const originalLog = console.log;
	game.addLog = () => {};
	game.recordAction = () => {};

	const stateKey = (movesLeft: number): string => {
		const units: string[] = [];
		game.players.forEach((p: any) => p.dice.forEach((d: any) => {
			if (!d.isDeath) units.push(`${d.id}:${d.hexId}:${d.value}:${d.isGuarding}:${d.skirmishBuff}`);
		}));
		return `${game.currentPlayerIndex}|${movesLeft}|${units.join(',')}`;
	};

	// Moves are applied on the live game (real endTurn), then undone via snapshot + the fields the snapshot misses.
	const tryMove = <T>(move: PuzzleMove, then: () => T): T => {
		const snap = engine.saveSnapshot(game);
		const { turnCount, winnerPlayerId } = game;
		try {
			engine.applyMove(game, move, null);
			if (++nodes > maxNodes) throw new BudgetExceeded();
			return then();
		} finally {
			engine.restoreSnapshot(game, snap);
			game.turnCount = turnCount;
			game.winnerPlayerId = winnerPlayerId;
		}
	};

	const legalMoves = (): PuzzleMove[] =>
		engine.generateAllPossibleMoves(game, game, null).filter((m: PuzzleMove) => m.actionType !== 'SPELLCAST_SACRIFICE');

	const attackerWon = () => game.phase === 'GAME_OVER' && game.winnerPlayerId === attacker;

	// Defender to move; true if every reply still lets the attacker win within movesLeft.
	const defenderLoses = (movesLeft: number): boolean => {
		if (game.phase === 'GAME_OVER') return attackerWon();
		const key = stateKey(movesLeft);
		const cached = table.get(key);
		if (cached !== undefined) return cached;

		const replies = legalMoves();
		if (!replies.some(m => m.actionType === 'END_TURN')) replies.push(DEFENDER_PASS);
		const result = replies.every(reply => tryMove(reply, () => attackerWinsWithin(movesLeft)));
		table.set(key, result);
		return result;
	};

	// Attacker to move with movesLeft own moves available.
	const attackerWinsWithin = (movesLeft: number): boolean => {
		if (game.phase === 'GAME_OVER') return attackerWon();
		if (movesLeft === 0) return false;
		return legalMoves()
			.filter(m => m.actionType !== 'END_TURN')
			.some(move => tryMove(move, () => game.phase === 'GAME_OVER' ? attackerWon() : defenderLoses(movesLeft - 1)));
	};

	console.log = () => {};
	try {
		const winningFirstMoves = legalMoves()
			.filter(m => m.actionType !== 'END_TURN')
			.filter(move => tryMove(move, () => game.phase === 'GAME_OVER' ? attackerWon() : defenderLoses(n - 1)));
		return { win: winningFirstMoves.length > 0, winningFirstMoves, nodes, aborted: false };
	} catch (e) {
		if (e instanceof BudgetExceeded) return { win: false, winningFirstMoves: [], nodes, aborted: true };
		throw e;
	} finally {
		console.log = originalLog;
	}
}
