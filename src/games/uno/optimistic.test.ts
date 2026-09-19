import { describe, expect, it } from "vitest";
import { predictDrawnView, predictPenaltyTakeView, predictPlayedView } from "@/games/uno/optimistic";
import type { UnoCard, UnoView } from "@/games/uno/types";

function viewFor(seat: 0 | 1, overrides: Partial<UnoView> = {}): UnoView {
  return {
    kind: "uno",
    stateSchemaVersion: 1,
    phase: "playing",
    mySeat: seat,
    activeSeat: seat,
    turnSeconds: 30,
    activeColor: "red",
    topCard: { id: "top", color: "red", symbol: "3" },
    drawPileCount: 20,
    hand: [{ id: "red-5", color: "red", symbol: "5" }],
    opponentHand: null,
    drawnCard: null,
    nextDrawCard: { id: "next", color: "green", symbol: "2" },
    nextDrawPlayable: false,
    playableCardIds: ["red-5"],
    pendingPenalty: null,
    players: [
      { id: "alice", seat: 0, pseudo: "Alice", cardCount: seat === 0 ? 1 : 3, score: 0, active: seat === 0 },
      { id: "bob", seat: 1, pseudo: "Bob", cardCount: seat === 1 ? 1 : 3, score: 0, active: seat === 1 },
    ],
    turns: 2,
    counters: { cardsPlayed: 0, cardsDrawn: 0, penaltyCardsTaken: 0, missedAnnouncements: 0, turns: 0 },
    actions: { canDraw: true, canPlay: true, canPlayDrawn: false, canKeepDrawn: false, canResign: true },
    result: null,
    ...overrides,
  };
}

