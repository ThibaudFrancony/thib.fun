"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UserRealtimeEvent, UserRealtimeStatus } from "@/lib/realtime";
import { useUserRealtime } from "@/lib/realtime";

export type VersionedSnapshot = {
  version: number;
  serverNow?: string;
};

export type HeartbeatResponse = {
  roomId?: string;
  matchId?: string;
  roomVersion?: number;
  matchVersion?: number;
  opponentLastSeenAt?: string | null;
  serverNow?: string;
};

export type PendingNetworkCommand = {
  resourceId: string;
  commandId: string;
  expectedVersion: number;
  phaseId: string | null;
  action: unknown;
  createdAt: number;
};

export type NetworkStatus = UserRealtimeStatus | "ONLINE" | "RECONNECTING";

export type SnapshotRefreshOptions = {
  force?: boolean;
  minimumVersion?: number;
};

export type NetworkCommandRequest = {
  url: string;
  body: unknown;
};

export type ResourceNetworkOptions<TSnapshot extends VersionedSnapshot, TAction> = {
  resourceId: string;
  snapshotUrl: string;
  heartbeatUrl: string;
  realtimeEvent: UserRealtimeEvent;
  parseSnapshot: (value: unknown) => TSnapshot | null;
  getResourceId: (snapshot: TSnapshot) => string;
  getPhaseId?: (snapshot: TSnapshot) => string | null;
  isFinished: (snapshot: TSnapshot) => boolean;
  buildCommand: (args: {
    commandId: string;
    expectedVersion: number;
    action: TAction;
    snapshot: TSnapshot;
  }) => NetworkCommandRequest;
  retryOnVersionConflict?: boolean;
  /** Number of safe same-phase retries after a stale snapshot (default: 1). */
  versionConflictRetries?: number;
  onCommandAccepted?: (data: Record<string, unknown>, action: TAction) => void;
  onSnapshotApplied?: (next: TSnapshot, previous: TSnapshot | null) => void;
};

export type ResourceNetworkState<TSnapshot extends VersionedSnapshot, TAction> = {
  snapshot: TSnapshot | null;
  busy: boolean;
  error: string | null;
  networkStatus: NetworkStatus;
  pendingIntent: PendingNetworkCommand | null;
  opponentLastSeenAt: number | null;
  serverOffset: number;
  refresh: (options?: SnapshotRefreshOptions) => Promise<TSnapshot | null>;
  heartbeat: () => Promise<HeartbeatResponse | null>;
  send: (action: TAction, snapshotOverride?: TSnapshot | null) => Promise<TSnapshot | null>;
};

const PENDING_PREFIX = "tibo.fun:pending-command:";
const TRANSPORT_ERROR = "Connexion interrompue. Ton état est conservé ; vérifie ta connexion puis réessaie.";
const INVALID_RESPONSE_ERROR = "La réponse du serveur est invalide. L'état affiché est conservé.";

function isSafeVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseVersionedSnapshot<TSnapshot extends VersionedSnapshot>(value: unknown): TSnapshot | null {
  if (!isRecord(value) || !isSafeVersion(value.version)) return null;
  return value as TSnapshot;
}

export function parseMatchSnapshot<TSnapshot extends VersionedSnapshot>(value: unknown): TSnapshot | null {
  if (!isRecord(value) || typeof value.matchId !== "string" || !isRecord(value.view)) return null;
  return parseVersionedSnapshot<TSnapshot>(value);
}

export function parseRoomSnapshot<TSnapshot extends VersionedSnapshot>(value: unknown): TSnapshot | null {
  if (
    !isRecord(value)
    || typeof value.roomId !== "string"
    || !Array.isArray(value.members)
    || !["waiting", "playing", "closed"].includes(String(value.status))
  ) return null;
  return parseVersionedSnapshot<TSnapshot>(value);
}

export function shouldApplySnapshot<TSnapshot extends VersionedSnapshot>(current: TSnapshot | null, next: TSnapshot): boolean {
  return current === null ? true : next.version > current.version;
}

export function heartbeatVersion(data: HeartbeatResponse): number | null {
  const versions = [data.matchVersion, data.roomVersion].filter(isSafeVersion);
  return versions.length > 0 ? Math.max(...versions) : null;
}

