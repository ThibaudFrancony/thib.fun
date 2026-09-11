import { describe, expect, it } from "vitest";
import { DEFAULT_LONGUEUR_ONDE_CONFIG, type LongueurOndeConfig } from "@/games/longueur-onde/config";
import { initializeLongueurOnde, reduceLongueurOnde, type LongueurOndeEngineContext } from "@/games/longueur-onde/engine";
import { projectLongueurOnde } from "@/games/longueur-onde/projection";
import type { LongueurOndeContent, LongueurOndeState } from "@/games/longueur-onde/types";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const content: LongueurOndeContent = {
  packId: "8c7f4d21-3a6e-4b92-9f15-0d28e6a4c753",
  packVersion: 1,
  axes: Array.from({ length: 10 }, (_, index) => ({
    itemId: `axis-${index + 1}`,
    packId: "8c7f4d21-3a6e-4b92-9f15-0d28e6a4c753",
    logicalKey: `axis-${index + 1}`,
    leftLabel: "Calme",
    rightLabel: "Vif",
    category: "quotidien" as const,
  })),
};
const config: LongueurOndeConfig = DEFAULT_LONGUEUR_ONDE_CONFIG;

function ctx(actorId: string | null, phaseId = "phase-1", nextPhaseId = "phase-2", nowMs = Date.parse("2026-09-11T20:00:00.000Z")): LongueurOndeEngineContext {
  return { nowMs, actorId, matchId: "match-1", participants: [A, B], content, entropy: Array.from({ length: 200 }, (_, index) => ((index * 37) % 97) / 100), phaseId, nextPhaseId };
}

function started(): LongueurOndeState {
  return initializeLongueurOnde(config, ctx(A)).state;
}

describe("projection À l'unisson", () => {
  it("ne révèle pas la cible au devineur ni la position provisoire au donneur", () => {
    const state = started();
    const giver = state.clueSeat === 0 ? A : B;
    const guesser = state.clueSeat === 0 ? B : A;
    const giverView = projectLongueurOnde(state, config, content, giver, [A, B], [{ id: A, pseudo: "Alice" }, { id: B, pseudo: "Basile" }]);
    const guesserView = projectLongueurOnde(state, config, content, guesser, [A, B], [{ id: A, pseudo: "Alice" }, { id: B, pseudo: "Basile" }]);
    expect(giverView.target).toBe(state.target);
    expect(guesserView.target).toBeNull();
    const clue = reduceLongueurOnde(state, { type: "SUBMIT_CLUE", clue: "Un café tout juste servi" }, config, ctx(giver)).state;
    const afterClueGiver = projectLongueurOnde(clue, config, content, giver, [A, B], [{ id: A, pseudo: "Alice" }, { id: B, pseudo: "Basile" }]);
    const afterClueGuesser = projectLongueurOnde(clue, config, content, guesser, [A, B], [{ id: A, pseudo: "Alice" }, { id: B, pseudo: "Basile" }]);
    expect(afterClueGuesser.clue).toBe("Un café tout juste servi");
    expect(afterClueGiver.myGuess).toBeNull();
    expect(afterClueGuesser.target).toBeNull();
  });

  it("révèle les deux valeurs uniquement après le guess", () => {
    const state = started();
    const giver = state.clueSeat === 0 ? A : B;
    const guesser = state.clueSeat === 0 ? B : A;
    const withClue = reduceLongueurOnde(state, { type: "SUBMIT_CLUE", clue: "Un café tout juste servi" }, config, ctx(giver)).state;
    const reveal = reduceLongueurOnde(withClue, { type: "SUBMIT_GUESS", position: 50 }, config, ctx(guesser, "phase-2", "phase-3"));
    const view = projectLongueurOnde(reveal.state, config, content, giver, [A, B], [{ id: A, pseudo: "Alice" }, { id: B, pseudo: "Basile" }]);
    expect(view.phase).toBe("reveal");
    expect(view.target).toBe(state.target);
    expect(view.myGuess).toBe(50);
    expect(reveal.jobs).toHaveLength(1);
  });
});
