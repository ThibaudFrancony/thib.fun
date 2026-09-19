import { getAuthenticatedAccount } from "@/server/auth";
import { avatarCacheVersion, isOwnAvatarPath } from "@/server/avatar";
import { getSupabaseServerConfig } from "@/server/config";
import { jsonError, mapServerError } from "@/server/http";
import { createAdminClient } from "@/server/supabase/admin";

const BUCKET = "avatars";

/**
 * Octets de la photo de profil du membre connecté, servis depuis la même
 * origine. La version (`?v=`) fait partie de l'URL pour que le navigateur
 * puisse mettre la réponse en cache immutable tant que la photo ne change pas.
 * Le chemin brut du bucket n'est jamais renvoyé.
 */
export async function GET() {
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const account = await getAuthenticatedAccount();
  if (!account) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour voir ton avatar.");
  if (account.isGuest) return jsonError("ACCOUNT_REQUIRED", 403, "Les avatars personnalisés sont réservés aux comptes permanents.");
  const path = account.member.avatarPath;
  if (!path) return jsonError("NOT_FOUND", 404, "Aucune photo de profil.");
  if (!isOwnAvatarPath(path, account.member.id)) return jsonError("DATABASE_UNAVAILABLE", 503, "L'avatar enregistré est indisponible.");
  try {
    const { data, error } = await createAdminClient().storage.from(BUCKET).download(path);
    if (error || !data) throw new Error("DATABASE_UNAVAILABLE");
    return new Response(data, {
      headers: {
        "content-type": data.type || "image/webp",
        "content-length": String(data.size),
        "cache-control": "private, max-age=31536000, immutable",
        etag: avatarCacheVersion(path) ?? "",
      },
    });
  } catch (error) {
    return mapServerError(error);
  }
}
