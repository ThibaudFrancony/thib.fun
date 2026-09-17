"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client-request";
import { DEFAULT_NAVAL_CONFIG, type NavalConfig } from "@/games/bataille-navale/config";

export function BatailleNavaleSetup() {
  const router = useRouter();
  const [config, setConfig] = useState<NavalConfig>(DEFAULT_NAVAL_CONFIG);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    setBusy(true);
    setError(null);
    try {
      const result = await postJson<{ roomId?: string }>("/api/rooms", { requestId: crypto.randomUUID(), gameSlug: "bataille-navale", config });
      if (!result.ok || !result.data?.roomId) setError(result.ok ? "Impossible de créer le salon." : result.message);
      else router.push(`/salons/${result.data.roomId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[1.75rem] border border-[var(--line)] bg-[var(--card)] p-6 shadow-[0_16px_36px_rgba(20,33,29,0.08)]">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6d28d9]">Créer une table</p>
      <h2 className="mt-2 text-2xl font-black">Flotte cachée, 17 cases à couler</h2>
      <label className="mt-6 block text-sm font-bold" htmlFor="naval-turn-seconds">Chronomètre de tir</label>
      <select
        id="naval-turn-seconds"
        aria-label="Chronomètre de tir"
        value={config.turnSeconds === null ? "none" : String(config.turnSeconds)}
        onChange={(event) =>
          setConfig((current) => ({
            ...current,
            turnSeconds: event.target.value === "none" ? null : 60,
          }))
        }
        className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3"
      >
        <option value="none">Sans chrono · partie tranquille</option>
        <option value="60">60 secondes · tir auto en cas de retard</option>
      </select>
      <div className="mt-5 rounded-2xl bg-[#f1eafe] p-4 text-sm leading-6 text-[#4c1d95]">
        Place tes cinq bateaux en secret, puis coule la flotte adverse case par case.
        Toucher ne fait pas rejouer. Les bateaux peuvent se toucher.
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button disabled={busy} onClick={() => void createRoom()} className="mt-6 w-full rounded-full bg-[#6d28d9] px-4 py-3 font-bold text-white hover:bg-[#5b21b6]">
        {busy ? "Création…" : "Créer le salon Flotte cachée"}
      </button>
    </section>
  );
}
