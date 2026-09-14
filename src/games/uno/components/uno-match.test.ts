import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ColorDialog, isPendingPlayValid, type PendingPlay } from "@/games/uno/components/uno-match";
import type { UnoView } from "@/games/uno/types";

function viewFor(seat: 0 | 1, overrides: Partial<UnoView> = {}): UnoView {
  const wild = { id: `wild-${seat}`, color: null, symbol: "wild" as const };
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
    hand: [wild],
    opponentHand: null,
    drawnCard: null,
    playableCardIds: [wild.id],
    players: [
      { id: "alice", seat: 0, pseudo: "Alice", cardCount: seat === 0 ? 1 : 3, score: 0, active: seat === 0 },
      { id: "bob", seat: 1, pseudo: "Bob", cardCount: seat === 1 ? 1 : 3, score: 0, active: seat === 1 },
    ],
    turns: 2,
    counters: { cardsPlayed: 0, cardsDrawn: 0, penaltyCardsTaken: 0, missedAnnouncements: 0, turns: 0 },
    actions: { canDraw: true, canPlay: true, canPlayDrawn: false, canKeepDrawn: false, canResign: true, canClaimForfeit: true },
    result: null,
    ...overrides,
  };
}

describe("composants UNO", () => {
  it("conserve le dialogue du joker pour les deux sièges tant que le coup reste valide", () => {
    for (const seat of [0, 1] as const) {
      const view = viewFor(seat);
      expect(isPendingPlayValid({ type: "PLAY_CARD", cardId: `wild-${seat}` }, view)).toBe(true);
      expect(isPendingPlayValid({ type: "PLAY_CARD", cardId: `wild-${seat}` }, { ...view, activeSeat: (1 - seat) as 0 | 1 })).toBe(false);
      expect(isPendingPlayValid({ type: "PLAY_CARD", cardId: `wild-${seat}` }, { ...view, hand: [] })).toBe(false);
    }
  });

  it("valide la couleur du joker pioché seulement pendant after_draw", () => {
    const view = viewFor(0, {
      phase: "after_draw",
      hand: [{ id: "drawn-wild", color: null, symbol: "wild" }],
      drawnCard: { id: "drawn-wild", color: null, symbol: "wild" },
      playableCardIds: ["drawn-wild"],
      actions: { canDraw: false, canPlay: false, canPlayDrawn: true, canKeepDrawn: true, canResign: true, canClaimForfeit: true },
    });
    const pending: PendingPlay = { type: "PLAY_DRAWN" };
    expect(isPendingPlayValid(pending, view)).toBe(true);
    expect(isPendingPlayValid(pending, { ...view, phase: "playing", drawnCard: null })).toBe(false);
    expect(isPendingPlayValid(pending, { ...view, drawnCard: null })).toBe(false);
    expect(isPendingPlayValid(pending, { ...view, hand: [] })).toBe(false);
  });

  it("expose un dialogue accessible avec annulation", () => {
    const markup = renderToStaticMarkup(createElement(ColorDialog, { onCancel: () => undefined, onChoose: () => undefined }));
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain("Choisis la couleur");
    expect(markup).toContain("Rouge");
    expect(markup).toContain("Annuler");
  });
});
