import { respondFriendRequest } from "@/server/chat/repository";
import { respondFriendRequestInputSchema, uuidSchema } from "@/server/chat/schemas";
import { getAuthenticatedPermanentMember } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { assertMutationOrigin, jsonError, jsonOk, mapServerError } from "@/server/http";

export async function POST(request: Request, { params }: { params: Promise<{ friendshipId: string }> }) {
  const originError = assertMutationOrigin(request);
  if (originError) return originError;
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const member = await getAuthenticatedPermanentMember();
  if (!member) return jsonError("ACCOUNT_REQUIRED", 403, "Crée un compte pour répondre à une demande d'ami.");
  const values = await params;
  if (!uuidSchema.safeParse(values.friendshipId).success) {
    return jsonError("FRIEND_REQUEST_NOT_FOUND", 404, "Cette demande d'ami n'existe plus.");
  }
  const body = respondFriendRequestInputSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("INVALID_REQUEST", 400, "La réponse à la demande est invalide.");
  try {
    return jsonOk(await respondFriendRequest(member.id, body.data.requestId, values.friendshipId, body.data.accept));
  } catch (error) {
    return mapServerError(error);
  }
}
