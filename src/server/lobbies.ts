import "server-only";

import { getAuthenticatedMember } from "@/server/auth";
import { getActiveLobby } from "@/server/matches/repository";
import { roomViewSchema, type RoomView } from "@/server/rooms/schemas";

/**
 * Salon générique actif du visiteur courant (créé depuis l'accueil avant le
 * choix du jeu). Retourne `null` s'il n'y est pas connecté ou n'a pas de groupe.
 */
export async function getActiveLobbyForViewer(): Promise<RoomView | null> {
  const member = await getAuthenticatedMember();
  if (!member) return null;
  const lobby = await getActiveLobby(member.id);
  if (!lobby) return null;
  const parsed = roomViewSchema.safeParse(lobby);
  return parsed.success ? parsed.data : null;
}
