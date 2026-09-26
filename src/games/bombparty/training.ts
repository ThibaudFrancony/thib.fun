import { normalizeBombpartyWord } from "@/games/bombparty/normalize";
import type { BombpartyContent } from "@/games/bombparty/types";

export const TRAINING_SUGGESTION_LIMIT = 20;
export const TRAINING_USED_WORD_LIMIT = 200;

/** Ignore une réponse réseau issue d'une requête ou séquence devenue obsolète. */
export function isCurrentTrainingResponse(
  requestToken: number,
  currentToken: number,
  requestSequence: string | null,
  currentSequence: string | null,
): boolean {
  return requestToken === currentToken && requestSequence === currentSequence;
}

/**
 * Le navigateur peut conserver une session d'entraînement, mais jamais une
 * liste non bornée. La normalisation est répétée ici afin que la limite porte
 * sur les mots effectivement comparés par le serveur.
 */
export function boundTrainingUsedWords(values: readonly unknown[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = normalizeBombpartyWord(value);
    if (normalized === null || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= TRAINING_USED_WORD_LIMIT) break;
  }
  return result;
}

export type TrainingCandidate = {
  display: string;
  normalized: string;
  length: number;
};

const trainingWordsById = new WeakMap<BombpartyContent, Map<string, BombpartyContent["words"][number]>>();
const trainingNormalized = new WeakMap<BombpartyContent, Set<string>>();

function trainingWordById(content: BombpartyContent): Map<string, BombpartyContent["words"][number]> {
  const cached = trainingWordsById.get(content);
  if (cached) return cached;
  const map = new Map<string, BombpartyContent["words"][number]>();
  for (const entry of content.words) map.set(entry.id, entry);
  trainingWordsById.set(content, map);
  return map;
}

function trainingNormalizedSet(content: BombpartyContent): Set<string> {
  const cached = trainingNormalized.get(content);
  if (cached) return cached;
  const set = new Set<string>();
  for (const entry of content.words) set.add(entry.normalizedForm);
  trainingNormalized.set(content, set);
  return set;
}

/** Candidats contenant la séquence, triés longueur croissante puis ordre alphabétique. */
export function trainingCandidatesFor(content: BombpartyContent, sequence: string): TrainingCandidate[] {
  const seen = new Set<string>();
  const candidates: TrainingCandidate[] = [];
  const indexed = content.bySequence[sequence];
  const entries = indexed && indexed.length > 0 ? indexed.flatMap((id) => {
    const entry = trainingWordById(content).get(id);
    return entry ? [entry] : [];
  }) : content.words;
  for (const entry of entries) {
    if (seen.has(entry.normalizedForm)) continue;
    seen.add(entry.normalizedForm);
    if (!entry.normalizedForm.includes(sequence)) continue;
    candidates.push({ display: entry.displayForm, normalized: entry.normalizedForm, length: entry.normalizedForm.length });
  }
  candidates.sort((first, second) => first.length - second.length || (first.normalized < second.normalized ? -1 : first.normalized > second.normalized ? 1 : 0));
  return candidates;
}

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), "utf8").toString("base64url");
}

function decodeCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { offset?: unknown };
    if (typeof value.offset !== "number" || !Number.isInteger(value.offset) || value.offset < 0) return 0;
    return value.offset;
  } catch {
    return 0;
  }
}

/** Pagination par curseur opaque, sans doublons entre les pages. */
export function paginateTrainingCandidates(
  candidates: readonly TrainingCandidate[],
  cursor: string | null | undefined,
  limit: number = TRAINING_SUGGESTION_LIMIT,
): { items: TrainingCandidate[]; nextCursor: string | null } {
  const offset = Math.min(decodeCursor(cursor), candidates.length);
  const items = candidates.slice(offset, offset + limit);
  const nextOffset = offset + items.length;
  return { items, nextCursor: nextOffset < candidates.length ? encodeCursor(nextOffset) : null };
}

export type TrainingCheck = { valid: true; normalized: string } | { valid: false; reason: "INVALID" | "MISSING_SEQUENCE" | "UNKNOWN" | "ALREADY_USED" };

/** Validation d'un mot d'entraînement : même normalisation stricte que la compétition. */
export function checkTrainingWord(
  content: BombpartyContent,
  sequence: string,
  rawWord: unknown,
  usedNormalized: ReadonlySet<string>,
): TrainingCheck {
  const normalized = normalizeBombpartyWord(rawWord);
  if (normalized === null) return { valid: false, reason: "INVALID" };
  if (!normalized.includes(sequence)) return { valid: false, reason: "MISSING_SEQUENCE" };
  const known = trainingNormalizedSet(content).has(normalized);
  if (!known) return { valid: false, reason: "UNKNOWN" };
  if (usedNormalized.has(normalized)) return { valid: false, reason: "ALREADY_USED" };
  return { valid: true, normalized };
}

/** Indice : longueur et première lettre d'un mot admissible (le plus court). */
export function hintForTrainingSequence(content: BombpartyContent, sequence: string): { length: number; firstLetter: string } | null {
  const candidates = trainingCandidatesFor(content, sequence);
  const first = candidates[0];
  if (!first) return null;
  return { length: first.normalized.length, firstLetter: first.display.normalize("NFC")[0] ?? first.normalized[0] };
}
