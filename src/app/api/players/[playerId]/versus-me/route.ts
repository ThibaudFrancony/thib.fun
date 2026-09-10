import { z } from "zod";
import { getAuthenticatedMember } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { jsonError, jsonOk, mapServerError } from "@/server/http";
import { getPairHistory } from "@/server/matches/repository";

export async function GET(request: Request, { params }: { params: Promise<{ playerId: string }> }) {
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const member = await getAuthenticatedMember();
  if (!member) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour voir ces statistiques.");
  const { playerId } = await params;
  if (!z.string().uuid().safeParse(playerId).success || playerId === member.id) return jsonError("NOT_FOUND", 404, "Joueur introuvable.");
  const game = new URL(request.url).searchParams.get("game") ?? undefined;
  if (game && !/^[a-z-]+$/.test(game)) return jsonError("INVALID_REQUEST", 400, "Le filtre de jeu est invalide.");
  try {
    return jsonOk(await getPairHistory(member.id, playerId, game));
  } catch (error) {
    return mapServerError(error);
  }
}
