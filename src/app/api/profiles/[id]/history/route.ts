import { z } from "zod";
import { getAuthenticatedAccount } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { jsonError, jsonOk, mapServerError } from "@/server/http";
import { getProfileHistoryPage, isValidHistoryCursor } from "@/app/historique/_data";

const paramsSchema = z.string().uuid();
const querySchema = z.object({
  cursor: z.string().max(512).optional(),
  game: z.string().regex(/^[a-z-]+$/).optional(),
  outcome: z.enum(["win", "loss", "draw", "cooperative", "abandoned"]).optional(),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const account = await getAuthenticatedAccount();
  if (!account) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour voir cet historique.");
  if (account.isGuest) return jsonError("ACCOUNT_REQUIRED", 403, "Crée un compte pour consulter un profil.");
  const { id } = await params;
  if (!paramsSchema.safeParse(id).success) return jsonError("NOT_FOUND", 404, "Joueur introuvable.");
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    cursor: url.searchParams.get("cursor") ?? undefined,
    game: url.searchParams.get("game") ?? undefined,
    outcome: url.searchParams.get("outcome") ?? undefined,
  });
  if (!parsed.success) return jsonError("INVALID_REQUEST", 400, "Le filtre d'historique est invalide.");
  if (!isValidHistoryCursor(parsed.data.cursor)) return jsonError("INVALID_REQUEST", 400, "Le curseur d'historique est invalide.");
  try {
    return jsonOk(await getProfileHistoryPage(id, parsed.data));
  } catch (error) {
    return mapServerError(error);
  }
}
