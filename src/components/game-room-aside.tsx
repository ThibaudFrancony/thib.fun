"use client";

import type { ReactNode } from "react";
import { GroupRoomBanner } from "@/components/group-room-banner";
import { useActiveGroupRoom } from "@/lib/group-room";

/**
 * Colonne latérale d'une page de jeu. Dès qu'un salon actif est connu (détecté
 * côté serveur ou rattrapé côté client), le bandeau du groupe remplace le
 * parcours historique « rejoindre ».
 */
export function GameRoomAside({ groupRoomId, fallback }: { groupRoomId?: string; fallback: ReactNode }) {
  const { roomId } = useActiveGroupRoom(groupRoomId);
  if (roomId) return <GroupRoomBanner roomId={roomId} />;
  return <>{fallback}</>;
}
