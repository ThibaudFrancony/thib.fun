import { z } from "zod";
import { getAuthenticatedMember } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { jsonError, jsonOk, mapServerError } from "@/server/http";
import { getHistoryEntry } from "@/server/matches/repository";

export async function GET(_request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const member = await getAuthenticatedMember();
  if (!member) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour voir cette partie.");
  const { matchId } = await params;
  if (!z.string().uuid().safeParse(matchId).success) return jsonError("NOT_FOUND", 404, "Résultat introuvable.");
  try {
    const entry = await getHistoryEntry(member.id, matchId);
    return entry ? jsonOk(entry) : jsonError("NOT_FOUND", 404, "Résultat introuvable.");
  } catch (error) {
    return mapServerError(error);
  }
}
