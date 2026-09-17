import { describe, expect, it } from "vitest";
import { buildSkyjoDeck, initializeSkyjo, isSkyjoDeadlineJobStale, onSkyjoAbsence, onSkyjoDeadline, reduceSkyjo, shouldAbandonForSkyjoAbsence, skyjoCardCount, SkyjoRuleError } from "@/games/skyjo/engine";
import type { SkyjoEngineContext } from "@/games/skyjo/engine";
import type { SkyjoAction, SkyjoCard, SkyjoCell, SkyjoState } from "@/games/skyjo/types";

const PARTICIPANTS = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"] as const;
const CONFIG = { format: "short", turnSeconds: 60 } as const;

function entropy(): number[] {
  return Array.from({ length: 600 }, (_, index) => ((index * 37) % 200) / 256 + 0.05);
}

function ctx(overrides: Partial<SkyjoEngineContext> = {}): SkyjoEngineContext {
  return {
    nowMs: Date.parse("2026-09-11T10:00:00.000Z"),
    actorId: PARTICIPANTS[0],
    matchId: "11111111-1111-4111-8111-111111111111",
    participants: [PARTICIPANTS[0], PARTICIPANTS[1]],
    content: null,
    entropy: entropy(),
    phaseId: "p0",
    nextPhaseId: "p1",
    currentDeadlineAt: null,
    currentDeadlineKind: null,
    ...overrides,
  };
}

function cell(id: string, value: number, revealed: boolean): SkyjoCell {
  return { card: { id, value }, revealed };
}

function grid(values: number[], revealed: boolean, prefix: string): SkyjoCell[] {
  return values.map((value, slot) => cell(`${prefix}-${slot}`, value, revealed));
}

function baseState(overrides: Partial<SkyjoState> = {}): SkyjoState {
  return {
    schemaVersion: 1,
    phase: "choose_source",
    round: 1,
    activeSeat: 0,
    firstSeat: 0,
    grids: [grid(Array(12).fill(3), false, "a"), grid(Array(12).fill(4), false, "b")],
    initialReady: [true, true],
    initialSums: [6, 8],
    drawPile: [{ id: "draw-1", value: 5 }],
    discardPile: [{ id: "disc-1", value: 7 }],
    removed: [],
    heldCard: null,
    heldSource: null,
    closingSeat: null,
    finalTurnsRemaining: 0,
    turns: 0,
    cumulative: [0, 0],
    acknowledgedBy: [],
    roundSummary: null,
    counters: { rawPointsSum: [0, 0], penalties: [0, 0], columnClears: [0, 0], automaticTurns: [0, 0] },
    finishedOutcome: null,
    finishedReason: null,
    winnerId: null,
    ...overrides,
  };
}

function reduce(state: SkyjoState, action: SkyjoAction, actor: string, extra: Partial<SkyjoEngineContext> = {}) {
  return reduceSkyjo(state, action, CONFIG, ctx({ actorId: actor, ...extra }));
}

function expectCode(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(SkyjoRuleError);
    expect((error as SkyjoRuleError).code).toBe(code);
    return;
  }
  throw new Error(`Attendu ${code}, aucune erreur levée`);
}

describe("paquet skyjo", () => {
  it("construit 150 cartes uniques avec la distribution exacte", () => {
    const deck = buildSkyjoDeck("m", 1);
    expect(deck).toHaveLength(150);
    expect(new Set(deck.map((card) => card.id)).size).toBe(150);
    const counts = new Map<number, number>();
    for (const card of deck) counts.set(card.value, (counts.get(card.value) ?? 0) + 1);
    expect(counts.get(-2)).toBe(5);
    expect(counts.get(0)).toBe(15);
    expect(counts.get(-1)).toBe(10);
    for (let value = 1; value <= 12; value += 1) expect(counts.get(value)).toBe(10);
  });

  it("conserve les 150 cartes à l'initialisation", () => {
    const transition = initializeSkyjo(CONFIG, ctx());
    expect(transition.state.phase).toBe("setup");
    expect(skyjoCardCount(transition.state)).toBe(150);
    expect(transition.state.grids[0]).toHaveLength(12);
    expect(transition.state.grids[1]).toHaveLength(12);
    expect(transition.state.drawPile).toHaveLength(125);
    expect(transition.state.discardPile).toHaveLength(1);
    expect(transition.jobs).toHaveLength(1);
    expect(transition.jobs[0].kind).toBe("preparation_timeout");
  });

  it("conserve les cartes après la première révélation", () => {
    const started = initializeSkyjo(CONFIG, ctx()).state;
    const transition = reduce(started, { type: "REVEAL_INITIAL", slots: [0, 1] }, PARTICIPANTS[0]);
    expect(skyjoCardCount(transition.state)).toBe(150);
  });
});

