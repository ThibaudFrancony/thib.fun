"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client-request";
import { DEFAULT_LONGUEUR_ONDE_CONFIG, type LongueurOndeConfig } from "@/games/longueur-onde/config";

export function LongueurOndeSetup() {
  const router = useRouter();
  const [config, setConfig] = useState<LongueurOndeConfig>(DEFAULT_LONGUEUR_ONDE_CONFIG);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    setBusy(true);
    setError(null);
    try {
      const result = await postJson<{ roomId?: string }>("/api/rooms", { requestId: crypto.randomUUID(), gameSlug: "longueur-onde", config });
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
        <h2 className="geo-panel-title">À l&apos;unisson</h2>
      </div>
      <div className="geo-form-stack">
        <label className="geo-label" htmlFor="longueur-onde-rounds">Manches</label>
        <select
          id="longueur-onde-rounds"
          value={config.rounds}
          onChange={(event) => setConfig((current) => ({ ...current, rounds: Number(event.target.value) as LongueurOndeConfig["rounds"] }))}
          className="geo-select"
        >
          <option value={6}>6 manches · express</option>
          <option value={8}>8 manches · standard</option>
          <option value={10}>10 manches · longue soirée</option>
        </select>
        <label className="geo-label" htmlFor="longueur-onde-clue-seconds">Temps pour l&apos;indice</label>
        <select id="longueur-onde-clue-seconds" value={config.clueSeconds} onChange={(event) => setConfig((current) => ({ ...current, clueSeconds: Number(event.target.value) as LongueurOndeConfig["clueSeconds"] }))} className="geo-select">
          <option value={60}>60 secondes</option><option value={90}>90 secondes</option><option value={120}>120 secondes</option>
        </select>
        <label className="geo-label" htmlFor="longueur-onde-guess-seconds">Temps pour placer</label>
        <select id="longueur-onde-guess-seconds" value={config.guessSeconds} onChange={(event) => setConfig((current) => ({ ...current, guessSeconds: Number(event.target.value) as LongueurOndeConfig["guessSeconds"] }))} className="geo-select">
          <option value={30}>30 secondes</option><option value={60}>60 secondes</option><option value={90}>90 secondes</option>
        </select>
      </div>
      <p className="geo-panel-note">Un joueur donne un indice, l&apos;autre place l&apos;aiguille. Les rôles changent à chaque manche.</p>
      {error && <p role="alert" className="geo-error">{error}</p>}
      <button type="button" disabled={busy} onClick={() => void createRoom()} className="geo-primary-button">
        {busy ? "Création…" : "Créer le salon À l'unisson"}
      </button>
    </section>
  );
}
