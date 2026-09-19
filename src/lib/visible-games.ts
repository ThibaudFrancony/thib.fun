import type { PublicGame } from "@/games/registry";

type VisibleGamePayload = Pick<PublicGame, "slug" | "cardName" | "description" | "displayName" | "kind" | "availability" | "priority" | "duration">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Garde-fou minimal pour le rafraîchissement client de l'accueil :
 * on accepte uniquement une liste de jeux avec les champs d'affichage requis.
 * Les champs inconnus sont ignorés, une charge invalide est refusée sans casser
 * le carrousel affiché depuis le cache serveur.
 */
export function parseVisibleGames(value: unknown): VisibleGamePayload[] | null {
  if (!Array.isArray(value)) return null;
  const games: VisibleGamePayload[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const { slug, cardName, description, displayName, kind, availability, priority, duration } = entry;
    if (
      typeof slug !== "string" ||
      typeof cardName !== "string" ||
      typeof description !== "string" ||
      typeof displayName !== "string" ||
      typeof duration !== "string" ||
      (kind !== "competitive" && kind !== "cooperative") ||
      (availability !== "coming_soon" && availability !== "beta" && availability !== "ready") ||
      (priority !== 0 && priority !== 1)
    ) {
      return null;
    }
    games.push({ slug, cardName, description, displayName, kind, availability, priority, duration });
  }
  return games;
}

/** Compare uniquement l'ordre des slugs : évite de reconstruire le carrousel pour rien. */
export function haveSameGameSlugs(
  current: readonly { slug: string }[],
  fresh: readonly { slug: string }[],
): boolean {
  if (current.length !== fresh.length) return false;
  return current.every((game, index) => game.slug === fresh[index]?.slug);
}