describe("mise en place simultanée", () => {
  it("révèle après chaque confirmation et démarre au plus fort", () => {
    const started = initializeSkyjo(CONFIG, ctx()).state;
    const first = reduce(started, { type: "REVEAL_INITIAL", slots: [0, 1] }, PARTICIPANTS[0]);
    expect(first.state.phase).toBe("setup");
    expect(first.state.grids[0][0]?.revealed).toBe(true);
    expect(first.state.grids[1][0]?.revealed ?? false).toBe(false);
    const second = reduceSkyjo(first.state, { type: "REVEAL_INITIAL", slots: [2, 3] }, CONFIG, ctx({ actorId: PARTICIPANTS[1], phaseId: first.phaseId, nextPhaseId: "p9" }));
    expect(second.state.phase).toBe("choose_source");
    const sums = second.state.initialSums;
    const expected = (sums[0] ?? 0) >= (sums[1] ?? 0) ? 0 : 1;
    expect(second.state.activeSeat).toBe(expected);
    expect(second.state.firstSeat).toBe(expected);
  });

  it("refuse deux fois la même case et une double confirmation", () => {
    const started = initializeSkyjo(CONFIG, ctx()).state;
    expectCode(() => reduce(started, { type: "REVEAL_INITIAL", slots: [4, 4] }, PARTICIPANTS[0]), "INVALID_SLOTS");
    const first = reduce(started, { type: "REVEAL_INITIAL", slots: [0, 1] }, PARTICIPANTS[0]);
    expectCode(() => reduceSkyjo(first.state, { type: "REVEAL_INITIAL", slots: [2, 3] }, CONFIG, ctx({ actorId: PARTICIPANTS[0], phaseId: first.phaseId, nextPhaseId: "px" })), "ALREADY_SUBMITTED");
  });

  it("départage une égalité par l'entropie serveur", () => {
    const forced = (value: number): SkyjoState => {
      const state = initializeSkyjo(CONFIG, ctx()).state;
      const grids: [SkyjoCell[], SkyjoCell[]] = [[...state.grids[0]], [...state.grids[1]]];
      for (const seat of [0, 1] as const) {
        for (let slot = 0; slot < 12; slot += 1) grids[seat][slot] = cell(`e${seat}-${slot}`, value, false);
      }
      return { ...state, grids };
    };
    const lowStart = reduce(forced(5), { type: "REVEAL_INITIAL", slots: [0, 1] }, PARTICIPANTS[0]);
    const low = reduceSkyjo(lowStart.state, { type: "REVEAL_INITIAL", slots: [0, 1] }, CONFIG, ctx({ actorId: PARTICIPANTS[1], phaseId: lowStart.phaseId, nextPhaseId: "pb", entropy: [0.1, ...entropy()] }));
    expect(low.state.activeSeat).toBe(0);
    const highStart = reduce(forced(5), { type: "REVEAL_INITIAL", slots: [0, 1] }, PARTICIPANTS[0]);
    const high = reduceSkyjo(highStart.state, { type: "REVEAL_INITIAL", slots: [0, 1] }, CONFIG, ctx({ actorId: PARTICIPANTS[1], phaseId: highStart.phaseId, nextPhaseId: "pb", entropy: [0.9, ...entropy()] }));
    expect(high.state.activeSeat).toBe(1);
  });

  it("le timeout remplit les cases manquantes des deux sièges", () => {
    const started = initializeSkyjo(CONFIG, ctx()).state;
    const transition = onSkyjoDeadline(started, "preparation_timeout", CONFIG, ctx({ actorId: null, phaseId: "p0", nextPhaseId: "ptime" }));
    expect(transition.state.phase).toBe("choose_source");
    expect(transition.state.initialReady).toEqual([true, true]);
    expect(transition.state.counters.automaticTurns).toEqual([1, 1]);
  });
});