describe("vues optimistes UNO", () => {
  it("passe la main à l'adversaire à la fin du vol d'une carte normale", () => {
    const view = viewFor(0, {
      hand: [
        { id: "red-5", color: "red", symbol: "5" },
        { id: "blue-9", color: "blue", symbol: "9" },
      ],
    });
    const predicted = predictPlayedView(view, { card: { id: "red-5", color: "red", symbol: "5" } });
    expect(predicted).not.toBeNull();
    expect(predicted?.activeSeat).toBe(1);
    expect(predicted?.players[0].active).toBe(false);
    expect(predicted?.players[1].active).toBe(true);
    expect(predicted?.topCard.id).toBe("red-5");
    expect(predicted?.hand.map((card) => card.id)).toEqual(["blue-9"]);
    expect(predicted?.activeColor).toBe("red");
    expect(predicted?.playableCardIds).toEqual([]);
    expect(predicted?.actions).toEqual({ canDraw: false, canPlay: false, canPlayDrawn: false, canKeepDrawn: false, canResign: true });
    expect(predicted?.nextDrawCard).toBeNull();
    expect(predicted?.turns).toBe(3);
  });

  it("garde l'auteur actif après skip ou reverse", () => {
    const view = viewFor(0, {
      hand: [
        { id: "red-skip", color: "red", symbol: "skip" },
        { id: "blue-9", color: "blue", symbol: "9" },
      ],
    });
    const skip = predictPlayedView(view, { card: { id: "red-skip", color: "red", symbol: "skip" } });
    expect(skip?.activeSeat).toBe(0);
    expect(skip?.players[0].active).toBe(true);
    const reverse = predictPlayedView(view, { card: { id: "red-skip", color: "red", symbol: "reverse" } });
    expect(reverse?.activeSeat).toBe(0);
  });

  it("cumule la pénalité et passe la main pour un +2 ou un +4", () => {
    const view = viewFor(0, {
      hand: [
        { id: "blue-draw2", color: "blue", symbol: "draw2" },
        { id: "blue-9", color: "blue", symbol: "9" },
      ],
      pendingPenalty: { symbol: "draw2", count: 4 },
    });
    const draw2 = predictPlayedView(view, { card: { id: "blue-draw2", color: "blue", symbol: "draw2" } });
    expect(draw2?.pendingPenalty).toEqual({ symbol: "draw2", count: 6 });
    expect(draw2?.activeSeat).toBe(1);
    const wild4View = viewFor(0, {
      hand: [
        { id: "wild4", color: null, symbol: "wild4" },
        { id: "blue-9", color: "blue", symbol: "9" },
      ],
      pendingPenalty: { symbol: "wild4", count: 4 },
    });
    const wild4 = predictPlayedView(wild4View, { card: { id: "wild4", color: null, symbol: "wild4" }, chosenColor: "green" });
    expect(wild4?.pendingPenalty).toEqual({ symbol: "wild4", count: 8 });
    expect(wild4?.activeColor).toBe("green");
  });

  it("pose la dernière carte sans inventer de cumul ni de résultat", () => {
    const last = viewFor(0, { hand: [{ id: "red-draw2", color: "red", symbol: "draw2" }] });
    const predicted = predictPlayedView(last, { card: { id: "red-draw2", color: "red", symbol: "draw2" } });
    expect(predicted?.topCard.id).toBe("red-draw2");
    expect(predicted?.hand).toEqual([]);
    expect(predicted?.pendingPenalty).toBeNull();
    expect(predicted?.phase).toBe("playing");
    expect(predicted?.result).toBeNull();
    expect(predicted?.actions.canPlay).toBe(false);
  });

  it("ne prédit ni un coup hors tour ni une carte absente", () => {
    const notMyTurn = viewFor(0, { activeSeat: 1 });
    expect(predictPlayedView(notMyTurn, { card: { id: "red-5", color: "red", symbol: "5" } })).toBeNull();
    const view = viewFor(0);
    expect(predictPlayedView(view, { card: { id: "missing", color: "red", symbol: "7" } })).toBeNull();
  });

  it("ajoute la carte piochée et reste en after_draw si elle est jouable", () => {
    const view = viewFor(0, { nextDrawCard: { id: "green-2", color: "green", symbol: "2" }, nextDrawPlayable: true });
    const predicted = predictDrawnView(view, { card: { id: "green-2", color: "green", symbol: "2" }, playable: true });
    expect(predicted?.phase).toBe("after_draw");
    expect(predicted?.activeSeat).toBe(0);
    expect(predicted?.hand.map((card) => card.id)).toEqual(["red-5", "green-2"]);
    expect(predicted?.drawnCard?.id).toBe("green-2");
    expect(predicted?.playableCardIds).toEqual(["green-2"]);
    expect(predicted?.actions.canPlayDrawn).toBe(true);
    expect(predicted?.actions.canKeepDrawn).toBe(true);
    expect(predicted?.actions.canDraw).toBe(false);
    expect(predicted?.actions.canPlay).toBe(false);
    expect(predicted?.drawPileCount).toBe(19);
    expect(predicted?.nextDrawCard).toBeNull();
  });

  it("ajoute la carte piochée et passe la main si elle n'est pas jouable", () => {
    const view = viewFor(0);
    const predicted = predictDrawnView(view, { card: { id: "green-2", color: "green", symbol: "2" }, playable: false });
    expect(predicted?.phase).toBe("playing");
    expect(predicted?.activeSeat).toBe(1);
    expect(predicted?.players[1].active).toBe(true);
    expect(predicted?.hand.map((card) => card.id)).toEqual(["red-5", "green-2"]);
    expect(predicted?.drawnCard).toBeNull();
    expect(predicted?.actions).toEqual({ canDraw: false, canPlay: false, canPlayDrawn: false, canKeepDrawn: false, canResign: true });
    expect(predicted?.drawPileCount).toBe(19);
  });

  it("ne prédit pas une prise de cumul ni un tirage hors tour", () => {
    const pending = viewFor(0, { pendingPenalty: { symbol: "draw2", count: 4 } });
    expect(predictDrawnView(pending, { card: { id: "green-2", color: "green", symbol: "2" }, playable: false })).toBeNull();
    const notMyTurn = viewFor(0, { activeSeat: 1 });
    expect(predictDrawnView(notMyTurn, { card: { id: "green-2", color: "green", symbol: "2" }, playable: true })).toBeNull();
    const alreadyInHand = viewFor(0, { hand: [{ id: "green-2", color: "green", symbol: "2" }] });
    expect(predictDrawnView(alreadyInHand, { card: { id: "green-2", color: "green", symbol: "2" }, playable: true })).toBeNull();
  });

  it("prise de pénalité : cartes en place, tour tenu puis passé à l'auteur", () => {
    const view = viewFor(0, {
      hand: [{ id: "red-5", color: "red", symbol: "5" }],
      pendingPenalty: { symbol: "wild4", count: 8 },
      drawPileCount: 20,
    });
    const cards: UnoCard[] = [
      { id: "take-1", color: "green", symbol: "2" },
      { id: "take-2", color: "blue", symbol: "7" },
      { id: "take-3", color: "red", symbol: "wild" },
    ];
    const during = predictPenaltyTakeView(view, { cards, landed: 1 });
    expect(during.pendingPenalty).toBeNull();
    expect(during.activeSeat).toBe(0);
    expect(during.actions.canDraw).toBe(false);
    expect(during.hand.map((card) => card.id)).toEqual(["red-5", "take-1", "take-2", "take-3"]);
    expect(during.drawPileCount).toBe(19);
    expect(during.turns).toBe(2);
    const after = predictPenaltyTakeView(view, { cards, landed: 3 });
    expect(after.activeSeat).toBe(1);
    expect(after.players[1].active).toBe(true);
    expect(after.drawPileCount).toBe(17);
    expect(after.turns).toBe(3);
    expect(after.actions).toEqual({ canDraw: false, canPlay: false, canPlayDrawn: false, canKeepDrawn: false, canResign: true });
  });

  it("prise de pénalité : ne duplique pas les cartes déjà confirmées par le serveur", () => {
    const view = viewFor(0, {
      hand: [{ id: "red-5", color: "red", symbol: "5" }, { id: "take-1", color: "green", symbol: "2" }],
      pendingPenalty: { symbol: "draw2", count: 2 },
    });
    const cards: UnoCard[] = [
      { id: "take-1", color: "green", symbol: "2" },
      { id: "take-2", color: "blue", symbol: "7" },
    ];
    const taken = predictPenaltyTakeView(view, { cards, landed: 2 });
    expect(taken.hand.map((card) => card.id)).toEqual(["red-5", "take-1", "take-2"]);
  });
});
