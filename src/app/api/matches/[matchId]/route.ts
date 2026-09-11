import { z } from "zod";
import { getAuthenticatedMember } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { jsonError, jsonOk, mapServerError } from "@/server/http";
import { getMatchSnapshot } from "@/server/matches/repository";

export async function GET(_request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const member = await getAuthenticatedMember();
  if (!member) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour voir cette partie.");
  const { matchId } = await params;
  if (!z.string().uuid().safeParse(matchId).success) return jsonError("MATCH_NOT_FOUND", 404, "Partie introuvable.");
  try {
    const snapshot = await getMatchSnapshot(member.id, matchId);
    if (snapshot.gameSlug !== "geographie" && snapshot.gameSlug !== "uno" && snapshot.gameSlug !== "trou-noir") return jsonError("GAME_NOT_READY", 409, "Cette partie n'est pas disponible.");
    // The persisted projection is the only payload returned to the browser.
    return jsonOk({
      matchId: snapshot.matchId,
      roomId: snapshot.roomId,
      gameSlug: snapshot.gameSlug,
      status: snapshot.status,
      mode: snapshot.mode,
      version: snapshot.version,
      phaseId: snapshot.phaseId,
      deadlineAt: snapshot.deadlineAt,
      deadlineKind: snapshot.deadlineKind,
      serverNow: snapshot.serverNow,
      view: snapshot.view,
    });
  } catch (error) {
    return mapServerError(error);
  }
}