describe("sources et remplacements", () => {
  it("TAKE_DISCARD impose un remplacement et recycle l'ancienne carte", () => {
    const state = baseState();
    const withDeadline = ctx({ actorId: PARTICIPANTS[0], phaseId: "p0", nextPhaseId: "p1", currentDeadlineAt: "2026-09-11T10:01:00.000Z", currentDeadlineKind: "turn_timeout" });
    const held = reduceSkyjo(state, { type: "TAKE_DISCARD" }, CONFIG, withDeadline);
    expect(held.state.phase).toBe("replace_discard");
    expect(held.state.heldCard?.value).toBe(7);
    expect(held.state.discardPile).toHaveLength(0);
    // Le budget n'est pas réinitialisé : même échéance conservée.
    expect(held.deadlineAt).toBe("2026-09-11T10:01:00.000Z");
    const replaced = reduceSkyjo(held.state, { type: "REPLACE", slot: 0 }, CONFIG, ctx({ actorId: PARTICIPANTS[0], phaseId: held.phaseId, nextPhaseId: "p2" }));
    expect(replaced.state.grids[0][0]).toEqual({ card: { id: "disc-1", value: 7 }, revealed: true });
    expect(replaced.state.discardPile.at(-1)?.value).toBe(3);
    expect(replaced.state.phase).toBe("choose_source");
    expect(replaced.state.activeSeat).toBe(1);
    expect(replaced.state.turns).toBe(1);
  });

  it("TAKE_DRAW permet REPLACE ou DISCARD_AND_REVEAL sur case cachée", () => {
    const state = baseState();
    const drawn = reduce(state, { type: "TAKE_DRAW" }, PARTICIPANTS[0]);
    expect(drawn.state.phase).toBe("resolve_draw");
    expect(drawn.state.heldCard?.value).toBe(5);
    const revealed = reduceSkyjo(drawn.state, { type: "DISCARD_AND_REVEAL", slot: 3 }, CONFIG, ctx({ actorId: PARTICIPANTS[0], phaseId: drawn.phaseId, nextPhaseId: "p3" }));
    expect(revealed.state.grids[0][3]?.revealed).toBe(true);
    expect(revealed.state.discardPile.at(-1)?.value).toBe(5);
  });

  it("refuse DISCARD_AND_REVEAL sur une case déjà visible ou en replace_discard", () => {
    const state = baseState({ grids: [grid(Array(12).fill(3), true, "a"), grid(Array(12).fill(4), false, "b")] });
    const drawn = reduce(state, { type: "TAKE_DRAW" }, PARTICIPANTS[0]);
    expectCode(() => reduceSkyjo(drawn.state, { type: "DISCARD_AND_REVEAL", slot: 0 }, CONFIG, ctx({ actorId: PARTICIPANTS[0], phaseId: drawn.phaseId, nextPhaseId: "pz" })), "SLOT_NOT_HIDDEN");
    const fromDiscard = reduce(state, { type: "TAKE_DISCARD" }, PARTICIPANTS[0]);
    expectCode(() => reduceSkyjo(fromDiscard.state, { type: "DISCARD_AND_REVEAL", slot: 5 }, CONFIG, ctx({ actorId: PARTICIPANTS[0], phaseId: fromDiscard.phaseId, nextPhaseId: "pz" })), "REPLACE_NOT_ALLOWED");
  });

  it("refuse les actions hors tour et hors phase", () => {
    const state = baseState();
    expectCode(() => reduce(state, { type: "TAKE_DRAW" }, PARTICIPANTS[1]), "NOT_YOUR_TURN");
    expectCode(() => reduce(state, { type: "REPLACE", slot: 0 }, PARTICIPANTS[0]), "WRONG_PHASE");
  });

  it("refuse REPLACE sur un trou", () => {
    const grids: [SkyjoCell[], SkyjoCell[]] = [grid(Array(12).fill(3), false, "a"), grid(Array(12).fill(4), false, "b")];
    grids[0][2] = null;
    const state = baseState({ grids });
    const drawn = reduce(state, { type: "TAKE_DRAW" }, PARTICIPANTS[0]);
    expectCode(() => reduceSkyjo(drawn.state, { type: "REPLACE", slot: 2 }, CONFIG, ctx({ actorId: PARTICIPANTS[0], phaseId: drawn.phaseId, nextPhaseId: "pz" })), "SLOT_EMPTY");
  });
});

describe("colonnes", () => {
  it("retire une colonne complète visible de même valeur vers removed", () => {
    const mine = grid([9, 7, 4, 8, 9, 2, 5, 1, 9, 3, 6, 0], true, "a");
    const state = baseState({ grids: [mine, grid(Array(12).fill(4), false, "b")], drawPile: [{ id: "d", value: 1 }] });
    const drawn = reduce(state, { type: "TAKE_DRAW" }, PARTICIPANTS[0]);
    const done = reduceSkyjo(drawn.state, { type: "REPLACE", slot: 11 }, CONFIG, ctx({ actorId: PARTICIPANTS[0], phaseId: drawn.phaseId, nextPhaseId: "pc" }));
    expect(done.state.grids[0][0]).toBeNull();
    expect(done.state.grids[0][4]).toBeNull();
    expect(done.state.grids[0][8]).toBeNull();
    expect(done.state.removed.map((card: SkyjoCard) => card.value)).toEqual([9, 9, 9]);
    expect(done.state.counters.columnClears[0]).toBe(1);
    // Les cartes retirées ne vont pas en défausse.
    expect(done.state.discardPile.some((card: SkyjoCard) => card.value === 9)).toBe(false);
  });

  it("retire plusieurs colonnes d'un coup", () => {
    const mine = grid([9, 6, 4, 8, 9, 6, 5, 1, 9, 6, 6, 0], true, "a");
    const state = baseState({ grids: [mine, grid(Array(12).fill(4), false, "b")], drawPile: [{ id: "d", value: 1 }] });
    const drawn = reduce(state, { type: "TAKE_DRAW" }, PARTICIPANTS[0]);
    const done = reduceSkyjo(drawn.state, { type: "REPLACE", slot: 11 }, CONFIG, ctx({ actorId: PARTICIPANTS[0], phaseId: drawn.phaseId, nextPhaseId: "pc" }));
    expect(done.state.counters.columnClears[0]).toBe(2);
    expect(done.state.removed).toHaveLength(6);
  });
});

