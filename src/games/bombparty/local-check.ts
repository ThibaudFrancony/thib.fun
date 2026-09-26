import { normalizeBombpartyWord } from "@/games/bombparty/normalize";

export type LocalWordVerdict = "valid" | "invalid" | "missing_sequence" | "unknown" | "used";

/** Lexical preview only; the server still decides timing and commits. */
export function checkBombpartyWordLocally(rawWord: string, sequence: string, lexicon: ReadonlySet<string>, acceptedWords: readonly string[]): LocalWordVerdict {
  const normalized = normalizeBombpartyWord(rawWord);
  if (normalized === null) return "invalid";
  if (!normalized.includes(sequence)) return "missing_sequence";
  if (!lexicon.has(normalized)) return "unknown";
  if (acceptedWords.some((word) => normalizeBombpartyWord(word) === normalized)) return "used";
  return "valid";
}
