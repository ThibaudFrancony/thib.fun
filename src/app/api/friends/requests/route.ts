import { sendFriendRequest } from "@/server/chat/repository";
import { friendRequestInputSchema } from "@/server/chat/schemas";
import { getAuthenticatedPermanentMember } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { assertMutationOrigin, jsonError, jsonOk, mapServerError } from "@/server/http";

export async function POST(request: Request) {
  const originError = assertMutationOrigin(request);
  if (originError) return originError;
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const member = await getAuthenticatedPermanentMember();
  if (!member) return jsonError("ACCOUNT_REQUIRED", 403, "Crée un compte pour ajouter des amis.");
  const body = friendRequestInputSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("INVALID_REQUEST", 400, "La demande d'ami est invalide.");
  try {
    return jsonOk(await sendFriendRequest(member.id, body.data.requestId, body.data.targetId));
  } catch (error) {
    return mapServerError(error);
  }
}
