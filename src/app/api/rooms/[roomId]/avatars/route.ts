import { z } from "zod";
import { getAuthenticatedMember } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { jsonError, jsonOk, mapServerError } from "@/server/http";
import { getRoomView } from "@/server/matches/repository";
import { createAdminClient } from "@/server/supabase/admin";
import { roomViewSchema } from "@/server/rooms/schemas";

const roomIdSchema = z.string().uuid();
const SIGNED_URL_SECONDS = 5 * 60;

/**
 * Photos des membres d'un salon : URLs signées courtes, réservées aux
 * participants du salon. Les chemins bruts ne sont jamais exposés.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const member = await getAuthenticatedMember();
  if (!member) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour voir ce salon.");
  const values = await params;
  const parsed = roomIdSchema.safeParse(values.roomId);
  if (!parsed.success) return jsonError("ROOM_NOT_FOUND", 404, "Salon introuvable.");
  try {
    const view = roomViewSchema.parse(await getRoomView(member.id, parsed.data));
    const admin = createAdminClient();
    const avatars: Record<string, string> = {};
    for (const entry of view.members) {
      if (!entry.avatarPath) continue;
      const { data, error } = await admin.storage.from("avatars").createSignedUrl(entry.avatarPath, SIGNED_URL_SECONDS);
      if (!error && data?.signedUrl) avatars[entry.id] = data.signedUrl;
    }
    return jsonOk({ avatars, expiresIn: SIGNED_URL_SECONDS });
  } catch (error) {
    return mapServerError(error);
  }
}