describe("fin de manche et pénalité", () => {
  // Grilles sans colonne uniforme : aucune suppression surprise pendant le jeu.
  const raw15 = [2, 2, 2, 2, 2, 2, 1, 1, 1, 0, 0, 0];
  const raw12 = [2, 1, 1, 0, 0, 0, 2, 2, 1, 1, 1, 1];
  const raw10 = [2, 2, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0];
  const raw5 = [2, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0];
  const raw24 = [5, 5, 5, 5, 1, 1, 1, 1, 0, 0, 0, 0];

  function closingSetup(triggerValues: number[], otherValues: number[]): SkyjoState {
    const mine = triggerValues.map((value, slot) => cell(`t-${slot}`, value, slot < 11));
    const other = otherValues.map((value, slot) => cell(`o-${slot}`, value, slot < 11));
    return baseState({
      grids: [mine, other],
      drawPile: [{ id: "d1", value: 0 }, { id: "d2", value: 0 }],
      discardPile: [{ id: "disc", value: 1 }],
    });
  }

  function playLastTwo(state: SkyjoState): SkyjoState {
    const drawn = reduce(state, { type: "TAKE_DRAW" }, PARTICIPANTS[0]);
    const closed = reduceSkyjo(drawn.state, { type: "DISCARD_AND_REVEAL", slot: 11 }, CONFIG, ctx({ actorId: PARTICIPANTS[0], phaseId: drawn.phaseId, nextPhaseId: "pclose" }));
    expect(closed.state.closingSeat).toBe(0);
    expect(closed.state.activeSeat).toBe(1);
    const oppDrawn = reduceSkyjo(closed.state, { type: "TAKE_DRAW" }, CONFIG, ctx({ actorId: PARTICIPANTS[1], phaseId: closed.phaseId, nextPhaseId: "popp" }));
    return reduceSkyjo(oppDrawn.state, { type: "DISCARD_AND_REVEAL", slot: 11 }, CONFIG, ctx({ actorId: PARTICIPANTS[1], phaseId: oppDrawn.phaseId, nextPhaseId: "pend" })).state;
  }

  it("15 contre 12 donne 30 contre 12", () => {
    const end = playLastTwo(closingSetup(raw15, raw12));
    expect(end.roundSummary?.raw).toEqual([15, 12]);
    expect(end.roundSummary?.final).toEqual([30, 12]);
    expect(end.roundSummary?.penalizedSeat).toBe(0);
    expect(end.cumulative).toEqual([30, 12]);
  });

  it("10 contre 10 donne 20 contre 10", () => {
    const end = playLastTwo(closingSetup(raw10, raw10));
    expect(end.roundSummary?.final).toEqual([20, 10]);
    expect(end.roundSummary?.penalizedSeat).toBe(0);
  });

  it("-2 contre -3 n'est jamais doublé", () => {
    const trigger = [0, 0, 0, 0, 0, 0, 0, 0, 0, -1, -1, 0];
    const other = [0, 0, 0, 0, 0, 0, 0, 0, 0, -1, -2, 0];
    const end = playLastTwo(closingSetup(trigger, other));
    expect(end.roundSummary?.raw).toEqual([-2, -3]);
    expect(end.roundSummary?.final).toEqual([-2, -3]);
    expect(end.roundSummary?.penalizedSeat).toBeNull();
  });

  it("un déclencheur strictement plus petit n'est pas pénalisé", () => {
    const end = playLastTwo(closingSetup(raw5, raw24));
    expect(end.roundSummary?.penalizedSeat).toBeNull();
    expect(end.roundSummary?.final).toEqual(end.roundSummary?.raw);
  });

  it("l'adversaire obtient exactement un dernier tour, sans tour de plus", () => {
    const state = closingSetup(Array(12).fill(1), Array(12).fill(2));
    const drawn = reduce(state, { type: "TAKE_DRAW" }, PARTICIPANTS[0]);
    const closed = reduceSkyjo(drawn.state, { type: "DISCARD_AND_REVEAL", slot: 11 }, CONFIG, ctx({ actorId: PARTICIPANTS[0], phaseId: drawn.phaseId, nextPhaseId: "pclose" }));
    expect(closed.state.phase).toBe("choose_source");
    expect(closed.state.finalTurnsRemaining).toBe(1);
    const oppDrawn = reduceSkyjo(closed.state, { type: "TAKE_DRAW" }, CONFIG, ctx({ actorId: PARTICIPANTS[1], phaseId: closed.phaseId, nextPhaseId: "popp" }));
    const end = reduceSkyjo(oppDrawn.state, { type: "DISCARD_AND_REVEAL", slot: 11 }, CONFIG, ctx({ actorId: PARTICIPANTS[1], phaseId: oppDrawn.phaseId, nextPhaseId: "pend" }));
    expect(end.state.phase).toBe("round_reveal");
    expect(end.roundRecords).toHaveLength(1);
    expect(end.roundRecords[0].roundNo).toBe(1);
  });

  it("une fin déjà déclenchée ne donne pas un second tour", () => {
    const mine = Array(12).fill(1).map((value, slot) => cell(`t-${slot}`, value, true));
    const other = Array(12).fill(2).map((value, slot) => cell(`o-${slot}`, value, slot < 11));
    const state = baseState({ grids: [mine, other], closingSeat: 0, finalTurnsRemaining: 1, activeSeat: 1, drawPile: [{ id: "d", value: 0 }] });
    const drawn = reduceSkyjo(state, { type: "TAKE_DRAW" }, CONFIG, ctx({ actorId: PARTICIPANTS[1], phaseId: "p0", nextPhaseId: "p1" }));
    const end = reduceSkyjo(drawn.state, { type: "DISCARD_AND_REVEAL", slot: 11 }, CONFIG, ctx({ actorId: PARTICIPANTS[1], phaseId: drawn.phaseId, nextPhaseId: "p2" }));
    expect(end.state.phase).toBe("round_reveal");
    expect(end.state.roundSummary?.triggerSeat).toBe(0);
  });

  it("le dernier tour se termine même si l'adversaire garde des cartes cachées", () => {
    const mine = Array(12).fill(1).map((value, slot) => cell(`t-${slot}`, value, true));
    // L'adversaire a encore 11 cartes cachées : son unique dernier tour
    // (remplacement) ne doit pas prolonger la manche.
    const other = Array(12).fill(2).map((value, slot) => cell(`o-${slot}`, value, false));
    const state = baseState({ grids: [mine, other], closingSeat: 0, finalTurnsRemaining: 1, activeSeat: 1, drawPile: [{ id: "d", value: 0 }], discardPile: [{ id: "disc", value: 9 }] });
    const drawn = reduceSkyjo(state, { type: "TAKE_DRAW" }, CONFIG, ctx({ actorId: PARTICIPANTS[1], phaseId: "p0", nextPhaseId: "p1" }));
    const end = reduceSkyjo(drawn.state, { type: "REPLACE", slot: 5 }, CONFIG, ctx({ actorId: PARTICIPANTS[1], phaseId: drawn.phaseId, nextPhaseId: "p2" }));
    expect(end.state.phase).toBe("round_reveal");
    expect(end.state.roundSummary?.triggerSeat).toBe(0);
    expect(end.state.finalTurnsRemaining).toBe(0);
  });

  it("TAKE_DRAW conserve aussi le budget du tour", () => {
    const state = baseState();
    const withDeadline = ctx({ actorId: PARTICIPANTS[0], phaseId: "p0", nextPhaseId: "p1", currentDeadlineAt: "2026-09-11T10:01:00.000Z", currentDeadlineKind: "turn_timeout" });
    const held = reduceSkyjo(state, { type: "TAKE_DRAW" }, CONFIG, withDeadline);
    expect(held.state.phase).toBe("resolve_draw");
    expect(held.deadlineAt).toBe("2026-09-11T10:01:00.000Z");
  });

  it("les colonnes révélées en fin de manche alimentent les compteurs", () => {
    // B garde une colonne 0 uniforme (5,5,5) dont le slot 8 reste caché
    // jusqu'à la révélation finale : seul finishRound peut la retirer.
    // (Grille A volontairement non uniforme : aucune suppression parasite.)
    const mine: SkyjoCell[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2].map((value, slot) => cell(`t-${slot}`, value as number, true));
    const otherValues = [5, 6, 4, 8, 5, 6, 5, 1, 5, 6, 6, 0];
    const other: SkyjoCell[] = otherValues.map((value, slot) => cell(`o-${slot}`, value, slot === 8 ? false : slot < 9 ? true : slot === 9));
    const state = baseState({
      grids: [mine, other],
      closingSeat: 0,
      finalTurnsRemaining: 1,
      activeSeat: 1,
      drawPile: [{ id: "d", value: 2 }],
      discardPile: [{ id: "disc", value: 9 }],
    });
    const before = skyjoCardCount(state);
    const drawn = reduceSkyjo(state, { type: "TAKE_DRAW" }, CONFIG, ctx({ actorId: PARTICIPANTS[1], phaseId: "p0", nextPhaseId: "p1" }));
    // Remplacement hors colonne 0 : le slot 8 reste caché jusqu'à la fin.
    const end = reduceSkyjo(drawn.state, { type: "REPLACE", slot: 1 }, CONFIG, ctx({ actorId: PARTICIPANTS[1], phaseId: drawn.phaseId, nextPhaseId: "p2" }));
    expect(end.state.phase).toBe("round_reveal");
    expect(end.state.roundSummary?.clears).toBe(1);
    expect(end.state.counters.columnClears).toEqual([0, 1]);
    expect(end.state.removed.map((card: SkyjoCard) => card.value)).toEqual([5, 5, 5]);
    expect(skyjoCardCount(end.state)).toBe(before);
  });

  it("le recyclage ne touche jamais aux cartes removed", () => {
    const state = baseState({
      drawPile: [],
      discardPile: [{ id: "r1", value: 1 }, { id: "top", value: 9 }],
      removed: [{ id: "out-1", value: 3 }, { id: "out-2", value: 3 }, { id: "out-3", value: 3 }],
    });
    const before = skyjoCardCount(state);
    const drawn = reduce(state, { type: "TAKE_DRAW" }, PARTICIPANTS[0]);
    expect(drawn.state.removed.map((card: SkyjoCard) => card.id)).toEqual(["out-1", "out-2", "out-3"]);
    expect(drawn.state.discardPile).toEqual([{ id: "top", value: 9 }]);
    expect(skyjoCardCount(drawn.state)).toBe(before);
  });
});

