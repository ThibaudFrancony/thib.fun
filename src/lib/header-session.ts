/**
 * Session minimale pour le header des pages statiques.
 * Mêmes champs que ceux déjà affichés dans le header serveur, sans secret :
 * l'îlot client la relit en JSON au lieu de forcer toute la page en dynamique.
 */
export type HeaderSession =
  | { connected: false }
  | {
      connected: true;
      isGuest: boolean;
      pseudo: string;
      effectiveName: string;
      needsOnboarding: boolean;
      avatarPreset: string;
      avatarVersion: string | null;
    };
