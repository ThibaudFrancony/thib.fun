import { describe, expect, it } from "vitest";
import { COMPATIBILITE_MAX_SKIPS, COMPATIBILITE_RESERVE_COUNT, type CompatibiliteConfig } from "@/games/compatibilite/config";
import {
  initializeCompatibilite,
  onCompatibiliteAbsence,
  onCompatibiliteDeadline,
  reduceCompatibilite,
  shouldAbandonForCompatibiliteAbsence,
  type CompatibiliteEngineContext,
} from "@/games/compatibilite/engine";
import { compatibiliteStateSchema, type CompatibilityContent, type CompatibiliteState } from "@/games/compatibilite/types";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const packId = "4f5d8a31-6b2e-4c70-9d14-8e3f2a1b6c57";
const config: CompatibiliteConfig = { questionCount: 10, category: "amitie", answerSeconds: null };

const content: CompatibilityContent = {
  packId,
  packVersion: 1,
  questions: Array.from({ length: 20 }, (_, index) => ({
    itemId: `compat-${index + 1}`,
    packId,
    logicalKey: `compatibilite-amitie-${String(index + 1).padStart(2, "0")}`,
    category: "amitie" as const,
    prompt: `Question amitié ${index + 1}`,
    options: [
      { id: "a", label: "Option A" },
      { id: "b", label: "Option B" },
      { id: "c", label: "Option C" },
    ],
    sensitivity: "light" as const,
  })),
};

function ctx(actorId: string | null, phaseId = "phase-1", nextPhaseId = "phase-2", nowMs = Date.parse("2026-09-11T20:00:00.000Z")): CompatibiliteEngineContext {
  return { nowMs, actorId, matchId: "match-1", participants: [A, B], content, entropy: Array.from({ length: 200 }, (_, index) => ((index * 37) % 97) / 100), phaseId, nextPhaseId };
}

function started(): CompatibiliteState {
  return initializeCompatibilite(config, ctx(A)).state;
}

function submitBoth(state: CompatibiliteState, first: string, second: string): CompatibiliteState {
  const one = reduceCompatibilite(state, { type: "SUBMIT_CHOICE", optionId: first }, config, ctx(A, "phase-1", "phase-2"));
  return reduceCompatibilite(one.state, { type: "SUBMIT_CHOICE", optionId: second }, config, ctx(B, one.phaseId, "phase-3")).state;
}

