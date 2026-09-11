import { z } from "zod";
import { normalizeBombpartySequence, normalizeBombpartyWord } from "@/games/bombparty/normalize";
import { checkTrainingWord } from "@/games/bombparty/training";
import { getAuthenticatedMember } from "@/server/auth";
import { loadBombpartyContent, hasActiveBombpartyMatch } from "@/server/bombparty/content";
import { getSupabaseServerConfig } from "@/server/config";
import { assertMutationOrigin, jsonError, jsonOk, mapServerError } from "@/server/http";

const bodySchema = z.object({
  sequence: z.string().min(2).max(60),
  word: z.string().min(1).max(60),
  usedWords: z.array(z.string().min(1).max(60)).max(200).optional(),
});

/**
 * Vérification d'un mot d'entraînement, sans points de profil.
 * Refusé pendant une partie BombParty active du même compte.
 */
export async function POST(request: Request) {
  const originError = assertMutationOrigin(request);
  if (originError) return originError;
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const member = await getAuthenticatedMember();
  if (!member) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour t'entraîner.");
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("INVALID_REQUEST", 400, "Le mot proposé est invalide.");
  const sequence = normalizeBombpartySequence(body.data.sequence);
  if (sequence === null) return jsonError("INVALID_REQUEST", 400, "La séquence demandée est invalide.");
  try {
    if (await hasActiveBombpartyMatch(member.id)) return jsonError("TRAINING_BLOCKED_DURING_MATCH", 409, "Termine ta partie Syllabe Express en cours avant de t'entraîner.");
    const content = await loadBombpartyContent();
    const used = new Set<string>();
    for (const raw of body.data.usedWords ?? []) {
      const normalized = normalizeBombpartyWord(raw);
      if (normalized !== null) used.add(normalized);
    }
    const checked = checkTrainingWord(content, sequence, body.data.word, used);
    if (!checked.valid) return jsonOk({ valid: false, reason: checked.reason });
    return jsonOk({ valid: true, normalized: checked.normalized });
  } catch (error) {
    return mapServerError(error);
  }
}
