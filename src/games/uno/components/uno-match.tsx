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

type Rect = { left: number; top: number; width: number; height: number };
type FlyingCard = {
  key: number;
  card: UnoCardData | null;
  left: number;
  top: number;
  width: number;
  height: number;
  dx: number;
  dy: number;
  rotate: number;
  scale: number;
  duration: number;
};

const FLY_DURATION = 520;
const COLOR_PALETTE = ["#ff5fa2", "#ffd166", "#6ee7ff", "#baffdd", "#c8a9f4", "#ff8a5b"];

function toRect(rect: DOMRect): Rect {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function handCardStyle(index: number, total: number): React.CSSProperties {
  const center = (total - 1) / 2;
  const offset = index - center;
  const rotate = Math.max(-7, Math.min(7, offset * 1.7));
  const lift = Math.abs(offset) * Math.abs(offset) * 1.4;
  return {
    "--uno-hand-rotate": `${rotate.toFixed(2)}deg`,
    "--uno-hand-lift": `${lift.toFixed(2)}px`,
    "--uno-card-in-delay": `${Math.min(index, 8) * 35}ms`,
  } as React.CSSProperties;
}

function confettiPiece(index: number): React.CSSProperties {
  const pseudo = (seed: number) => {
    const value = Math.sin((index + 1) * 12.9898 + seed * 78.233) * 43758.5453;
    return value - Math.floor(value);
  };
  return {
    left: `${(pseudo(1) * 96 + 2).toFixed(2)}%`,
    width: `${(6 + pseudo(7) * 7).toFixed(1)}px`,
    height: `${(9 + pseudo(8) * 9).toFixed(1)}px`,
    borderRadius: pseudo(8) > 0.72 ? "50%" : "2px",
    backgroundColor: COLOR_PALETTE[Math.floor(pseudo(6) * COLOR_PALETTE.length)],
    animationDelay: `${(pseudo(2) * 700).toFixed(0)}ms`,
    animationDuration: `${(2600 + pseudo(3) * 1800).toFixed(0)}ms`,
    "--uno-confetti-drift": `${((pseudo(4) - 0.5) * 240).toFixed(0)}px`,
    "--uno-confetti-spin": `${(360 + pseudo(5) * 900).toFixed(0)}deg`,
  } as React.CSSProperties;
}

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
  const [flying, setFlying] = useState<FlyingCard | null>(null);
  const [flyingCardId, setFlyingCardId] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const focusReturnRef = useRef<HTMLElement | null>(null);
  const shakeTimerRef = useRef<number | null>(null);
  const flyTimerRef = useRef<number | null>(null);
  const flyKeyRef = useRef(0);
  const flySourceRef = useRef<Rect | null>(null);
  const handRef = useRef<HTMLDivElement | null>(null);
  const discardRef = useRef<HTMLDivElement | null>(null);

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
    if (flyTimerRef.current !== null) window.clearTimeout(flyTimerRef.current);
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

  /**
   * Fait voler une copie visuelle de la carte vers la défausse (ou du haut
   * de la pioche vers la main) pendant l'aller-retour serveur. Pure
   * décoration : l'état officiel reste la projection serveur.
   */
  function startFly(card: UnoCardData | null, source: Rect, target: Rect | null, rotate: number) {
    if (!target || typeof window === "undefined") return;
    const dx = target.left + target.width / 2 - (source.left + source.width / 2);
    const dy = target.top + target.height / 2 - (source.top + source.height / 2);
    flyKeyRef.current += 1;
    setFlying({
      key: flyKeyRef.current,
      card,
      left: source.left,
      top: source.top,
      width: source.width,
      height: source.height,
      dx,
      dy,
      rotate,
      scale: Math.max(0.6, Math.min(1.1, target.width / Math.max(source.width, 1))),
      duration: FLY_DURATION,
    });
    setFlyingCardId(card?.id ?? null);
    if (flyTimerRef.current !== null) window.clearTimeout(flyTimerRef.current);
    flyTimerRef.current = window.setTimeout(() => {
      setFlying(null);
      setFlyingCardId(null);
      flyTimerRef.current = null;
    }, FLY_DURATION + 80);
  }

  function flyToDiscard(card: UnoCardData | null, source: Rect | null) {
    if (!source) return;
    const target = discardRef.current ? toRect(discardRef.current.getBoundingClientRect()) : null;
    startFly(card, source, target, 14);
  }

  function openColorDialog(next: PendingPlay, source: Rect | null) {
    flySourceRef.current = source;
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

  function playCard(card: UnoCardData, source: Rect | null) {
    if (busy || view.phase === "finished") return;
    if (!isMyTurn) return;
    if (view.phase === "after_draw") {
      if (!view.drawnCard || card.id !== view.drawnCard.id || !view.actions.canPlayDrawn) {
        refuse(card.id);
        return;
      }
      if (card.color === null) {
        openColorDialog({ type: "PLAY_DRAWN" }, source);
        return;
      }
      flyToDiscard(card, source);
      void send({ type: "PLAY_DRAWN", announceLastCard: announceNext });
      return;
    }
    if (!view.actions.canPlay || !view.playableCardIds.includes(card.id)) {
      refuse(card.id);
      return;
    }
    if (card.color === null) {
      openColorDialog({ type: "PLAY_CARD", cardId: card.id }, source);
      return;
    }
    flyToDiscard(card, source);
    void send({ type: "PLAY_CARD", cardId: card.id, announceLastCard: announceNext });
  }

  function drawCard(source: Rect | null) {
    if (busy || !view.actions.canDraw) return;
    const hand = handRef.current ? toRect(handRef.current.getBoundingClientRect()) : null;
    const from = source ?? hand;
    if (from && hand) {
      const target: Rect = {
        left: hand.left + hand.width * 0.5,
        top: hand.top + hand.height * 0.45,
        width: from.width,
        height: from.height,
      };
      startFly(null, from, target, -10);
    }
    void send({ type: "DRAW" });
  }

  async function chooseColor(color: UnoColor) {
    if (!pendingPlay) return;
    const source = flySourceRef.current;
    const flyingCard = pendingPlay.type === "PLAY_CARD"
      ? view.hand.find((candidate) => candidate.id === pendingPlay.cardId) ?? null
      : view.drawnCard;
    const action = pendingPlay.type === "PLAY_CARD"
      ? { type: "PLAY_CARD" as const, cardId: pendingPlay.cardId, chosenColor: color, announceLastCard: announceNext }
      : { type: "PLAY_DRAWN" as const, chosenColor: color, announceLastCard: announceNext };
    flyToDiscard(flyingCard, source);
    flySourceRef.current = null;
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
                <button type="button" className="uno-draw" aria-label="Piocher une carte" disabled={!view.actions.canDraw || busy} onClick={(event) => drawCard(toRect(event.currentTarget.getBoundingClientRect()))}>
                  <UnoCard faceDown />
                </button>
                <p className="uno-pile-count">{view.drawPileCount} cartes dans la pioche</p>
                <p className="uno-pile-action">{view.actions.canDraw ? "Piocher une carte" : "Patiente…"}</p>
              </div>
              <div className="uno-pile uno-pile--discard">
                <p className="uno-pile-label">Défausse</p>
                <div ref={discardRef} className="uno-discard-slot">
                  <UnoCard key={view.topCard.id} card={view.topCard} label={`Défausse : ${cardLabel(view.topCard)}`} className="uno-card--land" />
                </div>
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
              <div ref={handRef} className="uno-hand">
                {view.hand.map((card, index) => (
                  <UnoCard
                    key={card.id}
                    card={card}
                    playable={isPlayableCard(card)}
                    drawn={view.phase === "after_draw" && view.drawnCard?.id === card.id}
                    shake={shakeCardId === card.id}
                    disabled={busy}
                    className={flyingCardId === card.id ? "uno-card--flying" : undefined}
                    style={handCardStyle(index, view.hand.length)}
                    onClick={(event) => playCard(card, toRect(event.currentTarget.getBoundingClientRect()))}
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
      {flying && (
        <div
          key={flying.key}
          className="uno-flying"
          aria-hidden="true"
          style={{
            left: `${flying.left}px`,
            top: `${flying.top}px`,
            width: `${flying.width}px`,
            height: `${flying.height}px`,
            "--uno-fly-dx": `${flying.dx.toFixed(1)}px`,
            "--uno-fly-dy": `${flying.dy.toFixed(1)}px`,
            "--uno-fly-rotate": `${flying.rotate}deg`,
            "--uno-fly-scale": flying.scale.toFixed(3),
            "--uno-fly-duration": `${flying.duration}ms`,
          } as React.CSSProperties}
        >
          {flying.card ? <UnoCard card={flying.card} /> : <UnoCard faceDown />}
        </div>
      )}
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
  const celebrate = result?.outcome === "win" && winner;
  return (
    <section className="uno-finish" data-celebrate={celebrate} aria-label="Résultats">
      {celebrate && (
        <div className="uno-confetti" aria-hidden="true">
          {Array.from({ length: 72 }, (_, index) => (
            <span key={index} className="uno-confetti-piece" style={confettiPiece(index)} />
          ))}
        </div>
      )}
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
            {remaining.map((card, index) => (
              <UnoCard key={card.id} card={card} style={{ "--uno-card-in-delay": `${280 + index * 90}ms` } as React.CSSProperties} />
            ))}
          </div>
        </div>
      )}
      <button type="button" className="uno-primary" onClick={back}>Retour au salon</button>
    </section>
  );
}
