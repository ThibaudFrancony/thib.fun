import "server-only";

import { createAdminClient } from "@/server/supabase/admin";
import {
  getHistory,
  getHistoryEntry,
  getMatchSnapshot,
  getPairHistory,
  type HistoryEntry,
} from "@/server/matches/repository";
import { opponentPseudoFromPayload, toHistoryListItem, type HistoryListItem } from "./history-helpers";

export const HISTORY_PAGE_SIZE = 20;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const HISTORY_OUTCOMES = new Set(["win", "loss", "draw", "cooperative", "abandoned"]);
const HISTORY_REASONS = new Set([
  "normal",
  "round_limit",
  "turn_limit",
  "blocked",
  "dictionary_exhausted",
  "resign",
  "claimed_forfeit",
  "absence",
  "judging_unavailable",
  "technical_error",
]);

export type HistoryPage = { entries: HistoryListItem[]; nextCursor: string | null };

export type CompatibilityHistoryRound = {
  kind: "compatibilite";
  questionId: string;
  prompt: string;
  options: { id: string; label: string }[];
  choices: [string, string];
  isMatch: boolean;
};

export type LongueurOndeHistoryRound = {
  kind: "longueur-onde";
  round: number;
  leftLabel: string;
  rightLabel: string;
  clueSeat: 0 | 1;
  guessSeat: 0 | 1;
  clue: string | null;
  target: number;
  guess: number | null;
  error: number | null;
  points: number;
  missedReason: string | null;
};

export type SkyjoHistoryRound = {
  kind: "skyjo";
  round: number;
  triggerSeat: 0 | 1 | null;
  raw: [number, number];
  final: [number, number];
  penalizedSeat: 0 | 1 | null;
  clears: number;
  turns: number;
  cumulativeAfter: [number, number];
};

export type HistoryRoundResult = CompatibilityHistoryRound | LongueurOndeHistoryRound | SkyjoHistoryRound;

export type HistoryDetail = {
  entry: HistoryListItem;
  reason: string;
  rulesVersion: string | null;
  engineVersion: string | null;
  stateSchemaVersion: number | null;
  roundResults: HistoryRoundResult[];
  roundResultsAvailable: boolean;
};

export type PairAggregate = {
  gameSlug: string;
  played: number;
  myWins: number;
  opponentWins: number;
  draws: number;
  cooperative: number;
  abandoned: number;
  metrics: Record<string, unknown>;
};

export type PairHistoryPage = {
  opponentId: string;
  opponentPseudo: string;
  stats: PairAggregate[];
  entries: HistoryListItem[];
  nextCursor: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeString(value: unknown, maximum = 240): string | null {
  return typeof value === "string" && value.length <= maximum ? value : null;
}

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeInteger(value: unknown, minimum = 0): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum ? value : null;
}

function safeSeat(value: unknown): 0 | 1 | null {
  return value === 0 || value === 1 ? value : null;
}

function safeTuple(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const first = safeInteger(value[0]);
  const second = safeInteger(value[1]);
  return first === null || second === null ? null : [first, second];
}

function safeMetrics(value: unknown, depth = 0): Record<string, unknown> {
  if (!isRecord(value) || depth > 2) return {};
  const result: Record<string, unknown> = {};
  for (const [key, candidate] of Object.entries(value).slice(0, 32)) {
    if (!/^[a-zA-Z0-9_.-]{1,80}$/u.test(key)) continue;
    if (candidate === null || typeof candidate === "boolean" || typeof candidate === "string" && candidate.length <= 160 || typeof candidate === "number" && Number.isFinite(candidate)) {
      result[key] = candidate;
    } else if (Array.isArray(candidate) && candidate.length <= 20 && candidate.every((item) => typeof item === "number" && Number.isFinite(item))) {
      result[key] = candidate;
    } else if (isRecord(candidate)) {
      result[key] = safeMetrics(candidate, depth + 1);
    }
  }
  return result;
}

function mapHistoryRow(row: Record<string, unknown>): HistoryEntry | null {
  const matchId = safeString(row.match_id, 80);
  const opponentId = safeString(row.opponent_id, 80);
  const gameSlug = safeString(row.game_slug, 80);
  const startedAt = safeString(row.started_at, 80);
  const endedAt = safeString(row.ended_at, 80);
  const outcome = safeString(row.outcome, 30);
  if (!matchId || !opponentId || !gameSlug || !startedAt || !endedAt || !outcome || !HISTORY_OUTCOMES.has(outcome)) return null;
  const numeric = (value: unknown): number | null => value === null || value === undefined ? null : safeNumber(value);
  return {
    matchId,
    opponentId,
    gameSlug,
    startedAt,
    endedAt,
    outcome: outcome as HistoryEntry["outcome"],
    score: numeric(row.score),
    opponentScore: numeric(row.opponent_score),
    sharedScore: numeric(row.shared_score),
    payload: isRecord(row.payload) ? row.payload : {},
  };
}

