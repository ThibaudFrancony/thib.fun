"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { RoomView } from "@/server/rooms/schemas";
import { useUserRealtime } from "@/lib/realtime";

export function RoomLobby({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [room, setRoom] = useState<RoomView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (): Promise<RoomView | null> => {
    const response = await fetch(`/api/rooms/${roomId}`, { cache: "no-store" });
    const data = await response.json().catch(() => null) as RoomView | { error?: { message?: string } } | null;
    if (!response.ok) { setError((data as { error?: { message?: string } } | null)?.error?.message ?? "Salon introuvable."); return null; }
    const next = data as RoomView;
    setRoom(next);
    if (next.currentMatchId) router.push(`/parties/${next.currentMatchId}`);
    return next;
  }, [roomId, router]);

  useEffect(() => { const initial = window.setTimeout(() => void refresh(), 0); const timer = window.setInterval(() => void refresh(), 2500); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, [refresh]);
  const heartbeat = useCallback(async () => { await fetch(`/api/rooms/${roomId}/heartbeat`, { method: "POST", headers: { "content-type": "application/json" } }).catch(() => undefined); }, [roomId]);
  useEffect(() => { const initial = window.setTimeout(() => void heartbeat(), 0); const timer = window.setInterval(() => void heartbeat(), 15000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, [heartbeat]);
  useUserRealtime([{ event: "room.updated", id: roomId, onInvalidate: () => void refresh() }]);

  async function setReady(ready: boolean) {
    if (!room) return;
    setBusy(true); setError(null);
    const commandId = crypto.randomUUID();
    let snapshot: RoomView | null = room;
    for (let attempt = 0; attempt < 2 && snapshot; attempt += 1) {
      const response = await fetch(`/api/rooms/${roomId}/ready`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ commandId, expectedVersion: snapshot.version, ready }) });
      const data = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
      if (response.ok) { await refresh(); snapshot = null; break; }
      if (data?.error?.code !== "VERSION_CONFLICT" || attempt === 1) {
        setError(data?.error?.message ?? "Impossible de modifier ton statut.");
        snapshot = null;
        break;
      }
      snapshot = await refresh();
      if (snapshot?.members.find((member) => member.id === snapshot?.viewerId)?.ready === ready) snapshot = null;
    }
    setBusy(false);
  }

  async function start() {
    setBusy(true); setError(null);
    const response = await fetch(`/api/rooms/${roomId}/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ commandId: crypto.randomUUID() }) });
    const data = await response.json().catch(() => null) as { matchId?: string; error?: { message?: string } } | null;
    if (!response.ok || !data?.matchId) setError(data?.error?.message ?? "Impossible de lancer la partie."); else router.push(`/parties/${data.matchId}`);
    setBusy(false);
  }

  if (error && !room) return <div role="alert" className="mt-10 rounded-2xl bg-red-50 p-5 text-red-700">{error}</div>;
  if (!room) return <div className="mt-10 rounded-3xl border border-[var(--line)] bg-white/60 p-8 text-center text-[var(--muted)]">Chargement du salon…</div>;
  const isHost = room.members[0]?.id === room.viewerId;
  const me = room.members.find((member) => member.id === room.viewerId);
  const canStart = isHost && room.members.length === 2 && room.members.every((member) => member.ready);
  return <section className="mt-10"><div className="rounded-[2rem] border border-[var(--line)] bg-[var(--card)] p-6 shadow-[0_16px_36px_rgba(20,33,29,0.08)] sm:p-8"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--orange)]">Salon Géographie</p><h1 className="mt-2 text-4xl font-black tracking-tight">Code <span className="font-mono text-[var(--green)]">{room.code}</span></h1><p className="mt-2 text-sm text-[var(--muted)]">Partage ce code à ton partenaire.</p></div><button onClick={() => void navigator.clipboard?.writeText(room.code)} className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-bold">Copier</button></div><div className="mt-8 grid gap-3 sm:grid-cols-2">{[0, 1].map((seat) => { const player = room.members.find((member) => member.seat === seat); return <div key={seat} className="rounded-2xl border border-[var(--line)] bg-white/70 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Place {seat + 1}</p><p className="mt-1 font-black">{player?.pseudo ?? "En attente…"}</p></div>{player && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${player.ready ? "bg-[var(--green)]/10 text-[var(--green)]" : "bg-[var(--paper-deep)] text-[var(--muted)]"}`}>{player.ready ? "Prêt" : "Pas prêt"}</span>}</div></div>; })}</div><div className="mt-8 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[var(--muted)]">{room.members.length === 1 ? "En attente du deuxième joueur…" : canStart ? "Tout le monde est prêt." : "Chaque joueur doit se déclarer prêt."}</p><div className="flex gap-2">{me && <button disabled={busy} onClick={() => void setReady(!me.ready)} className="rounded-full border border-[var(--line)] bg-white px-4 py-3 text-sm font-bold">{me.ready ? "Ne plus être prêt" : "Je suis prêt"}</button>}{isHost && <button disabled={busy || !canStart} onClick={() => void start()} className="rounded-full bg-[var(--green)] px-4 py-3 text-sm font-bold text-white">Lancer</button>}</div></div>{error && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}</div><p className="mt-5 text-center text-xs text-[var(--muted)]">Les options sont fixées par l&apos;hôte pour cette partie.</p></section>;
}
