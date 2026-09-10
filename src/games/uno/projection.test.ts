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
});
