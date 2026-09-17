export type GameKind = "competitive" | "cooperative";
export type GameAvailability = "coming_soon" | "beta" | "ready";

export type PublicGame = {
  slug: string;
  displayName: string;
  /** Nom affiché sur la carte de l'accueil (nom « carte », sans migration d'identifiant). */
  cardName: string;
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
    cardName: "Trou noir",
    description: "Réponds juste pour éviter la chute.",
    priority: 0,
    kind: "competitive",
    availability: "ready",
    duration: "8–12 min",
  },
  {
    slug: "ttmc",
    displayName: "À ton niveau",
    cardName: "TTMC",
    description: "Choisis ta difficulté et mise sur tes connaissances.",
    priority: 0,
    kind: "competitive",
    availability: "ready",
    duration: "10–20 min",
  },
  {
    slug: "geographie",
    displayName: "HexaPoint",
    cardName: "Géographie",
    description: "Place les villes au plus près sur la carte.",
    priority: 0,
    kind: "competitive",
    availability: "ready",
    duration: "8–15 min",
  },
  {
    slug: "skyjo",
    displayName: "Douze cases",
    cardName: "Skyjo",
    description: "Révèle et échange tes cartes pour réduire ton total.",
    priority: 1,
    kind: "competitive",
    availability: "ready",
    duration: "10–20 min",
  },
  {
    slug: "uno",
    displayName: "Dernière carte",
    cardName: "UNO",
    description: "Débarrasse-toi de ta main avant ton adversaire.",
    priority: 1,
    kind: "competitive",
    availability: "ready",
    duration: "8–15 min",
  },
  {
    slug: "bombparty",
    displayName: "Syllabe Express",
    cardName: "BombParty",
    description: "Trouve le bon mot avant la fin du chrono.",
    priority: 1,
    kind: "competitive",
    availability: "ready",
    duration: "5–10 min",
  },
  {
    slug: "bataille-navale",
    displayName: "Flotte cachée",
    cardName: "Bataille navale",
    description: "Repère et coule la flotte adverse.",
    priority: 1,
    kind: "competitive",
    availability: "ready",
    duration: "10–20 min",
  },
  {
    slug: "compatibilite",
    displayName: "Même réponse ?",
    cardName: "Compatibilité",
    description: "Comparez vos choix et découvrez vos points communs.",
    priority: 1,
    kind: "cooperative",
    availability: "ready",
    duration: "8–12 min",
  },
  {
    slug: "longueur-onde",
    displayName: "À l'unisson",
    cardName: "Longueur d'onde",
    description: "Donne un indice et trouvez la même longueur d'onde.",
    priority: 1,
    kind: "cooperative",
    availability: "ready",
    duration: "8–12 min",
  },
];

export function publicGameBySlug(slug: string): PublicGame | null {
  return PUBLIC_GAMES.find((game) => game.slug === slug) ?? null;
}
