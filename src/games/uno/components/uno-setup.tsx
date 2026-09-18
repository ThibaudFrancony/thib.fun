"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client-request";
import { useGroupRoom } from "@/lib/group-room";
import { GroupLaunchControls } from "@/components/group-launch-controls";
import { DEFAULT_UNO_CONFIG, type UnoConfig } from "@/games/uno/config";
import { RoomJoin } from "@/games/geographie/components/geography-setup";

export function UnoSetup({ groupRoomId }: { groupRoomId?: string } = {}) {
  const router = useRouter();
  const [config, setConfig] = useState<UnoConfig>(DEFAULT_UNO_CONFIG);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const group = useGroupRoom(groupRoomId ?? null);
  const inGroup = Boolean(groupRoomId);

  async function createRoom() {
    setBusy(true);
    setError(null);
    try {
      const result = await postJson<{ roomId?: string }>("/api/rooms", { requestId: crypto.randomUUID(), gameSlug: "uno", config });
      if (!result.ok || !result.data?.roomId) setError(result.ok ? "Impossible de créer le salon." : result.message);
      else router.push(`/salons/${result.data.roomId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="geo-panel geo-setup-panel">
      <div className="geo-panel-heading">
        <p className="geo-kicker geo-kicker-accent">{inGroup ? "Groupe" : "Créer une table"}</p>
        <h2 className="geo-panel-title">{inGroup ? "Choisis les règles de la partie" : "Une partie classique à deux"}</h2>
      </div>
      <div className="geo-form-stack">
        <label className="geo-label" htmlFor="uno-turn-seconds">Temps par tour</label>
        <select id="uno-turn-seconds" aria-label="Temps par tour" value={config.turnSeconds} onChange={(event) => setConfig((current) => ({ ...current, turnSeconds: Number(event.target.value) as UnoConfig["turnSeconds"] }))} className="geo-select">
          <option value={20}>20 secondes · nerveux</option>
          <option value={30}>30 secondes · classique</option>
          <option value={60}>60 secondes · tranquille</option>
        </select>
      </div>
      <p className="geo-panel-note">
        108 cartes, 7 cartes chacun, pas de cumul de pénalités. Le +4 n&apos;est jouable que si tu n&apos;as aucune carte de la couleur active.
      </p>
      {error && <p role="alert" className="geo-error">{error}</p>}
      {inGroup ? <GroupLaunchControls gameSlug="uno" config={config} group={group} /> : <button disabled={busy} onClick={() => void createRoom()} className="geo-primary-button">{busy ? "Création…" : "Créer le salon UNO"}</button>}
    </section>
  );
}

export { RoomJoin };
