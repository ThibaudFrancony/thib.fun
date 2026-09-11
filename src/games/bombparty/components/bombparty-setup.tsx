"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_BOMBPARTY_CONFIG, type BombpartyConfig } from "@/games/bombparty/config";

export function BombpartySetup() {
  const router = useRouter();
  const [config, setConfig] = useState<BombpartyConfig>(DEFAULT_BOMBPARTY_CONFIG);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId: crypto.randomUUID(), gameSlug: "bombparty", config }),
    });
    const data = (await response.json().catch(() => null)) as { roomId?: string; error?: { message?: string } } | null;
    if (!response.ok || !data?.roomId) setError(data?.error?.message ?? "Impossible de créer le salon.");
    else router.push(`/salons/${data.roomId}`);
    setBusy(false);
  }

  return (
    <section className="rounded-[1.75rem] border border-[var(--line)] bg-[var(--card)] p-6 shadow-[0_16px_36px_rgba(20,33,29,0.08)]">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6d28d9]">Créer une table</p>
      <h2 className="mt-2 text-2xl font-black">Syllabe Express, le mot juste avant le chrono</h2>
      <label className="mt-6 block text-sm font-bold" htmlFor="bombparty-lives">Vies par joueur</label>
      <select
        id="bombparty-lives"
        aria-label="Vies par joueur"
        value={config.lives}
        onChange={(event) => setConfig((current) => ({ ...current, lives: Number(event.target.value) as BombpartyConfig["lives"] }))}
        className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3"
      >
        <option value={3}>3 vies · nerveux</option>
        <option value={5}>5 vies · classique</option>
      </select>
      <label className="mt-4 block text-sm font-bold" htmlFor="bombparty-seconds">Temps de départ par tour</label>
      <select
        id="bombparty-seconds"
        aria-label="Temps de départ par tour"
        value={config.initialSeconds}
        onChange={(event) => setConfig((current) => ({ ...current, initialSeconds: Number(event.target.value) as BombpartyConfig["initialSeconds"] }))}
        className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3"
      >
        <option value={10}>10 secondes · éclair</option>
        <option value={15}>15 secondes · classique</option>
        <option value={20}>20 secondes · tranquille</option>
      </select>
      <label className="mt-4 block text-sm font-bold" htmlFor="bombparty-difficulty">Difficulté des séquences</label>
      <select
        id="bombparty-difficulty"
        aria-label="Difficulté des séquences"
        value={config.sequenceDifficulty}
        onChange={(event) => setConfig((current) => ({ ...current, sequenceDifficulty: event.target.value as BombpartyConfig["sequenceDifficulty"] }))}
        className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3"
      >
        <option value="easy">Facile · séquences fréquentes</option>
        <option value="normal">Normal · séquences variées</option>
        <option value="hard">Difficile · séquences rares</option>
      </select>
      <div className="mt-5 rounded-2xl bg-[#f1eafe] p-4 text-sm leading-6 text-[#4c1d95]">
        Une séquence de 2 ou 3 lettres s&apos;affiche : propose un mot du dictionnaire qui la contient.
        Chaque mot accepté passe la main. Le chrono raccourcit au fil des mots valides, puis chaque
        temps écoulé coûte une vie.
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button disabled={busy} onClick={() => void createRoom()} className="mt-6 w-full rounded-full bg-[#6d28d9] px-4 py-3 font-bold text-white hover:bg-[#5b21b6]">
        {busy ? "Création…" : "Créer le salon Syllabe Express"}
      </button>
    </section>
  );
}
