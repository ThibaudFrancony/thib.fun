"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client-request";
import type { GroupRoomState } from "@/lib/group-room";

/**
 * Bouton de lancement en mode « groupe » : l'hôte pose le jeu et la
 * configuration, puis la route serveur démarre la partie. L'invité attend et
 * sera redirigé automatiquement par `useGroupRoom` dès que la partie démarre.
 */
export function GroupLaunchControls({
  gameSlug,
  config,
  group,
}: {
  gameSlug: string;
  config: Record<string, unknown>;
  group: GroupRoomState;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const room = group.room;
  const canLaunch = Boolean(room && room.status === "waiting" && group.memberCount === 2);

  async function launch() {
    if (!room) return;
    setBusy(true);
    setError(null);
    try {
      const prepared = await postJson<{ version?: number }>(`/api/lobbies/${room.roomId}/prepare`, {
        commandId: crypto.randomUUID(),
        expectedVersion: room.version,
        gameSlug,
        config,
      });
      if (!prepared.ok) {
        setError(prepared.message);
        return;
      }
      const started = await postJson<{ matchId?: string }>(`/api/rooms/${room.roomId}/start`, { commandId: crypto.randomUUID() });
      if (!started.ok || !started.data?.matchId) {
        setError(started.ok ? "Impossible de lancer la partie." : started.message);
        return;
      }
      router.push(`/parties/${started.data.matchId}`);
    } finally {
      setBusy(false);
    }
  }

  if (!room) {
    return <p className="geo-panel-note">{group.error ?? "Connexion au groupe…"}</p>;
  }

  if (!group.isHost) {
    return (
      <p className="geo-panel-note">
        {group.memberCount < 2 ? "En attente du deuxième joueur…" : "L'hôte prépare la partie : elle démarrera automatiquement."}
      </p>
    );
  }

  return (
    <>
      {group.memberCount < 2 && <p className="geo-panel-note">En attente du deuxième joueur…</p>}
      {error && <p role="alert" className="geo-error">{error}</p>}
      <button type="button" disabled={busy || !canLaunch} onClick={() => void launch()} className="geo-primary-button">
        {busy ? "Lancement…" : "Jouer"}
      </button>
    </>
  );
}
