import { requireAdminAccount } from "@/server/admin/guard";
import { listAdminConversations } from "@/server/admin/repository";
import { getSupabaseServerConfig } from "@/server/config";
import { jsonError, jsonOk, mapServerError } from "@/server/http";

export async function GET() {
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const guard = await requireAdminAccount();
  if (!guard.ok) return guard.response;
  try {
    return jsonOk({ conversations: await listAdminConversations(guard.account.member.id) });
  } catch (error) {
    return mapServerError(error);
  }
}
