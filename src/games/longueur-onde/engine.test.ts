import { describe, expect, it } from "vitest";
import { DEFAULT_LONGUEUR_ONDE_CONFIG, type LongueurOndeConfig } from "@/games/longueur-onde/config";
import {
  initializeLongueurOnde,
  isLongueurOndeDeadlineJobStale,
  onLongueurOndeAbsence,
  onLongueurOndeDeadline,
  pointsForError,
  reduceLongueurOnde,
  shouldAbandonForLongueurOndeAbsence,
  type LongueurOndeEngineContext,
} from "@/games/longueur-onde/engine";
import type { LongueurOndeContent, LongueurOndeState } from "@/games/longueur-onde/types";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const config: LongueurOndeConfig = DEFAULT_LONGUEUR_ONDE_CONFIG;
const content: LongueurOndeContent = {
  packId: "8c7f4d21-3a6e-4b92-9f15-0d28e6a4c753",
  packVersion: 1,
  axes: Array.from({ length: 10 }, (_, index) => ({
    itemId: `axis-${index + 1}`,
    packId: "8c7f4d21-3a6e-4b92-9f15-0d28e6a4c753",
    logicalKey: `axis-${index + 1}`,
    leftLabel: "Très calme",
    rightLabel: "Très vif",
    category: "quotidien" as const,
  })),
};

function ctx(actorId: string | null, phaseId = "phase-1", nextPhaseId = "phase-2", nowMs = Date.parse("2026-09-11T20:00:00.000Z")): LongueurOndeEngineContext {
  return {
    nowMs,
    actorId,
    matchId: "match-1",
    participants: [A, B],
    content,
    entropy: Array.from({ length: 200 }, (_, index) => ((index * 37 + 11) % 97) / 100),
    phaseId,
    nextPhaseId,
  };
}

function started(): LongueurOndeState {
  return initializeLongueurOnde(config, ctx(A)).state;
}

function finishReveal(state: LongueurOndeState, revealPhaseId: string): LongueurOndeState {
  const first = reduceLongueurOnde(state, { type: "NEXT" }, config, ctx(A, revealPhaseId, `${revealPhaseId}-a`));
  return reduceLongueurOnde(first.state, { type: "NEXT" }, config, ctx(B, first.phaseId, `${revealPhaseId}-b`)).state;
}

function compareRound(state: LongueurOndeState, position: number): { state: LongueurOndeState; phaseId: string } {
  const giver = state.clueSeat === 0 ? A : B;
  const guesser = state.clueSeat === 0 ? B : A;
  const withClue = reduceLongueurOnde(state, { type: "SUBMIT_CLUE", clue: "Un café tout juste servi" }, config, ctx(giver, "phase-1", "phase-2"));
  const reveal = reduceLongueurOnde(withClue.state, { type: "SUBMIT_GUESS", position }, config, ctx(guesser, withClue.phaseId, "phase-3"));
  return { state: finishReveal(reveal.state, reveal.phaseId), phaseId: reveal.phaseId };
}

