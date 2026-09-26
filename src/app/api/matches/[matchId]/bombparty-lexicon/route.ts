import { z } from "zod";
import { getAuthenticatedMember } from "@/server/auth";
import { loadBombpartyContent } from "@/server/bombparty/content";
import { getSupabaseServerConfig } from "@/server/config";
import { jsonError, jsonOk, mapServerError } from "@/server/http";
import { getMatchSnapshot } from "@/server/matches/repository";
import { bombpartyStateSchema } from "@/games/bombparty/types";

/** Lexique de la version jouée, réservé aux deux participants. */
export async function GET(_request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const member = await getAuthenticatedMember();
  if (!member) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour jouer.");
  const { matchId } = await params;
  if (!z.string().uuid().safeParse(matchId).success) return jsonError("MATCH_NOT_FOUND", 404, "Partie introuvable.");
  try {
    const snapshot = await getMatchSnapshot(member.id, matchId);
    if (snapshot.gameSlug !== "bombparty") return jsonError("MATCH_NOT_FOUND", 404, "Partie introuvable.");
    const state = bombpartyStateSchema.parse(snapshot.state);
    const content = await loadBombpartyContent();
    if (content.packId !== state.packId || content.packChecksum !== state.packChecksum) {
      return jsonError("BOMBPARTY_CONTENT_UNAVAILABLE", 503, "Le lexique de cette partie n'est pas disponible.");
    }
    return jsonOk({ packId: content.packId, checksum: content.packChecksum, words: content.words.map((word) => word.normalizedForm) });
  } catch (error) {
    return mapServerError(error);
  }
}
