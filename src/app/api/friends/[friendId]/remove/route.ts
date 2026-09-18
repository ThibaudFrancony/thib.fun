import { removeFriend } from "@/server/chat/repository";
import { removeFriendInputSchema, uuidSchema } from "@/server/chat/schemas";
import { getAuthenticatedPermanentMember } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { assertMutationOrigin, jsonError, jsonOk, mapServerError } from "@/server/http";

export async function POST(request: Request, { params }: { params: Promise<{ friendId: string }> }) {
  const originError = assertMutationOrigin(request);
  if (originError) return originError;
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const member = await getAuthenticatedPermanentMember();
  if (!member) return jsonError("ACCOUNT_REQUIRED", 403, "Crée un compte pour gérer tes amis.");
  const values = await params;
  if (!uuidSchema.safeParse(values.friendId).success) {
    return jsonError("NOT_FRIENDS", 403, "Vous n'êtes pas amis.");
  }
  const body = removeFriendInputSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("INVALID_REQUEST", 400, "La demande de retrait est invalide.");
  try {
    await removeFriend(member.id, body.data.requestId, values.friendId);
    return jsonOk({ removed: true, targetId: values.friendId });
  } catch (error) {
    return mapServerError(error);
  }
}
