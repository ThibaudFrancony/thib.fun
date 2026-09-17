"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client-request";
import { DEFAULT_GEO_CONFIG, type GeoConfig } from "@/games/geographie/config";

export function GeographySetup() {
  const router = useRouter();
  const [config, setConfig] = useState<GeoConfig>(DEFAULT_GEO_CONFIG);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<Key extends keyof GeoConfig>(key: Key, value: GeoConfig[Key]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  async function createRoom() {
    setBusy(true);
    setError(null);
    try {
      const result = await postJson<{ roomId?: string }>("/api/rooms", { requestId: crypto.randomUUID(), gameSlug: "geographie", config });
      if (!result.ok || !result.data?.roomId) setError(result.ok ? "Impossible de créer le salon." : result.message);
      else router.push(`/salons/${result.data.roomId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="geo-panel geo-setup-panel">
      <div className="geo-panel-heading"><p className="geo-kicker geo-kicker-accent">Créer une table</p><h2 className="geo-panel-title">Choisis vos règles</h2></div>
      <div className="geo-form-stack">
        <label className="geo-label" htmlFor="rounds">Manches</label>
        <select id="rounds" value={config.rounds} onChange={(event) => update("rounds", Number(event.target.value) as GeoConfig["rounds"])} className="geo-select"><option value={5}>5 manches · rapide</option><option value={10}>10 manches · classique</option><option value={15}>15 manches · longue</option></select>
        <label className="geo-label" htmlFor="turnSeconds">Temps par placement</label>
        <select id="turnSeconds" value={config.turnSeconds} onChange={(event) => update("turnSeconds", Number(event.target.value) as GeoConfig["turnSeconds"])} className="geo-select"><option value={30}>30 secondes</option><option value={60}>60 secondes</option><option value={90}>90 secondes</option></select>
        <label className="geo-label" htmlFor="difficulty">Villes</label>
        <select id="difficulty" value={config.difficulty} onChange={(event) => update("difficulty", event.target.value as GeoConfig["difficulty"])} className="geo-select"><option value="easy">Grandes villes</option><option value="medium">Villes moyennes</option><option value="hard">Toutes les communes du pack</option></select>
      </div>
      <fieldset className="geo-radio-fieldset"><legend className="geo-label">Sélection des villes</legend><div className="geo-radio-grid"><label className="geo-radio-card" data-selected={config.selection === "random"}><input className="geo-visually-hidden" type="radio" name="selection" checked={config.selection === "random"} onChange={() => update("selection", "random")} /> <span><strong>Aléatoire</strong><small>Sans remise</small></span></label><label className="geo-radio-card" data-selected={config.selection === "challenge"}><input className="geo-visually-hidden" type="radio" name="selection" checked={config.selection === "challenge"} onChange={() => update("selection", "challenge")} /> <span><strong>Défi</strong><small>Vous les proposez</small></span></label></div></fieldset>
      <p className="geo-panel-note">Le salon sera accessible avec un code à partager. Il faut deux comptes connectés pour lancer la partie.</p>
      {error && <p role="alert" className="geo-error">{error}</p>}
      <button disabled={busy} onClick={createRoom} className="geo-primary-button">{busy ? "Création…" : "Créer le salon"}</button>
    </section>
  );
}

export function RoomJoin() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function joinRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await postJson<{ roomId?: string }>("/api/rooms/join", {
        requestId: crypto.randomUUID(),
        code: code.trim().toUpperCase(),
      });
      if (!result.ok || !result.data?.roomId) setError(result.ok ? "Impossible de rejoindre ce salon." : result.message);
      else router.push(`/salons/${result.data.roomId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={joinRoom} className="geo-panel geo-join-panel">
      <p className="geo-kicker geo-kicker-warm">Rejoindre une table</p>
      <p className="geo-subtitle">Tu as reçu un code ?</p>
      <label className="geo-label" htmlFor="room-code">Code du salon</label>
      <input id="room-code" required minLength={6} maxLength={6} pattern="[A-Za-z0-9]{6}" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="ABC123" autoCapitalize="characters" autoComplete="off" className="geo-input geo-code-input" />
      {error && <p role="alert" className="geo-error">{error}</p>}
      <button disabled={busy} className="geo-secondary-button">{busy ? "Connexion…" : "Rejoindre le salon"}</button>
    </form>
  );
}