describe("moteur Compatibilité", () => {
  it("sélectionne une partie et trois réserves sans échéance de réponse", () => {
    const transition = initializeCompatibilite(config, ctx(A));
    expect(transition.state.questionIds).toHaveLength(10);
    expect(transition.state.reserveIds).toHaveLength(COMPATIBILITE_RESERVE_COUNT);
    expect(transition.state.questionIds).not.toContain(transition.state.reserveIds[0]);
    expect(transition.deadlineAt).toBeNull();
    expect(transition.jobs).toEqual([]);
  });

  it("verrouille une réponse, cache le choix adverse puis ouvre la révélation", () => {
    const state = started();
    const first = reduceCompatibilite(state, { type: "SUBMIT_CHOICE", optionId: "a" }, config, ctx(A));
    expect(first.state.submitted).toEqual([true, false]);
    expect(first.state.choices).toEqual(["a", null]);
    expect(first.state.phase).toBe("answering");
    expect(() => reduceCompatibilite(first.state, { type: "SUBMIT_CHOICE", optionId: "b" }, config, ctx(A, first.phaseId, "phase-3"))).toThrow("ALREADY_SUBMITTED");
    const reveal = reduceCompatibilite(first.state, { type: "SUBMIT_CHOICE", optionId: "a" }, config, ctx(B, first.phaseId, "phase-3"));
    expect(reveal.state.phase).toBe("reveal");
    expect(reveal.deadlineKind).toBe("advance_reveal");
    expect(reveal.jobs).toHaveLength(1);
  });

  it("compare les optionId, ajoute un round et produit 100% sans vainqueur", () => {
    let state = submitBoth(started(), "a", "a");
    const nextA = reduceCompatibilite(state, { type: "NEXT" }, config, ctx(A, "phase-2", "phase-4"));
    expect(nextA.state.phase).toBe("reveal");
    const nextB = reduceCompatibilite(nextA.state, { type: "NEXT" }, config, ctx(B, nextA.phaseId, "phase-5"));
    state = nextB.state;
    expect(state.phase).toBe("answering");
    expect(state.compared).toBe(1);
    expect(state.matches).toBe(1);
    expect(state.rounds[0]?.isMatch).toBe(true);
    expect(nextB.roundRecords[0]?.summary).toMatchObject({ isMatch: true, choices: ["a", "a"] });
  });

  it("un passage remplace la question et supprime les choix privés déjà saisis", () => {
    const initial = started();
    const answered = reduceCompatibilite(initial, { type: "SUBMIT_CHOICE", optionId: "a" }, config, ctx(B));
    const skipped = reduceCompatibilite(answered.state, { type: "SKIP_QUESTION" }, config, ctx(A, answered.phaseId, "phase-9"));
    expect(skipped.state.questionIndex).toBe(0);
    expect(skipped.state.skipped).toBe(1);
    expect(skipped.state.submitted).toEqual([false, false]);
    expect(skipped.state.choices).toEqual([null, null]);
    expect(skipped.state.currentQuestionId).not.toBe(initial.currentQuestionId);
    expect(skipped.state.reserveIds).toHaveLength(COMPATIBILITE_RESERVE_COUNT - 1);
  });

  it("refuse un choix absent et limite les passages", () => {
    expect(() => reduceCompatibilite(started(), { type: "SUBMIT_CHOICE", optionId: "z" }, config, ctx(A))).toThrow("INVALID_OPTION");
    let state = started();
    for (let index = 0; index < COMPATIBILITE_MAX_SKIPS; index += 1) {
      state = reduceCompatibilite(state, { type: "SKIP_QUESTION" }, config, ctx(A, `phase-${index + 1}`, `phase-${index + 2}`)).state;
    }
    expect(state.skipped).toBe(3);
    expect(() => reduceCompatibilite(state, { type: "SKIP_QUESTION" }, config, ctx(A, "phase-4", "phase-5"))).toThrow("SKIP_LIMIT_REACHED");
  });

  it("avance à l'échéance de révélation et termine exactement à questionCount", () => {
    let state = started();
    for (let index = 0; index < config.questionCount; index += 1) {
      state = submitBoth(state, index % 2 === 0 ? "a" : "b", "a");
      if (index === config.questionCount - 1) break;
      state = onCompatibiliteDeadline(state, "advance_reveal", config, ctx(null, `phase-${index + 1}`, `phase-${index + 2}`, Date.parse("2026-09-11T20:00:08.000Z"))).state;
    }
    const final = onCompatibiliteDeadline(state, "advance_reveal", config, ctx(null, "phase-10", "phase-final", Date.parse("2026-09-11T20:00:08.000Z")));
    expect(final.state.phase).toBe("finished");
    expect(final.result?.outcome).toBe("cooperative");
    expect(final.result?.winnerId).toBeNull();
    expect(final.result?.sharedScore).toBe(50);
    expect(final.state.compared).toBe(10);
    expect(final.state.rounds).toHaveLength(10);
  });

  it("abandonne sans score coopératif normal et applique les seuils d'absence", () => {
    expect(shouldAbandonForCompatibiliteAbsence(["2026-09-11T19:57:59.000Z", "2026-09-11T19:59:00.000Z"], Date.parse("2026-09-11T20:00:00.000Z"))).toBe(false);
    expect(shouldAbandonForCompatibiliteAbsence(["2026-09-11T19:57:59.000Z", "2026-09-11T19:57:59.000Z"], Date.parse("2026-09-11T20:00:00.000Z"))).toBe(true);
    const result = onCompatibiliteAbsence(started(), config, ctx(null));
    expect(result.state.phase).toBe("finished");
    expect(result.result?.outcome).toBe("abandoned");
    expect(result.result?.sharedScore).toBeNull();
  });

  it("garde RESIGN et CLAIM_FORFEIT comme interruptions coopératives pour chaque siège", () => {
    for (const actorId of [A, B]) {
      for (const action of [{ type: "RESIGN" as const }, { type: "CLAIM_FORFEIT" as const }]) {
        const result = reduceCompatibilite(started(), action, config, ctx(actorId)).result;
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

  it("refuse les états et actions enrichis", () => {
    expect(() => compatibiliteStateSchema.parse({ ...started(), unexpected: true })).toThrow();
    expect(() => reduceCompatibilite(started(), { type: "SKIP_QUESTION", unexpected: true }, config, ctx(A))).toThrow();
  });
});
