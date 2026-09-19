import { requireAdminAccount } from "@/server/admin/guard";
import { getAdminConversation } from "@/server/admin/repository";
import { adminMessagesQuerySchema } from "@/server/admin/schemas";
import { uuidSchema } from "@/server/chat/schemas";
import { getSupabaseServerConfig } from "@/server/config";
import { jsonError, jsonOk, mapServerError } from "@/server/http";

export async function GET(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const guard = await requireAdminAccount();
  if (!guard.ok) return guard.response;
  const values = await params;
  if (!uuidSchema.safeParse(values.conversationId).success) {
    return jsonError("CONVERSATION_NOT_FOUND", 404, "Cette conversation est introuvable.");
  }
  const url = new URL(request.url);
  const query = adminMessagesQuerySchema.safeParse({
    before: url.searchParams.get("before") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!query.success) return jsonError("INVALID_REQUEST", 400, "La pagination demandée est invalide.");
  try {
    return jsonOk(
      await getAdminConversation(guard.account.member.id, values.conversationId, {
        before: query.data.before,
        limit: query.data.limit,
      }),
    );
  } catch (error) {
    return mapServerError(error);
  }
}
