"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { UnoAction, UnoCard as UnoCardData, UnoColor, UnoView } from "@/games/uno/types";
import { cardLabel } from "@/games/uno/deck";
import { UnoCard } from "@/games/uno/components/uno-card";
import { parseMatchSnapshot, useResourceNetwork } from "@/lib/network-sync";

type MatchResponse = { matchId: string; roomId: string; gameSlug: string; status: string; version: number; phaseId: string; deadlineAt: string | null; deadlineKind: string | null; serverNow: string; view: UnoView };
export type PendingPlay = { type: "PLAY_CARD"; cardId: string } | { type: "PLAY_DRAWN" };

const colorNames: Record<UnoColor, string> = { red: "Rouge", yellow: "Jaune", green: "Vert", blue: "Bleu" };
const colorSwatches: Record<UnoColor, string> = { red: "#e8435a", yellow: "#f2b21b", green: "#2fbf71", blue: "#3d7cf0" };

export function isPendingPlayValid(pending: PendingPlay, view: UnoView): boolean {
  if (view.phase === "finished" || view.activeSeat !== view.mySeat) return false;
  if (pending.type === "PLAY_CARD") {
    const card = view.hand.find((candidate) => candidate.id === pending.cardId);
    return view.phase === "playing"
      && view.actions.canPlay
      && card?.color === null
      && view.playableCardIds.includes(pending.cardId);
  }
  const drawnCard = view.drawnCard;
  return view.phase === "after_draw"
    && view.actions.canPlayDrawn
    && drawnCard !== null
    && drawnCard.color === null
    && view.hand.some((card) => card.id === drawnCard.id)
    && view.playableCardIds.includes(drawnCard.id);
}

