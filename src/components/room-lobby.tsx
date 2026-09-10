"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { RoomView } from "@/server/rooms/schemas";
import { publicGameBySlug } from "@/games/registry";
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
    // Both players commonly click at nearly the same time. Keep retrying the
    // same intention against the newest room version so one optimistic click
    // cannot strand the other player as "not ready".
    for (let attempt = 0; attempt < 4 && snapshot; attempt += 1) {
      const response = await fetch(`/api/rooms/${roomId}/ready`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ commandId, expectedVersion: snapshot.version, ready }) });
      const data = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
      if (response.ok) { await refresh(); snapshot = null; break; }
      if (data?.error?.code !== "VERSION_CONFLICT" || attempt === 3) {
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
  const game = publicGameBySlug(room.gameSlug);
  return <section className="geo-room-lobby"><div className="geo-panel geo-lobby-panel"><div className="geo-lobby-heading"><div><p className="geo-kicker geo-kicker-warm">Salon {game?.displayName ?? room.gameSlug}</p><h1 className="geo-lobby-title">Code <span>{room.code}</span></h1><p className="geo-panel-note">Partage ce code à ton partenaire.</p></div><button type="button" onClick={() => void navigator.clipboard?.writeText(room.code)} className="geo-secondary-button geo-copy-button">Copier</button></div><div className="geo-members-grid">{[0, 1].map((seat) => { const player = room.members.find((member) => member.seat === seat); return <div key={seat} className="geo-member-card"><div><p className="geo-member-seat">Place {seat + 1}</p><p className="geo-member-name">{player?.pseudo ?? "En attente…"}</p></div>{player && <span className="geo-ready-badge" data-ready={player.ready}>{player.ready ? "Prêt" : "Pas prêt"}</span>}</div>; })}</div><div className="geo-lobby-footer"><p className="geo-panel-note">{room.members.length === 1 ? "En attente du deuxième joueur…" : canStart ? "Tout le monde est prêt." : "Chaque joueur doit se déclarer prêt."}</p><div className="geo-lobby-actions">{me && <button type="button" disabled={busy} onClick={() => void setReady(!me.ready)} className="geo-secondary-button">{me.ready ? "Ne plus être prêt" : "Je suis prêt"}</button>}{isHost && <button type="button" disabled={busy || !canStart} onClick={() => void start()} className="geo-primary-button geo-start-button">Lancer</button>}</div></div>{error && <p role="alert" className="geo-error">{error}</p>}</div><p className="geo-helper-text">Les options sont fixées par l&apos;hôte pour cette partie.</p></section>;
}
