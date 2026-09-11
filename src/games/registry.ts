export type GameKind = "competitive" | "cooperative";
export type GameAvailability = "coming_soon" | "beta" | "ready";

export type PublicGame = {
  slug: string;
  displayName: string;
  description: string;
  priority: 0 | 1;
  kind: GameKind;
  availability: GameAvailability;
  duration: string;
};

export const PUBLIC_GAMES: readonly PublicGame[] = [
  {
    slug: "trou-noir",
    displayName: "Chute libre",
    description: "Réponds juste pour éviter la chute.",
    priority: 0,
    kind: "competitive",
    availability: "ready",
    duration: "8–12 min",
  },
  {
    slug: "ttmc",
    displayName: "À ton niveau",
    description: "Choisis ta difficulté et mise sur tes connaissances.",
    priority: 0,
    kind: "competitive",
    availability: "ready",
    duration: "10–20 min",
  },
  {
    slug: "geographie",
    displayName: "HexaPoint",
    description: "Place les villes au plus près sur la carte.",
    priority: 0,
    kind: "competitive",
    availability: "ready",
    duration: "8–15 min",
  },
  {
    slug: "skyjo",
    displayName: "Douze cases",
    description: "Révèle et échange tes cartes pour réduire ton total.",
    priority: 1,
    kind: "competitive",
    availability: "ready",
    duration: "10–20 min",
  },
  {
    slug: "uno",
    displayName: "Dernière carte",
    description: "Débarrasse-toi de ta main avant ton adversaire.",
    priority: 1,
    kind: "competitive",
    availability: "ready",
    duration: "8–15 min",
  },
  {
    slug: "bombparty",
    displayName: "Syllabe Express",
    description: "Trouve le bon mot avant la fin du chrono.",
    priority: 1,
    kind: "competitive",
    availability: "coming_soon",
    duration: "5–10 min",
  },
  {
    slug: "bataille-navale",
    displayName: "Flotte cachée",
    description: "Repère et coule la flotte adverse.",
    priority: 1,
    kind: "competitive",
    availability: "coming_soon",
    duration: "10–20 min",
  },
  {
    slug: "compatibilite",
    displayName: "Même réponse ?",
    description: "Comparez vos choix et découvrez vos points communs.",
    priority: 1,
    kind: "cooperative",
    availability: "coming_soon",
    duration: "8–12 min",
  },
  {
    slug: "longueur-onde",
    displayName: "À l'unisson",
    description: "Donne un indice et trouvez la même longueur d'onde.",
    priority: 1,
    kind: "cooperative",
    availability: "coming_soon",
    duration: "8–12 min",
  },
];

export function publicGameBySlug(slug: string): PublicGame | null {
  return PUBLIC_GAMES.find((game) => game.slug === slug) ?? null;
}
