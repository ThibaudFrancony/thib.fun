import { markChatRead } from "@/server/chat/repository";
import { markChatReadInputSchema, uuidSchema } from "@/server/chat/schemas";
import { getAuthenticatedMember } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { assertMutationOrigin, jsonError, jsonOk, mapServerError } from "@/server/http";

export async function POST(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const originError = assertMutationOrigin(request);
  if (originError) return originError;
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const member = await getAuthenticatedMember();
  if (!member) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour marquer cette conversation comme lue.");
  const values = await params;
  if (!uuidSchema.safeParse(values.conversationId).success) {
    return jsonError("CONVERSATION_NOT_FOUND", 404, "Cette conversation est introuvable.");
  }
  const body = markChatReadInputSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("INVALID_REQUEST", 400, "Le marqueur de lecture est invalide.");
  try {
    await markChatRead(member.id, values.conversationId, body.data.lastReadSeq);
    return jsonOk({ conversationId: values.conversationId, lastReadSeq: body.data.lastReadSeq });
  } catch (error) {
    return mapServerError(error);
  }
}