export function shouldRefreshFromHeartbeat(currentVersion: number | null, data: HeartbeatResponse): boolean {
  const nextVersion = heartbeatVersion(data);
  return nextVersion !== null && (currentVersion === null || nextVersion > currentVersion);
}

export const FORFEIT_ABSENCE_THRESHOLD_MS = 90_000;

export function canClaimForfeit(opponentLastSeenAt: number | null, nowMs: number, serverOffsetMs = 0): boolean {
  return opponentLastSeenAt !== null && nowMs + serverOffsetMs - opponentLastSeenAt >= FORFEIT_ABSENCE_THRESHOLD_MS;
}

export function actionFingerprint(action: unknown): string {
  try {
    return JSON.stringify(action) ?? "null";
  } catch {
    return String(action);
  }
}

export function pendingCommandMatches(
  pending: PendingNetworkCommand | null,
  resourceId: string,
  phaseId: string | null,
  action: unknown,
): boolean {
  return Boolean(
    pending
      && pending.resourceId === resourceId
      && pending.phaseId === phaseId
      && actionFingerprint(pending.action) === actionFingerprint(action),
  );
}

function storageKey(resourceId: string): string {
  return `${PENDING_PREFIX}${encodeURIComponent(resourceId)}`;
}

function readPending(resourceId: string): PendingNetworkCommand | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(resourceId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PendingNetworkCommand>;
    if (
      !isRecord(value)
      || value.resourceId !== resourceId
      || typeof value.commandId !== "string"
      || !isSafeVersion(value.expectedVersion)
      || (typeof value.phaseId !== "string" && value.phaseId !== null)
      || typeof value.createdAt !== "number"
      || !("action" in value)
    ) return null;
    return value as PendingNetworkCommand;
  } catch {
    return null;
  }
}

function writePending(pending: PendingNetworkCommand | null): void {
  if (typeof window === "undefined" || !pending) return;
  try {
    window.sessionStorage.setItem(storageKey(pending.resourceId), JSON.stringify(pending));
  } catch {
    // Private browsing and disabled storage must not break a command.
  }
}

function deletePending(resourceId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(storageKey(resourceId));
  } catch {
    // Storage cleanup is best effort.
  }
}

function errorMessage(data: unknown, fallback: string): string {
  if (isRecord(data) && isRecord(data.error) && typeof data.error.message === "string" && data.error.message.trim()) {
    return data.error.message;
  }
  return fallback;
}

