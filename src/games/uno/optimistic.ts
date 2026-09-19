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
 * Vue après un `PLAY_CARD` ou `PLAY_DRAWN` : la carte quitte la main, la
 * couleur active suit, la pénalité éventuelle est cumulée, et le tour va au
 * siège que le moteur désignerait (skip/reverse font rejouer l'auteur).
 * `null` si le coup n'est pas prévisible : pas mon tour, carte absente, ou
 * dernière carte (la fin de partie reste décidée par le serveur).
 */
export function predictPlayedView(view: UnoView, play: PlayedCardPrediction): UnoView | null {
  if (view.phase === "finished" || view.activeSeat !== view.mySeat) return null;
  if (view.phase !== "playing" && view.phase !== "after_draw") return null;
  if (!view.hand.some((candidate) => candidate.id === play.card.id)) return null;
  if (view.hand.length <= 1) return null;
  const activeColor = play.card.color ?? play.chosenColor;
  if (!activeColor) return null;
  const nextSeat = play.card.symbol === "skip" || play.card.symbol === "reverse" ? view.mySeat : otherSeat(view.mySeat);
  const pendingPenalty = play.card.symbol === "draw2" || play.card.symbol === "wild4"
    ? { symbol: play.card.symbol, count: (view.pendingPenalty?.count ?? 0) + (play.card.symbol === "draw2" ? 2 : 4) }
    : view.pendingPenalty ?? null;
  return withActiveSeat({
    ...view,
    phase: "playing",
    hand: view.hand.filter((candidate) => candidate.id !== play.card.id),
    drawnCard: null,
    activeColor,
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