export function UnoMatch({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [announceNext, setAnnounceNext] = useState(false);
  const [pendingPlay, setPendingPlay] = useState<PendingPlay | null>(null);
  const [shakeCardId, setShakeCardId] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const focusReturnRef = useRef<HTMLElement | null>(null);
  const shakeTimerRef = useRef<number | null>(null);

  const restoreDialogFocus = useCallback(() => {
    const target = focusReturnRef.current;
    focusReturnRef.current = null;
    if (!target) return;
    window.requestAnimationFrame(() => {
      if (target.isConnected) target.focus();
    });
  }, []);

  const closeColorDialog = useCallback(() => {
    setPendingPlay(null);
    restoreDialogFocus();
  }, [restoreDialogFocus]);

  const onSnapshotApplied = useCallback((next: MatchResponse) => {
    if (pendingPlay && !isPendingPlayValid(pendingPlay, next.view)) closeColorDialog();
  }, [closeColorDialog, pendingPlay]);

  const {
    snapshot: match,
    error,
    busy,
    serverOffset,
    send: networkSend,
  } = useResourceNetwork<MatchResponse, UnoAction>({
    resourceId: matchId,
    snapshotUrl: `/api/matches/${matchId}`,
    heartbeatUrl: `/api/matches/${matchId}/heartbeat`,
    realtimeEvent: "match.updated",
    parseSnapshot: parseMatchSnapshot<MatchResponse>,
    getResourceId: (snapshot) => snapshot.matchId,
    getPhaseId: (snapshot) => snapshot.phaseId,
    isFinished: (snapshot) => snapshot.view.phase === "finished",
    buildCommand: ({ commandId, expectedVersion, action }) => ({
      url: `/api/matches/${matchId}/commands`,
      body: { commandId, expectedVersion, action },
    }),
    onSnapshotApplied,
  });

  useEffect(() => {
    const clockTimer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clockTimer);
  }, []);

  useEffect(() => () => {
    if (shakeTimerRef.current !== null) window.clearTimeout(shakeTimerRef.current);
  }, []);

  async function send(action: UnoAction): Promise<MatchResponse | null> {
    const next = await networkSend(action);
    if (next) setAnnounceNext(false);
    return next;
  }

  function refuse(cardId: string) {
    setShakeCardId(cardId);
    if (shakeTimerRef.current !== null) window.clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = window.setTimeout(() => {
      setShakeCardId((current) => (current === cardId ? null : current));
      shakeTimerRef.current = null;
    }, 420);
  }

  function openColorDialog(next: PendingPlay) {
    const activeElement = document.activeElement;
    focusReturnRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    setPendingPlay(next);
  }

  const remaining = match?.deadlineAt ? Math.max(0, Math.ceil((Date.parse(match.deadlineAt) - (now + serverOffset)) / 1000)) : null;

  if (error && !match) {
    return (
      <main className="uno-page">
        <UnoBackground />
        <div className="uno-shell uno-shell--state">
          <div role="alert" className="uno-state-card uno-state-card--error">{error}</div>
        </div>
      </main>
    );
  }
  if (!match) {
    return (
      <main className="uno-page">
        <UnoBackground />
        <div className="uno-shell uno-shell--state">
          <div className="uno-state-card">Chargement de la partie…</div>
        </div>
      </main>
    );
  }

  const view = match.view;
  const opponent = view.players[(1 - view.mySeat) as 0 | 1];
  const isMyTurn = view.activeSeat === view.mySeat && view.phase !== "finished";
  const needsAnnouncement = view.hand.length === 2;

  function isPlayableCard(card: UnoCardData): boolean {
    if (!match) return false;
    if (!isMyTurn || !view.playableCardIds.includes(card.id)) return false;
    if (view.phase === "after_draw") return view.actions.canPlayDrawn && view.drawnCard?.id === card.id;
    return view.phase === "playing" && view.actions.canPlay;
  }

  function playCard(card: UnoCardData) {
    if (busy || view.phase === "finished") return;
    if (!isMyTurn) return;
    if (view.phase === "after_draw") {
      if (!view.drawnCard || card.id !== view.drawnCard.id || !view.actions.canPlayDrawn) {
        refuse(card.id);
        return;
      }
      if (card.color === null) openColorDialog({ type: "PLAY_DRAWN" });
      else void send({ type: "PLAY_DRAWN", announceLastCard: announceNext });
      return;
    }
    if (!view.actions.canPlay || !view.playableCardIds.includes(card.id)) {
      refuse(card.id);
      return;
    }
    if (card.color === null) openColorDialog({ type: "PLAY_CARD", cardId: card.id });
    else void send({ type: "PLAY_CARD", cardId: card.id, announceLastCard: announceNext });
  }

  function drawCard() {
    if (busy || !view.actions.canDraw) return;
    void send({ type: "DRAW" });
  }

  async function chooseColor(color: UnoColor) {
    if (!pendingPlay) return;
    const action = pendingPlay.type === "PLAY_CARD"
      ? { type: "PLAY_CARD" as const, cardId: pendingPlay.cardId, chosenColor: color, announceLastCard: announceNext }
      : { type: "PLAY_DRAWN" as const, chosenColor: color, announceLastCard: announceNext };
    const next = await send(action);
    if (next) closeColorDialog();
  }

  return (
    <main className="uno-page">
      <UnoBackground />
      <div className="uno-shell">
        <header className="uno-header">
          <button type="button" className="uno-back" onClick={() => router.push(`/salons/${match.roomId}`)}>← Salon</button>
          <div className="uno-heading">
            <p className="uno-brand">
              <svg viewBox="0 0 32 32" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M10 9h12c3 0 5 3 6 7l1 6c.5 4-3 6-5 3l-4-4h-8l-4 4c-2 3-5.5 1-5-3l1-6c1-4 3-7 6-7Z" />
                <path d="M10 13v6m-3-3h6" />
                <circle cx="22" cy="14" r="1.3" fill="currentColor" stroke="none" />
                <circle cx="25" cy="18" r="1.3" fill="currentColor" stroke="none" />
              </svg>
              <span>tibo.fun</span>
            </p>
            <p className="uno-kicker">Dernière carte</p>
            <p className="uno-round">Manche unique · tour {view.turns + 1}</p>
          </div>
          <span className="uno-header-spacer" aria-hidden="true" />
        </header>

        {view.phase === "finished" ? (
          <FinishedPanel view={view} back={() => router.push(`/salons/${match.roomId}`)} />
        ) : (
          <>
            <section className="uno-opponent" data-active={opponent.active} aria-label={`Main de ${opponent.pseudo}`}>
              <div className="uno-opponent-hand" aria-hidden="true">
                {Array.from({ length: opponent.cardCount }, (_, index) => <UnoCard key={index} faceDown />)}
              </div>
              <div className="uno-opponent-info">
                <span className="uno-opponent-avatar" aria-hidden="true">{opponent.pseudo.slice(0, 1).toLocaleUpperCase("fr-FR")}</span>
                <span className="uno-opponent-text">
                  <strong>{opponent.pseudo}</strong>
                  <small>Adversaire</small>
                </span>
                <span className="uno-count-badge" aria-label={`${opponent.cardCount} cartes en main`}>{opponent.cardCount}</span>
              </div>
              <p className="uno-turn-hint uno-turn-hint--opponent" aria-live="polite">
                {opponent.active ? `Au tour de ${opponent.pseudo}${remaining !== null ? ` · ${remaining}s` : ""}` : null}
              </p>
            </section>

            <section className="uno-table" aria-label="Table de jeu UNO">
              <div className="uno-pile">
                <p className="uno-pile-label">Pioche</p>
                <button type="button" className="uno-draw" aria-label="Piocher une carte" disabled={!view.actions.canDraw || busy} onClick={drawCard}>
                  <UnoCard faceDown />
                </button>
                <p className="uno-pile-count">{view.drawPileCount} cartes dans la pioche</p>
                <p className="uno-pile-action">{view.actions.canDraw ? "Piocher une carte" : "Patiente…"}</p>
              </div>
              <div className="uno-pile uno-pile--discard">
                <p className="uno-pile-label">Défausse</p>
                <UnoCard card={view.topCard} label={`Défausse : ${cardLabel(view.topCard)}`} />
                <p className="uno-active-color">
                  <span className="uno-color-dot" style={{ backgroundColor: colorSwatches[view.activeColor] }} aria-hidden="true" />
                  {colorNames[view.activeColor]} active
                </p>
              </div>
            </section>

            <section className="uno-hand-panel" data-turn={isMyTurn} aria-label="Ta main">
              <div className="uno-hand-head">
                <div>
                  <p className="uno-hand-title">Ta main</p>
                  <h2 className="uno-hand-count">{view.hand.length} carte{view.hand.length > 1 ? "s" : ""}</h2>
                </div>
                {view.phase === "playing" && isMyTurn && (
                  <p className="uno-turn-hint" aria-live="polite">
                    {`À ton tour${remaining !== null ? ` · ${remaining}s` : ""}`}
                  </p>
                )}
                {view.phase === "after_draw" && (
                  <div className="uno-drawn-actions">
                    <p>{isMyTurn ? "Joue la carte piochée ou garde-la." : "Ton adversaire choisit sa carte piochée."}</p>
                    {isMyTurn && (
                      <button type="button" disabled={!view.actions.canKeepDrawn || busy} onClick={() => void send({ type: "KEEP_DRAWN" })}>
                        Garder la carte
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="uno-hand">
                {view.hand.map((card) => (
                  <UnoCard
                    key={card.id}
                    card={card}
                    playable={isPlayableCard(card)}
                    drawn={view.phase === "after_draw" && view.drawnCard?.id === card.id}
                    shake={shakeCardId === card.id}
                    disabled={busy}
                    onClick={() => playCard(card)}
                  />
                ))}
              </div>
              {needsAnnouncement && view.phase === "playing" && isMyTurn && (
                <label className="uno-announce">
                  <input type="checkbox" checked={announceNext} onChange={(event) => setAnnounceNext(event.target.checked)} />
                  Dernière carte ! <span>(pour la prochaine carte seulement)</span>
                </label>
              )}
            </section>

            <footer className="uno-footer">
              <span>Besoin d&apos;arrêter la partie ?</span>
              <button
                type="button"
                className="uno-resign"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Abandonner cette partie ?")) void send({ type: "RESIGN" });
                }}
              >
                Abandonner
              </button>
            </footer>
          </>
        )}

        {error && <p role="alert" className="uno-error">{error}</p>}
      </div>
      {pendingPlay && <ColorDialog onCancel={closeColorDialog} onChoose={(color) => { void chooseColor(color); }} />}
    </main>
  );
}

function UnoBackground() {
  return (
    <div className="uno-bg" aria-hidden="true">
      <Image src="/home/hero.png" alt="" fill priority sizes="100vw" className="uno-bg-image" />
    </div>
  );
}

export function ColorDialog({ onCancel, onChoose }: { onCancel: () => void; onChoose: (color: UnoColor) => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstColorRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstColorRef.current?.focus();
  }, []);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []);
    if (buttons.length === 0) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <div className="uno-dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="uno-color-title" onKeyDown={onKeyDown}>
      <div ref={dialogRef} className="uno-dialog">
        <p className="uno-kicker">Joker</p>
        <h2 id="uno-color-title" className="uno-dialog-title">Choisis la couleur</h2>
        <div className="uno-dialog-colors">
          {(Object.keys(colorNames) as UnoColor[]).map((color, index) => (
            <button
              ref={index === 0 ? firstColorRef : undefined}
              key={color}
              type="button"
              onClick={() => onChoose(color)}
            >
              <span className="uno-color-dot" style={{ backgroundColor: colorSwatches[color] }} aria-hidden="true" />
              {colorNames[color]}
            </button>
          ))}
        </div>
        <button type="button" className="uno-dialog-cancel" onClick={onCancel}>Annuler</button>
      </div>
    </div>
  );
}

function FinishedPanel({ view, back }: { view: UnoView; back: () => void }) {
  const result = view.result;
  const winner = result?.winnerId === view.players[view.mySeat].id;
  const title = result?.outcome === "draw" ? "Égalité" : result?.outcome === "abandoned" ? "Partie interrompue" : winner ? "Victoire" : "Défaite";
  const remaining = view.opponentHand ?? [];
  return (
    <section className="uno-finish" aria-label="Résultats">
      <p className="uno-kicker">Résultats</p>
      <h1 className="uno-finish-title">{title}</h1>
      <div className="uno-finish-scores">
        {view.players.map((player) => (
          <div key={player.id}>
            <p>{player.pseudo}</p>
            <strong>{result?.players[player.seat]?.score ?? 0}</strong>
            <span>points</span>
          </div>
        ))}
      </div>
      {remaining.length > 0 && (
        <div className="uno-finish-reveal">
          <p>Main adverse révélée</p>
          <div className="uno-finish-cards">
            {remaining.map((card) => <UnoCard key={card.id} card={card} />)}
          </div>
        </div>
      )}
      <button type="button" className="uno-primary" onClick={back}>Retour au salon</button>
    </section>
  );
}
