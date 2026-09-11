import { z } from "zod";
import { normalizeBombpartySequence } from "@/games/bombparty/normalize";
import { paginateTrainingCandidates, trainingCandidatesFor, TRAINING_SUGGESTION_LIMIT } from "@/games/bombparty/training";
import { getAuthenticatedMember } from "@/server/auth";
import { loadBombpartyContent, hasActiveBombpartyMatch } from "@/server/bombparty/content";
import { getSupabaseServerConfig } from "@/server/config";
import { jsonError, jsonOk, mapServerError } from "@/server/http";

const querySchema = z.object({
  sequence: z.string().min(2).max(3),
  cursor: z.string().max(512).optional(),
});

/**
 * Suggestions d'entraînement paginées (max 20, longueur croissante puis
 * alphabétique). Refusé pendant une partie BombParty active du même compte.
 */
export async function GET(request: Request) {
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const member = await getAuthenticatedMember();
  if (!member) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour t'entraîner.");
  const url = new URL(request.url);
  const query = querySchema.safeParse({
    sequence: url.searchParams.get("sequence") ?? "",
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  if (!query.success) return jsonError("INVALID_REQUEST", 400, "La séquence demandée est invalide.");
  const sequence = normalizeBombpartySequence(query.data.sequence);
  if (sequence === null) return jsonError("INVALID_REQUEST", 400, "La séquence demandée est invalide.");
  try {
    if (await hasActiveBombpartyMatch(member.id)) return jsonError("TRAINING_BLOCKED_DURING_MATCH", 409, "Termine ta partie Syllabe Express en cours avant de t'entraîner.");
    const content = await loadBombpartyContent();
    const candidates = trainingCandidatesFor(content, sequence);
    const page = paginateTrainingCandidates(candidates, query.data.cursor, TRAINING_SUGGESTION_LIMIT);
    return jsonOk({
      sequence,
      count: candidates.length,
      examples: page.items.map((item) => ({ word: item.display, length: item.length })),
      nextCursor: page.nextCursor,
    });
  } catch (error) {
    return mapServerError(error);
  }
}