describe("timeouts", () => {
  it("choose_source pioche puis révèle la cachée la plus basse", () => {
    const state = baseState({ drawPile: [{ id: "d", value: 8 }] });
    const transition = onSkyjoDeadline(state, "turn_timeout", CONFIG, ctx({ actorId: null, phaseId: "p0", nextPhaseId: "pto" }));
    expect(transition.state.grids[0][0]?.revealed).toBe(true);
    expect(transition.state.discardPile.at(-1)?.value).toBe(8);
    expect(transition.state.activeSeat).toBe(1);
    expect(transition.state.counters.automaticTurns[0]).toBe(1);
  });

  it("choose_source remplace la plus basse sans case cachée", () => {
    const state = baseState({ grids: [grid(Array(12).fill(3), true, "a"), grid(Array(12).fill(4), false, "b")], drawPile: [{ id: "d", value: 8 }] });
    const transition = onSkyjoDeadline(state, "turn_timeout", CONFIG, ctx({ actorId: null, phaseId: "p0", nextPhaseId: "pto" }));
    expect(transition.state.grids[0][0]).toEqual({ card: { id: "d", value: 8 }, revealed: true });
  });

  it("choose_source sans pioche recyclable prend la défausse", () => {
    const state = baseState({ drawPile: [], discardPile: [{ id: "only", value: 6 }] });
    expectCode(() => reduce(state, { type: "TAKE_DRAW" }, PARTICIPANTS[0]), "DRAW_UNAVAILABLE");
    const transition = onSkyjoDeadline(state, "turn_timeout", CONFIG, ctx({ actorId: null, phaseId: "p0", nextPhaseId: "pto" }));
    expect(transition.state.grids[0][0]).toEqual({ card: { id: "only", value: 6 }, revealed: true });
  });

  it("replace_discard remplace la case présente la plus basse", () => {
    const state = baseState({ phase: "replace_discard", heldCard: { id: "h", value: 11 }, heldSource: "discard" });
    const transition = onSkyjoDeadline(state, "turn_timeout", CONFIG, ctx({ actorId: null, phaseId: "p0", nextPhaseId: "pto" }));
    expect(transition.state.grids[0][0]).toEqual({ card: { id: "h", value: 11 }, revealed: true });
    expect(transition.state.heldCard).toBeNull();
  });

  it("resolve_draw jette et révèle, ou remplace sans cachée", () => {
    const held: SkyjoState = baseState({ phase: "resolve_draw", heldCard: { id: "h", value: 11 }, heldSource: "draw" });
    const revealed = onSkyjoDeadline(held, "turn_timeout", CONFIG, ctx({ actorId: null, phaseId: "p0", nextPhaseId: "pto" }));
    expect(revealed.state.grids[0][0]?.revealed).toBe(true);
    expect(revealed.state.discardPile.at(-1)).toEqual({ id: "h", value: 11 });
    const open: SkyjoState = baseState({ phase: "resolve_draw", heldCard: { id: "h", value: 11 }, heldSource: "draw", grids: [grid(Array(12).fill(3), true, "a"), grid(Array(12).fill(4), false, "b")] });
    const replaced = onSkyjoDeadline(open, "turn_timeout", CONFIG, ctx({ actorId: null, phaseId: "p0", nextPhaseId: "pto" }));
    expect(replaced.state.grids[0][0]).toEqual({ card: { id: "h", value: 11 }, revealed: true });
  });

  it("round_reveal avance automatiquement à la manche suivante", () => {
    const state = baseState({ phase: "round_reveal", round: 1, firstSeat: 0, acknowledgedBy: [PARTICIPANTS[0]], roundSummary: { round: 1, triggerSeat: 0, raw: [5, 9], final: [5, 9], penalizedSeat: null, clears: 0, turns: 10, cumulativeAfter: [5, 9] } });
    const transition = onSkyjoDeadline(state, "advance_reveal", CONFIG, ctx({ actorId: null, phaseId: "p0", nextPhaseId: "pto" }));
    expect(transition.state.phase).toBe("setup");
    expect(transition.state.round).toBe(2);
    expect(transition.state.firstSeat).toBe(1);
    expect(transition.state.cumulative).toEqual([0, 0]);
  });
});

