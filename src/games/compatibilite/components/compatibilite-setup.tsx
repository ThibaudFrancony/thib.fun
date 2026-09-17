"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client-request";
import { DEFAULT_COMPATIBILITE_CONFIG, type CompatibiliteConfig } from "@/games/compatibilite/config";

const CATEGORY_LABELS: Record<CompatibiliteConfig["category"], string> = {
  quotidien: "Quotidien",
  absurde: "Absurde",
  amitie: "Amitié",
  couple: "Couple",
};

export function CompatibiliteSetup() {
  const router = useRouter();
  const [config, setConfig] = useState<CompatibiliteConfig>(DEFAULT_COMPATIBILITE_CONFIG);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <section className="rounded-[1.75rem] border border-[var(--line)] bg-[var(--card)] p-6 shadow-[0_16px_36px_rgba(20,33,29,0.08)]">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6d28d9]">Créer une table</p>
      <h2 className="mt-2 text-2xl font-black">Même réponse ?</h2>
      <label className="mt-6 block text-sm font-bold" htmlFor="compatibilite-category">Catégorie</label>
      <select
        id="compatibilite-category"
        value={config.category}
        onChange={(event) => setConfig((current) => ({ ...current, category: event.target.value as CompatibiliteConfig["category"] }))}
        className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3"
      >
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <label className="mt-4 block text-sm font-bold" htmlFor="compatibilite-count">Questions comparées</label>
      <select
        id="compatibilite-count"
        value={config.questionCount}
        onChange={(event) => setConfig((current) => ({ ...current, questionCount: Number(event.target.value) as CompatibiliteConfig["questionCount"] }))}
        className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3"
      >
        <option value={10}>10 questions · express</option>
        <option value={15}>15 questions · détendu</option>
        <option value={20}>20 questions · longue soirée</option>
      </select>
      <div className="mt-5 rounded-2xl bg-[#f1eafe] p-4 text-sm leading-6 text-[#4c1d95]">
        Choisissez chacun une option, puis découvrez vos points communs. Une question peut être passée jusqu&apos;à trois fois, sans pénalité.
      </div>
      {config.category === "couple" && <p className="mt-3 text-xs leading-5 text-[var(--muted)]">La catégorie Couple reste légère et n&apos;utilise pas de questions de santé, d&apos;argent ou de vie privée sensible.</p>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button type="button" disabled={busy} onClick={() => void createRoom()} className="mt-6 w-full rounded-full bg-[#6d28d9] px-4 py-3 font-bold text-white hover:bg-[#5b21b6]">
        {busy ? "Création…" : "Créer le salon Même réponse ?"}
      </button>
    </section>
  );
}
