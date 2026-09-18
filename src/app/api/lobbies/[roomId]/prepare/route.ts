import { z } from "zod";
import { navalConfigSchema } from "@/games/bataille-navale/config";
import { compatibiliteConfigSchema } from "@/games/compatibilite/config";
import { longueurOndeConfigSchema } from "@/games/longueur-onde/config";
import { bombpartyConfigSchema } from "@/games/bombparty/config";
import { geoConfigSchema } from "@/games/geographie/config";
import { skyjoConfigSchema } from "@/games/skyjo/config";
import { trouNoirConfigSchema } from "@/games/trou-noir/config";
import { ttmcConfigSchema } from "@/games/ttmc/config";
import { unoConfigSchema } from "@/games/uno/config";
import { getAuthenticatedMember } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { assertMutationOrigin, jsonError, jsonOk, mapServerError } from "@/server/http";
import { prepareLobbyMatch } from "@/server/matches/repository";

const prepareSchema = z.discriminatedUnion("gameSlug", [
  z.object({ commandId: z.string().uuid(), expectedVersion: z.number().int().nonnegative(), gameSlug: z.literal("geographie"), config: geoConfigSchema }),
  z.object({ commandId: z.string().uuid(), expectedVersion: z.number().int().nonnegative(), gameSlug: z.literal("uno"), config: unoConfigSchema }),
  z.object({ commandId: z.string().uuid(), expectedVersion: z.number().int().nonnegative(), gameSlug: z.literal("skyjo"), config: skyjoConfigSchema }),
  z.object({ commandId: z.string().uuid(), expectedVersion: z.number().int().nonnegative(), gameSlug: z.literal("trou-noir"), config: trouNoirConfigSchema }),
  z.object({ commandId: z.string().uuid(), expectedVersion: z.number().int().nonnegative(), gameSlug: z.literal("ttmc"), config: ttmcConfigSchema }),
  z.object({ commandId: z.string().uuid(), expectedVersion: z.number().int().nonnegative(), gameSlug: z.literal("bombparty"), config: bombpartyConfigSchema }),
  z.object({ commandId: z.string().uuid(), expectedVersion: z.number().int().nonnegative(), gameSlug: z.literal("bataille-navale"), config: navalConfigSchema }),
  z.object({ commandId: z.string().uuid(), expectedVersion: z.number().int().nonnegative(), gameSlug: z.literal("compatibilite"), config: compatibiliteConfigSchema }),
  z.object({ commandId: z.string().uuid(), expectedVersion: z.number().int().nonnegative(), gameSlug: z.literal("longueur-onde"), config: longueurOndeConfigSchema }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const originError = assertMutationOrigin(request);
  if (originError) return originError;
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const member = await getAuthenticatedMember();
  if (!member) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour lancer une partie.");
  const { roomId } = await params;
  if (!z.string().uuid().safeParse(roomId).success) return jsonError("ROOM_NOT_FOUND", 404, "Salon introuvable.");
  const body = prepareSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("INVALID_REQUEST", 400, "La configuration du jeu est invalide.");
  try {
    return jsonOk(
      await prepareLobbyMatch({
        actorId: member.id,
        commandId: body.data.commandId,
        roomId,
        expectedVersion: body.data.expectedVersion,
        gameSlug: body.data.gameSlug,
        config: body.data.config,
      }),
    );
  } catch (error) {
    return mapServerError(error);
  }
}
