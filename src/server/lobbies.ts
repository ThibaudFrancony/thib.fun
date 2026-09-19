import "server-only";

import { getAuthenticatedMember } from "@/server/auth";
import { getActiveRoom } from "@/server/matches/repository";
import { roomViewSchema, type RoomView } from "@/server/rooms/schemas";

/**
 * Salon actif du visiteur courant, générique (groupe formé depuis l'accueil
 * avant le choix du jeu) ou déjà associé à un jeu. Retourne `null` s'il n'y est
 * pas connecté ou n'a pas de salon en attente / en cours.
 */
export async function getActiveRoomForViewer(): Promise<RoomView | null> {
  const member = await getAuthenticatedMember();
  if (!member) return null;
  try {
    const room = await getActiveRoom(member.id);
    if (!room) return null;
    const parsed = roomViewSchema.safeParse(room);
    return parsed.success ? parsed.data : null;
  } catch {
    // Migration distante éventuellement non appliquée : la page de jeu doit
    // rester utilisable en parcours historique plutôt que de planter.
    return null;
  }
}
