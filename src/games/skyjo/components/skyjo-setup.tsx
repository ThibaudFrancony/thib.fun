"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_SKYJO_CONFIG, type SkyjoConfig } from "@/games/skyjo/config";

export function SkyjoSetup() {
  const router = useRouter();
  const [config, setConfig] = useState<SkyjoConfig>(DEFAULT_SKYJO_CONFIG);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId: crypto.randomUUID(), gameSlug: "skyjo", config }),
    });
    const data = (await response.json().catch(() => null)) as { roomId?: string; error?: { message?: string } } | null;
    if (!response.ok || !data?.roomId) setError(data?.error?.message ?? "Impossible de créer le salon.");
    else router.push(`/salons/${data.roomId}`);
    setBusy(false);
  }

  return (
    <section className="rounded-[1.75rem] border border-[var(--line)] bg-[var(--card)] p-6 shadow-[0_16px_36px_rgba(20,33,29,0.08)]">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6d28d9]">Créer une table</p>
      <h2 className="mt-2 text-2xl font-black">Douze cases, le plus petit total gagne</h2>
      <label className="mt-6 block text-sm font-bold" htmlFor="skyjo-format">Format de partie</label>
      <select
        id="skyjo-format"
        aria-label="Format de partie"
        value={config.format}
        onChange={(event) => setConfig((current) => ({ ...current, format: event.target.value as SkyjoConfig["format"] }))}
        className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3"
      >
        <option value="short">Rapide · 3 manches</option>
        <option value="full">Complet · jusqu&apos;à 100 points</option>
      </select>
      <label className="mt-4 block text-sm font-bold" htmlFor="skyjo-turn-seconds">Temps par tour</label>
      <select
        id="skyjo-turn-seconds"
        aria-label="Temps par tour"
        value={config.turnSeconds}
        onChange={(event) => setConfig((current) => ({ ...current, turnSeconds: Number(event.target.value) as SkyjoConfig["turnSeconds"] }))}
        className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3"
      >
        <option value={30}>30 secondes · nerveux</option>
        <option value={60}>60 secondes · classique</option>
        <option value={90}>90 secondes · tranquille</option>
      </select>
      <div className="mt-5 rounded-2xl bg-[#f1eafe] p-4 text-sm leading-6 text-[#4c1d95]">
        Révèle deux cartes, puis pioche ou prends la défausse pour réduire ton total. Trois cartes identiques en
        colonne disparaissent. Celui qui finit en premier offre un dernier tour à son adversaire.
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button disabled={busy} onClick={() => void createRoom()} className="mt-6 w-full rounded-full bg-[#6d28d9] px-4 py-3 font-bold text-white hover:bg-[#5b21b6]">
        {busy ? "Création…" : "Créer le salon Douze cases"}
      </button>
    </section>
  );
}
