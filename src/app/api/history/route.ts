import { z } from "zod";
import { getAuthenticatedMember } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { jsonError, jsonOk, mapServerError } from "@/server/http";
import { getHistory } from "@/server/matches/repository";

const querySchema = z.object({
  cursor: z.string().max(512).optional(),
  game: z.string().regex(/^[a-z-]+$/).optional(),
  outcome: z.enum(["win", "loss", "draw", "cooperative", "abandoned"]).optional(),
});

export async function GET(request: Request) {
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const member = await getAuthenticatedMember();
  if (!member) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour voir ton historique.");
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    cursor: url.searchParams.get("cursor") ?? undefined,
    game: url.searchParams.get("game") ?? undefined,
    outcome: url.searchParams.get("outcome") ?? undefined,
  });
  if (!parsed.success) return jsonError("INVALID_REQUEST", 400, "Le filtre d'historique est invalide.");
  try {
    return jsonOk(await getHistory(member.id, parsed.data));
  } catch (error) {
    return mapServerError(error);
  }
}
