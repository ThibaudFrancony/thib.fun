import { z } from "zod";
import { getAuthenticatedAccount } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { jsonError, jsonOk, mapServerError } from "@/server/http";
import { getPairHistoryPage, isValidHistoryCursor } from "@/app/historique/_data";

const playerIdSchema = z.string().uuid();
const querySchema = z.object({ cursor: z.string().max(512).optional(), game: z.string().regex(/^[a-z-]+$/u).optional() });

export async function GET(request: Request, { params }: { params: Promise<{ playerId: string }> }) {
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const account = await getAuthenticatedAccount();
  if (!account) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour voir cet historique.");
  if (account.isGuest) return jsonError("ACCOUNT_REQUIRED", 403, "Crée un compte pour voir l'historique de ce duo.");
  const { playerId } = await params;
  if (!playerIdSchema.safeParse(playerId).success || playerId === account.member.id) return jsonError("NOT_FOUND", 404, "Joueur introuvable.");
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ cursor: url.searchParams.get("cursor") ?? undefined, game: url.searchParams.get("game") ?? undefined });
  if (!parsed.success || !isValidHistoryCursor(parsed.data.cursor)) return jsonError("INVALID_REQUEST", 400, "Le filtre de duo est invalide.");
  try {
    return jsonOk(await getPairHistoryPage(account.member.id, playerId, parsed.data));
  } catch (error) {
    return mapServerError(error);
  }
}
