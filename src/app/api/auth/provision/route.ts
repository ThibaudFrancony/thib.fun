import { z } from "zod";
import { getAuthenticatedUserId } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { assertMutationOrigin, jsonError, jsonOk } from "@/server/http";
import { createAdminClient } from "@/server/supabase/admin";

const provisionSchema = z.object({
  pseudo: z.string().trim().min(2).max(24).regex(/^[\p{L}\p{N} _-]+$/u).optional(),
});

export async function POST(request: Request) {
  const originError = assertMutationOrigin(request);
  if (originError) return originError;
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");

  const actorId = await getAuthenticatedUserId();
  if (!actorId) return jsonError("UNAUTHENTICATED", 401, "Connecte-toi pour finaliser ton compte.");

  const body = provisionSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return jsonError("INVALID_REQUEST", 400, "Le pseudo est invalide.");

  const { data, error } = await createAdminClient().rpc("server_provision_account", {
    p_actor: actorId,
    p_requested_pseudo: body.data.pseudo ?? null,
  });
  if (error?.message?.includes("ACCOUNT_DISABLED")) return jsonError("ACCOUNT_DISABLED", 403, "Ce compte est désactivé.");
  if (error || !data) return jsonError("ACCOUNT_PROVISIONING_FAILED", 503, "Ton compte n'a pas pu être finalisé. Réessaie dans un instant.");
  return jsonOk(data);
}
