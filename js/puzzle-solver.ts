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
	/** moves that did not hand the turn over (should stay 0; see tests) */
	turnModelViolations: number;
	/** true when maxNodes was hit; `win`/`winningFirstMoves` are then unreliable */
	aborted: boolean;
}

class BudgetExceeded extends Error {}

const DEFENDER_PASS: PuzzleMove = { actionType: 'END_TURN' };

export interface SolveOptions {
	/** abort (result.aborted) after this many applied moves */
	maxNodes?: number;
	/** reverse move order: an independent search used to cross-check a result */
	reverseOrder?: boolean;
	/** stop the first-move scan once this many winning first moves are found (2 is enough to prove non-uniqueness) */
	stopAfter?: number;
	/** false disables the leaf/last-ply pruning; used by tests to prove pruning does not change results */
	prune?: boolean;
}

export function solvePuzzle(engine: any, game: any, n: number, opts: SolveOptions = {}): SolveResult {
	const { maxNodes = Infinity, reverseOrder = false, stopAfter = Infinity, prune = true } = opts;
	const attacker = game.currentPlayerIndex;
	const table = new Map<string, boolean>();
	let nodes = 0;
	let turnModelViolations = 0;

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
			const mover = game.currentPlayerIndex;
			engine.applyMove(game, move, null);
			if (game.phase !== 'GAME_OVER' && (game.currentPlayerIndex === mover || game.actionMode)) turnModelViolations++;
			if (++nodes > maxNodes) throw new BudgetExceeded();
			return then();
		} finally {
			engine.restoreSnapshot(game, snap);
			game.actionMode = null;
			game.turnCount = turnCount;
			game.winnerPlayerId = winnerPlayerId;
		}
	};

	const legalMoves = (): PuzzleMove[] => {
		const moves = engine.generateAllPossibleMoves(game, game, null).filter((m: PuzzleMove) => m.actionType !== 'SPELLCAST_SACRIFICE');
		return reverseOrder ? moves.reverse() : moves;
	};

	const enemyId = 1 - attacker;
	const annihilation = String(game.options || '').includes('a');
	// On the final own move only a base capture or killing the last enemy unit can win.
	const canEndGame = (m: PuzzleMove): boolean => {
		if (m.actionType !== 'MOVE' && m.actionType !== 'RANGED_ATTACK') return false;
		if (!annihilation && m.actionType === 'MOVE' && m.targetHexId === game.players[enemyId].baseHexId) return true;
		const alive = game.players[enemyId].dice.filter((d: any) => d.isDeployed && !d.isDeath).length;
		const target = game.getUnitOnHex(m.targetHexId);
		return alive === 1 && !!target && target.playerId === enemyId;
	};

	const attackerWon = () => game.phase === 'GAME_OVER' && game.winnerPlayerId === attacker;

	// Defender to move; true if every reply still lets the attacker win within movesLeft.
	const defenderLoses = (movesLeft: number): boolean => {
		if (game.phase === 'GAME_OVER') return attackerWon();
		// Attacker has no moves left and the game is not over; a V1 defender move cannot end it in the attacker's favour.
		if (prune && movesLeft === 0) return false;
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
			.filter(m => m.actionType !== 'END_TURN' && (!prune || movesLeft > 1 || canEndGame(m)))
			.some(move => tryMove(move, () => game.phase === 'GAME_OVER' ? attackerWon() : defenderLoses(movesLeft - 1)));
	};

	console.log = () => {};
	try {
		const winningFirstMoves: PuzzleMove[] = [];
		for (const move of legalMoves().filter(m => m.actionType !== 'END_TURN' && (!prune || n > 1 || canEndGame(m)))) {
			if (tryMove(move, () => game.phase === 'GAME_OVER' ? attackerWon() : defenderLoses(n - 1))) winningFirstMoves.push(move);
			if (winningFirstMoves.length >= stopAfter) break;
		}
		return { win: winningFirstMoves.length > 0, winningFirstMoves, nodes, turnModelViolations, aborted: false };
	} catch (e) {
		if (e instanceof BudgetExceeded) return { win: false, winningFirstMoves: [], nodes, turnModelViolations, aborted: true };
		throw e;
	} finally {
		console.log = originalLog;
	}
}
