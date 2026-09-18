"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client-request";
import { useGroupRoom } from "@/lib/group-room";

/**
 * Bandeau affiché sur une page de jeu quand le joueur est déjà dans un salon
 * d'accueil. Il remplace l'interface « créer / rejoindre ».
 */
export function GroupRoomBanner({ roomId }: { roomId: string }) {
  const router = useRouter();
  const group = useGroupRoom(roomId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const room = group.room;

  async function leave() {
    if (!room) return;
    if (!window.confirm("Quitter le groupe ? Ta place sera libérée.")) return;
    setBusy(true);
    setError(null);
    try {
      const result = await postJson<{ closed?: boolean }>(`/salons/${roomId}/actions`, {
        commandId: crypto.randomUUID(),
        expectedVersion: room.version,
        action: { type: "LEAVE" },
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push("/");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="geo-panel group-room-banner">
      <div>
        <p className="geo-kicker geo-kicker-warm">Groupe</p>
        <p className="geo-panel-note">
          {room ? `Code ${room.code} · ${group.memberCount}/2 joueur${group.memberCount > 1 ? "s" : ""}` : "Connexion au groupe…"}
        </p>
      </div>
      {error && <p role="alert" className="geo-error">{error}</p>}
      <button type="button" disabled={busy || !room} onClick={() => void leave()} className="geo-secondary-button">
        Quitter le groupe
      </button>
    </section>
  );
}
