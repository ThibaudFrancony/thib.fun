"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client-request";
import { useActiveGroupRoom } from "@/lib/group-room";
import { GroupLaunchControls } from "@/components/group-launch-controls";
import { DEFAULT_TROU_NOIR_CONFIG, type TrouNoirCategory, type TrouNoirConfig } from "@/games/trou-noir/config";

const CATEGORY_LABELS: Array<{ value: TrouNoirCategory; label: string }> = [
  { value: "culture", label: "Culture" },
  { value: "histoire-geo", label: "Histoire-Géo" },
  { value: "cuisine", label: "Cuisine" },
  { value: "sport", label: "Sport" },
  { value: "sciences", label: "Sciences" },
];

export function TrouNoirSetup({ groupRoomId }: { groupRoomId?: string } = {}) {
  const router = useRouter();
  const [config, setConfig] = useState<TrouNoirConfig>(DEFAULT_TROU_NOIR_CONFIG);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { group, inGroup } = useActiveGroupRoom(groupRoomId);

  function toggleCategory(value: TrouNoirCategory) {
    setConfig((current) => ({
      ...current,
      categories: current.categories.includes(value)
        ? current.categories.filter((item) => item !== value)
        : [...current.categories, value],
    }));
  }

  async function createRoom() {
    if (config.categories.length === 0) {
      setError("Choisis au moins une catégorie.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await postJson<{ roomId?: string }>("/api/rooms", { requestId: crypto.randomUUID(), gameSlug: "trou-noir", config });
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
        <h2 className="geo-panel-title">{inGroup ? "Choisis les règles de la partie" : "Choisis vos règles"}</h2>
      </div>
      <div className="geo-form-stack">
        <label className="geo-label" htmlFor="tn-rounds">Manches</label>
        <select
          id="tn-rounds"
          value={config.maxRounds}
          onChange={(event) => setConfig((current) => ({ ...current, maxRounds: Number(event.target.value) as 5 | 10 }))}
          className="geo-select"
        >
          <option value={5}>5 manches · rapide</option>
          <option value={10}>10 manches · classique</option>
        </select>
        <label className="geo-label" htmlFor="tn-seconds">Temps par réponse</label>
        <select
          id="tn-seconds"
          value={config.answerSeconds}
          onChange={(event) => setConfig((current) => ({ ...current, answerSeconds: Number(event.target.value) as 30 | 60 | 90 }))}
          className="geo-select"
        >
          <option value={30}>30 secondes</option>
          <option value={60}>60 secondes</option>
          <option value={90}>90 secondes</option>
        </select>
      </div>
      <fieldset className="geo-radio-fieldset">
        <legend className="geo-label">Catégories (au moins une)</legend>
        <div className="geo-radio-grid">
          {CATEGORY_LABELS.map((category) => (
            <label key={category.value} className="geo-radio-card" data-selected={config.categories.includes(category.value)}>
              <input
                className="geo-visually-hidden"
                type="checkbox"
                checked={config.categories.includes(category.value)}
                onChange={() => toggleCategory(category.value)}
              />
              <span>
                <strong>{category.label}</strong>
                <small>Niveaux 3 à 6</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="geo-panel-note">
        Chacun commence avec 100 points de réserve. Bonne réponse : tu gardes tes points. Mauvaise réponse ou temps
        écoulé : −10. Le salon sera accessible avec un code à partager.
      </p>
      {error && <p role="alert" className="geo-error">{error}</p>}
      {inGroup ? <GroupLaunchControls gameSlug="trou-noir" config={config} group={group} /> : <button disabled={busy} onClick={createRoom} className="geo-primary-button">
        {busy ? "Création…" : "Créer le salon"}
      </button>}
    </section>
  );
}

export function TrouNoirRoomJoin() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function joinRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await postJson<{ roomId?: string }>("/api/rooms/join", { requestId: crypto.randomUUID(), code: code.trim().toUpperCase() });
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
      <label className="geo-label" htmlFor="tn-room-code">Code du salon</label>
      <input
        id="tn-room-code"
        required
        minLength={6}
        maxLength={6}
        pattern="[A-Za-z0-9]{6}"
        value={code}
        onChange={(event) => setCode(event.target.value.toUpperCase())}
        placeholder="ABC123"
        autoCapitalize="characters"
        autoComplete="off"
        className="geo-input geo-code-input"
      />
      {error && <p role="alert" className="geo-error">{error}</p>}
      <button disabled={busy} className="geo-secondary-button">{busy ? "Connexion…" : "Rejoindre le salon"}</button>
    </form>
  );
}
