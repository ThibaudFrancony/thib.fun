import type { NextRequest } from "next/server";
import { updateSupabaseSession } from "@/server/supabase/session-refresh";

/**
 * Proxy Next.js 16 (remplace l'ancien `middleware.ts`) : rafraîchit la
 * session Supabase SSR sur chaque requête afin que les navigations suivant
 * une connexion client (e-mail ou invité anonyme) arrivent connectées.
 */
export async function proxy(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    /*
     * Toutes les routes sauf les fichiers statiques et images optimisées.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
