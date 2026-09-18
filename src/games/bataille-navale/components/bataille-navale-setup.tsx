"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client-request";
import { DEFAULT_NAVAL_CONFIG, type NavalConfig } from "@/games/bataille-navale/config";

export function BatailleNavaleSetup() {
  const router = useRouter();
  const [config, setConfig] = useState<NavalConfig>(DEFAULT_NAVAL_CONFIG);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    setBusy(true);
    setError(null);
    try {
      const result = await postJson<{ roomId?: string }>("/api/rooms", { requestId: crypto.randomUUID(), gameSlug: "bataille-navale", config });
      if (!result.ok || !result.data?.roomId) setError(result.ok ? "Impossible de créer le salon." : result.message);
      else router.push(`/salons/${result.data.roomId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="geo-panel geo-setup-panel">
      <div className="geo-panel-heading">
        <p className="geo-kicker geo-kicker-accent">Créer une table</p>
        <h2 className="geo-panel-title">Flotte cachée, 17 cases à couler</h2>
      </div>
      <div className="geo-form-stack">
        <label className="geo-label" htmlFor="naval-turn-seconds">Chronomètre de tir</label>
        <select
          id="naval-turn-seconds"
          aria-label="Chronomètre de tir"
          value={config.turnSeconds === null ? "none" : String(config.turnSeconds)}
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              turnSeconds: event.target.value === "none" ? null : 60,
            }))
          }
          className="geo-select"
        >
          <option value="none">Sans chrono · partie tranquille</option>
          <option value="60">60 secondes · tir auto en cas de retard</option>
        </select>
      </div>
      <p className="geo-panel-note">
        Place tes cinq bateaux en secret, puis coule la flotte adverse case par case.
        Toucher ne fait pas rejouer. Les bateaux peuvent se toucher.
      </p>
      {error && <p role="alert" className="geo-error">{error}</p>}
      <button disabled={busy} onClick={() => void createRoom()} className="geo-primary-button">
        {busy ? "Création…" : "Créer le salon Flotte cachée"}
      </button>
    </section>
  );
}
