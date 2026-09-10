import { z } from "zod";
import { getAuthenticatedMember } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { assertMutationOrigin, jsonError, jsonOk, mapServerError } from "@/server/http";
import { setRoomReady } from "@/server/matches/repository";

const bodySchema = z.object({ commandId: z.string().uuid(), expectedVersion: z.number().int().nonnegative(), ready: z.boolean() });

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const originError = assertMutationOrigin(request);
  if (originError) return originError;
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const member = await getAuthenticatedMember();
  if (!member) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour modifier ce salon.");
  const { roomId } = await params;
  if (!z.string().uuid().safeParse(roomId).success) return jsonError("ROOM_NOT_FOUND", 404, "Salon introuvable.");
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("INVALID_REQUEST", 400, "La demande de disponibilité est invalide.");
  try {
    return jsonOk(await setRoomReady(member.id, body.data.commandId, roomId, body.data.expectedVersion, body.data.ready));
  } catch (error) {
    return mapServerError(error);
  }
}
