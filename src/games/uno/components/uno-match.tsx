"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { MatchToolbar, MatchDetails } from "@/components/match-toolbar";
import { useRouter } from "next/navigation";
import type { UnoAction, UnoCard as UnoCardData, UnoColor, UnoView } from "@/games/uno/types";
import { cardLabel } from "@/games/uno/deck";
import { UnoCard } from "@/games/uno/components/uno-card";
import {
  predictDrawnView,
  predictPenaltyTakeView,
  predictPlayedView,
  type DrawnCardPrediction,
  type PenaltyTakePrediction,
  type PlayedCardPrediction,
} from "@/games/uno/optimistic";
import { parseMatchSnapshot, useResourceNetwork } from "@/lib/network-sync";

type MatchResponse = { matchId: string; roomId: string; gameSlug: string; status: string; version: number; phaseId: string; deadlineAt: string | null; deadlineKind: string | null; serverNow: string; view: UnoView };
export type PendingPlay = { type: "PLAY_CARD"; cardId: string } | { type: "PLAY_DRAWN" };

type Rect = { left: number; top: number; width: number; height: number };
/** Coup appliqué à l'atterrissage d'un vol (purement visuel). */
type FlightSettle =
  | { kind: "discard"; chosenColor?: UnoColor }
  | { kind: "hand"; prediction: DrawnCardPrediction | null }
  | { kind: "take" };
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
  /** Décalage du départ du vol, pour les prises de pénalité en rafale. */
  delay: number;
  settle: FlightSettle | null;
};

const FLY_DURATION = 520;
const TAKE_STAGGER = 90;
const COLOR_PALETTE = ["#ff5fa2", "#ffd166", "#6ee7ff", "#baffdd", "#c8a9f4", "#ff8a5b"];