function encodeHistoryCursor(entry: Pick<HistoryEntry, "endedAt" | "matchId">): string {
  return Buffer.from(JSON.stringify({ endedAt: entry.endedAt, matchId: entry.matchId }), "utf8").toString("base64url");
}

export function decodeHistoryCursor(cursor: string | undefined): { endedAt: string; matchId: string } | null {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { endedAt?: unknown; matchId?: unknown };
    if (typeof value.endedAt !== "string" || !Number.isFinite(Date.parse(value.endedAt)) || typeof value.matchId !== "string" || !UUID_PATTERN.test(value.matchId)) return null;
    return { endedAt: value.endedAt, matchId: value.matchId };
  } catch {
    return null;
  }
}

export function isValidHistoryCursor(cursor: string | undefined): boolean {
  return cursor === undefined || decodeHistoryCursor(cursor) !== null;
}

export async function getHistoryPage(actorId: string, options: { cursor?: string; game?: string; outcome?: string } = {}): Promise<HistoryPage> {
  const page = await getHistory(actorId, options);
  return { entries: page.entries.map(toHistoryListItem), nextCursor: page.nextCursor };
}

function compatibilityRound(value: unknown): CompatibilityHistoryRound | null {
  if (!isRecord(value)) return null;
  const questionId = safeString(value.questionId, 120);
  const prompt = safeString(value.prompt, 240);
  const options = Array.isArray(value.options)
    ? value.options.flatMap((option) => {
        if (!isRecord(option)) return [];
        const id = safeString(option.id, 40);
        const label = safeString(option.label, 100);
        return id && label ? [{ id, label }] : [];
      })
    : [];
  const choices = Array.isArray(value.choices) && value.choices.length === 2 && typeof value.choices[0] === "string" && typeof value.choices[1] === "string"
    ? [value.choices[0], value.choices[1]] as [string, string]
    : null;
  return questionId && prompt && options.length >= 2 && choices && typeof value.isMatch === "boolean"
    ? { kind: "compatibilite", questionId, prompt, options, choices, isMatch: value.isMatch }
    : null;
}

function longueurOndeRound(value: unknown): LongueurOndeHistoryRound | null {
  if (!isRecord(value)) return null;
  const round = safeInteger(value.round, 1);
  const leftLabel = safeString(value.leftLabel, 60);
  const rightLabel = safeString(value.rightLabel, 60);
  const clueSeat = safeSeat(value.clueSeat);
  const guessSeat = safeSeat(value.guessSeat);
  const target = safeInteger(value.target);
  const points = safeInteger(value.points);
  if (round === null || !leftLabel || !rightLabel || clueSeat === null || guessSeat === null || target === null || target > 100 || points === null || points > 4) return null;
  const clue = value.clue === null ? null : safeString(value.clue, 120);
  const guess = value.guess === null ? null : safeInteger(value.guess);
  const error = value.error === null ? null : safeInteger(value.error);
  const missedReason = value.missedReason === null ? null : safeString(value.missedReason, 40);
  if (value.clue !== null && clue === null || value.guess !== null && guess === null || value.error !== null && error === null || value.missedReason !== null && missedReason === null) return null;
  return { kind: "longueur-onde", round, leftLabel, rightLabel, clueSeat, guessSeat, clue, target, guess, error, points, missedReason };
}

function skyjoRound(value: unknown): SkyjoHistoryRound | null {
  if (!isRecord(value)) return null;
  const round = safeInteger(value.round, 1);
  const raw = safeTuple(value.raw);
  const final = safeTuple(value.final);
  const cumulativeAfter = safeTuple(value.cumulativeAfter);
  const triggerSeat = value.triggerSeat === null ? null : safeSeat(value.triggerSeat);
  const penalizedSeat = value.penalizedSeat === null ? null : safeSeat(value.penalizedSeat);
  const clears = safeInteger(value.clears);
  const turns = safeInteger(value.turns);
  if (round === null || !raw || !final || !cumulativeAfter || triggerSeat === null && value.triggerSeat !== null || penalizedSeat === null && value.penalizedSeat !== null || clears === null || turns === null) return null;
  return { kind: "skyjo", round, triggerSeat, raw, final, penalizedSeat, clears, turns, cumulativeAfter };
}

function extractRoundResults(gameSlug: string, view: unknown): HistoryRoundResult[] {
  if (!isRecord(view)) return [];
  const result = isRecord(view.result) ? view.result : null;
  if (gameSlug === "compatibilite" && result && Array.isArray(result.rounds)) return result.rounds.flatMap((round) => { const safe = compatibilityRound(round); return safe ? [safe] : []; });
  if (gameSlug === "longueur-onde" && result && Array.isArray(result.rounds)) return result.rounds.flatMap((round) => { const safe = longueurOndeRound(round); return safe ? [safe] : []; });
  if (gameSlug === "skyjo" && view.roundSummary) {
    const safe = skyjoRound(view.roundSummary);
    return safe ? [safe] : [];
  }
  return [];
}

