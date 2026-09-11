import { z } from "zod";
import { geoConfigSchema } from "@/games/geographie/config";
import { trouNoirConfigSchema } from "@/games/trou-noir/config";
import { unoConfigSchema } from "@/games/uno/config";
import { getAuthenticatedMember } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { assertMutationOrigin, jsonError, jsonOk, mapServerError } from "@/server/http";
import { createRoom } from "@/server/matches/repository";

const createRoomSchema = z.discriminatedUnion("gameSlug", [
  z.object({ requestId: z.string().uuid(), gameSlug: z.literal("geographie"), config: geoConfigSchema }),
  z.object({ requestId: z.string().uuid(), gameSlug: z.literal("uno"), config: unoConfigSchema }),
  z.object({ requestId: z.string().uuid(), gameSlug: z.literal("trou-noir"), config: trouNoirConfigSchema }),
]);

export async function POST(request: Request) {
  const originError = assertMutationOrigin(request);
  if (originError) return originError;
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const member = await getAuthenticatedMember();
  if (!member) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour créer un salon.");
  const body = createRoomSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("INVALID_REQUEST", 400, "Les options du salon sont invalides.");
  try {
    return jsonOk(await createRoom(member.id, body.data.requestId, body.data.gameSlug, body.data.config));
  } catch (error) {
    return mapServerError(error);
  }
}
