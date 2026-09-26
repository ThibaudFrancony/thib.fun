"use client";

import { useRef, useState } from "react";
import type { VersionedSnapshot } from "@/lib/network-sync";

type MatchSnapshot<TView> = VersionedSnapshot & { matchId: string; phaseId: string; view: TView };

type PendingView<TView> = { matchId: string; version: number; phaseId: string; view: TView };

export function visibleOptimisticView<TView>(snapshot: MatchSnapshot<TView> | null, pending: PendingView<TView> | null): TView | null {
  if (!snapshot) return null;
  return pending
    && pending.matchId === snapshot.matchId
    && pending.version === snapshot.version
    && pending.phaseId === snapshot.phaseId
    ? pending.view
    : snapshot.view;
}

/** Visual-only transition. Network commands always use the canonical snapshot. */
export function useOptimisticMatch<TView, TAction, TSnapshot extends MatchSnapshot<TView>>(
  snapshot: TSnapshot | null,
  networkSend: (action: TAction) => Promise<TSnapshot | null>,
) {
  const [pending, setPending] = useState<PendingView<TView> | null>(null);
  const sendingRef = useRef(false);
  const view = visibleOptimisticView(snapshot, pending);

  async function send(action: TAction, predict?: (view: TView) => TView | null): Promise<TSnapshot | null> {
    if (!snapshot || sendingRef.current) return null;
    sendingRef.current = true;
    const predicted = predict?.(snapshot.view);
    if (predicted) setPending({ matchId: snapshot.matchId, version: snapshot.version, phaseId: snapshot.phaseId, view: predicted });
    try {
      return await networkSend(action);
    } finally {
      setPending(null);
      sendingRef.current = false;
    }
  }

  return { view, send };
}
