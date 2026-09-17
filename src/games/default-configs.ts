import { DEFAULT_GEO_CONFIG } from "@/games/geographie/config";
import { DEFAULT_UNO_CONFIG } from "@/games/uno/config";
import { DEFAULT_SKYJO_CONFIG } from "@/games/skyjo/config";
import { DEFAULT_TROU_NOIR_CONFIG } from "@/games/trou-noir/config";
import { DEFAULT_TTMC_CONFIG } from "@/games/ttmc/config";
import { DEFAULT_BOMBPARTY_CONFIG } from "@/games/bombparty/config";
import { DEFAULT_NAVAL_CONFIG } from "@/games/bataille-navale/config";
import { DEFAULT_COMPATIBILITE_CONFIG } from "@/games/compatibilite/config";
import { DEFAULT_LONGUEUR_ONDE_CONFIG } from "@/games/longueur-onde/config";

/**
 * Configuration par défaut proposée quand l'hôte change de jeu dans un salon.
 * Purement client : aucun identifiant de contenu, aucune donnée secrète.
 */
export const DEFAULT_ROOM_CONFIGS: Readonly<Record<string, Record<string, unknown>>> = {
  geographie: DEFAULT_GEO_CONFIG,
  uno: DEFAULT_UNO_CONFIG,
  skyjo: DEFAULT_SKYJO_CONFIG,
  "trou-noir": DEFAULT_TROU_NOIR_CONFIG,
  ttmc: DEFAULT_TTMC_CONFIG,
  bombparty: DEFAULT_BOMBPARTY_CONFIG,
  "bataille-navale": DEFAULT_NAVAL_CONFIG,
  compatibilite: DEFAULT_COMPATIBILITE_CONFIG,
  "longueur-onde": DEFAULT_LONGUEUR_ONDE_CONFIG,
};