describe("recyclage et limites", () => {
  it("recycle la défausse en conservant son sommet", () => {
    const state = baseState({ drawPile: [], discardPile: [{ id: "r1", value: 1 }, { id: "r2", value: 2 }, { id: "top", value: 9 }] });
    const drawn = reduce(state, { type: "TAKE_DRAW" }, PARTICIPANTS[0]);
    expect(drawn.state.discardPile).toEqual([{ id: "top", value: 9 }]);
    expect(drawn.state.drawPile).toHaveLength(1);
    expect(drawn.state.phase).toBe("resolve_draw");
  });

  it("plafonne à 200 tours sans pénalité", () => {
    const state = baseState({ turns: 199, drawPile: [{ id: "d", value: 1 }] });
    const drawn = reduce(state, { type: "TAKE_DRAW" }, PARTICIPANTS[0]);
    const end = reduceSkyjo(drawn.state, { type: "DISCARD_AND_REVEAL", slot: 0 }, CONFIG, ctx({ actorId: PARTICIPANTS[0], phaseId: drawn.phaseId, nextPhaseId: "p200" }));
    expect(end.state.phase).toBe("round_reveal");
    expect(end.state.roundSummary?.penalizedSeat).toBeNull();
    expect(end.state.roundSummary?.triggerSeat).toBeNull();
    expect(end.state.turns).toBe(200);
    expect(end.state.roundSummary?.turns).toBe(200);
    expect(end.roundRecords[0].summary.turns).toBe(200);
  });

  it("signale des piles impossibles", () => {
    const state = baseState({ drawPile: [], discardPile: [] });
    expectCode(() => reduce(state, { type: "TAKE_DISCARD" }, PARTICIPANTS[0]), "MATCH_BLOCKED");
  });
});

