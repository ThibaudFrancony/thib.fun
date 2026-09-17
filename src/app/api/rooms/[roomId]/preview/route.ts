import { z } from "zod";
import { getAuthenticatedMember } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { jsonError, jsonOk, mapServerError } from "@/server/http";
import { getRoomPreview } from "@/server/matches/repository";

export async function GET(_request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const member = await getAuthenticatedMember();
  if (!member) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour rejoindre un salon.");
  const { roomId } = await params;
  if (!z.string().uuid().safeParse(roomId).success) return jsonError("ROOM_NOT_FOUND", 404, "Salon introuvable.");
  try {
    const preview = await getRoomPreview(member.id, roomId);
    return jsonOk({
      roomId: preview.roomId,
      code: preview.code,
      gameSlug: preview.gameSlug,
      status: preview.status,
      expiresAt: preview.expiresAt,
      memberCount: preview.memberCount,
      viewerIsMember: preview.viewerIsMember,
    });
  } catch (error) {
    return mapServerError(error);
  }
}
