import { z } from "zod";
import { getAuthenticatedMember } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { matchHeartbeat } from "@/server/matches/repository";
import { assertMutationOrigin, jsonError, jsonOk, mapServerError } from "@/server/http";

export async function POST(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const originError = assertMutationOrigin(request);
  if (originError) return originError;
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const member = await getAuthenticatedMember();
  if (!member) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour continuer la partie.");
  const { matchId } = await params;
  if (!z.string().uuid().safeParse(matchId).success) return jsonError("MATCH_NOT_FOUND", 404, "Partie introuvable.");
  try {
    return jsonOk(await matchHeartbeat(member.id, matchId));
  } catch (error) {
    return mapServerError(error);
  }
}
