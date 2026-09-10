import { z } from "zod";
import { getAuthenticatedMember } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { assertMutationOrigin, jsonError, jsonOk, mapServerError } from "@/server/http";
import { joinRoom } from "@/server/matches/repository";

const joinSchema = z.object({ requestId: z.string().uuid(), code: z.string().trim().length(6) });

export async function POST(request: Request) {
  const originError = assertMutationOrigin(request);
  if (originError) return originError;
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const member = await getAuthenticatedMember();
  if (!member) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour rejoindre un salon.");
  const body = joinSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("INVALID_REQUEST", 400, "Le code du salon est invalide.");
  try {
    return jsonOk(await joinRoom(member.id, body.data.requestId, body.data.code));
  } catch (error) {
    return mapServerError(error);
  }
}
