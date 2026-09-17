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
    <section className="rounded-[1.75rem] border border-[var(--line)] bg-[var(--card)] p-6 shadow-[0_16px_36px_rgba(20,33,29,0.08)]">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6d28d9]">Créer une table</p>
      <h2 className="mt-2 text-2xl font-black">À l&apos;unisson</h2>
      <label className="mt-6 block text-sm font-bold" htmlFor="longueur-onde-rounds">Manches</label>
      <select
        id="longueur-onde-rounds"
        value={config.rounds}
        onChange={(event) => setConfig((current) => ({ ...current, rounds: Number(event.target.value) as LongueurOndeConfig["rounds"] }))}
        className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3"
      >
        <option value={6}>6 manches · express</option>
        <option value={8}>8 manches · standard</option>
        <option value={10}>10 manches · longue soirée</option>
      </select>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-bold" htmlFor="longueur-onde-clue-seconds">Temps pour l&apos;indice
          <select id="longueur-onde-clue-seconds" value={config.clueSeconds} onChange={(event) => setConfig((current) => ({ ...current, clueSeconds: Number(event.target.value) as LongueurOndeConfig["clueSeconds"] }))} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 font-normal">
            <option value={60}>60 secondes</option><option value={90}>90 secondes</option><option value={120}>120 secondes</option>
          </select>
        </label>
        <label className="block text-sm font-bold" htmlFor="longueur-onde-guess-seconds">Temps pour placer
          <select id="longueur-onde-guess-seconds" value={config.guessSeconds} onChange={(event) => setConfig((current) => ({ ...current, guessSeconds: Number(event.target.value) as LongueurOndeConfig["guessSeconds"] }))} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 font-normal">
            <option value={30}>30 secondes</option><option value={60}>60 secondes</option><option value={90}>90 secondes</option>
          </select>
        </label>
      </div>
      <p className="mt-5 rounded-2xl bg-[#f1eafe] p-4 text-sm leading-6 text-[#4c1d95]">Un joueur donne un indice, l&apos;autre place l&apos;aiguille. Les rôles changent à chaque manche.</p>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button type="button" disabled={busy} onClick={() => void createRoom()} className="mt-6 w-full rounded-full bg-[#6d28d9] px-4 py-3 font-bold text-white hover:bg-[#5b21b6]">
        {busy ? "Création…" : "Créer le salon À l'unisson"}
      </button>
    </section>
  );
}