function resultReason(entry: HistoryEntry): string {
  const reason = safeString(entry.payload.reason, 40);
  return reason && HISTORY_REASONS.has(reason) ? reason : entry.outcome === "abandoned" ? "absence" : "normal";
}

export async function getHistoryDetail(actorId: string, matchId: string): Promise<HistoryDetail | null> {
  const entry = await getHistoryEntry(actorId, matchId);
  if (!entry) return null;
  let snapshot: Awaited<ReturnType<typeof getMatchSnapshot>> | null = null;
  try {
    snapshot = await getMatchSnapshot(actorId, matchId);
  } catch {
    // L'entrée reste consultable si la vue de partie a déjà été purgée ;
    // aucune lecture directe d'une table privée ne sert de secours.
  }
  const roundResults = snapshot ? extractRoundResults(entry.gameSlug, snapshot.view) : [];
  return {
    entry: toHistoryListItem(entry),
    reason: resultReason(entry),
    rulesVersion: snapshot?.rulesVersion ?? null,
    engineVersion: snapshot?.engineVersion ?? null,
    stateSchemaVersion: snapshot?.stateSchemaVersion ?? null,
    roundResults,
    roundResultsAvailable: roundResults.length > 0,
  };
}

function pairAggregate(value: unknown, actorId: string, opponentId: string): PairAggregate | null {
  if (!isRecord(value)) return null;
  const gameSlug = safeString(value.game_slug, 80);
  const playerLow = safeString(value.player_low, 80);
  const playerHigh = safeString(value.player_high, 80);
  const played = safeInteger(value.played);
  const lowWins = safeInteger(value.low_wins);
  const highWins = safeInteger(value.high_wins);
  const draws = safeInteger(value.draws);
  const cooperative = safeInteger(value.cooperative);
  const abandoned = safeInteger(value.abandoned);
  if (!gameSlug || !playerLow || !playerHigh || played === null || lowWins === null || highWins === null || draws === null || cooperative === null || abandoned === null) return null;
  const actorIsLow = playerLow === actorId && playerHigh === opponentId;
  const actorIsHigh = playerHigh === actorId && playerLow === opponentId;
  if (!actorIsLow && !actorIsHigh) return null;
  return {
    gameSlug,
    played,
    myWins: actorIsLow ? lowWins : highWins,
    opponentWins: actorIsLow ? highWins : lowWins,
    draws,
    cooperative,
    abandoned,
    metrics: safeMetrics(value.metrics),
  };
}

function pairStats(value: unknown, actorId: string, opponentId: string): PairAggregate[] {
  const rows = isRecord(value) && Array.isArray(value.games) ? value.games : value ? [value] : [];
  return rows.flatMap((row) => {
    const aggregate = pairAggregate(row, actorId, opponentId);
    return aggregate ? [aggregate] : [];
  });
}

export async function getPairHistoryPage(actorId: string, opponentId: string, options: { cursor?: string; game?: string } = {}): Promise<PairHistoryPage> {
  const client = createAdminClient();
  let query = client
    .from("history_entries")
    .select("match_id,opponent_id,game_slug,started_at,ended_at,outcome,score,opponent_score,shared_score,payload")
    .eq("viewer_id", actorId)
    .eq("opponent_id", opponentId)
    .order("ended_at", { ascending: false })
    .order("match_id", { ascending: false })
    .limit(HISTORY_PAGE_SIZE + 1);
  if (options.game) query = query.eq("game_slug", options.game);
  const cursor = decodeHistoryCursor(options.cursor);
  if (cursor) query = query.or(`ended_at.lt.${cursor.endedAt},and(ended_at.eq.${cursor.endedAt},match_id.lt.${cursor.matchId})`);
  const response = await query;
  if (response.error) throw new Error("HISTORY_UNAVAILABLE");
  const rows = (response.data ?? []) as unknown as Record<string, unknown>[];
  const rawEntries = rows.flatMap((row) => { const entry = mapHistoryRow(row); return entry ? [entry] : []; });
  const entries = rawEntries.slice(0, HISTORY_PAGE_SIZE).map(toHistoryListItem);
  const pair = await getPairHistory(actorId, opponentId, options.game);
  return {
    opponentId,
    opponentPseudo: entries[0]?.opponentPseudo ?? (pair.entries[0] ? opponentPseudoFromPayload(pair.entries[0]) : "Partenaire"),
    stats: pairStats(pair.stats, actorId, opponentId),
    entries,
    nextCursor: rows.length > HISTORY_PAGE_SIZE && entries.length > 0 ? encodeHistoryCursor(rawEntries[HISTORY_PAGE_SIZE - 1]!) : null,
  };
}