function toRect(rect: DOMRect): Rect {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function buildFlight(key: number, card: UnoCardData | null, source: Rect, target: Rect, rotate: number, delay: number, settle: FlightSettle | null): FlyingCard {
  const dx = target.left + target.width / 2 - (source.left + source.width / 2);
  const dy = target.top + target.height / 2 - (source.top + source.height / 2);
  return {
    key,
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
    delay,
    settle,
  };
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
  const [pendingPlay, setPendingPlay] = useState<PendingPlay | null>(null);
  const [shakeCardId, setShakeCardId] = useState<string | null>(null);
  const [flying, setFlying] = useState<FlyingCard[]>([]);
  const [predictedPlay, setPredictedPlay] = useState<PlayedCardPrediction | null>(null);
  const [predictedDraw, setPredictedDraw] = useState<DrawnCardPrediction | null>(null);
  const [pendingTake, setPendingTake] = useState<PenaltyTakePrediction | null>(null);
  const [drawPending, setDrawPending] = useState(false);
  const [drawLanded, setDrawLanded] = useState(false);
  const [now, setNow] = useState(0);
  const [requestedHandPage, setHandPage] = useState(0);
  const focusReturnRef = useRef<HTMLElement | null>(null);
  const shakeTimerRef = useRef<number | null>(null);
  const flightTimersRef = useRef<Map<number, number>>(new Map());
  const flyingRef = useRef<FlyingCard[]>([]);
  const flyKeyRef = useRef(0);
  const flySourceRef = useRef<Rect | null>(null);
  const pendingDrawSourceRef = useRef<Rect | null>(null);
  const pendingDrawPredictionRef = useRef<DrawnCardPrediction | null>(null);
  const pendingTakeSourceRef = useRef<Rect | null>(null);
  const takeLaunchedRef = useRef<string | null>(null);
  const drawBaselineRef = useRef<number | null>(null);
  const drawFlightRef = useRef(false);
  const [silentLandIds, setSilentLandIds] = useState<Set<string>>(() => new Set());
  const [silentHandIds, setSilentHandIds] = useState<Set<string>>(() => new Set());
  const handRef = useRef<HTMLDivElement | null>(null);
  const discardRef = useRef<HTMLDivElement | null>(null);
  const placeholderRef = useRef<HTMLSpanElement | null>(null);

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

  const settleFlight = useCallback((flight: FlyingCard) => {
    if (flight.settle?.kind === "discard" && flight.card) {
      setPredictedPlay({ card: flight.card, chosenColor: flight.settle.chosenColor });
    }
    if (flight.settle?.kind === "hand") {
      drawFlightRef.current = false;
      if (flight.settle.prediction && flight.card) {
        setPredictedDraw(flight.settle.prediction);
        setDrawPending(false);
        setDrawLanded(false);
      } else {
        setDrawLanded(true);
      }
    }
    if (flight.settle?.kind === "take") {
      setPendingTake((current) => (current && current.landed < current.cards.length ? { ...current, landed: current.landed + 1 } : current));
    }
    setFlying((current) => current.filter((item) => item.key !== flight.key));
  }, []);

  const launchFlights = useCallback((flights: FlyingCard[]) => {
    if (typeof window === "undefined") return;
    for (const timer of flightTimersRef.current.values()) window.clearTimeout(timer);
    flightTimersRef.current.clear();
    setFlying(flights);
    for (const flight of flights) {
      const timer = window.setTimeout(() => {
        flightTimersRef.current.delete(flight.key);
        settleFlight(flight);
      }, flight.delay + flight.duration + 40);
      flightTimersRef.current.set(flight.key, timer);
    }
  }, [settleFlight]);

  /**
   * Fait voler une copie visuelle de la carte vers la défausse (ou du haut
   * de la pioche vers la main) pendant l'aller-retour serveur. Pure
   * décoration : l'état officiel reste la projection serveur. À
   * l'atterrissage, `settle` applique tout de suite la suite connue du coup.
   */
  const startFly = useCallback((card: UnoCardData | null, source: Rect, target: Rect | null, rotate: number, settle: FlightSettle | null) => {
    if (!target || typeof window === "undefined") return;
    // La carte posée est déjà connue : le prochain montage (prédiction ou
    // projection confirmée) ne doit pas rejouer l'animation d'atterrissage.
    if (settle?.kind === "discard" && card) {
      setSilentLandIds((current) => (current.has(card.id) ? current : new Set(current).add(card.id)));
    }
    drawFlightRef.current = settle?.kind === "hand";
    flyKeyRef.current += 1;
    launchFlights([buildFlight(flyKeyRef.current, card, source, target, rotate, 0, settle)]);
  }, [launchFlights]);

  /**
   * Retire le décor de pioche (place réservée, carte en vol) dès que le
   * serveur a tranché. Une pioche peut se résoudre sans être conservée
   * (`drawnCard` nul quand la carte est non jouable et le tour passe), donc
   * on se fie au tour et à la taille de main plutôt qu'à `drawnCard`.
   */
  const clearDrawVisual = useCallback(() => {
    drawBaselineRef.current = null;
    if (drawFlightRef.current) {
      drawFlightRef.current = false;
      const airborne = flyingRef.current.filter((flight) => flight.settle?.kind === "hand");
      for (const flight of airborne) {
        const timer = flightTimersRef.current.get(flight.key);
        if (timer !== undefined) {
          window.clearTimeout(timer);
          flightTimersRef.current.delete(flight.key);
        }
      }
      if (airborne.length > 0) setFlying((current) => current.filter((flight) => flight.settle?.kind !== "hand"));
    }
    setDrawPending(false);
    setDrawLanded(false);
  }, []);

  const onSnapshotApplied = useCallback((next: MatchResponse) => {
    if (pendingPlay && !isPendingPlayValid(pendingPlay, next.view)) closeColorDialog();
    const baseline = drawBaselineRef.current;
    const drawResolved = next.view.phase === "finished"
      || next.view.activeSeat !== next.view.mySeat
      || (baseline !== null && next.view.hand.length > baseline);
    if (drawResolved) clearDrawVisual();
    // Les prédictions visuelles s'éteignent dès que la projection serveur
    // porte le coup ; une vue encore vierge (version intermédiaire) les garde.
    setPredictedPlay((current) => (current && predictPlayedView(next.view, current) ? current : null));
    setPredictedDraw((current) => (current && predictDrawnView(next.view, current) ? current : null));
  }, [clearDrawVisual, closeColorDialog, pendingPlay]);

  const {
    snapshot: match,
    error,
    busy,
    serverOffset,
    refresh,
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

  useEffect(() => {
    flyingRef.current = flying;
  }, [flying]);

  useEffect(() => () => {
    if (shakeTimerRef.current !== null) window.clearTimeout(shakeTimerRef.current);
    for (const timer of flightTimersRef.current.values()) window.clearTimeout(timer);
    flightTimersRef.current.clear();
  }, []);

  useLayoutEffect(() => {
    if (!drawPending) return;
    const placeholder = placeholderRef.current;
    const source = pendingDrawSourceRef.current;
    const prediction = pendingDrawPredictionRef.current;
    pendingDrawSourceRef.current = null;
    pendingDrawPredictionRef.current = null;
    if (!placeholder || !source) return;
    startFly(
      prediction?.card ?? null,
      source,
      toRect(placeholder.getBoundingClientRect()),
      -10,
      { kind: "hand", prediction },
    );
  }, [drawPending, startFly]);

  useLayoutEffect(() => {
    if (!pendingTake) return;
    // `pendingTake` change d'identité à chaque atterrissage : la signature des
    // cartes garantit qu'une prise ne lance ses vols qu'une seule fois.
    const signature = pendingTake.cards.map((card) => card.id).join("|");
    if (takeLaunchedRef.current === signature) return;
    const source = pendingTakeSourceRef.current;
    const hand = handRef.current;
    if (!source || !hand || typeof window === "undefined") return;
    const slots = Array.from(hand.querySelectorAll<HTMLElement>("[data-take-slot]"));
    const fallback = toRect(hand.getBoundingClientRect());
    takeLaunchedRef.current = signature;
    drawFlightRef.current = false;
    const flights = pendingTake.cards.map((card, index) => {
      const slot = slots[index];
      flyKeyRef.current += 1;
      return buildFlight(
        flyKeyRef.current,
        card,
        source,
        slot?.getClientRects().length ? toRect(slot.getBoundingClientRect()) : fallback,
        index % 2 === 0 ? -12 : 12,
        index * TAKE_STAGGER,
        { kind: "take" },
      );
    });
    launchFlights(flights);
  }, [pendingTake, launchFlights]);

  async function send(action: UnoAction): Promise<MatchResponse | null> {
    return networkSend(action);
  }

  function refuse(cardId: string) {
    setShakeCardId(cardId);
    if (shakeTimerRef.current !== null) window.clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = window.setTimeout(() => {
      setShakeCardId((current) => (current === cardId ? null : current));
      shakeTimerRef.current = null;
    }, 420);
  }

  /** Annule toutes les décorations en attente (échec réseau confirmé). */
  function cancelVisual() {
    for (const timer of flightTimersRef.current.values()) window.clearTimeout(timer);
    flightTimersRef.current.clear();
    drawFlightRef.current = false;
    drawBaselineRef.current = null;
    takeLaunchedRef.current = null;
    setFlying([]);
    setPredictedPlay(null);
    setPredictedDraw(null);
    setPendingTake(null);
    setDrawPending(false);
    setDrawLanded(false);
  }

  function flyToDiscard(card: UnoCardData | null, source: Rect | null, chosenColor?: UnoColor) {
    if (!source) return;
    const target = discardRef.current ? toRect(discardRef.current.getBoundingClientRect()) : null;
    startFly(card, source, target, 14, { kind: "discard", chosenColor });
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

  // Vue affichée : la projection serveur, remplacée le temps de l'aller-retour
  // par la suite anticipée du coup (défausse, pioche préchargée ou prise de
  // pénalité). Les commandes, elles, gardent toujours la version serveur.
  const serverView = match.view;
  // La prise de pénalité reste affichée tant que le serveur n'a pas confirmé
  // que l'attente est vidée (fin de l'animation puis bascule au serveur).
  const takeResolved = pendingTake !== null
    && pendingTake.landed >= pendingTake.cards.length
    && serverView.pendingPenalty === null;
  const activeTake = pendingTake && !takeResolved ? pendingTake : null;
  const takeView = activeTake ? predictPenaltyTakeView(serverView, activeTake) : null;
  const playView = predictedPlay ? predictPlayedView(serverView, predictedPlay) : null;
  const drawView = !playView && predictedDraw ? predictDrawnView(serverView, predictedDraw) : null;
  const view = takeView ?? playView ?? drawView ?? serverView;
  const pageSize = 7;
  const handPages = Math.max(1, Math.ceil((view.hand.length + (drawPending ? 1 : 0)) / pageSize));
  const drawnIndex = view.phase === "after_draw" ? view.hand.findIndex((card) => card.id === view.drawnCard?.id) : -1;
  const handPage = drawnIndex >= 0 ? Math.floor(drawnIndex / pageSize) : Math.min(requestedHandPage, handPages - 1);
  const opponent = view.players[(1 - view.mySeat) as 0 | 1];
  const isMyTurn = view.activeSeat === view.mySeat && view.phase !== "finished";
  const pending = view.pendingPenalty ?? null;
  const pendingCounter = pending?.symbol === "draw2" ? "+2" : "+4";
  const hiddenCardId = flying.find((flight) => flight.settle?.kind === "discard")?.card?.id ?? null;
  const takePendingIds = activeTake
    ? new Set(activeTake.cards.slice(activeTake.landed).map((card) => card.id))
    : null;

  function isPlayableCard(card: UnoCardData): boolean {
    if (!match) return false;
    if (!isMyTurn || !view.playableCardIds.includes(card.id)) return false;
    if (view.phase === "after_draw") return view.actions.canPlayDrawn && view.drawnCard?.id === card.id;
    return view.phase === "playing" && view.actions.canPlay;
  }

  function playCard(card: UnoCardData, source: Rect | null) {
    if (busy || activeTake !== null || view.phase === "finished") return;
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
      void send({ type: "PLAY_DRAWN" }).then((next) => { if (!next) cancelVisual(); });
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
    void send({ type: "PLAY_CARD", cardId: card.id }).then((next) => { if (!next) cancelVisual(); });
  }

  function markHandSilent(ids: readonly string[]) {
    if (ids.length === 0) return;
    setSilentHandIds((current) => {
      const next = new Set(current);
      for (const id of ids) next.add(id);
      return next;
    });
  }

  function drawCard(source: Rect | null) {
    if (busy || !view.actions.canDraw) return;
    const windowCards = view.nextDrawCards ?? [];
    const penaltyCount = view.pendingPenalty?.count ?? 0;
    setHandPage(Math.floor((view.hand.length + Math.max(1, penaltyCount) - 1) / pageSize));
    drawBaselineRef.current = view.hand.length;
    setPendingTake(null);
    setDrawLanded(false);
    if (penaltyCount > 0) {
      if (windowCards.length >= penaltyCount && source) {
        // Prise connue en entier : chaque carte a déjà sa place réservée et
        // vole vers elle, la main se remplit à chaque atterrissage.
        const cards = windowCards.slice(0, penaltyCount);
        markHandSilent(cards.map((card) => card.id));
        pendingTakeSourceRef.current = source;
        setPendingTake({ cards, landed: 0 });
        setDrawPending(false);
      } else {
        pendingDrawSourceRef.current = source;
        pendingDrawPredictionRef.current = null;
        setDrawPending(true);
      }
    } else {
      const preloaded = windowCards[0] ?? view.nextDrawCard ?? null;
      pendingDrawSourceRef.current = source;
      pendingDrawPredictionRef.current = preloaded ? { card: preloaded, playable: view.nextDrawPlayable === true } : null;
      if (preloaded) markHandSilent([preloaded.id]);
      setDrawPending(true);
    }
    void send({ type: "DRAW" }).then((next) => { if (!next) cancelVisual(); });
  }

  async function chooseColor(color: UnoColor) {
    if (!pendingPlay) return;
    const source = flySourceRef.current;
    const flyingCard = pendingPlay.type === "PLAY_CARD"
      ? view.hand.find((candidate) => candidate.id === pendingPlay.cardId) ?? null
      : view.drawnCard;
    const action = pendingPlay.type === "PLAY_CARD"
      ? { type: "PLAY_CARD" as const, cardId: pendingPlay.cardId, chosenColor: color }
      : { type: "PLAY_DRAWN" as const, chosenColor: color };
    flyToDiscard(flyingCard, source, color);
    const next = await send(action);
    if (next) {
      flySourceRef.current = null;
      closeColorDialog();
    } else {
      cancelVisual();
    }
  }

  return (
    <main className="uno-page play-screen" data-phase={view.phase}>
      <UnoBackground />
      <div className="uno-shell play-shell">
        <MatchToolbar title="Dernière carte" busy={busy} onBack={() => router.push(`/salons/${match.roomId}`)} onRefresh={() => void refresh()} onResign={view.phase === "finished" ? undefined : () => void send({ type: "RESIGN" })}>

        </MatchToolbar>

        {view.phase === "finished" ? (
          <FinishedPanel view={view} back={() => router.push("/jeux/uno")} />
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
                <button type="button" className="uno-draw" aria-label={pending ? `Prendre ${pending.count} cartes` : "Piocher une carte"} disabled={!view.actions.canDraw || busy} onClick={(event) => drawCard(toRect(event.currentTarget.getBoundingClientRect()))}>
                  <UnoCard faceDown />
                </button>

              </div>
              <div className="uno-pile uno-pile--discard">
                <p className="uno-pile-label">Défausse</p>
                <div ref={discardRef} className="uno-discard-slot">
                  <UnoCard
                    key={view.topCard.id}
                    card={view.topCard}
                    label={`Défausse : ${cardLabel(view.topCard)}`}
                    className={silentLandIds.has(view.topCard.id) ? "uno-card--no-land" : "uno-card--land"}
                  />
                </div>
                <p className="uno-active-color">
                  <span className="uno-color-dot" style={{ backgroundColor: colorSwatches[view.activeColor] }} aria-hidden="true" />
                  {colorNames[view.activeColor]} active
                </p>
              </div>
              {pending && (
                <p className="uno-penalty-banner" role="status">
                  {`+${pending.count} à prendre ou à contrer avec un ${pendingCounter}`}
                </p>
              )}
            </section>

            <section className="uno-hand-panel" data-turn={isMyTurn} aria-label="Ta main">
              <div className="uno-hand-head">
                <div>
                  <p className="uno-hand-title">Ta main</p>

                </div>
                {view.phase === "playing" && isMyTurn && activeTake === null && (
                  <p className="uno-turn-hint" aria-live="polite">
                    {`À ton tour${remaining !== null ? ` · ${remaining}s` : ""}`}
                  </p>
                )}
                {view.phase === "after_draw" && (
                  <div className="uno-drawn-actions">
                    <p>{isMyTurn ? "Jouer ou garder ?" : "Son choix…"}</p>
                    {isMyTurn && (
                      <button type="button" disabled={!view.actions.canKeepDrawn || busy} onClick={() => void send({ type: "KEEP_DRAWN" })}>
                        Garder
                      </button>
                    )}
                  </div>
                )}
              </div>
              {handPages > 1 && <nav className="uno-hand-pages" aria-label="Pages de la main">
                <button type="button" aria-label="Cartes précédentes" disabled={handPage === 0 || busy || activeTake !== null || view.phase === "after_draw"} onClick={() => setHandPage(handPage - 1)}>←</button>
                <span aria-live="polite">{handPage + 1}/{handPages}</span>
                <button type="button" aria-label="Cartes suivantes" disabled={handPage === handPages - 1 || busy || activeTake !== null || view.phase === "after_draw"} onClick={() => setHandPage(handPage + 1)}>→</button>
              </nav>}
              <div ref={handRef} className="uno-hand">
                {view.hand.map((card, index) => {
                  const takeSlot = activeTake ? activeTake.cards.findIndex((taken) => taken.id === card.id) : -1;
                  const classes = [
                    Math.floor(index / pageSize) !== handPage ? "uno-card--paged-out" : "",
                    hiddenCardId === card.id ? "uno-card--flying" : "",
                    takePendingIds?.has(card.id) ? "uno-card--take-pending" : "",
                    silentHandIds.has(card.id) ? "uno-card--no-in" : "",
                  ].filter(Boolean).join(" ");
                  return (
                    <UnoCard
                      key={card.id}
                      card={card}
                      playable={isPlayableCard(card)}
                      drawn={view.phase === "after_draw" && view.drawnCard?.id === card.id}
                      shake={shakeCardId === card.id}
                      disabled={busy || activeTake !== null}
                      takeSlot={takeSlot >= 0 ? takeSlot : undefined}
                      className={classes || undefined}
                      style={handCardStyle(index % pageSize, Math.min(pageSize, view.hand.length - handPage * pageSize))}
                      onClick={(event) => playCard(card, toRect(event.currentTarget.getBoundingClientRect()))}
                    />
                  );
                })}
                {drawPending && (
                  <span ref={placeholderRef} className="uno-hand-placeholder" data-visible={drawLanded} aria-hidden="true">
                    <UnoCard faceDown />
                  </span>
                )}
              </div>
            </section>

          </>
        )}

        {error && <p role="alert" className="uno-error">{error}</p>}
      </div>
      {flying.map((flight) => (
        <div
          key={flight.key}
          className="uno-flying"
          aria-hidden="true"
          style={{
            left: `${flight.left}px`,
            top: `${flight.top}px`,
            width: `${flight.width}px`,
            height: `${flight.height}px`,
            animationDelay: `${flight.delay}ms`,
            "--uno-fly-dx": `${flight.dx.toFixed(1)}px`,
            "--uno-fly-dy": `${flight.dy.toFixed(1)}px`,
            "--uno-fly-rotate": `${flight.rotate}deg`,
            "--uno-fly-scale": flight.scale.toFixed(3),
            "--uno-fly-duration": `${flight.duration}ms`,
          } as React.CSSProperties}
        >
          {flight.card ? <UnoCard card={flight.card} /> : <UnoCard faceDown />}
        </div>
      ))}
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
        <MatchDetails label="Main adverse"><div className="uno-finish-reveal">
          <p>Main adverse révélée</p>
          <div className="uno-finish-cards">
            {remaining.map((card, index) => (
              <UnoCard key={card.id} card={card} style={{ "--uno-card-in-delay": `${280 + index * 90}ms` } as React.CSSProperties} />
            ))}
          </div>
        </div></MatchDetails>
      )}
      <button type="button" className="uno-primary" onClick={back}>Rejouer</button>
    </section>
  );
}