describe("scores, victoire et abandons", () => {
  function lastRoundState(triggerValues: number[], otherValues: number[], cumulative: [number, number], round: number): SkyjoState {
    return baseState({
      round,
      cumulative,
      grids: [
        triggerValues.map((value, slot) => cell(`t-${slot}`, value, slot < 11)),
        otherValues.map((value, slot) => cell(`o-${slot}`, value, slot < 11)),
      ],
      drawPile: [{ id: "d1", value: 0 }, { id: "d2", value: 0 }],
    });
  }

  function finishLast(state: SkyjoState, config: { format: "short" | "full"; turnSeconds: 60 } = { format: "short", turnSeconds: 60 }): SkyjoState {
    const drawn = reduceSkyjo(state, { type: "TAKE_DRAW" }, config, ctx({ actorId: PARTICIPANTS[0], phaseId: "p0", nextPhaseId: "pa" }));
    const closed = reduceSkyjo(drawn.state, { type: "DISCARD_AND_REVEAL", slot: 11 }, config, ctx({ actorId: PARTICIPANTS[0], phaseId: drawn.phaseId, nextPhaseId: "pb" }));
    const opp = reduceSkyjo(closed.state, { type: "TAKE_DRAW" }, config, ctx({ actorId: PARTICIPANTS[1], phaseId: closed.phaseId, nextPhaseId: "pc" }));
    return reduceSkyjo(opp.state, { type: "DISCARD_AND_REVEAL", slot: 11 }, config, ctx({ actorId: PARTICIPANTS[1], phaseId: opp.phaseId, nextPhaseId: "pd" })).state;
  }

  it("short finit après 3 manches, plus petit cumul gagne", () => {
    const trigger = [2, 1, 1, 0, 0, 0, 2, 2, 1, 1, 1, 1];
    const other = [5, 5, 5, 5, 1, 1, 1, 1, 0, 0, 0, 0];
    const end = finishLast(lastRoundState(trigger, other, [20, 30], 3));
    expect(end.phase).toBe("finished");
    expect(end.cumulative).toEqual([32, 54]);
    expect(end.winnerId).toBe(PARTICIPANTS[0]);
  });

  it("short déclare une égalité possible", () => {
    const trigger = [1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0];
    const other = [2, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0];
    const end = finishLast(lastRoundState(trigger, other, [12, 10], 3));
    expect(end.phase).toBe("finished");
    expect(end.cumulative).toEqual([16, 16]);
    expect(end.finishedOutcome).toBe("draw");
    expect(end.winnerId).toBeNull();
  });

  it("full finit quand un cumul atteint 100", () => {
    const trigger = [2, 1, 1, 0, 0, 0, 2, 2, 1, 1, 1, 1];
    const other = Array(12).fill(0);
    const end = finishLast(lastRoundState(trigger, other, [95, 90], 5), { format: "full", turnSeconds: 60 });
    expect(end.phase).toBe("finished");
    expect(end.cumulative).toEqual([119, 90]);
    expect(end.winnerId).toBe(PARTICIPANTS[1]);
  });

  it("NEXT double avance vers la manche suivante", () => {
    const summary = { round: 1, triggerSeat: 0 as const, raw: [5, 9] as [number, number], final: [5, 9] as [number, number], penalizedSeat: null as null, clears: 0, turns: 10, cumulativeAfter: [5, 9] as [number, number] };
    const state = baseState({ phase: "round_reveal", firstSeat: 0, cumulative: [5, 9], acknowledgedBy: [], roundSummary: summary });
    const first = reduceSkyjo(state, { type: "NEXT" }, CONFIG, ctx({ actorId: PARTICIPANTS[0], phaseId: "p0", nextPhaseId: "pn" }));
    expect(first.state.phase).toBe("round_reveal");
    const second = reduceSkyjo(first.state, { type: "NEXT" }, CONFIG, ctx({ actorId: PARTICIPANTS[1], phaseId: "p0", nextPhaseId: "pn2" }));
    expect(second.state.phase).toBe("setup");
    expect(second.state.round).toBe(2);
    // Alternance : le premier siège de la manche 2 est l'inverse de la manche 1.
    expect(second.state.firstSeat).toBe(1);
    expect(second.state.cumulative).toEqual([5, 9]);
    expect(skyjoCardCount(second.state)).toBe(150);
    expectCode(() => reduceSkyjo(first.state, { type: "NEXT" }, CONFIG, ctx({ actorId: PARTICIPANTS[0], phaseId: "p0", nextPhaseId: "pn3" })), "ALREADY_ACKNOWLEDGED");
  });

  it("RESIGN abandonne avant le premier tour, sinon défaite", () => {
    const fresh = initializeSkyjo(CONFIG, ctx()).state;
    const abandoned = reduce(fresh, { type: "RESIGN" }, PARTICIPANTS[0]);
    expect(abandoned.state.phase).toBe("finished");
    expect(abandoned.result?.outcome).toBe("abandoned");
    expect(abandoned.result?.winnerId).toBeNull();
    const mid = baseState({ turns: 3 });
    const resigned = reduce(mid, { type: "RESIGN" }, PARTICIPANTS[0]);
    expect(resigned.result?.outcome).toBe("win");
    expect(resigned.result?.winnerId).toBe(PARTICIPANTS[1]);
  });

  it("MATCH_FINISHED après la fin et STALE_DEADLINE hors sujet", () => {
    const trigger = [2, 1, 1, 0, 0, 0, 2, 2, 1, 1, 1, 1];
    const other = [5, 5, 5, 5, 1, 1, 1, 1, 0, 0, 0, 0];
    const end = finishLast(lastRoundState(trigger, other, [20, 30], 3));
    expectCode(() => reduce(end, { type: "TAKE_DRAW" }, PARTICIPANTS[0]), "MATCH_FINISHED");
    expectCode(() => onSkyjoDeadline(baseState(), "advance_reveal", CONFIG, ctx({ actorId: null })), "STALE_DEADLINE");
  });
});

