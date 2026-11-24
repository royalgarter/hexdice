// Elo for online rooms. Game-agnostic: a match is two accounts, a winner (or null for a draw) and a mode label.

export const ELO_START = 1500;
export const K_NEW = 40; // first games move faster so new accounts settle
export const K_SETTLED = 32;
export const NEW_PLAYER_GAMES = 20;
export const PAIR_CAP = 3; // rated games per pair inside the window; beyond that the game is played but unrated
export const PAIR_WINDOW_MS = 24 * 3600 * 1000;
const OPPONENT_HISTORY = 20;

export interface RatingDoc {
	_key: string;
	name: string;
	elo: number;
	games: number;
	wins: number;
	losses: number;
	draws: number;
	lastOpponents: { id: string; at: string }[];
	updatedAt: string;
}

export interface MatchPlayer { id: string; name: string }

export interface MatchResult {
	rated: boolean;
	reason?: string;
	deltas?: Record<string, number>;
}

export function expectedScore(own: number, other: number): number {
	return 1 / (1 + Math.pow(10, (other - own) / 400));
}

export function kFactor(games: number): number {
	return games < NEW_PLAYER_GAMES ? K_NEW : K_SETTLED;
}

// score: 1 win, 0.5 draw, 0 loss
export function eloDelta(own: number, other: number, score: number, games: number): number {
	return Math.round(kFactor(games) * (score - expectedScore(own, other)));
}

const blank = (id: string, name: string, now: string): RatingDoc => ({
	_key: id, name, elo: ELO_START, games: 0, wins: 0, losses: 0, draws: 0, lastOpponents: [], updatedAt: now,
});

export async function getRating(db: any, id: string): Promise<RatingDoc | null> {
	try {
		return await db.collection("ratings").document(id);
	} catch (e: any) {
		if (e?.code === 404 || /not found/i.test(e?.message ?? "")) return null;
		throw e;
	}
}

async function writeRating(db: any, doc: RatingDoc, existed: boolean) {
	const coll = db.collection("ratings");
	if (existed) await coll.update(doc._key, doc);
	else await coll.save(doc);
}

const cleanName = (n: unknown) => (typeof n === "string" ? n.trim().slice(0, 40) : "") || "Player";

/**
 * Applies one finished two-player match. Idempotent per roomId: the `matches` document keyed by the room id is the claim,
 * a second call for the same room returns { rated: false, reason: "already finalized" } without touching ratings.
 */
export async function rateMatch(
	db: any,
	args: { roomId: string; mode: string; players: [MatchPlayer, MatchPlayer]; winnerId: string | null; now?: Date },
): Promise<MatchResult> {
	const { roomId, mode, players, winnerId } = args;
	const now = (args.now ?? new Date()).toISOString();
	const nowMs = Date.parse(now);
	const [a, b] = players;
	if (a.id === b.id) return { rated: false, reason: "same account" };

	const ra = await getRating(db, a.id);
	const rb = await getRating(db, b.id);
	const docA = ra ?? blank(a.id, cleanName(a.name), now);
	const docB = rb ?? blank(b.id, cleanName(b.name), now);

	const recent = (doc: RatingDoc, opp: string) =>
		doc.lastOpponents.filter((o) => o.id === opp && nowMs - Date.parse(o.at) < PAIR_WINDOW_MS).length;
	const capped = recent(docA, b.id) >= PAIR_CAP || recent(docB, a.id) >= PAIR_CAP;

	const matchDoc: any = { _key: roomId, mode, players: [a.id, b.id], winnerId, createdAt: now, rated: !capped };
	if (capped) matchDoc.reason = "pair cap";
	try {
		await db.collection("matches").save(matchDoc);
	} catch (e: any) {
		if (e?.code === 409) return { rated: false, reason: "already finalized" };
		throw e;
	}
	if (capped) return { rated: false, reason: "pair cap" };

	const scoreA = winnerId === null ? 0.5 : winnerId === a.id ? 1 : 0;
	const dA = eloDelta(docA.elo, docB.elo, scoreA, docA.games);
	const dB = eloDelta(docB.elo, docA.elo, 1 - scoreA, docB.games);

	const apply = (doc: RatingDoc, opp: MatchPlayer, delta: number, score: number, name: string) => {
		doc.name = cleanName(name);
		doc.elo += delta;
		doc.games++;
		if (score === 1) doc.wins++;
		else if (score === 0) doc.losses++;
		else doc.draws++;
		doc.lastOpponents = [...doc.lastOpponents, { id: opp.id, at: now }].slice(-OPPONENT_HISTORY);
		doc.updatedAt = now;
	};
	apply(docA, b, dA, scoreA, a.name);
	apply(docB, a, dB, 1 - scoreA, b.name);
	await writeRating(db, docA, !!ra);
	await writeRating(db, docB, !!rb);
	return { rated: true, deltas: { [a.id]: dA, [b.id]: dB } };
}
