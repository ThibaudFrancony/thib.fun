"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserRealtime } from "@/lib/realtime";
import type { RoomView } from "@/server/rooms/schemas";

export type GroupRoomState = {
  room: RoomView | null;
  loading: boolean;
  error: string | null;
  isHost: boolean;
  memberCount: number;
  refresh: () => Promise<RoomView | null>;
};

type Keyed<T> = { roomId: string | null; value: T };

/**
 * Salon d'accueil (groupe) partagé par le popup d'accueil et le mode « groupe »
 * des pages de jeu. La lecture passe toujours par la projection authentifiée ;
 * le temps réel n'est qu'une invalidation, complétée par un polling de secours.
 */
export function useGroupRoom(roomId: string | null, options: { redirectOnStart?: boolean } = {}): GroupRoomState {
  const router = useRouter();
  const [roomState, setRoomState] = useState<Keyed<RoomView | null>>({ roomId: null, value: null });
  const [errorState, setErrorState] = useState<Keyed<string | null>>({ roomId: null, value: null });
  const [loadingState, setLoadingState] = useState<Keyed<boolean>>({ roomId: null, value: false });
  const roomIdRef = useRef<string | null>(roomId);
  const redirectOnStart = options.redirectOnStart !== false;

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  const refresh = useCallback(async (): Promise<RoomView | null> => {
    const id = roomIdRef.current;
    if (!id) return null;
    const response = await fetch(`/api/rooms/${id}`, { cache: "no-store" });
    const data = (await response.json().catch(() => null)) as RoomView | { error?: { message?: string } } | null;
    if (roomIdRef.current !== id) return null;
    if (!response.ok) {
      setErrorState({ roomId: id, value: (data as { error?: { message?: string } } | null)?.error?.message ?? "Salon indisponible." });
      setLoadingState({ roomId: id, value: false });
      return null;
    }
    const next = data as RoomView;
    setRoomState({ roomId: id, value: next });
    setErrorState({ roomId: id, value: null });
    setLoadingState({ roomId: id, value: false });
    if (redirectOnStart && next.currentMatchId) router.push(`/parties/${next.currentMatchId}`);
    return next;
  }, [redirectOnStart, router]);

  useEffect(() => {
    if (!roomId) return;
    const heartbeat = () => {
      void fetch(`/api/rooms/${roomId}/heartbeat`, { method: "POST", headers: { "content-type": "application/json" } }).catch(() => undefined);
    };
    void refresh();
    heartbeat();
    const poll = window.setInterval(() => void refresh(), 2500);
    const heartbeatTimer = window.setInterval(heartbeat, 15000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(heartbeatTimer);
    };
  }, [roomId, refresh]);

  useUserRealtime(
    roomId ? [{ event: "room.updated", id: roomId, onInvalidate: () => void refresh() }] : [],
    { enabled: Boolean(roomId) },
  );

  const room = roomState.roomId === roomId ? roomState.value : null;
  const error = errorState.roomId === roomId ? errorState.value : null;
  const loading = loadingState.roomId === roomId ? loadingState.value : Boolean(roomId);

  return {
    room,
    loading,
    error,
    isHost: Boolean(room && room.hostId === room.viewerId),
    memberCount: room?.members.length ?? 0,
    refresh,
  };
}
