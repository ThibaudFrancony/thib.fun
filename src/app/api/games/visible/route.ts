import { getVisibleGames } from "@/server/games/visibility";
import { jsonOk } from "@/server/http";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Liste publique des jeux visibles sur l'accueil.
 * Sans authentification : mêmes champs que le registre public, filtrés par
 * `public.games.visible`. `no-store` côté serveur (`jsonOk`) pour que le
 * carrousel client puisse vérifier en arrière-plan s'il a changé.
 */
export async function GET() {
  return jsonOk({ games: await getVisibleGames() });
}
