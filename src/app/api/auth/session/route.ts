import { getAuthenticatedAccount } from "@/server/auth";
import { avatarCacheVersion } from "@/server/avatar";
import { getSupabaseServerConfig } from "@/server/config";
import { jsonOk } from "@/server/http";
import type { HeaderSession } from "@/lib/header-session";

/**
 * Session minimale du header (GET /api/auth/session).
 * Réponse volontairement `private, no-store` via `jsonOk` : elle est
 * personnelle au visiteur et n'est jamais mise en cache partagé. Les pages
 * statiques restent statiques car cet appel est fait côté client par l'îlot
 * `SiteHeaderAuth`, jamais pendant le rendu serveur de la page.
 */
export async function GET() {
  if (!getSupabaseServerConfig()) return jsonOk<HeaderSession>({ connected: false });
  const account = await getAuthenticatedAccount();
  if (!account) return jsonOk<HeaderSession>({ connected: false });
  return jsonOk<HeaderSession>({
    connected: true,
    isGuest: account.isGuest,
    pseudo: account.member.pseudo,
    effectiveName: account.member.effectiveName,
    needsOnboarding: account.member.needsOnboarding,
    avatarPreset: account.member.avatarPreset,
    avatarVersion: avatarCacheVersion(account.member.avatarPath),
  });
}
