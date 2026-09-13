import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { judgeTrouNoirAnswer } from "@/server/quiz/judge";
import { createDeepSeekFixture } from "@/test-support/deepseek-adapter";
import { createTestClock } from "@/test-support/clock";
import type { QuizQuestion } from "@/games/trou-noir/types";

const question: QuizQuestion = {
  itemId: "tn1-0001",
  packId: "trou-noir-v1",
  logicalKey: "culture-livre-miserables",
  category: "culture",
  themeLabel: "Littérature",
  difficulty: 3,
  prompt: "Qui est l'auteur du roman « Les Misérables », publié en 1862 ?",
  canonical: "Victor Hugo",
  aliases: [],
  answerType: "person",
  requiredPrecision: "Le nom de l'auteur suffit.",
  allowSurnameOnly: true,
  allowDescription: false,
  numericTolerance: 0,
  explanation: "« Les Misérables » est un roman de Victor Hugo paru en 1862.",
};

const ambiguousAnswer = "un écrivain français du XIXe siècle";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("juge serveur Trou Noir", () => {
  it("accepte le canonique en méthode exacte sans appeler le modèle", async () => {
    const outcome = await judgeTrouNoirAnswer(question, "Victor Hugo");
    expect(outcome).toEqual({ verdict: "accept", method: "exact", reasonCode: "exact_meaning" });
  });

  it("rejette une réponse vide", async () => {
    const outcome = await judgeTrouNoirAnswer(question, "   ");
    expect(outcome.verdict).toBe("reject");
  });

  it("rend un verdict ambigu sans pénalité quand le modèle n'est pas configuré", async () => {
    const outcome = await judgeTrouNoirAnswer(question, ambiguousAnswer);
    expect(outcome).toEqual({ verdict: "ambiguous", method: "llm", reasonCode: "ambiguous" });
  });

  it.each([
    ["exact", "accept", "exact_meaning"],
    ["false", "reject", "wrong_fact"],
  ] as const)("branche le fixture DeepSeek pour une réponse %s", async (mode, verdict, reasonCode) => {
    vi.stubEnv("DEEPSEEK_API_KEY", "fixture-key");
    vi.stubEnv("DEEPSEEK_MODEL", "fixture-model");
    const fixture = createDeepSeekFixture([mode]);
    const clock = createTestClock();
    const outcome = await judgeTrouNoirAnswer(question, ambiguousAnswer, {
      fetchImpl: fixture.fetchImpl,
      now: clock.now,
      sleep: async () => undefined,
    });
    expect(outcome).toEqual({ verdict, method: "llm", reasonCode });
    expect(fixture.callCount).toBe(1);
    expect(fixture.requests[0]).toContain("fixture-model");
  });

  it("retombe après deux erreurs du transport sans appeler l'API réelle", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "fixture-key");
    vi.stubEnv("DEEPSEEK_MODEL", "fixture-model");
    const fixture = createDeepSeekFixture(["error", "error"]);
    const outcome = await judgeTrouNoirAnswer(question, ambiguousAnswer, {
      fetchImpl: fixture.fetchImpl,
      sleep: async () => undefined,
    });
    expect(outcome).toEqual({ verdict: "ambiguous", method: "llm", reasonCode: "ambiguous" });
    expect(fixture.callCount).toBe(2);
  });

  it("interrompt un transport lent avec l'horloge et les timers contrôlés", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "fixture-key");
    vi.stubEnv("DEEPSEEK_MODEL", "fixture-model");
    vi.useFakeTimers();
    const fixture = createDeepSeekFixture(["slow", "slow"]);
    const promise = judgeTrouNoirAnswer(question, ambiguousAnswer, {
      fetchImpl: fixture.fetchImpl,
      now: () => Date.now(),
      sleep: async () => undefined,
    });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual({ verdict: "ambiguous", method: "llm", reasonCode: "ambiguous" });
    expect(fixture.callCount).toBe(2);
  });
});
