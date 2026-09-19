import { describe, expect, it } from "vitest";
import { DEFAULT_UNO_CONFIG } from "@/games/uno/config";
import { projectUno } from "@/games/uno/projection";
import { hasOpponentHandLeak } from "@/games/uno/projection";
import type { UnoState } from "@/games/uno/types";

const state: UnoState = {
  schemaVersion: 1,
  phase: "playing",
  activeSeat: 0,
  hands: [[{ id: "alice-card", color: "red", symbol: "5" }], [{ id: "secret-bob", color: null, symbol: "wild4" }]],
  drawPile: [{ id: "draw", color: "green", symbol: "2" }],
  discardPile: [{ id: "top", color: "red", symbol: "3" }],
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
};

describe("UNO projection", () => {
  it("ne transmet pas la main adverse pendant la partie", () => {
    const view = projectUno(state, DEFAULT_UNO_CONFIG, "alice", ["alice", "bob"], [{ id: "alice", pseudo: "Alice" }, { id: "bob", pseudo: "Bob" }]);
    expect(view.hand[0]?.id).toBe("alice-card");
    expect(view.opponentHand).toBeNull();
    expect(JSON.stringify(view)).not.toContain("secret-bob");
    expect(hasOpponentHandLeak(view)).toBe(false);
    expect(view.playableCardIds).toEqual(["alice-card"]);
  });

  it("révèle la main adverse seulement à la fin", () => {
    const view = projectUno({ ...state, phase: "finished", finishedOutcome: "win", finishedReason: "normal", winnerId: "alice" }, DEFAULT_UNO_CONFIG, "alice", ["alice", "bob"], [{ id: "alice", pseudo: "Alice" }, { id: "bob", pseudo: "Bob" }]);
    expect(view.opponentHand?.[0]?.id).toBe("secret-bob");
    expect(view.result?.winnerId).toBe("alice");
    expect(view.players[0].score).toBe(50);
  });

  it("pendant une attente +2, seuls les +2 sont jouables et la prise est proposée", () => {
    const pending: UnoState = {
      ...state,
      pendingPenalty: { symbol: "draw2", count: 4 },
      hands: [
        [{ id: "blue-2", color: "blue", symbol: "draw2" }, { id: "red-5", color: "red", symbol: "5" }],
        [{ id: "secret-bob", color: "green", symbol: "7" }],
      ],
    };
    const view = projectUno(pending, DEFAULT_UNO_CONFIG, "alice", ["alice", "bob"], [{ id: "alice", pseudo: "Alice" }, { id: "bob", pseudo: "Bob" }]);
    expect(view.pendingPenalty).toEqual({ symbol: "draw2", count: 4 });
    // Le +2 bleu contre malgré la couleur différente ; le 5 rouge ne répond pas.
    expect(view.playableCardIds).toEqual(["blue-2"]);
    expect(view.actions.canDraw).toBe(true);
    expect(view.actions.canPlay).toBe(true);
    expect(view.opponentHand).toBeNull();
    expect(JSON.stringify(view)).not.toContain("secret-bob");
    expect(hasOpponentHandLeak(view)).toBe(false);
  });

  it("pendant une attente +4, seul un +4 répond", () => {
    const pending: UnoState = {
      ...state,
      activeColor: "green",
      pendingPenalty: { symbol: "wild4", count: 8 },
      hands: [
        [{ id: "my-4", color: null, symbol: "wild4" }, { id: "green-3", color: "green", symbol: "3" }],
        [{ id: "secret-bob", color: "yellow", symbol: "9" }],
      ],
    };
    const view = projectUno(pending, DEFAULT_UNO_CONFIG, "alice", ["alice", "bob"], [{ id: "alice", pseudo: "Alice" }, { id: "bob", pseudo: "Bob" }]);
    expect(view.pendingPenalty).toEqual({ symbol: "wild4", count: 8 });
    expect(view.playableCardIds).toEqual(["my-4"]);
    expect(view.opponentHand).toBeNull();
  });
});
