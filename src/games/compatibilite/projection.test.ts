import { describe, expect, it } from "vitest";
import { type CompatibiliteConfig } from "@/games/compatibilite/config";
import { initializeCompatibilite, reduceCompatibilite, type CompatibiliteEngineContext } from "@/games/compatibilite/engine";
import { projectCompatibilite } from "@/games/compatibilite/projection";
import type { CompatibilityContent } from "@/games/compatibilite/types";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const config: CompatibiliteConfig = { questionCount: 10, category: "amitie", answerSeconds: null };
const content: CompatibilityContent = {
  packId: "4f5d8a31-6b2e-4c70-9d14-8e3f2a1b6c57",
  packVersion: 1,
  questions: Array.from({ length: 15 }, (_, index) => ({
    itemId: `q-${index}`,
    packId: "4f5d8a31-6b2e-4c70-9d14-8e3f2a1b6c57",
    logicalKey: `key-${index}`,
    category: "amitie" as const,
    prompt: `Choix ${index}`,
    options: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
    sensitivity: "light" as const,
  })),
};
const identities = [{ id: A, pseudo: "Ariane" }, { id: B, pseudo: "Basile" }] as [{ id: string; pseudo: string }, { id: string; pseudo: string }];

function ctx(actorId: string | null, phaseId = "phase-1", nextPhaseId = "phase-2"): CompatibiliteEngineContext {
  return { nowMs: Date.parse("2026-09-11T20:00:00.000Z"), actorId, matchId: "match-1", participants: [A, B], content, entropy: Array.from({ length: 100 }, (_, index) => (index % 10) / 10), phaseId, nextPhaseId };
}

describe("projection Compatibilité", () => {
  it("montre la question courante et le statut adverse sans fuite de choix ou de réserves", () => {
    const state = initializeCompatibilite(config, ctx(A)).state;
    const after = reduceCompatibilite(state, { type: "SUBMIT_CHOICE", optionId: "b" }, config, ctx(A));
    const viewA = projectCompatibilite(after.state, config, content, A, [A, B], identities);
    const viewB = projectCompatibilite(after.state, config, content, B, [A, B], identities);
    expect(viewA.myChoice).toBe("b");
    expect(viewA.opponentSubmitted).toBe(false);
    expect(viewA.opponentChoice).toBeNull();
    expect(viewB.opponentSubmitted).toBe(true);
    expect(viewB.opponentChoice).toBeNull();
    expect(JSON.stringify(viewA)).not.toContain("reserveIds");
    expect(JSON.stringify(viewA)).not.toContain("questionIds");
  });

  it("révèle les deux options seulement après le second submit, puis garde les rounds révélés", () => {
    const initial = initializeCompatibilite(config, ctx(A)).state;
    const first = reduceCompatibilite(initial, { type: "SUBMIT_CHOICE", optionId: "a" }, config, ctx(A));
    const reveal = reduceCompatibilite(first.state, { type: "SUBMIT_CHOICE", optionId: "b" }, config, ctx(B, first.phaseId));
    const view = projectCompatibilite(reveal.state, config, content, A, [A, B], identities);
    expect(view.phase).toBe("reveal");
    expect(view.opponentChoice).toBe("b");
    expect(view.allowedActions).toContain("NEXT");
    const ackA = reduceCompatibilite(reveal.state, { type: "NEXT" }, config, ctx(A, reveal.phaseId, "phase-4"));
    const closed = reduceCompatibilite(ackA.state, { type: "NEXT" }, config, ctx(B, ackA.phaseId, "phase-5"));
    const after = projectCompatibilite(closed.state, config, content, B, [A, B], identities);
    expect(after.phase).toBe("answering");
    expect(after.compared).toBe(1);
  });

  it("ne produit ni gagnant ni défaite et garde le score coopératif dans le résultat", () => {
    let state = initializeCompatibilite(config, ctx(A)).state;
    for (let index = 0; index < 10; index += 1) {
      const first = reduceCompatibilite(state, { type: "SUBMIT_CHOICE", optionId: "a" }, config, ctx(A));
      const reveal = reduceCompatibilite(first.state, { type: "SUBMIT_CHOICE", optionId: index === 0 ? "b" : "a" }, config, ctx(B));
      const ackA = reduceCompatibilite(reveal.state, { type: "NEXT" }, config, ctx(A));
      state = reduceCompatibilite(ackA.state, { type: "NEXT" }, config, ctx(B, ackA.phaseId)).state;
    }
    const view = projectCompatibilite(state, config, content, A, [A, B], identities);
    expect(view.phase).toBe("finished");
    expect(view.result?.outcome).toBe("cooperative");
    expect(view.result?.winnerId).toBeNull();
    expect(view.result?.sharedScore).toBe(90);
    expect(view.result?.rounds).toHaveLength(10);
  });
});
