"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    const response = await fetch("/api/rooms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: crypto.randomUUID(), gameSlug: "geographie", config }) });
    const data = await response.json().catch(() => null) as { roomId?: string; error?: { message?: string } } | null;
    if (!response.ok || !data?.roomId) setError(data?.error?.message ?? "Impossible de créer le salon.");
    else router.push(`/salons/${data.roomId}`);
    setBusy(false);
  }

  return (
    <section className="rounded-[1.75rem] border border-[var(--line)] bg-[var(--card)] p-6 shadow-[0_16px_36px_rgba(20,33,29,0.08)]">
      <div className="mb-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--green)]">Créer une table</p><h2 className="mt-2 text-2xl font-black">Choisis vos règles</h2></div>
      <label className="block text-sm font-bold" htmlFor="rounds">Manches</label>
      <select id="rounds" value={config.rounds} onChange={(event) => update("rounds", Number(event.target.value) as GeoConfig["rounds"])} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3"><option value={5}>5 manches · rapide</option><option value={10}>10 manches · classique</option><option value={15}>15 manches · longue</option></select>
      <label className="mt-4 block text-sm font-bold" htmlFor="turnSeconds">Temps par placement</label>
      <select id="turnSeconds" value={config.turnSeconds} onChange={(event) => update("turnSeconds", Number(event.target.value) as GeoConfig["turnSeconds"])} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3"><option value={30}>30 secondes</option><option value={60}>60 secondes</option><option value={90}>90 secondes</option></select>
      <label className="mt-4 block text-sm font-bold" htmlFor="difficulty">Villes</label>
      <select id="difficulty" value={config.difficulty} onChange={(event) => update("difficulty", event.target.value as GeoConfig["difficulty"])} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3"><option value="easy">Grandes villes</option><option value="medium">Villes moyennes</option><option value="hard">Toutes les communes du pack</option></select>
      <fieldset className="mt-5"><legend className="text-sm font-bold">Sélection des villes</legend><div className="mt-2 grid grid-cols-2 gap-2"><label className={`rounded-xl border p-3 text-sm ${config.selection === "random" ? "border-[var(--green)] bg-[var(--green)]/10" : "border-[var(--line)]"}`}><input className="sr-only" type="radio" name="selection" checked={config.selection === "random"} onChange={() => update("selection", "random")} />Aléatoire<span className="mt-1 block text-xs text-[var(--muted)]">Sans remise</span></label><label className={`rounded-xl border p-3 text-sm ${config.selection === "challenge" ? "border-[var(--green)] bg-[var(--green)]/10" : "border-[var(--line)]"}`}><input className="sr-only" type="radio" name="selection" checked={config.selection === "challenge"} onChange={() => update("selection", "challenge")} />Défi<span className="mt-1 block text-xs text-[var(--muted)]">Vous les proposez</span></label></div></fieldset>
      <p className="mt-5 text-xs leading-5 text-[var(--muted)]">Le salon sera accessible avec un code à partager. Il faut deux comptes membres admis pour lancer la partie.</p>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button disabled={busy} onClick={createRoom} className="mt-6 w-full rounded-full bg-[var(--green)] px-4 py-3 font-bold text-white hover:bg-[var(--green-dark)]">{busy ? "Création…" : "Créer le salon"}</button>
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
    const response = await fetch("/api/rooms/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId: crypto.randomUUID(), code: code.trim().toUpperCase() }),
    });
    const data = await response.json().catch(() => null) as { roomId?: string; error?: { message?: string } } | null;
    if (!response.ok || !data?.roomId) setError(data?.error?.message ?? "Impossible de rejoindre ce salon.");
    else router.push(`/salons/${data.roomId}`);
    setBusy(false);
  }

  return (
    <form onSubmit={joinRoom} className="rounded-[1.75rem] border border-[var(--line)] bg-white/70 p-6">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--orange)]">Rejoindre une table</p>
      <p className="mt-2 text-lg font-black">Tu as reçu un code ?</p>
      <label className="mt-3 block text-sm font-bold" htmlFor="room-code">Code du salon</label>
      <input id="room-code" required minLength={6} maxLength={6} pattern="[A-Za-z0-9]{6}" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="ABC123" autoCapitalize="characters" autoComplete="off" className="mt-3 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 font-mono tracking-[0.2em] outline-none focus:border-[var(--green)]" />
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="mt-4 w-full rounded-full border border-[var(--line)] bg-white px-4 py-3 font-bold hover:border-[var(--green)]">{busy ? "Connexion…" : "Rejoindre le salon"}</button>
    </form>
  );
}
