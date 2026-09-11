import { describe, expect, it } from "vitest";
import { projectSkyjo } from "@/games/skyjo/projection";
import type { SkyjoCell, SkyjoState } from "@/games/skyjo/types";

const PARTICIPANTS = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"] as const;
const IDENTITIES = [{ id: PARTICIPANTS[0], pseudo: "Awa" }, { id: PARTICIPANTS[1], pseudo: "Bil" }] as const;
const CONFIG = { format: "short", turnSeconds: 60 } as const;

function cell(id: string, value: number, revealed: boolean): SkyjoCell {
  return { card: { id, value }, revealed };
}

function state(overrides: Partial<SkyjoState> = {}): SkyjoState {
  const grids: [SkyjoCell[], SkyjoCell[]] = [
    Array.from({ length: 12 }, (_, slot) => cell(`secret-a-${slot}`, slot, slot < 2)),
    Array.from({ length: 12 }, (_, slot) => cell(`secret-b-${slot}`, 12 - slot, slot < 2)),
  ];
  return {
    schemaVersion: 1,
    phase: "choose_source",
    round: 1,
    activeSeat: 0,
    firstSeat: 0,
    grids,
    initialReady: [true, true],
    initialSums: [1, 23],
    drawPile: [{ id: "secret-draw-1", value: 11 }, { id: "secret-draw-2", value: 0 }],
    discardPile: [{ id: "disc-1", value: 4 }],
    removed: [{ id: "rem-1", value: 9 }],
    heldCard: null,
    heldSource: null,
    closingSeat: null,
    finalTurnsRemaining: 0,
    turns: 2,
    cumulative: [7, 12],
    acknowledgedBy: [],
    roundSummary: null,
    counters: { rawPointsSum: [7, 12], penalties: [0, 0], columnClears: [0, 0], automaticTurns: [0, 0] },
    finishedOutcome: null,
    finishedReason: null,
    winnerId: null,
    ...overrides,
  };
}

