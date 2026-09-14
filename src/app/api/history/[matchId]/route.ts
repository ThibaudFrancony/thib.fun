import { z } from "zod";
import { getAuthenticatedAccount } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { jsonError, jsonOk, mapServerError } from "@/server/http";
import { getHistoryDetail } from "@/app/historique/_data";

export async function GET(_request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const account = await getAuthenticatedAccount();
  if (!account) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour voir cette partie.");
  if (account.isGuest) return jsonError("ACCOUNT_REQUIRED", 403, "Crée un compte pour retrouver tes résultats.");
  const { matchId } = await params;
  if (!z.string().uuid().safeParse(matchId).success) return jsonError("NOT_FOUND", 404, "Résultat introuvable.");
  try {
    const detail = await getHistoryDetail(account.member.id, matchId);
    return detail ? jsonOk(detail) : jsonError("NOT_FOUND", 404, "Résultat introuvable.");
  } catch (error) {
    return mapServerError(error);
  }
}
