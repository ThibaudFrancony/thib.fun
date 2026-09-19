"use client";

import { useEffect, useRef } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";

export type UserRealtimeEvent = "room.updated" | "match.updated" | "history.updated";
export type UserRealtimeStatus = "SUBSCRIBING" | "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED";

export type UserRealtimeListener = {
  event: UserRealtimeEvent;
  /** Identifiant exact attendu, ou `"*"` pour écouter toutes les ressources de cet événement. */
  id: string;
  onInvalidate: (version: number) => void;
};

export type UserRealtimeOptions = {
  enabled?: boolean;
  onStatusChange?: (status: UserRealtimeStatus) => void;
  onReconnected?: () => void;
};

function isUserRealtimeStatus(value: unknown): value is UserRealtimeStatus {
  return value === "SUBSCRIBING"
    || value === "SUBSCRIBED"
    || value === "CHANNEL_ERROR"
    || value === "TIMED_OUT"
    || value === "CLOSED";
}

/**
 * One private user channel per mounted surface. Broadcast only invalidates;
 * the callback always re-reads the authenticated projection over HTTP.
 */
export function useUserRealtime(
  listeners: readonly UserRealtimeListener[],
  options: UserRealtimeOptions = {},
): void {
  const listenersRef = useRef(listeners);
  const optionsRef = useRef(options);
  useEffect(() => {
    listenersRef.current = listeners;
  }, [listeners]);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (options.enabled === false) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let hasSubscribed = false;
    optionsRef.current.onStatusChange?.("SUBSCRIBING");

    void (async () => {
      let result: Awaited<ReturnType<typeof supabase.auth.getUser>>;
      try {
        result = await supabase.auth.getUser();
      } catch {
        if (!cancelled) optionsRef.current.onStatusChange?.("CHANNEL_ERROR");
        return;
      }
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
        if (
          typeof candidate.id !== "string"
          || typeof candidate.version !== "number"
          || !Number.isSafeInteger(candidate.version)
          || candidate.version < 0
        ) return;
        for (const listener of listenersRef.current) {
          if (listener.event === event && (listener.id === candidate.id || listener.id === "*")) {
            listener.onInvalidate(candidate.version);
          }
        }
      }

      try {
        await channel.subscribe((status: unknown) => {
          if (cancelled || !isUserRealtimeStatus(status)) return;
          optionsRef.current.onStatusChange?.(status);
          if (status === "SUBSCRIBED") {
            if (hasSubscribed) optionsRef.current.onReconnected?.();
            hasSubscribed = true;
          }
        });
      } catch {
        if (!cancelled) optionsRef.current.onStatusChange?.("CHANNEL_ERROR");
      }
    })();

    return () => {
      cancelled = true;
      optionsRef.current.onStatusChange?.("CLOSED");
      if (channel) void supabase.removeChannel(channel);
    };
  }, [options.enabled]);
}
