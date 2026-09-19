import { describe, expect, it } from "vitest";
import { DEFAULT_UNO_CONFIG, unoConfigSchema } from "@/games/uno/config";
import { buildUnoDeck } from "@/games/uno/deck";
import {
  initializeUno,
  onUnoAbsence,
  onUnoDeadline,
  reduceUno,
  unoDeckCardCount,
  type UnoEngineContext,
} from "@/games/uno/engine";
import type { UnoCard, UnoState } from "@/games/uno/types";

const participants = ["alice", "bob"] as const;
const entropy = Array.from({ length: 512 }, (_, index) => ((index * 37) % 997) / 997);

function context(actorId: string | null = "alice", overrides: Partial<UnoEngineContext> = {}): UnoEngineContext {
  return {
    nowMs: Date.parse("2026-09-10T12:00:00.000Z"),
    actorId,
    matchId: "match-uno-test",
    participants,
    content: null,
    entropy,
    phaseId: "phase-current",
    nextPhaseId: "phase-next",
    currentDeadlineAt: "2026-09-10T12:00:30.000Z",
    currentDeadlineKind: "turn_timeout",
    ...overrides,
  };
}

function card(id: string, color: UnoCard["color"], symbol: UnoCard["symbol"]): UnoCard {
  return { id, color, symbol };
}

function state(overrides: Partial<UnoState> = {}): UnoState {
  return {
    schemaVersion: 1,
    phase: "playing",
    activeSeat: 0,
    hands: [[card("a-1", "red", "5")], [card("b-1", "blue", "9")]],
    drawPile: [card("draw-1", "green", "7"), card("draw-2", "yellow", "2")],
    discardPile: [card("top", "red", "3")],
    activeColor: "red",
    drawnCardId: null,
    turns: 0,
    blockedTurns: 0,
    counters: [
      { cardsPlayed: 0, cardsDrawn: 0, penaltyCardsTaken: 0, missedAnnouncements: 0, turns: 0 },
      { cardsPlayed: 0, cardsDrawn: 0, penaltyCardsTaken: 0, missedAnnouncements: 0, turns: 0 },
    ],
    finishedOutcome: null,
    finishedReason: null,
    winnerId: null,
    ...overrides,
  };
}

