import type { Seat } from "@/games/contracts";
import { unoConfigSchema } from "@/games/uno/config";
import { isUnoCardPlayable } from "@/games/uno/engine";
import { unoStateSchema, type UnoPlayerView, type UnoResultView, type UnoState, type UnoView } from "@/games/uno/types";

type PlayerIdentity = { id: string; pseudo: string };

function seatOf(viewerId: string, participants: readonly [string, string]): Seat {
  const seat = participants.indexOf(viewerId);
  if (seat !== 0 && seat !== 1) throw new Error("NOT_A_PARTICIPANT");
  return seat;
}

function resultView(state: UnoState, participants: readonly [string, string]): UnoResultView | null {
  if (state.phase !== "finished") return null;
  return {
    outcome: state.finishedOutcome === "win" ? "win" : state.finishedOutcome === "draw" ? "draw" : "abandoned",
    winnerId: state.winnerId,
    reason: state.finishedReason ?? "normal",
    players: [
      { id: participants[0], score: null },
      { id: participants[1], score: null },
    ],
  };
}

function playerView(identity: PlayerIdentity, seat: Seat, state: UnoState): UnoPlayerView {
  return {
    id: identity.id,
    seat,
    pseudo: identity.pseudo,
    cardCount: state.hands[seat].length,
    score: 0,
    active: state.phase !== "finished" && state.activeSeat === seat,
  };
}

export function projectUno(
  stateInput: unknown,
  configInput: unknown,
  viewerId: string,
  participants: readonly [string, string],
  identities: readonly [PlayerIdentity, PlayerIdentity],
): UnoView {
  const state = unoStateSchema.parse(stateInput);
  const config = unoConfigSchema.parse(configInput);
  const viewerSeat = seatOf(viewerId, participants);
  const ownHand = state.hands[viewerSeat];
  const active = state.phase !== "finished" && state.activeSeat === viewerSeat;
  const playableCardIds = active && state.phase === "playing"
    ? ownHand.filter((card) => isUnoCardPlayable(card, state, viewerSeat)).map((card) => card.id)
    : active && state.phase === "after_draw" && state.drawnCardId
      ? ownHand.some((card) => card.id === state.drawnCardId && isUnoCardPlayable(card, state, viewerSeat)) ? [state.drawnCardId] : []
      : [];
  const topCard = state.discardPile[state.discardPile.length - 1];
  if (!topCard) throw new Error("EMPTY_DISCARD");
  const players: [UnoPlayerView, UnoPlayerView] = [
    playerView(identities[0], 0, state),
    playerView(identities[1], 1, state),
  ];
  const scores = state.phase === "finished" && state.finishedOutcome === "win" && state.finishedReason === "normal" && state.winnerId
    ? [state.winnerId === participants[0] ? state.hands[1].reduce((sum, card) => sum + (card.symbol >= "0" && card.symbol <= "9" ? Number(card.symbol) : card.symbol === "wild" || card.symbol === "wild4" ? 50 : 20), 0) : 0,
       state.winnerId === participants[1] ? state.hands[0].reduce((sum, card) => sum + (card.symbol >= "0" && card.symbol <= "9" ? Number(card.symbol) : card.symbol === "wild" || card.symbol === "wild4" ? 50 : 20), 0) : 0]
    : [0, 0];
  players[0].score = scores[0];
  players[1].score = scores[1];
  const result = resultView(state, participants);
  if (result) {
    result.players = [
      { id: participants[0], score: scores[0] },
      { id: participants[1], score: scores[1] },
    ];
  }
  const drawnCard = active && state.phase === "after_draw" && state.drawnCardId
    ? ownHand.find((card) => card.id === state.drawnCardId) ?? null
    : null;
  return {
    kind: "uno",
    stateSchemaVersion: 1,
    phase: state.phase,
    mySeat: viewerSeat,
    activeSeat: state.activeSeat,
    turnSeconds: config.turnSeconds,
    activeColor: state.activeColor,
    topCard,
    drawPileCount: state.drawPile.length,
    hand: ownHand,
    opponentHand: state.phase === "finished" ? state.hands[(1 - viewerSeat) as Seat] : null,
    drawnCard,
    playableCardIds,
    players,
    turns: state.turns,
    counters: state.counters[viewerSeat],
    actions: {
      canDraw: active && state.phase === "playing",
      canPlay: active && state.phase === "playing" && playableCardIds.length > 0,
      canPlayDrawn: active && state.phase === "after_draw" && playableCardIds.length === 1,
      canKeepDrawn: active && state.phase === "after_draw" && state.drawnCardId !== null,
      canResign: state.phase !== "finished",
      canClaimForfeit: state.phase !== "finished",
    },
    result,
  };
}

export function hasOpponentHandLeak(view: UnoView): boolean {
  return view.phase !== "finished" && view.opponentHand !== null;
}

export function hiddenOpponentHandKeys(view: UnoView): string[] {
  return view.phase !== "finished" ? Object.keys(view.opponentHand ?? {}) : [];
}
