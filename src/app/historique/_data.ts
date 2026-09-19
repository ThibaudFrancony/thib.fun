import "server-only";

import {
  getHistory,
  getHistoryEntry,
  getMatchSnapshot,
  type HistoryEntry,
} from "@/server/matches/repository";
import { toHistoryListItem, viewerParticipates, type HistoryListItem, type ProfileHistoryListItem } from "./history-helpers";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
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
  "superseded",
  "worker_unreachable",
]);

export type HistoryPage = { entries: HistoryListItem[]; nextCursor: string | null };

export type ProfileHistoryPage = { entries: ProfileHistoryListItem[]; nextCursor: string | null };

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeString(value: unknown, maximum = 240): string | null {
  return typeof value === "string" && value.length <= maximum ? value : null;
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

/**
 * Historique d'un autre membre : l'appelant précise qui regarde pour marquer
 * les parties où il a réellement joué. Le détail d'une partie reste réservé
 * aux participants côté page.
 */
export async function getProfileHistoryPage(viewerId: string, targetId: string, options: { cursor?: string; game?: string; outcome?: string } = {}): Promise<ProfileHistoryPage> {
  const page = await getHistory(targetId, options);
  return {
    entries: page.entries.map((entry) => ({
      ...toHistoryListItem(entry),
      viewerIsParticipant: viewerId === targetId || viewerParticipates(entry, viewerId),
    })),
    nextCursor: page.nextCursor,
  };
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


