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
import { createAdminClient } from "@/server/supabase/admin";

const setConfigActionSchema = z.union([
  z.object({ type: z.literal("SET_CONFIG"), gameSlug: z.literal("geographie"), config: geoConfigSchema }),
  z.object({ type: z.literal("SET_CONFIG"), gameSlug: z.literal("uno"), config: unoConfigSchema }),
  z.object({ type: z.literal("SET_CONFIG"), gameSlug: z.literal("skyjo"), config: skyjoConfigSchema }),
  z.object({ type: z.literal("SET_CONFIG"), gameSlug: z.literal("trou-noir"), config: trouNoirConfigSchema }),
  z.object({ type: z.literal("SET_CONFIG"), gameSlug: z.literal("ttmc"), config: ttmcConfigSchema }),
  z.object({ type: z.literal("SET_CONFIG"), gameSlug: z.literal("bombparty"), config: bombpartyConfigSchema }),
  z.object({ type: z.literal("SET_CONFIG"), gameSlug: z.literal("bataille-navale"), config: navalConfigSchema }),
  z.object({ type: z.literal("SET_CONFIG"), gameSlug: z.literal("compatibilite"), config: compatibiliteConfigSchema }),
  z.object({ type: z.literal("SET_CONFIG"), gameSlug: z.literal("longueur-onde"), config: longueurOndeConfigSchema }),
]);

const roomActionSchema = z.union([
  z.object({ type: z.literal("LEAVE") }),
  z.object({ type: z.literal("REJOIN") }),
  z.object({ type: z.literal("REMATCH") }),
  z.object({ type: z.literal("TRANSFER_HOST"), targetUserId: z.string().uuid() }),
  setConfigActionSchema,
]);

const roomActionRequestSchema = z.object({
  commandId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
  action: roomActionSchema,
}).strict();

const roomErrorResponses: Readonly<Record<string, { code: "UNAUTHORIZED" | "ROOM_CLOSED" | "ROOM_NOT_WAITING" | "HOST_REQUIRED" | "ROOM_FULL" | "VERSION_CONFLICT" | "ROOM_TARGET_NOT_MEMBER"; status: number; message: string }>> = {
  NOT_A_ROOM_MEMBER: { code: "UNAUTHORIZED", status: 403, message: "Tu ne participes plus à ce salon." },
  ROOM_EXPIRED: { code: "ROOM_CLOSED", status: 409, message: "Ce salon est fermé ou expiré." },
  ROOM_NOT_WAITING: { code: "ROOM_NOT_WAITING", status: 409, message: "Ce salon n'attend plus de joueurs." },
  HOST_REQUIRED: { code: "HOST_REQUIRED", status: 403, message: "Seul l'hôte peut effectuer cette action." },
  ROOM_FULL: { code: "ROOM_FULL", status: 409, message: "Ce salon est déjà complet." },
  ROOM_TARGET_NOT_MEMBER: { code: "ROOM_TARGET_NOT_MEMBER", status: 422, message: "Choisis un autre participant du salon." },
  VERSION_CONFLICT: { code: "VERSION_CONFLICT", status: 409, message: "Le salon a changé. Recharge la page avant de réessayer." },
};

function mapRoomActionError(error: unknown) {
  const rawCode = error instanceof Error ? error.message : "";
  const response = roomErrorResponses[rawCode];
  return response ? jsonError(response.code, response.status, response.message) : mapServerError(error);
}

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const originError = assertMutationOrigin(request);
  if (originError) return originError;
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const member = await getAuthenticatedMember();
  if (!member) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour modifier ce salon.");

  const { roomId } = await params;
  if (!z.string().uuid().safeParse(roomId).success) return jsonError("ROOM_NOT_FOUND", 404, "Salon introuvable.");
  const body = roomActionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("INVALID_REQUEST", 400, "La commande du salon est invalide.");

  try {
    // La RPC verrouille le salon, vérifie la version et conserve le reçu de
    // commande ; le navigateur ne simule aucune sortie ni transfert d'hôte.
    const response = await createAdminClient().rpc("server_change_room", {
      p_actor: member.id,
      p_command_id: body.data.commandId,
      p_room_id: roomId,
      p_expected_version: body.data.expectedVersion,
      p_action: body.data.action,
    });
    if (response.error) throw new Error(response.error.message);
    if (!response.data) throw new Error("DATABASE_UNAVAILABLE");
    return jsonOk(response.data);
  } catch (error) {
    return mapRoomActionError(error);
  }
}