describe("projection skyjo", () => {
  it("ne révèle jamais une carte cachée, même à son propriétaire", () => {
    for (const viewer of PARTICIPANTS) {
      const view = projectSkyjo(state(), CONFIG, viewer, [PARTICIPANTS[0], PARTICIPANTS[1]], [IDENTITIES[0], IDENTITIES[1]]);
      for (const cellView of [...view.myGrid, ...view.opponentGrid]) {
        if (!cellView.revealed) expect("value" in cellView).toBe(false);
      }
      const raw = JSON.stringify(view);
      expect(raw).not.toContain("secret-a-5");
      expect(raw).not.toContain("secret-b-5");
      expect(raw).not.toContain("secret-draw-1");
      expect(raw).not.toContain("secret-draw-2");
      expect(raw).not.toContain("heldSource");
      expect(raw).not.toContain("initialSums");
      expect(raw).not.toContain("drawPile");
    }
  });

  it("montre les cartes visibles des deux grilles", () => {
    const view = projectSkyjo(state(), CONFIG, PARTICIPANTS[0], [PARTICIPANTS[0], PARTICIPANTS[1]], [IDENTITIES[0], IDENTITIES[1]]);
    expect(view.myGrid[0]).toEqual({ slot: 0, revealed: true, value: 0 });
    expect(view.opponentGrid[0]).toEqual({ slot: 0, revealed: true, value: 12 });
    expect(view.discardTop).toBe(4);
    expect(view.drawCount).toBe(2);
    expect(view.removedCount).toBe(1);
  });

  it("ne montre la carte tenue qu'au joueur actif", () => {
    const holding = state({ phase: "resolve_draw", heldCard: { id: "held-secret", value: 10 }, heldSource: "draw" });
    const active = projectSkyjo(holding, CONFIG, PARTICIPANTS[0], [PARTICIPANTS[0], PARTICIPANTS[1]], [IDENTITIES[0], IDENTITIES[1]]);
    expect(active.held).toEqual({ value: 10, source: "draw" });
    const opponent = projectSkyjo(holding, CONFIG, PARTICIPANTS[1], [PARTICIPANTS[0], PARTICIPANTS[1]], [IDENTITIES[0], IDENTITIES[1]]);
    expect(opponent.held).toEqual({ hidden: true });
    expect(JSON.stringify(opponent)).not.toContain("held-secret");
  });

  it("expose les trous, le résumé de manche et le résultat", () => {
    const grids: [SkyjoCell[], SkyjoCell[]] = [
      [null, ...Array.from({ length: 11 }, (_, slot) => cell(`f-a-${slot}`, 3, true))],
      Array.from({ length: 12 }, (_, slot) => cell(`f-b-${slot}`, 2, true)),
    ];
    const summary = { round: 1, triggerSeat: 0 as const, raw: [33, 24] as [number, number], final: [33, 24] as [number, number], penalizedSeat: null as null, clears: 0, turns: 9, cumulativeAfter: [33, 24] as [number, number] };
    const reveal = projectSkyjo(state({ phase: "round_reveal", grids, roundSummary: summary }), CONFIG, PARTICIPANTS[0], [PARTICIPANTS[0], PARTICIPANTS[1]], [IDENTITIES[0], IDENTITIES[1]]);
    expect(reveal.myGrid[0]).toEqual({ slot: 0, revealed: false, empty: true });
    expect(reveal.roundSummary?.final).toEqual([33, 24]);
    expect(reveal.allowedActions).toContain("NEXT");
    const finished = projectSkyjo(
      state({ phase: "finished", cumulative: [33, 24], finishedOutcome: "win", finishedReason: "normal", winnerId: PARTICIPANTS[1] }),
      CONFIG,
      PARTICIPANTS[0],
      [PARTICIPANTS[0], PARTICIPANTS[1]],
      [IDENTITIES[0], IDENTITIES[1]],
    );
    expect(finished.result?.winnerId).toBe(PARTICIPANTS[1]);
    expect(finished.activePlayerId).toBeNull();
  });

  it("propose les bonnes actions selon la phase", () => {
    const setup = projectSkyjo(state({ phase: "setup", initialReady: [false, false], activeSeat: 0 }), CONFIG, PARTICIPANTS[0], [PARTICIPANTS[0], PARTICIPANTS[1]], [IDENTITIES[0], IDENTITIES[1]]);
    expect(setup.allowedActions).toContain("REVEAL_INITIAL");
    expect(setup.activePlayerId).toBeNull();
    const turn = projectSkyjo(state(), CONFIG, PARTICIPANTS[0], [PARTICIPANTS[0], PARTICIPANTS[1]], [IDENTITIES[0], IDENTITIES[1]]);
    expect(turn.allowedActions).toContain("TAKE_DRAW");
    expect(turn.allowedActions).toContain("TAKE_DISCARD");
    const waiting = projectSkyjo(state(), CONFIG, PARTICIPANTS[1], [PARTICIPANTS[0], PARTICIPANTS[1]], [IDENTITIES[0], IDENTITIES[1]]);
    expect(waiting.allowedActions).not.toContain("TAKE_DRAW");
  });

  it("masque TAKE_DRAW sans carte recyclable, l'offre sinon", () => {
    const blocked = projectSkyjo(
      state({ drawPile: [], discardPile: [{ id: "only", value: 6 }] }),
      CONFIG, PARTICIPANTS[0], [PARTICIPANTS[0], PARTICIPANTS[1]], [IDENTITIES[0], IDENTITIES[1]],
    );
    expect(blocked.allowedActions).toContain("TAKE_DISCARD");
    expect(blocked.allowedActions).not.toContain("TAKE_DRAW");
    const recyclable = projectSkyjo(
      state({ drawPile: [], discardPile: [{ id: "r1", value: 1 }, { id: "top", value: 9 }] }),
      CONFIG, PARTICIPANTS[0], [PARTICIPANTS[0], PARTICIPANTS[1]], [IDENTITIES[0], IDENTITIES[1]],
    );
    expect(recyclable.allowedActions).toContain("TAKE_DRAW");
    expect(JSON.stringify(blocked)).not.toContain("only");
  });

  it("n'affiche aucun joueur actif en setup ni en round_reveal", () => {
    const setup = projectSkyjo(
      state({ phase: "setup", initialReady: [false, false], activeSeat: 0 }),
      CONFIG, PARTICIPANTS[0], [PARTICIPANTS[0], PARTICIPANTS[1]], [IDENTITIES[0], IDENTITIES[1]],
    );
    expect(setup.activePlayerId).toBeNull();
    expect(setup.players[0].active).toBe(false);
    expect(setup.players[1].active).toBe(false);
    const summary = { round: 1, triggerSeat: 0 as const, raw: [5, 9] as [number, number], final: [5, 9] as [number, number], penalizedSeat: null as null, clears: 0, turns: 2, cumulativeAfter: [5, 9] as [number, number] };
    const reveal = projectSkyjo(
      state({ phase: "round_reveal", roundSummary: summary }),
      CONFIG, PARTICIPANTS[0], [PARTICIPANTS[0], PARTICIPANTS[1]], [IDENTITIES[0], IDENTITIES[1]],
    );
    expect(reveal.activePlayerId).toBeNull();
    expect(reveal.players[0].active).toBe(false);
    expect(reveal.players[1].active).toBe(false);
  });
});
