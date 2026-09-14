"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { publicGameBySlug } from "@/games/registry";
import { parseRoomSnapshot, useResourceNetwork } from "@/lib/network-sync";
import type { RoomView } from "@/server/rooms/schemas";

type RoomAction =
  | { type: "SET_READY"; ready: boolean }
  | { type: "START" };

export function RoomLobby({ roomId }: { roomId: string }) {
  const router = useRouter();
  const onSnapshotApplied = useCallback((next: RoomView) => {
    if (next.currentMatchId) router.push(`/parties/${next.currentMatchId}`);
  }, [router]);

  const {
    snapshot: room,
    error,
    busy,
    send,
  } = useResourceNetwork<RoomView, RoomAction>({
    resourceId: roomId,
    snapshotUrl: `/api/rooms/${roomId}`,
    heartbeatUrl: `/api/rooms/${roomId}/heartbeat`,
    realtimeEvent: "room.updated",
    parseSnapshot: parseRoomSnapshot<RoomView>,
    getResourceId: (snapshot) => snapshot.roomId,
    getPhaseId: (snapshot) => snapshot.currentMatchId ?? snapshot.status,
    isFinished: (snapshot) => snapshot.status === "closed" || snapshot.currentMatchId !== null,
    buildCommand: ({ commandId, expectedVersion, action }) => action.type === "SET_READY"
      ? {
          url: `/api/rooms/${roomId}/ready`,
          body: { commandId, expectedVersion, ready: action.ready },
        }
      : {
          url: `/api/rooms/${roomId}/start`,
          body: { commandId },
        },
    onSnapshotApplied,
  });

  if (error && !room) return <div role="alert" className="mt-10 rounded-2xl bg-red-50 p-5 text-red-700">{error}</div>;
  if (!room) return <div className="mt-10 rounded-3xl border border-[var(--line)] bg-white/60 p-8 text-center text-[var(--muted)]">Chargement du salon…</div>;

  const isHost = room.members[0]?.id === room.viewerId;
  const me = room.members.find((member) => member.id === room.viewerId);
  const canStart = isHost && room.members.length === 2 && room.members.every((member) => member.ready);
  const game = publicGameBySlug(room.gameSlug);

  return <section className="geo-room-lobby"><div className="geo-panel geo-lobby-panel"><div className="geo-lobby-heading"><div><p className="geo-kicker geo-kicker-warm">Salon {game?.displayName ?? room.gameSlug}</p><h1 className="geo-lobby-title">Code <span>{room.code}</span></h1><p className="geo-panel-note">Partage ce code à ton partenaire.</p></div><button type="button" onClick={() => { void navigator.clipboard?.writeText(room.code).catch(() => undefined); }} className="geo-secondary-button geo-copy-button">Copier</button></div><div className="geo-members-grid">{[0, 1].map((seat) => { const player = room.members.find((member) => member.seat === seat); return <div key={seat} className="geo-member-card"><div><p className="geo-member-seat">Place {seat + 1}</p><p className="geo-member-name">{player?.pseudo ?? "En attente…"}</p></div>{player && <span className="geo-ready-badge" data-ready={player.ready}>{player.ready ? "Prêt" : "Pas prêt"}</span>}</div>; })}</div><div className="geo-lobby-footer"><p className="geo-panel-note">{room.members.length === 1 ? "En attente du deuxième joueur…" : canStart ? "Tout le monde est prêt." : "Chaque joueur doit se déclarer prêt."}</p><div className="geo-lobby-actions">{me && <button type="button" disabled={busy} onClick={() => void send({ type: "SET_READY", ready: !me.ready })} className="geo-secondary-button">{me.ready ? "Ne plus être prêt" : "Je suis prêt"}</button>}{isHost && <button type="button" disabled={busy || !canStart} onClick={() => void send({ type: "START" })} className="geo-primary-button geo-start-button">Lancer</button>}</div></div>{error && <p role="alert" className="geo-error">{error}</p>}</div><p className="geo-helper-text">Les options sont fixées par l&apos;hôte pour cette partie.</p></section>;
}