describe("UNO engine", () => {
  it("construit le paquet complet et une distribution classique", () => {
    const deck = buildUnoDeck("match");
    expect(deck).toHaveLength(108);
    expect(new Set(deck.map((item) => item.id)).size).toBe(108);
    expect(deck.filter((item) => item.symbol === "0")).toHaveLength(4);
    expect(deck.filter((item) => item.symbol === "wild")).toHaveLength(4);
    expect(deck.filter((item) => item.symbol === "wild4")).toHaveLength(4);

    const started = initializeUno(DEFAULT_UNO_CONFIG, context());
    expect(started.state.hands[0]).toHaveLength(7);
    expect(started.state.hands[1]).toHaveLength(7);
    expect(started.state.discardPile.at(-1)?.symbol).toMatch(/^\d$/);
    expect(unoDeckCardCount(started.state)).toBe(108);
    expect(started.jobs).toHaveLength(1);
    expect(unoConfigSchema.safeParse({ ...DEFAULT_UNO_CONFIG, firstSeat: 1 }).success).toBe(false);
  });

  it("interrompt la partie avant le premier tour sans fabriquer une victoire", () => {
    const resigned = reduceUno(state(), { type: "RESIGN" }, DEFAULT_UNO_CONFIG, context("bob"));
    expect(resigned.result?.outcome).toBe("abandoned");
    expect(resigned.result?.winnerId).toBeNull();
  });

  it("attribue le départ volontaire à l'adversaire et l'absence au joueur resté", () => {
    const resigned = reduceUno(state({ turns: 1 }), { type: "RESIGN" }, DEFAULT_UNO_CONFIG, context("bob"));
    expect(resigned.result?.outcome).toBe("win");
    expect(resigned.result?.winnerId).toBe("alice");

    const absent = onUnoAbsence(state({ turns: 1 }), DEFAULT_UNO_CONFIG, context("bob"));
    expect(absent.result?.outcome).toBe("win");
    expect(absent.result?.winnerId).toBe("alice");
    expect(absent.result?.reason).toBe("absence");

    const bothAbsent = onUnoAbsence(state({ turns: 1 }), DEFAULT_UNO_CONFIG, context(null));
    expect(bothAbsent.result?.outcome).toBe("abandoned");
    expect(bothAbsent.result?.winnerId).toBeNull();

    const final = reduceUno(state(), { type: "PLAY_CARD", cardId: "a-1", announceLastCard: false }, DEFAULT_UNO_CONFIG, context());
    expect(final.result?.players[0].metrics.turns).toBe(1);
    expect(final.roundRecords).toHaveLength(1);
  });

  it("refuse de démarrer avec une entropie absente", () => {
    expect(() => initializeUno(DEFAULT_UNO_CONFIG, context("alice", { entropy: [] }))).toThrowError("INVALID_ENTROPY");
  });

  it("refuse un +4 quand une carte de la couleur active est en main", () => {
    const current = state({ hands: [[card("wild4", null, "wild4"), card("red-8", "red", "8")], [card("b-1", "blue", "9")]] });
    expect(() => reduceUno(current, { type: "PLAY_CARD", cardId: "wild4", chosenColor: "blue", announceLastCard: true }, DEFAULT_UNO_CONFIG, context())).toThrowError("WILD4_NOT_ALLOWED");

    const allowed = {
      ...current,
      hands: [[card("wild4", null, "wild4"), card("blue-8", "blue", "8")], current.hands[1]] as [UnoCard[], UnoCard[]],
      drawPile: [card("p-1", "red", "1"), card("p-2", "blue", "2"), card("p-3", "green", "3"), card("p-4", "yellow", "4")],
    };
    const transition = reduceUno(allowed, { type: "PLAY_CARD", cardId: "wild4", chosenColor: "green", announceLastCard: true }, DEFAULT_UNO_CONFIG, context());
    expect(transition.state.activeColor).toBe("green");
    // Le +4 crée une attente au lieu de faire piocher aussitôt : Bob prend 4 et Alice rejoue.
    expect(transition.state.pendingPenalty).toEqual({ symbol: "wild4", count: 4 });
    expect(transition.state.hands[1]).toHaveLength(1);
    expect(transition.state.activeSeat).toBe(1);
    const taken = reduceUno(transition.state, { type: "DRAW" }, DEFAULT_UNO_CONFIG, context("bob"));
    expect(taken.state.pendingPenalty).toBeNull();
    expect(taken.state.hands[1]).toHaveLength(5);
    expect(taken.state.counters[1].penaltyCardsTaken).toBe(4);
    expect(taken.state.activeSeat).toBe(0);
  });

  it("applique skip et reverse à deux joueurs, et passe après un joker", () => {
    for (const symbol of ["skip", "reverse"] as const) {
      const current = state({
        hands: [[card("effect", "red", symbol), card("spare", "green", "8")], [card("b-1", "blue", "9")]],
      });
      const transition = reduceUno(current, { type: "PLAY_CARD", cardId: "effect", announceLastCard: true }, DEFAULT_UNO_CONFIG, context());
      expect(transition.state.activeSeat).toBe(0);
      expect(transition.state.turns).toBe(1);
    }

    const wild = state({
      hands: [[card("wild", null, "wild"), card("spare", "green", "8")], [card("b-1", "blue", "9")]],
    });
    const wildTransition = reduceUno(wild, { type: "PLAY_CARD", cardId: "wild", chosenColor: "blue", announceLastCard: true }, DEFAULT_UNO_CONFIG, context());
    expect(wildTransition.state.activeColor).toBe("blue");
    expect(wildTransition.state.activeSeat).toBe(1);

    const drawTwo = state({
      hands: [[card("draw-two", "red", "draw2"), card("spare", "green", "8")], [card("b-1", "blue", "9")]],
      drawPile: [card("penalty-1", "yellow", "1"), card("penalty-2", "green", "2"), card("rest", "blue", "8")],
    });
    const drawTwoTransition = reduceUno(drawTwo, { type: "PLAY_CARD", cardId: "draw-two", announceLastCard: true }, DEFAULT_UNO_CONFIG, context());
    // Le +2 crée une attente : Bob prend 2 via DRAW et Alice rejoue.
    expect(drawTwoTransition.state.pendingPenalty).toEqual({ symbol: "draw2", count: 2 });
    expect(drawTwoTransition.state.hands[1]).toHaveLength(1);
    expect(drawTwoTransition.state.activeSeat).toBe(1);
    const drawTwoTaken = reduceUno(drawTwoTransition.state, { type: "DRAW" }, DEFAULT_UNO_CONFIG, context("bob"));
    expect(drawTwoTaken.state.pendingPenalty).toBeNull();
    expect(drawTwoTaken.state.hands[1]).toHaveLength(3);
    expect(drawTwoTaken.state.counters[1].penaltyCardsTaken).toBe(2);
    expect(drawTwoTaken.state.activeSeat).toBe(0);
  });

  it("ne permet après DRAW que de jouer la carte nouvellement tirée", () => {
    const current = state({ hands: [[], [card("b-1", "blue", "9")]], drawPile: [card("draw-1", "red", "7"), card("draw-2", "green", "3")] });
    const drawn = reduceUno(current, { type: "DRAW" }, DEFAULT_UNO_CONFIG, context());
    expect(drawn.state.phase).toBe("after_draw");
    expect(drawn.state.drawnCardId).toBe("draw-1");
    expect(drawn.state.hands[0]).toEqual([card("draw-1", "red", "7")]);
    expect(() => reduceUno(drawn.state, { type: "PLAY_CARD", cardId: "draw-1", announceLastCard: true }, DEFAULT_UNO_CONFIG, context())).toThrowError("NOT_PLAYING");
    const kept = reduceUno(drawn.state, { type: "KEEP_DRAWN" }, DEFAULT_UNO_CONFIG, context());
    expect(kept.state.phase).toBe("playing");
    expect(kept.state.activeSeat).toBe(1);
    expect(kept.state.turns).toBe(1);
  });

  it("renouvelle le job timeout après une pioche jouable sans relancer le chrono", () => {
    const current = state({ drawPile: [card("draw-1", "red", "7")] });
    const transition = reduceUno(current, { type: "DRAW" }, DEFAULT_UNO_CONFIG, context());
    expect(transition.state.phase).toBe("after_draw");
    expect(transition.deadlineAt).toBe("2026-09-10T12:00:30.000Z");
    expect(transition.phaseId).toBe("phase-next");
    expect(transition.jobs).toHaveLength(1);
    expect(transition.jobs[0]).toMatchObject({
      kind: "turn_timeout",
      phaseId: "phase-next",
      runAt: "2026-09-10T12:00:30.000Z",
    });
  });

  it("ne pénalise plus l'absence d'annonce de dernière carte", () => {
    const current = state({
      hands: [[card("red-5", "red", "5"), card("red-7", "red", "7")], [card("b-1", "blue", "9")]],
      discardPile: [card("top", "blue", "5")],
      activeColor: "blue",
      drawPile: [card("penalty-1", "green", "1"), card("penalty-2", "yellow", "2"), card("rest", "blue", "8")],
    });
    const transition = reduceUno(current, { type: "PLAY_CARD", cardId: "red-5" }, DEFAULT_UNO_CONFIG, context());
    expect(transition.state.hands[0]).toHaveLength(1);
    expect(transition.state.counters[0].missedAnnouncements).toBe(0);
    expect(transition.state.counters[0].penaltyCardsTaken).toBe(0);
    expect(transition.state.counters[0].cardsDrawn).toBe(0);
    expect(transition.state.counters[0].cardsPlayed).toBe(1);
    expect(transition.state.activeSeat).toBe(1);
  });

  it("cumule les +2 : 2 puis 4 puis 6 avant la prise", () => {
    const start = state({
      hands: [
        [card("a-2a", "red", "draw2"), card("a-2b", "green", "draw2"), card("a-spare", "yellow", "1")],
        [card("b-2", "blue", "draw2"), card("b-spare", "yellow", "9")],
      ],
      drawPile: [
        card("p-1", "red", "1"), card("p-2", "blue", "2"), card("p-3", "green", "3"),
        card("p-4", "yellow", "4"), card("p-5", "red", "5"), card("p-6", "blue", "6"),
        card("p-7", "green", "7"),
      ],
    });
    const first = reduceUno(start, { type: "PLAY_CARD", cardId: "a-2a" }, DEFAULT_UNO_CONFIG, context());
    expect(first.state.pendingPenalty).toEqual({ symbol: "draw2", count: 2 });
    expect(first.state.activeSeat).toBe(1);
    expect(first.state.activeColor).toBe("red");

    // Un +2 d'une autre couleur contre quand même.
    const second = reduceUno(first.state, { type: "PLAY_CARD", cardId: "b-2" }, DEFAULT_UNO_CONFIG, context("bob"));
    expect(second.state.pendingPenalty).toEqual({ symbol: "draw2", count: 4 });
    expect(second.state.activeSeat).toBe(0);
    expect(second.state.activeColor).toBe("blue");

    // Une carte normale ne peut pas répondre à l'attente.
    expect(() => reduceUno(second.state, { type: "PLAY_CARD", cardId: "a-spare" }, DEFAULT_UNO_CONFIG, context())).toThrowError("CARD_NOT_PLAYABLE");

    const third = reduceUno(second.state, { type: "PLAY_CARD", cardId: "a-2b" }, DEFAULT_UNO_CONFIG, context());
    expect(third.state.pendingPenalty).toEqual({ symbol: "draw2", count: 6 });
    expect(third.state.activeSeat).toBe(1);

    // Bob prend 6 : l'attente s'annule et Alice rejoue.
    const taken = reduceUno(third.state, { type: "DRAW" }, DEFAULT_UNO_CONFIG, context("bob"));
    expect(taken.state.pendingPenalty).toBeNull();
    expect(taken.state.hands[1]).toHaveLength(7);
    expect(taken.state.counters[1].penaltyCardsTaken).toBe(6);
    expect(taken.state.counters[1].cardsDrawn).toBe(6);
    expect(taken.state.activeSeat).toBe(0);
  });

  it("prendre un +2 sans contrer fait rejouer l'auteur, sans mélange +2/+4", () => {
    const start = state({
      hands: [
        [card("a-2", "red", "draw2"), card("a-spare", "green", "8")],
        [card("b-4", null, "wild4"), card("b-spare", "yellow", "1")],
      ],
      drawPile: [card("p-1", "red", "1"), card("p-2", "blue", "2"), card("p-3", "green", "3")],
    });
    const stacked = reduceUno(start, { type: "PLAY_CARD", cardId: "a-2" }, DEFAULT_UNO_CONFIG, context());
    expect(stacked.state.pendingPenalty).toEqual({ symbol: "draw2", count: 2 });
    // Un +4 ne répond pas à un +2.
    expect(() => reduceUno(stacked.state, { type: "PLAY_CARD", cardId: "b-4", chosenColor: "green" }, DEFAULT_UNO_CONFIG, context("bob"))).toThrowError("CARD_NOT_PLAYABLE");
    const taken = reduceUno(stacked.state, { type: "DRAW" }, DEFAULT_UNO_CONFIG, context("bob"));
    expect(taken.state.pendingPenalty).toBeNull();
    expect(taken.state.hands[1]).toHaveLength(4);
    expect(taken.state.counters[1].penaltyCardsTaken).toBe(2);
    expect(taken.state.activeSeat).toBe(0);
  });

  it("cumule les +4 : 4 puis 8, sans restriction de couleur en riposte", () => {
    const start = state({
      activeColor: "red",
      hands: [
        [card("a-4", null, "wild4"), card("a-spare", "blue", "8")],
        [card("b-4", null, "wild4"), card("b-green", "green", "3")],
      ],
      drawPile: [
        card("p-1", "red", "1"), card("p-2", "blue", "2"), card("p-3", "green", "3"),
        card("p-4", "yellow", "4"), card("p-5", "red", "5"), card("p-6", "blue", "6"),
        card("p-7", "green", "7"), card("p-8", "yellow", "8"),
      ],
    });
    const first = reduceUno(start, { type: "PLAY_CARD", cardId: "a-4", chosenColor: "green" }, DEFAULT_UNO_CONFIG, context());
    expect(first.state.pendingPenalty).toEqual({ symbol: "wild4", count: 4 });
    expect(first.state.activeColor).toBe("green");
    expect(first.state.activeSeat).toBe(1);
    // Sans couleur choisie, la riposte +4 est refusée.
    expect(() => reduceUno(first.state, { type: "PLAY_CARD", cardId: "b-4" }, DEFAULT_UNO_CONFIG, context("bob"))).toThrowError("WILD_COLOR_REQUIRED");
    // Bob détient du vert (couleur active) : interdit en temps normal, admis en riposte.
    const second = reduceUno(first.state, { type: "PLAY_CARD", cardId: "b-4", chosenColor: "yellow" }, DEFAULT_UNO_CONFIG, context("bob"));
    expect(second.state.pendingPenalty).toEqual({ symbol: "wild4", count: 8 });
    expect(second.state.activeColor).toBe("yellow");
    expect(second.state.activeSeat).toBe(0);
    const taken = reduceUno(second.state, { type: "DRAW" }, DEFAULT_UNO_CONFIG, context());
    expect(taken.state.pendingPenalty).toBeNull();
    expect(taken.state.hands[0]).toHaveLength(9);
    expect(taken.state.counters[0].penaltyCardsTaken).toBe(8);
    expect(taken.state.activeSeat).toBe(1);
  });

  it("au timeout face à une attente, le joueur prend tout le cumul", () => {
    const pending = state({
      activeSeat: 1,
      hands: [[card("a-spare", "green", "8")], [card("b-spare", "yellow", "1")]],
      pendingPenalty: { symbol: "draw2", count: 4 },
      drawPile: [card("p-1", "red", "1"), card("p-2", "blue", "2"), card("p-3", "green", "3"), card("p-4", "yellow", "4")],
    });
    const transition = onUnoDeadline(pending, "turn_timeout", DEFAULT_UNO_CONFIG, context(null));
    expect(transition.state.pendingPenalty).toBeNull();
    expect(transition.state.hands[1]).toHaveLength(5);
    expect(transition.state.counters[1].penaltyCardsTaken).toBe(4);
    expect(transition.state.activeSeat).toBe(0);
  });

  it("jouer le +2 pioché crée une attente au lieu de passer", () => {
    const start = state({
      hands: [[card("blue-9", "blue", "9")], [card("b-1", "blue", "1")]],
      drawPile: [card("draw-2", "red", "draw2")],
    });
    const drawn = reduceUno(start, { type: "DRAW" }, DEFAULT_UNO_CONFIG, context());
    expect(drawn.state.phase).toBe("after_draw");
    const stacked = reduceUno(drawn.state, { type: "PLAY_DRAWN" }, DEFAULT_UNO_CONFIG, context());
    expect(stacked.state.pendingPenalty).toEqual({ symbol: "draw2", count: 2 });
    expect(stacked.state.phase).toBe("playing");
    expect(stacked.state.activeSeat).toBe(1);
  });

  it("applique un +2 final avant de calculer le score gagnant", () => {
    const current = state({
      hands: [[card("last-2", "red", "draw2")], [card("b-1", "blue", "9")]],
      drawPile: [card("p-1", "green", "4"), card("p-2", null, "wild")],
    });
    const transition = reduceUno(current, { type: "PLAY_CARD", cardId: "last-2", announceLastCard: false }, DEFAULT_UNO_CONFIG, context());
    expect(transition.state.phase).toBe("finished");
    expect(transition.result?.winnerId).toBe("alice");
    expect(transition.result?.players[0].score).toBe(63);
    expect(transition.state.hands[1]).toHaveLength(3);
  });

  it("recycle la défausse sans déplacer son sommet", () => {
    const current = state({ drawPile: [], discardPile: [card("old-1", "blue", "1"), card("old-2", "green", "2"), card("top", "red", "3")] });
    const transition = reduceUno(current, { type: "DRAW" }, DEFAULT_UNO_CONFIG, context());
    expect(transition.state.discardPile).toEqual([card("top", "red", "3")]);
    expect(unoDeckCardCount(transition.state)).toBe(5);
    expect(transition.state.counters[0].cardsDrawn).toBe(1);
  });

  it("au timeout tire puis garde la carte jouable et passe immédiatement", () => {
    const current = state({ drawPile: [card("timeout-card", "red", "7")] });
    const transition = onUnoDeadline(current, "turn_timeout", DEFAULT_UNO_CONFIG, context(null));
    expect(transition.state.phase).toBe("playing");
    expect(transition.state.activeSeat).toBe(1);
    expect(transition.state.hands[0]).toContainEqual(card("timeout-card", "red", "7"));
    expect(transition.state.drawnCardId).toBeNull();
  });

  it("termine en draw après deux tours bloqués et à la limite de 300 tours", () => {
    const blocked = state({ drawPile: [], discardPile: [card("top", "red", "3")], blockedTurns: 1 });
    const blockedTransition = onUnoDeadline(blocked, "turn_timeout", DEFAULT_UNO_CONFIG, context(null));
    expect(blockedTransition.state.phase).toBe("finished");
    expect(blockedTransition.result?.reason).toBe("blocked");
    expect(blockedTransition.result?.outcome).toBe("draw");

    const limit = state({ turns: 299, drawPile: [card("draw", "green", "8")] });
    const limitTransition = onUnoDeadline(limit, "turn_timeout", DEFAULT_UNO_CONFIG, context(null));
    expect(limitTransition.state.phase).toBe("finished");
    expect(limitTransition.result?.reason).toBe("turn_limit");
  });
});
