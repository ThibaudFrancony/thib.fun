import "server-only";

import { PUBLIC_GAMES, type PublicGame } from "@/games/registry";
import { getSupabaseServerConfig } from "@/server/config";
import { createAdminClient } from "@/server/supabase/admin";

type GamesVisibilityRow = { slug: string; visible: boolean };

/**
 * Jeux visibles sur l'accueil selon `public.games.visible`. En cas de
 * configuration ou de colonne absente (déploiement en cours), on retombe sur
 * le registre complet plutôt que de casser l'accueil.
 */
export async function getVisibleGames(): Promise<readonly PublicGame[]> {
  if (!getSupabaseServerConfig()) return PUBLIC_GAMES;
  try {
    const { data, error } = await createAdminClient().from("games").select("slug, visible");
    if (error || !data) return PUBLIC_GAMES;
    const hidden = new Set(
      (data as GamesVisibilityRow[]).filter((row) => row.visible === false).map((row) => row.slug),
    );
    return PUBLIC_GAMES.filter((game) => !hidden.has(game.slug));
  } catch {
    return PUBLIC_GAMES;
  }
}
