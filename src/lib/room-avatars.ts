"use client";

import { useEffect, useState } from "react";

/**
 * URLs signées des photos des membres d'un salon. Rafraîchies toutes les
 * 4 minutes (validité serveur 5 min), avec repli silencieux sur l'initiale.
 */
export function useRoomAvatars(roomId: string | null, memberIds: readonly string[]): Record<string, string> {
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const key = memberIds.join(",");

  useEffect(() => {
    if (!roomId || memberIds.length === 0) return;
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/rooms/${roomId}/avatars`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { avatars?: Record<string, string> };
        if (!cancelled && data.avatars) setAvatars(data.avatars);
      } catch {
        // Repli : initiales.
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 4 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, key]);

  if (!roomId) return {};
  return avatars;
}
