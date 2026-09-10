import { z } from "zod";
import { getAuthenticatedMember } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { jsonError, jsonOk, mapServerError } from "@/server/http";
import { getRoomView } from "@/server/matches/repository";

const roomIdSchema = z.string().uuid();

export async function GET(_request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const member = await getAuthenticatedMember();
  if (!member) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour voir ce salon.");
  const values = await params;
  const parsed = roomIdSchema.safeParse(values.roomId);
  if (!parsed.success) return jsonError("ROOM_NOT_FOUND", 404, "Salon introuvable.");
  try {
    return jsonOk(await getRoomView(member.id, parsed.data));
  } catch (error) {
    return mapServerError(error);
  }
}