describe("absence et garde phaseId", () => {
  it("détecte l'absence des deux ou d'un joueur", () => {
    const now = Date.parse("2026-09-11T10:05:00.000Z");
    expect(shouldAbandonForSkyjoAbsence(["2026-09-11T10:00:00.000Z", "2026-09-11T10:01:00.000Z"], now)).toBe(true);
    expect(shouldAbandonForSkyjoAbsence(["2026-09-11T10:04:50.000Z", "2026-09-11T10:04:55.000Z"], now)).toBe(false);
    expect(isSkyjoDeadlineJobStale("p-old", "p-new")).toBe(true);
    expect(isSkyjoDeadlineJobStale("p-same", "p-same")).toBe(false);
    expect(isSkyjoDeadlineJobStale(null, "p-new")).toBe(false);
  });

  it("abandonne proprement sur absence", () => {
    const transition = onSkyjoAbsence(baseState(), CONFIG, ctx({ actorId: null, phaseId: "p0", nextPhaseId: "pabs" }));
    expect(transition.state.phase).toBe("finished");
    expect(transition.result?.outcome).toBe("abandoned");
    expect(transition.result?.reason).toBe("absence");
  });
});

describe("régressions du cycle 2", () => {
  it("initialise le siège actif sur le premier siège configuré", () => {
    const first = initializeSkyjo({ format: "short", turnSeconds: 60, firstSeat: 1 }, ctx()).state;
    expect(first.firstSeat).toBe(1);
    expect(first.activeSeat).toBe(1);
    const zero = initializeSkyjo(CONFIG, ctx()).state;
    expect(zero.firstSeat).toBe(0);
    expect(zero.activeSeat).toBe(0);
  });

  it("compte exactement les tours terminés dans le résumé", () => {
    const trigger = [2, 1, 1, 0, 0, 0, 2, 2, 1, 1, 1, 1];
    const other = [2, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0];
    const initial = baseState({
      round: 1,
      cumulative: [0, 0],
      grids: [
        trigger.map((value, slot) => cell(`t-${slot}`, value, slot < 11)),
        other.map((value, slot) => cell(`o-${slot}`, value, slot < 11)),
      ],
      drawPile: [{ id: "d1", value: 0 }, { id: "d2", value: 0 }],
    });
    const drawn = reduceSkyjo(initial, { type: "TAKE_DRAW" }, CONFIG, ctx({ actorId: PARTICIPANTS[0], phaseId: "p0", nextPhaseId: "pa" }));
    const closed = reduceSkyjo(drawn.state, { type: "DISCARD_AND_REVEAL", slot: 11 }, CONFIG, ctx({ actorId: PARTICIPANTS[0], phaseId: drawn.phaseId, nextPhaseId: "pb" }));
    const opp = reduceSkyjo(closed.state, { type: "TAKE_DRAW" }, CONFIG, ctx({ actorId: PARTICIPANTS[1], phaseId: closed.phaseId, nextPhaseId: "pc" }));
    const end = reduceSkyjo(opp.state, { type: "DISCARD_AND_REVEAL", slot: 11 }, CONFIG, ctx({ actorId: PARTICIPANTS[1], phaseId: opp.phaseId, nextPhaseId: "pd" })).state;
    expect(end.turns).toBe(2);
    expect(end.roundSummary?.turns).toBe(2);
  });
});
