import { requireAdminAccount } from "@/server/admin/guard";
import { setAdminGameVisibility } from "@/server/admin/repository";
import { setGameVisibilityInputSchema } from "@/server/admin/schemas";
import { getSupabaseServerConfig } from "@/server/config";
import { assertMutationOrigin, jsonError, jsonOk, mapServerError } from "@/server/http";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const originError = assertMutationOrigin(request);
  if (originError) return originError;
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const guard = await requireAdminAccount();
  if (!guard.ok) return guard.response;
  const values = await params;
  const slug = values.slug?.trim();
  if (!slug || slug.length > 64) return jsonError("GAME_NOT_FOUND", 404, "Ce jeu est introuvable.");
  const body = setGameVisibilityInputSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("INVALID_REQUEST", 400, "La demande de visibilité est invalide.");
  try {
    return jsonOk(await setAdminGameVisibility(guard.account.member.id, body.data.requestId, slug, body.data.visible));
  } catch (error) {
    return mapServerError(error);
  }
}
