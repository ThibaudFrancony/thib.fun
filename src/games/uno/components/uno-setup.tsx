"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_UNO_CONFIG, type UnoConfig } from "@/games/uno/config";
import { RoomJoin } from "@/games/geographie/components/geography-setup";

export function UnoSetup() {
  const router = useRouter();
  const [config, setConfig] = useState<UnoConfig>(DEFAULT_UNO_CONFIG);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId: crypto.randomUUID(), gameSlug: "uno", config }),
    });
    const data = await response.json().catch(() => null) as { roomId?: string; error?: { message?: string } } | null;
    if (!response.ok || !data?.roomId) setError(data?.error?.message ?? "Impossible de créer le salon.");
    else router.push(`/salons/${data.roomId}`);
    setBusy(false);
  }

  return (
    <section className="rounded-[1.75rem] border border-[var(--line)] bg-[var(--card)] p-6 shadow-[0_16px_36px_rgba(20,33,29,0.08)]">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#b23853]">Créer une table</p>
      <h2 className="mt-2 text-2xl font-black">Une partie classique à deux</h2>
      <label className="mt-6 block text-sm font-bold" htmlFor="uno-turn-seconds">Temps par tour</label>
      <select id="uno-turn-seconds" aria-label="Temps par tour" value={config.turnSeconds} onChange={(event) => setConfig((current) => ({ ...current, turnSeconds: Number(event.target.value) as UnoConfig["turnSeconds"] }))} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3">
        <option value={20}>20 secondes · nerveux</option>
        <option value={30}>30 secondes · classique</option>
        <option value={60}>60 secondes · tranquille</option>
      </select>
      <div className="mt-5 rounded-2xl bg-[#fff0f3] p-4 text-sm leading-6 text-[#672538]">
        108 cartes, 7 cartes chacun, pas de cumul de pénalités. Le +4 n&apos;est jouable que si tu n&apos;as aucune carte de la couleur active.
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button disabled={busy} onClick={() => void createRoom()} className="mt-6 w-full rounded-full bg-[#b23853] px-4 py-3 font-bold text-white hover:bg-[#8f2942]">{busy ? "Création…" : "Créer le salon UNO"}</button>
    </section>
  );
}

export { RoomJoin };
