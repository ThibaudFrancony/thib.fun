"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client-request";
import { DEFAULT_SKYJO_CONFIG, type SkyjoConfig } from "@/games/skyjo/config";

export function SkyjoSetup() {
  const router = useRouter();
  const [config, setConfig] = useState<SkyjoConfig>(DEFAULT_SKYJO_CONFIG);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    setBusy(true);
    setError(null);
    try {
      const result = await postJson<{ roomId?: string }>("/api/rooms", { requestId: crypto.randomUUID(), gameSlug: "skyjo", config });
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
        <h2 className="geo-panel-title">Douze cases, le plus petit total gagne</h2>
      </div>
      <div className="geo-form-stack">
        <label className="geo-label" htmlFor="skyjo-format">Format de partie</label>
        <select
          id="skyjo-format"
          aria-label="Format de partie"
          value={config.format}
          onChange={(event) => setConfig((current) => ({ ...current, format: event.target.value as SkyjoConfig["format"] }))}
          className="geo-select"
        >
          <option value="short">Rapide · 3 manches</option>
          <option value="full">Complet · jusqu&apos;à 100 points</option>
        </select>
        <label className="geo-label" htmlFor="skyjo-turn-seconds">Temps par tour</label>
        <select
          id="skyjo-turn-seconds"
          aria-label="Temps par tour"
          value={config.turnSeconds}
          onChange={(event) => setConfig((current) => ({ ...current, turnSeconds: Number(event.target.value) as SkyjoConfig["turnSeconds"] }))}
          className="geo-select"
        >
          <option value={30}>30 secondes · nerveux</option>
          <option value={60}>60 secondes · classique</option>
          <option value={90}>90 secondes · tranquille</option>
        </select>
      </div>
      <p className="geo-panel-note">
        Révèle deux cartes, puis pioche ou prends la défausse pour réduire ton total. Trois cartes identiques en
        colonne disparaissent. Celui qui finit en premier offre un dernier tour à son adversaire.
      </p>
      {error && <p role="alert" className="geo-error">{error}</p>}
      <button disabled={busy} onClick={() => void createRoom()} className="geo-primary-button">
        {busy ? "Création…" : "Créer le salon Douze cases"}
      </button>
    </section>
  );
}