function responseVersion(data: unknown): number | null {
  return isRecord(data) && isSafeVersion(data.version) ? data.version : null;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function serverOffsetFrom(serverNow: string | undefined, sentAt: number, receivedAt: number): number | null {
  if (!serverNow) return null;
  const serverMs = Date.parse(serverNow);
  if (!Number.isFinite(serverMs)) return null;
  return serverMs - (sentAt + (receivedAt - sentAt) / 2);
}

export function useResourceNetwork<TSnapshot extends VersionedSnapshot, TAction>(
  initialOptions: ResourceNetworkOptions<TSnapshot, TAction>,
): ResourceNetworkState<TSnapshot, TAction> {
  const optionsRef = useRef(initialOptions);
  const resourceIdRef = useRef(initialOptions.resourceId);
  const generationRef = useRef(0);
  const snapshotRef = useRef<TSnapshot | null>(null);
  const pendingRef = useRef<PendingNetworkCommand | null>(readPending(initialOptions.resourceId));
  const refreshInFlightRef = useRef<{
    controller: AbortController;
    promise: Promise<TSnapshot | null>;
  } | null>(null);
  const busyRef = useRef(false);

  const [snapshotState, setSnapshotState] = useState<TSnapshot | null>(null);
  const [pendingState, setPendingState] = useState<PendingNetworkCommand | null>(null);
  const [errorState, setErrorState] = useState<{ resourceId: string; message: string } | null>(null);
  const [busyState, setBusyState] = useState({ resourceId: initialOptions.resourceId, value: false });
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>("RECONNECTING");
  const [opponentState, setOpponentState] = useState<{ resourceId: string; value: number | null }>({ resourceId: initialOptions.resourceId, value: null });
  const [serverOffsetState, setServerOffsetState] = useState({ resourceId: initialOptions.resourceId, value: 0 });

  useEffect(() => {
    optionsRef.current = initialOptions;
  }, [initialOptions]);

  useEffect(() => {
    const pending = readPending(initialOptions.resourceId);
    refreshInFlightRef.current?.controller.abort();
    refreshInFlightRef.current = null;
    resourceIdRef.current = initialOptions.resourceId;
    generationRef.current += 1;
    snapshotRef.current = null;
    pendingRef.current = pending;
    busyRef.current = false;
  }, [initialOptions.resourceId]);

  const setError = useCallback((message: string | null) => {
    setErrorState(message ? { resourceId: resourceIdRef.current, message } : null);
  }, []);

  const currentResource = useCallback((): TSnapshot | null => {
    const current = snapshotRef.current;
    return current && optionsRef.current.getResourceId(current) === resourceIdRef.current ? current : null;
  }, []);

  const setPending = useCallback((pending: PendingNetworkCommand | null) => {
    pendingRef.current = pending;
    setPendingState(pending);
    if (pending) writePending(pending);
    else deletePending(resourceIdRef.current);
  }, []);

  const applySnapshot = useCallback((next: TSnapshot, generation: number): TSnapshot | null => {
    const options = optionsRef.current;
    if (
      generation !== generationRef.current
      || options.getResourceId(next) !== resourceIdRef.current
      || !shouldApplySnapshot(snapshotRef.current, next)
    ) return currentResource();

    const previous = snapshotRef.current;
    snapshotRef.current = next;
    setSnapshotState(next);
    const offset = serverOffsetFrom(next.serverNow, Date.now(), Date.now());
    if (offset !== null) setServerOffsetState({ resourceId: resourceIdRef.current, value: offset });

    const pending = pendingRef.current;
    if (pending) {
      const nextPhaseId = options.getPhaseId?.(next) ?? null;
      if (pending.phaseId !== nextPhaseId) {
        setPending(null);
      } else if (next.version > pending.expectedVersion) {
        setPending({ ...pending, expectedVersion: next.version });
      }
    }
    options.onSnapshotApplied?.(next, previous);
    return next;
  }, [currentResource, setPending]);

  const refresh = useCallback(async (refreshOptions: SnapshotRefreshOptions = {}): Promise<TSnapshot | null> => {
    const options = optionsRef.current;
    const generation = generationRef.current;
    const resourceId = resourceIdRef.current;
    let rereadAfterStaleInFlight = false;
    while (refreshInFlightRef.current) {
      const inFlight = refreshInFlightRef.current;
      const loaded = await inFlight.promise;
      if (generation !== generationRef.current || resourceId !== resourceIdRef.current) return currentResource();
      const minimumVersionReached = refreshOptions.minimumVersion === undefined
        || (loaded !== null && loaded.version >= refreshOptions.minimumVersion);
      if (!refreshOptions.force || minimumVersionReached || rereadAfterStaleInFlight) return loaded;
      // A forced reread used for a version-conflict retry must not inherit a
      // pre-commit GET. Wait for it, then perform one fresh GET. Other forced
      // refreshes simply share the in-flight request instead of aborting it.
      rereadAfterStaleInFlight = true;
    }
    if (generation !== generationRef.current || resourceId !== resourceIdRef.current) return currentResource();

    const controller = new AbortController();
    const operation = {
      controller,
      promise: Promise.resolve(null) as Promise<TSnapshot | null>,
    };
    operation.promise = (async () => {
      try {
        const response = await fetch(options.snapshotUrl, {
          cache: "no-store",
          signal: controller.signal,
          headers: { "cache-control": "no-cache" },
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          if (generation === generationRef.current && resourceId === resourceIdRef.current) {
            setNetworkStatus("ONLINE");
            setError(errorMessage(data, "Partie introuvable."));
          }
          return null;
        }
        const next = options.parseSnapshot(data);
        if (!next) {
          if (generation === generationRef.current && resourceId === resourceIdRef.current) setError(INVALID_RESPONSE_ERROR);
          return null;
        }
        if (refreshOptions.minimumVersion !== undefined && next.version < refreshOptions.minimumVersion) {
          return currentResource();
        }
        const applied = applySnapshot(next, generation);
        if (generation === generationRef.current && resourceId === resourceIdRef.current) {
          setNetworkStatus("ONLINE");
          setError(null);
        }
        return applied;
      } catch (caught) {
        if (isAbortError(caught)) return currentResource();
        if (generation === generationRef.current && resourceId === resourceIdRef.current) {
          setNetworkStatus("RECONNECTING");
          setError(TRANSPORT_ERROR);
        }
        return currentResource();
      } finally {
        if (refreshInFlightRef.current === operation) refreshInFlightRef.current = null;
      }
    })();
    refreshInFlightRef.current = operation;
    return operation.promise;
  }, [applySnapshot, currentResource, setError]);

  const heartbeat = useCallback(async (): Promise<HeartbeatResponse | null> => {
    const options = optionsRef.current;
    const resourceId = resourceIdRef.current;
    const generation = generationRef.current;
    const current = currentResource();
    if (!current || options.isFinished(current)) return null;
    const sentAt = Date.now();
    try {
      const response = await fetch(options.heartbeatUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const receivedAt = Date.now();
      const data = await response.json().catch(() => null) as HeartbeatResponse | null;
      if (generation !== generationRef.current || resourceId !== resourceIdRef.current) return null;
      if (!response.ok || !isRecord(data)) {
        setNetworkStatus("ONLINE");
        return null;
      }
      if ((data.matchId && data.matchId !== resourceId) || (data.roomId && data.roomId !== resourceId)) return null;
      const offset = serverOffsetFrom(data.serverNow, sentAt, receivedAt);
      if (offset !== null) setServerOffsetState({ resourceId, value: offset });
      if ("opponentLastSeenAt" in data) {
        const seen = data.opponentLastSeenAt;
        const seenAt = seen === null ? null : typeof seen === "string" && Number.isFinite(Date.parse(seen)) ? Date.parse(seen) : undefined;
        if (seenAt !== undefined) setOpponentState({ resourceId, value: seenAt });
      }
      setNetworkStatus("ONLINE");
      if (shouldRefreshFromHeartbeat(current.version, data)) {
        void refresh({ force: true, minimumVersion: heartbeatVersion(data) ?? undefined });
      }
      return data;
    } catch {
      if (generation === generationRef.current && resourceId === resourceIdRef.current) {
        setNetworkStatus("RECONNECTING");
      }
      return null;
    }
  }, [currentResource, refresh]);

  const send = useCallback(async (action: TAction, snapshotOverride?: TSnapshot | null): Promise<TSnapshot | null> => {
    if (busyRef.current) return null;
    const options = optionsRef.current;
    const resourceId = resourceIdRef.current;
    const generation = generationRef.current;
    const base = snapshotOverride && options.getResourceId(snapshotOverride) === resourceId
      ? snapshotOverride
      : currentResource();
    if (!base || options.isFinished(base)) return null;

    busyRef.current = true;
    setBusyState({ resourceId, value: true });
    setError(null);
    const phaseId = options.getPhaseId?.(base) ?? null;
    const existing = pendingRef.current;
    const pending: PendingNetworkCommand = existing && pendingCommandMatches(existing, resourceId, phaseId, action)
      ? { ...existing, expectedVersion: Math.max(existing.expectedVersion, base.version) }
      : {
          resourceId,
          commandId: crypto.randomUUID(),
          expectedVersion: base.version,
          phaseId,
          action,
          createdAt: Date.now(),
        };
    setPending(pending);

    try {
      let expectedVersion = pending.expectedVersion;
      let requestSnapshot = base;
      const versionConflictRetries = Math.min(
        4,
        Math.max(0, Number.isSafeInteger(options.versionConflictRetries) ? options.versionConflictRetries ?? 1 : 1),
      );
      for (let attempt = 0; attempt <= versionConflictRetries; attempt += 1) {
        const request = options.buildCommand({
          commandId: pending.commandId,
          expectedVersion,
          action,
          snapshot: requestSnapshot,
        });
        let response: Response;
        let data: unknown;
        try {
          response = await fetch(request.url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(request.body),
          });
          data = await response.json().catch(() => null);
        } catch {
          if (generation === generationRef.current && resourceId === resourceIdRef.current) {
            setNetworkStatus("RECONNECTING");
            setError(TRANSPORT_ERROR);
            void refresh({ force: true });
          }
          return null;
        }

        if (response.ok) {
          if (generation !== generationRef.current || resourceId !== resourceIdRef.current) return null;
          if (!isRecord(data)) {
            setError(INVALID_RESPONSE_ERROR);
            void refresh({ force: true });
            return null;
          }
          options.onCommandAccepted?.(data, action);
          const committedVersion = responseVersion(data);
          setPending(null);
          const next = await refresh({ force: true, minimumVersion: committedVersion ?? undefined });
          if (!next && generation === generationRef.current) {
            setError("Commande reçue. La vue sera relue dès que la connexion revient.");
          }
          return next;
        }

        const code = isRecord(data) && isRecord(data.error) && typeof data.error.code === "string" ? data.error.code : null;
        if (
          code === "VERSION_CONFLICT"
          && attempt < versionConflictRetries
          && options.retryOnVersionConflict !== false
        ) {
          const latest = await refresh({ force: true, minimumVersion: expectedVersion + 1 });
          if (generation !== generationRef.current || resourceId !== resourceIdRef.current) return null;
          const latestPhaseId = latest ? options.getPhaseId?.(latest) ?? null : null;
          if (latest && latestPhaseId === phaseId && !options.isFinished(latest)) {
            expectedVersion = latest.version;
            requestSnapshot = latest;
            setPending({ ...pending, expectedVersion });
            continue;
          }
        }

        await refresh({ force: true });
        if (generation === generationRef.current && resourceId === resourceIdRef.current) {
          setError(errorMessage(data, "La commande n'a pas été acceptée."));
        }
        return null;
      }
      return null;
    } finally {
      if (generation === generationRef.current && resourceId === resourceIdRef.current) {
        busyRef.current = false;
        setBusyState({ resourceId, value: false });
      }
    }
  }, [currentResource, refresh, setError, setPending]);

  const currentSnapshot = snapshotState && initialOptions.getResourceId(snapshotState) === initialOptions.resourceId
    ? snapshotState
    : null;
  const busy = busyState.resourceId === initialOptions.resourceId && busyState.value;
  const finished = currentSnapshot ? initialOptions.isFinished(currentSnapshot) : false;
  const error = errorState?.resourceId === initialOptions.resourceId ? errorState.message : null;
  const opponentLastSeenAt = opponentState.resourceId === initialOptions.resourceId ? opponentState.value : null;
  const serverOffset = serverOffsetState.resourceId === initialOptions.resourceId ? serverOffsetState.value : 0;

  useUserRealtime(
    [{
      event: initialOptions.realtimeEvent,
      id: initialOptions.resourceId,
      onInvalidate: (version) => {
        const currentVersion = currentResource()?.version ?? null;
        if (currentVersion !== null && version <= currentVersion) return;
        void refresh({ force: true, minimumVersion: version });
      },
    }],
    {
      enabled: !finished,
      onStatusChange: (status) => {
        if (status === "SUBSCRIBED") setNetworkStatus("SUBSCRIBED");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setNetworkStatus("RECONNECTING");
      },
      onReconnected: () => {
        void refresh({ force: true });
        void heartbeat();
      },
    },
  );

  useEffect(() => {
    if (finished) return;
    let disposed = false;
    const reread = () => {
      if (disposed) return;
      void refresh({ force: true });
    };
    const rereadAndHeartbeat = () => {
      if (disposed) return;
      void refresh({ force: true }).then((loaded) => {
        if (!disposed && loaded && !optionsRef.current.isFinished(loaded)) void heartbeat();
      });
    };
    rereadAndHeartbeat();
    const poll = window.setInterval(reread, 2500);
    const heartbeatTimer = window.setInterval(() => void heartbeat(), 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") rereadAndHeartbeat();
    };
    const onPageShow = () => rereadAndHeartbeat();
    const onOnline = () => rereadAndHeartbeat();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", onOnline);
    return () => {
      disposed = true;
      window.clearInterval(poll);
      window.clearInterval(heartbeatTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", onOnline);
    };
  }, [finished, heartbeat, refresh]);

  return {
    snapshot: currentSnapshot,
    busy,
    error,
    networkStatus,
    pendingIntent: pendingState && pendingState.resourceId === initialOptions.resourceId ? pendingState : null,
    opponentLastSeenAt,
    serverOffset,
    refresh,
    heartbeat,
    send,
  };
}
