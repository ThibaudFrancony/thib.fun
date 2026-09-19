import "server-only";

import { getHistory } from "@/server/matches/repository";
import { toHistoryListItem, type HistoryListItem } from "./history-helpers";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type HistoryPage = { entries: HistoryListItem[]; nextCursor: string | null };

export type ProfileHistoryPage = HistoryPage;

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
 * Historique d'un membre, affiché uniquement en prévisualisation dans le
 * profil (aucune page de détail) : le visiteur voit les mêmes cartes, qu'il
 * ait participé ou non à la partie.
 */
export async function getProfileHistoryPage(targetId: string, options: { cursor?: string; game?: string; outcome?: string } = {}): Promise<ProfileHistoryPage> {
  const page = await getHistory(targetId, options);
  return { entries: page.entries.map(toHistoryListItem), nextCursor: page.nextCursor };
}
