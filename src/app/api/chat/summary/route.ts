import { getAuthenticatedAccount } from "@/server/auth";
import { getChatSummary } from "@/server/chat/repository";
import { getSupabaseServerConfig } from "@/server/config";
import { jsonError, jsonOk, mapServerError } from "@/server/http";

export async function GET() {
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const account = await getAuthenticatedAccount();
  if (!account) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour accéder au chat.");
  try {
    return jsonOk(
      await getChatSummary({
        id: account.member.id,
        name: account.member.effectiveName,
        isGuest: account.isGuest,
        canWrite: !account.isGuest,
      }),
    );
  } catch (error) {
    return mapServerError(error);
  }
}
