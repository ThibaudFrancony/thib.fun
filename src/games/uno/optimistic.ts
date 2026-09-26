import type { Seat } from "@/games/contracts";
import type { UnoCard, UnoColor, UnoPlayerView, UnoView } from "@/games/uno/types";

/**
 * Vues optimistes purement visuelles de la table UNO : elles anticipent un
 * coup déterministe à la fin de l'animation pour que le joueur qui vient
 * d'agir voie tout de suite la suite, sans attendre la projection serveur.
 * La projection serveur reste l'autorité et remplace ces vues dès qu'elle
 * arrive ; aucune commande ne s'appuie dessus.
 */

export type PlayedCardPrediction = { card: UnoCard; chosenColor?: UnoColor };
export type DrawnCardPrediction = { card: UnoCard; playable: boolean };
/** Prise de pénalité en bloc : cartes connues et nombre déjà atterri. */
export type PenaltyTakePrediction = { cards: UnoCard[]; landed: number };

function otherSeat(seat: Seat): Seat {
  return (1 - seat) as Seat;
}

function withActiveSeat(view: UnoView, activeSeat: Seat): UnoView {
  const players: [UnoPlayerView, UnoPlayerView] = [
    { ...view.players[0], active: view.players[0].seat === activeSeat },
    { ...view.players[1], active: view.players[1].seat === activeSeat },
  ];
  return { ...view, activeSeat, players };
}

function idleActions(view: UnoView): UnoView["actions"] {
  return { canDraw: false, canPlay: false, canPlayDrawn: false, canKeepDrawn: false, canResign: view.actions.canResign };
}

/**
 * Vue après un `PLAY_CARD` ou `PLAY_DRAWN` : la carte quitte la main et se
 * pose sur la défausse, la couleur active suit, la pénalité éventuelle est
 * cumulée, et le tour va au siège que le moteur désignerait (skip/reverse
 * font rejouer l'auteur). Une dernière carte vide la main : la fin de partie
 * reste décidée par le serveur, seul l'effet de plateau est anticipé.
 * `null` si le coup n'est pas prévisible : pas mon tour ou carte absente.
 */
export function predictPlayedView(view: UnoView, play: PlayedCardPrediction): UnoView | null {
  if (view.phase === "finished" || view.activeSeat !== view.mySeat) return null;
  if (view.phase !== "playing" && view.phase !== "after_draw") return null;
  if (!view.hand.some((candidate) => candidate.id === play.card.id)) return null;
  const activeColor = play.card.color ?? play.chosenColor;
  if (!activeColor) return null;
  const lastCard = view.hand.length === 1;
  const nextSeat = play.card.symbol === "skip" || play.card.symbol === "reverse" ? view.mySeat : otherSeat(view.mySeat);
  // Une dernière carte de pénalité termine la partie : le moteur applique la
  // pioche au score sans attente, donc on n'affiche pas de cumul irréel.
  const pendingPenalty = lastCard
    ? view.pendingPenalty ?? null
    : play.card.symbol === "draw2" || play.card.symbol === "wild4"
      ? { symbol: play.card.symbol, count: (view.pendingPenalty?.count ?? 0) + (play.card.symbol === "draw2" ? 2 : 4) }
      : view.pendingPenalty ?? null;
  return withActiveSeat({
    ...view,
    phase: "playing",
    topCard: play.card,
    hand: view.hand.filter((candidate) => candidate.id !== play.card.id),
    drawnCard: null,
    activeColor,
    nextDrawCards: [],
    nextDrawCard: null,
    nextDrawPlayable: false,
    playableCardIds: [],
    actions: idleActions(view),
    pendingPenalty,
    turns: view.turns + 1,
  }, nextSeat);
}

/**
 * Vue après un `DRAW` préchargé : la carte rejoint la main, la taille de
 * pioche diminue, et selon la jouabilité calculée serveur le joueur reste en
 * `after_draw` ou passe la main. `null` si la pioche n'était pas préchargée,
 * si une pénalité impose de prendre tout le cumul (cartes multiples
 * inconnues) ou si le coup n'est plus d'actualité.
 */
export function predictDrawnView(view: UnoView, draw: DrawnCardPrediction): UnoView | null {
  if (view.phase !== "playing" || view.activeSeat !== view.mySeat) return null;
  if (view.pendingPenalty) return null;
  if (view.hand.some((candidate) => candidate.id === draw.card.id)) return null;
  const base = withActiveSeat({
    ...view,
    hand: [...view.hand, draw.card],
    drawPileCount: Math.max(0, view.drawPileCount - 1),
    nextDrawCards: [],
    nextDrawCard: null,
    nextDrawPlayable: false,
  }, view.mySeat);
  if (!draw.playable) {
    return withActiveSeat({
      ...base,
      drawnCard: null,
      playableCardIds: [],
      actions: idleActions(view),
    }, otherSeat(view.mySeat));
  }
  return {
    ...base,
    phase: "after_draw",
    drawnCard: draw.card,
    playableCardIds: [draw.card.id],
    actions: { canDraw: false, canPlay: false, canPlayDrawn: true, canKeepDrawn: true, canResign: view.actions.canResign },
  };
}

/** La carte piochée est déjà dans la main ; la garder passe simplement le tour. */
export function predictKeptDrawnView(view: UnoView): UnoView | null {
  if (view.phase !== "after_draw" || view.activeSeat !== view.mySeat || !view.actions.canKeepDrawn || !view.drawnCard) return null;
  return withActiveSeat({
    ...view,
    phase: "playing",
    drawnCard: null,
    playableCardIds: [],
    actions: idleActions(view),
    turns: view.turns + 1,
  }, otherSeat(view.mySeat));
}

/**
 * Vue pendant une prise de pénalité en bloc : toutes les cartes connues
 * occupent leur place finale dans la main (le composant masque celles encore
 * en vol) et la pénalité est vidée. Tant que la dernière carte n'a pas
 * atterri, le joueur reste affiché comme actif sans action possible ; une
 * fois toutes posées, la main passe à l'auteur de la pénalité. La projection
 * serveur reste l'autorité et remplace cette vue dès qu'elle confirme.
 */
export function predictPenaltyTakeView(view: UnoView, take: PenaltyTakePrediction): UnoView {
  const done = take.landed >= take.cards.length;
  const takenIds = new Set(take.cards.map((card) => card.id));
  const hand = [
    ...view.hand.filter((card) => !takenIds.has(card.id)),
    ...take.cards,
  ];
  return withActiveSeat({
    ...view,
    hand,
    drawPileCount: Math.max(0, view.drawPileCount - take.landed),
    pendingPenalty: null,
    drawnCard: null,
    nextDrawCards: [],
    nextDrawCard: null,
    nextDrawPlayable: false,
    playableCardIds: [],
    actions: idleActions(view),
    turns: view.turns + (done ? 1 : 0),
  }, done ? otherSeat(view.mySeat) : view.mySeat);
}