describe("moteur À l'unisson", () => {
  it("tire les axes sans remise, la cible entre 0 et 100 et démarre avec un timeout indice", () => {
    const transition = initializeLongueurOnde(config, ctx(A));
    expect(transition.state.axisIds).toHaveLength(config.rounds + 2);
    expect(new Set(transition.state.axisIds).size).toBe(config.rounds + 2);
    expect(transition.state.target).toBeGreaterThanOrEqual(0);
    expect(transition.state.target).toBeLessThanOrEqual(100);
    expect(transition.deadlineKind).toBe("clue_timeout");
    expect(transition.jobs).toHaveLength(1);
    expect(transition.jobs[0]?.runAt).toBe(transition.deadlineAt);
  });

  it("applique exactement les paliers de score, y compris les bords", () => {
    expect(pointsForError(0)).toBe(4);
    expect(pointsForError(4)).toBe(4);
    expect(pointsForError(5)).toBe(3);
    expect(pointsForError(9)).toBe(3);
    expect(pointsForError(10)).toBe(2);
    expect(pointsForError(14)).toBe(2);
    expect(pointsForError(15)).toBe(0);
    expect(pointsForError(100)).toBe(0);
    expect(pointsForError(null)).toBe(0);
  });

  it("valide l'indice, le fige et protège les rôles", () => {
    const state = started();
    const giver = state.clueSeat === 0 ? A : B;
    const guesser = state.clueSeat === 0 ? B : A;
    expect(() => reduceLongueurOnde(state, { type: "SUBMIT_CLUE", clue: "73" }, config, ctx(giver))).toThrow("INVALID_CLUE");
    expect(() => reduceLongueurOnde(state, { type: "SUBMIT_CLUE", clue: "https://example.com" }, config, ctx(giver))).toThrow("INVALID_CLUE");
    expect(() => reduceLongueurOnde(state, { type: "SUBMIT_CLUE", clue: "indice\ninterdit" }, config, ctx(giver))).toThrow("INVALID_CLUE");
    expect(() => reduceLongueurOnde(state, { type: "SUBMIT_CLUE", clue: "Un indice" }, config, ctx(guesser))).toThrow("NOT_YOUR_TURN");
    const withClue = reduceLongueurOnde(state, { type: "SUBMIT_CLUE", clue: "  Un   indice  " }, config, ctx(giver));
    expect(withClue.state.clue).toBe("Un indice");
    expect(withClue.state.phase).toBe("guessing");
    expect(withClue.deadlineKind).toBe("guess_timeout");
    expect(() => reduceLongueurOnde(withClue.state, { type: "SUBMIT_CLUE", clue: "Autre" }, config, ctx(giver, withClue.phaseId, "phase-3"))).toThrow("WRONG_PHASE");
  });

  it("enregistre un guess une seule fois, sans révéler avant la soumission", () => {
    const state = started();
    const giver = state.clueSeat === 0 ? A : B;
    const guesser = state.clueSeat === 0 ? B : A;
    const withClue = reduceLongueurOnde(state, { type: "SUBMIT_CLUE", clue: "Un café" }, config, ctx(giver));
    expect(() => reduceLongueurOnde(withClue.state, { type: "SUBMIT_GUESS", position: 101 }, config, ctx(guesser, withClue.phaseId, "phase-3"))).toThrow();
    const reveal = reduceLongueurOnde(withClue.state, { type: "SUBMIT_GUESS", position: 42 }, config, ctx(guesser, withClue.phaseId, "phase-3"));
    expect(reveal.state.phase).toBe("reveal");
    expect(reveal.state.guess).toBe(42);
    expect(reveal.deadlineKind).toBe("advance_reveal");
    expect(() => reduceLongueurOnde(reveal.state, { type: "SUBMIT_GUESS", position: 43 }, config, ctx(guesser, reveal.phaseId, "phase-4"))).toThrow("WRONG_PHASE");
  });

  it("crédite chaque révélation une seule fois et inverse le donneur", () => {
    let state = started();
    const initialGiver = state.clueSeat;
    const first = compareRound(state, 50);
    state = first.state;
    expect(state.round).toBe(2);
    expect(state.rounds).toHaveLength(1);
    expect(state.clueSeat).toBe((1 - initialGiver) as 0 | 1);
    expect(state.total).toBeGreaterThanOrEqual(0);
    expect(() => reduceLongueurOnde(state, { type: "NEXT" }, config, ctx(A, first.phaseId, "phase-retry"))).toThrow("WRONG_PHASE");
  });

  it("termine après le nombre configuré de manches et produit uniquement un résultat coopératif", () => {
    let state = started();
    let final: ReturnType<typeof reduceLongueurOnde> | null = null;
    for (let round = 0; round < config.rounds; round += 1) {
      const giver = state.clueSeat === 0 ? A : B;
      const guesser = state.clueSeat === 0 ? B : A;
      const withClue = reduceLongueurOnde(state, { type: "SUBMIT_CLUE", clue: "Un café" }, config, ctx(giver));
      const reveal = reduceLongueurOnde(withClue.state, { type: "SUBMIT_GUESS", position: 0 }, config, ctx(guesser, withClue.phaseId, `round-${round}-reveal`));
      const first = reduceLongueurOnde(reveal.state, { type: "NEXT" }, config, ctx(A, reveal.phaseId, `round-${round}-a`));
      final = reduceLongueurOnde(first.state, { type: "NEXT" }, config, ctx(B, first.phaseId, `round-${round}-b`));
      state = final.state;
    }
    expect(state.phase).toBe("finished");
    expect(state.rounds).toHaveLength(config.rounds);
    expect(final?.result?.kind).toBe("cooperative");
    expect(final?.result?.outcome).toBe("cooperative");
    expect(final?.result?.winnerId).toBeNull();
    expect(final?.result?.sharedScore).toBe(state.total);
  });

  it("timeout clue et guess donnent zéro sans inventer une position 50", () => {
    const state = started();
    const clueTimeout = onLongueurOndeDeadline(state, "clue_timeout", config, ctx(null, "phase-1", "phase-2"));
    expect(clueTimeout.state.phase).toBe("reveal");
    expect(clueTimeout.state.clue).toBeNull();
    expect(clueTimeout.state.guess).toBeNull();
    expect(clueTimeout.state.missed).toBe(1);
    const afterClueTimeout = onLongueurOndeDeadline(clueTimeout.state, "advance_reveal", config, ctx(null, clueTimeout.phaseId, "phase-3"));
    expect(afterClueTimeout.state.rounds[0]?.missedReason).toBe("clue_timeout");
    expect(afterClueTimeout.state.rounds[0]?.points).toBe(0);

    const giver = state.clueSeat === 0 ? A : B;
    const withClue = reduceLongueurOnde(state, { type: "SUBMIT_CLUE", clue: "Un café" }, config, ctx(giver));
    const guessTimeout = onLongueurOndeDeadline(withClue.state, "guess_timeout", config, ctx(null, withClue.phaseId, "phase-3"));
    expect(guessTimeout.state.guess).toBeNull();
    expect(guessTimeout.state.missedReason).toBe("guess_timeout");
  });

  it("gère l'absence, le forfait coopératif et les jobs obsolètes", () => {
    expect(shouldAbandonForLongueurOndeAbsence(["2026-09-11T19:57:59.000Z", "2026-09-11T19:59:00.000Z"], Date.parse("2026-09-11T20:00:00.000Z"))).toBe(false);
    expect(shouldAbandonForLongueurOndeAbsence(["2026-09-11T19:57:59.000Z", "2026-09-11T19:57:59.000Z"], Date.parse("2026-09-11T20:00:00.000Z"))).toBe(true);
    const abandoned = onLongueurOndeAbsence(started(), config, ctx(null));
    expect(abandoned.result?.outcome).toBe("abandoned");
    expect(abandoned.result?.sharedScore).toBeNull();
    expect(isLongueurOndeDeadlineJobStale("old-phase", "new-phase")).toBe(true);
    expect(isLongueurOndeDeadlineJobStale(undefined, "new-phase")).toBe(false);
  });

  it("garde RESIGN et CLAIM_FORFEIT comme interruptions coopératives pour chaque siège", () => {
    for (const actorId of [A, B]) {
      for (const action of [{ type: "RESIGN" as const }, { type: "CLAIM_FORFEIT" as const }]) {
        const result = reduceLongueurOnde(started(), action, config, ctx(actorId)).result;
        expect(result).toMatchObject({
          kind: "cooperative",
          outcome: "abandoned",
          winnerId: null,
          sharedScore: null,
          reason: action.type === "RESIGN" ? "resign" : "claimed_forfeit",
        });
      }
    }
  });

  it("refuse un état enrichi inattendu", () => {
    expect(() => initializeLongueurOnde(config, ctx(A))).not.toThrow();
    expect(() => reduceLongueurOnde({ ...started(), unexpected: true }, { type: "RESIGN" }, config, ctx(A))).toThrow();
  });
});
