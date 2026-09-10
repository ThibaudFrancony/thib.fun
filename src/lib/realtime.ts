"use client";

import { useEffect, useRef } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";

export type UserRealtimeEvent = "room.updated" | "match.updated" | "history.updated";

export type UserRealtimeListener = {
  event: UserRealtimeEvent;
  id: string;
  onInvalidate: () => void;
};

/**
 * One private user channel per mounted surface. Broadcast only invalidates;
 * the callback always re-reads the authenticated projection over HTTP.
 */
export function useUserRealtime(listeners: readonly UserRealtimeListener[]): void {
  const listenersRef = useRef(listeners);
  useEffect(() => {
    listenersRef.current = listeners;
  }, [listeners]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      const result = await supabase.auth.getUser();
      const userId = result.data.user?.id;
      if (cancelled || !userId) return;
      channel = supabase
        .channel(`user:${userId}`, { config: { private: true } })
        .on("broadcast", { event: "room.updated" }, ({ payload }: { payload: unknown }) => {
          dispatchInvalidation("room.updated", payload);
        })
        .on("broadcast", { event: "match.updated" }, ({ payload }: { payload: unknown }) => {
          dispatchInvalidation("match.updated", payload);
        })
        .on("broadcast", { event: "history.updated" }, ({ payload }: { payload: unknown }) => {
          dispatchInvalidation("history.updated", payload);
        });

      function dispatchInvalidation(event: UserRealtimeEvent, payload: unknown) {
        if (!payload || typeof payload !== "object") return;
        const candidate = payload as { id?: unknown; version?: unknown };
        if (typeof candidate.id !== "string" || typeof candidate.version !== "number") return;
        for (const listener of listenersRef.current) {
          if (listener.event === event && listener.id === candidate.id) listener.onInvalidate();
        }
      }

      void channel.subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);
}
