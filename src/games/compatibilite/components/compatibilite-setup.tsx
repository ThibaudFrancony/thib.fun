"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client-request";
import { useActiveGroupRoom } from "@/lib/group-room";
import { GroupLaunchControls } from "@/components/group-launch-controls";
import { DEFAULT_COMPATIBILITE_CONFIG, type CompatibiliteConfig } from "@/games/compatibilite/config";

const CATEGORY_LABELS: Record<CompatibiliteConfig["category"], string> = {
  quotidien: "Quotidien",
  absurde: "Absurde",
  amitie: "Amitié",
  couple: "Couple",
};

export function CompatibiliteSetup({ groupRoomId }: { groupRoomId?: string } = {}) {
  const router = useRouter();
  const [config, setConfig] = useState<CompatibiliteConfig>(DEFAULT_COMPATIBILITE_CONFIG);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { group, inGroup } = useActiveGroupRoom(groupRoomId);

  async function createRoom() {
    setBusy(true);
    setError(null);
    try {
      const result = await postJson<{ roomId?: string }>("/api/rooms", { requestId: crypto.randomUUID(), gameSlug: "compatibilite", config });
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
        <h2 className="geo-panel-title">{inGroup ? "Choisis les règles de la partie" : "Même réponse ?"}</h2>
      </div>
      <div className="geo-form-stack">
        <label className="geo-label" htmlFor="compatibilite-category">Catégorie</label>
        <select
          id="compatibilite-category"
          value={config.category}
          onChange={(event) => setConfig((current) => ({ ...current, category: event.target.value as CompatibiliteConfig["category"] }))}
          className="geo-select"
        >
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <label className="geo-label" htmlFor="compatibilite-count">Questions comparées</label>
        <select
          id="compatibilite-count"
          value={config.questionCount}
          onChange={(event) => setConfig((current) => ({ ...current, questionCount: Number(event.target.value) as CompatibiliteConfig["questionCount"] }))}
          className="geo-select"
        >
          <option value={10}>10 questions · express</option>
          <option value={15}>15 questions · détendu</option>
          <option value={20}>20 questions · longue soirée</option>
        </select>
      </div>
      <p className="geo-panel-note">
        Choisissez chacun une option, puis découvrez vos points communs. Une question peut être passée jusqu&apos;à trois fois, sans pénalité.
      </p>
      {config.category === "couple" && <p className="geo-panel-note">La catégorie Couple reste légère et n&apos;utilise pas de questions de santé, d&apos;argent ou de vie privée sensible.</p>}
      {error && <p role="alert" className="geo-error">{error}</p>}
      {inGroup ? <GroupLaunchControls gameSlug="compatibilite" config={config} group={group} /> : <button type="button" disabled={busy} onClick={() => void createRoom()} className="geo-primary-button">
        {busy ? "Création…" : "Créer le salon Même réponse ?"}
      </button>}
    </section>
  );
}
