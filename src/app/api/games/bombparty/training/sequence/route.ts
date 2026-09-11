import { z } from "zod";
import { bombpartyDifficultySchema } from "@/games/bombparty/config";
import { normalizeBombpartySequence } from "@/games/bombparty/normalize";
import { trainingCandidatesFor } from "@/games/bombparty/training";
import { getAuthenticatedMember } from "@/server/auth";
import { loadBombpartyContent, hasActiveBombpartyMatch } from "@/server/bombparty/content";
import { getSupabaseServerConfig } from "@/server/config";
import { entropyValues } from "@/server/hash";
import { jsonError, jsonOk, mapServerError } from "@/server/http";

const querySchema = z.object({
  difficulty: bombpartyDifficultySchema.default("normal"),
});

function categoryOf(total: number): "easy" | "normal" | "hard" | null {
  if (total >= 200) return "easy";
  if (total >= 50) return "normal";
  if (total >= 10) return "hard";
  return null;
}

/**
 * Tirage d'une séquence d'entraînement solo. Refusé pendant une partie
 * BombParty active du même compte (séparation assistance/compétition).
 */
export async function GET(request: Request) {
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const member = await getAuthenticatedMember();
  if (!member) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour t'entraîner.");
  const url = new URL(request.url);
  const query = querySchema.safeParse({ difficulty: url.searchParams.get("difficulty") ?? undefined });
  if (!query.success) return jsonError("INVALID_REQUEST", 400, "La difficulté demandée est invalide.");
  try {
    if (await hasActiveBombpartyMatch(member.id)) return jsonError("TRAINING_BLOCKED_DURING_MATCH", 409, "Termine ta partie Syllabe Express en cours avant de t'entraîner.");
    const content = await loadBombpartyContent();
    const sequences = Object.keys(content.bySequence).sort();
    const inDifficulty = sequences.filter((sequence) => categoryOf(content.bySequence[sequence]?.length ?? 0) === query.data.difficulty);
    const pool = inDifficulty.length > 0 ? inDifficulty : sequences.filter((sequence) => (content.bySequence[sequence]?.length ?? 0) >= 1);
    if (pool.length === 0) return jsonError("TRAINING_UNAVAILABLE", 503, "Aucune séquence disponible pour l'entraînement.");
    const entropy = entropyValues(1)[0] ?? 0.5;
    const sequence = pool[Math.min(Math.floor(entropy * pool.length), pool.length - 1)];
    const normalized = normalizeBombpartySequence(sequence) ?? sequence;
    return jsonOk({ sequence: normalized, count: trainingCandidatesFor(content, normalized).length });
  } catch (error) {
    return mapServerError(error);
  }
}
