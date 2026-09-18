"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client-request";
import { DEFAULT_BOMBPARTY_CONFIG, type BombpartyConfig } from "@/games/bombparty/config";

export function BombpartySetup() {
  const router = useRouter();
  const [config, setConfig] = useState<BombpartyConfig>(DEFAULT_BOMBPARTY_CONFIG);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    setBusy(true);
    setError(null);
    try {
      const result = await postJson<{ roomId?: string }>("/api/rooms", { requestId: crypto.randomUUID(), gameSlug: "bombparty", config });
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
        <h2 className="geo-panel-title">Syllabe Express, le mot juste avant le chrono</h2>
      </div>
      <div className="geo-form-stack">
        <label className="geo-label" htmlFor="bombparty-lives">Vies par joueur</label>
        <select
          id="bombparty-lives"
          aria-label="Vies par joueur"
          value={config.lives}
          onChange={(event) => setConfig((current) => ({ ...current, lives: Number(event.target.value) as BombpartyConfig["lives"] }))}
          className="geo-select"
        >
          <option value={3}>3 vies · nerveux</option>
          <option value={5}>5 vies · classique</option>
        </select>
        <label className="geo-label" htmlFor="bombparty-seconds">Temps de départ par tour</label>
        <select
          id="bombparty-seconds"
          aria-label="Temps de départ par tour"
          value={config.initialSeconds}
          onChange={(event) => setConfig((current) => ({ ...current, initialSeconds: Number(event.target.value) as BombpartyConfig["initialSeconds"] }))}
          className="geo-select"
        >
          <option value={10}>10 secondes · éclair</option>
          <option value={15}>15 secondes · classique</option>
          <option value={20}>20 secondes · tranquille</option>
        </select>
        <label className="geo-label" htmlFor="bombparty-difficulty">Difficulté des séquences</label>
        <select
          id="bombparty-difficulty"
          aria-label="Difficulté des séquences"
          value={config.sequenceDifficulty}
          onChange={(event) => setConfig((current) => ({ ...current, sequenceDifficulty: event.target.value as BombpartyConfig["sequenceDifficulty"] }))}
          className="geo-select"
        >
          <option value="easy">Facile · séquences fréquentes</option>
          <option value="normal">Normal · séquences variées</option>
          <option value="hard">Difficile · séquences rares</option>
        </select>
      </div>
      <p className="geo-panel-note">
        Une séquence de 2 ou 3 lettres s&apos;affiche : propose un mot du dictionnaire qui la contient.
        Chaque mot accepté passe la main. Le chrono raccourcit au fil des mots valides, puis chaque
        temps écoulé coûte une vie.
      </p>
      {error && <p role="alert" className="geo-error">{error}</p>}
      <button disabled={busy} onClick={() => void createRoom()} className="geo-primary-button">
        {busy ? "Création…" : "Créer le salon Syllabe Express"}
      </button>
    </section>
  );
}
