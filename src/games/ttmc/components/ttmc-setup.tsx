"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client-request";
import { DEFAULT_TTMC_CONFIG, type TtmcConfig } from "@/games/ttmc/config";

export function TtmcSetup() {
  const router = useRouter();
  const [config, setConfig] = useState<TtmcConfig>(DEFAULT_TTMC_CONFIG);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setTarget(targetScore: 20 | 30 | 50) {
    setConfig((current) => ({
      ...current,
      targetScore,
      maxRounds: targetScore === 20 ? 15 : targetScore === 30 ? 20 : 30,
    }));
  }

  async function createRoom() {
    setBusy(true);
    setError(null);
    try {
      const result = await postJson<{ roomId?: string }>("/api/rooms", { requestId: crypto.randomUUID(), gameSlug: "ttmc", config });
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
        <h2 className="geo-panel-title">Choisis vos règles</h2>
      </div>
      <div className="geo-form-stack">
        <label className="geo-label" htmlFor="ttmc-target">Score à atteindre</label>
        <select
          id="ttmc-target"
          value={config.targetScore}
          onChange={(event) => setTarget(Number(event.target.value) as 20 | 30 | 50)}
          className="geo-select"
        >
          <option value={20}>20 points · 15 manches · rapide</option>
          <option value={30}>30 points · 20 manches · classique</option>
          <option value={50} disabled>50 points · 30 manches · marathon (32 thèmes requis, pack actuel : 22)</option>
        </select>
        <label className="geo-label" htmlFor="ttmc-seconds">Temps par réponse</label>
        <select
          id="ttmc-seconds"
          value={config.answerSeconds}
          onChange={(event) =>
            setConfig((current) => ({ ...current, answerSeconds: Number(event.target.value) as 30 | 60 | 90 }))
          }
          className="geo-select"
        >
          <option value={30}>30 secondes</option>
          <option value={60}>60 secondes</option>
          <option value={90}>90 secondes</option>
        </select>
      </div>
      <p className="geo-panel-note">
        Chacun part de 0. Choisis un niveau de 1 à 10 avant de voir la question : bonne réponse, tu avances du
        niveau choisi ; mauvaise, tu restes en place. La manche va toujours à son terme avant de comparer les
        scores. Le choix du niveau dure 20 secondes. Le marathon 50 exige 32 thèmes : indisponible avec le pack
        actuel de 22 thèmes, le serveur refuse aussi son démarrage.
      </p>
      {error && <p role="alert" className="geo-error">{error}</p>}
      <button disabled={busy} onClick={createRoom} className="geo-primary-button">
        {busy ? "Création…" : "Créer le salon"}
      </button>
    </section>
  );
}

export function TtmcRoomJoin() {
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
      <label className="geo-label" htmlFor="ttmc-room-code">Code du salon</label>
      <input
        id="ttmc-room-code"
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
