import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { judgeTtmcAnswer } from "@/server/ttmc/judge";
import { createDeepSeekFixture } from "@/test-support/deepseek-adapter";
import { createTestClock } from "@/test-support/clock";
import type { TtmcQuestion } from "@/games/ttmc/types";

const question: TtmcQuestion = {
  itemId: "ttmc-1",
  packId: "pack-test",
  logicalKey: "ttmc-histoire-1-1",
  themeId: "histoire",
  themeLabel: "Histoire",
  themeDescription: "Dates et tournants.",
  level: 1,
  prompt: "Quelle civilisation a construit le Machu Picchu ?",
  canonical: "Les Incas",
  aliases: [],
  explanation: "Réponse de référence : Les Incas.",
};

const ambiguousAnswer = "une civilisation andine";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("juge serveur TTMC", () => {
  it("accepte le canonique en méthode exacte sans appeler le modèle", async () => {
    const outcome = await judgeTtmcAnswer(question, "Les Incas");
    expect(outcome).toEqual({ verdict: "accept", method: "exact", reasonCode: "exact_meaning" });
  });

  it("accepte un alias normalisé (casse, accents, espaces) sans appeler le modèle", async () => {
    const withAlias: TtmcQuestion = { ...question, aliases: ["Empire inca"] };
    const outcome = await judgeTtmcAnswer(withAlias, "  empire  inca ");
    expect(outcome.verdict).toBe("accept");
    expect(outcome.method).toBe("exact");
  });

  it("rejette une réponse vide", async () => {
    const outcome = await judgeTtmcAnswer(question, "   ");
    expect(outcome.verdict).toBe("reject");
  });

  it("rend un verdict ambigu sans pénalité quand le modèle n'est pas configuré", async () => {
    const outcome = await judgeTtmcAnswer(question, ambiguousAnswer);
    expect(outcome).toEqual({ verdict: "ambiguous", method: "llm", reasonCode: "ambiguous" });
  });

  it("ne devine jamais : une entité fausse reste ambigue sans modèle, sans acceptation floue", async () => {
    const outcome = await judgeTtmcAnswer(question, "Les Aztèques");
    expect(outcome.verdict).toBe("ambiguous");
  });

  it.each([
    ["exact", "accept", "exact_meaning"],
    ["false", "reject", "wrong_fact"],
  ] as const)("utilise le transport DeepSeek simulé (%s)", async (mode, verdict, reasonCode) => {
    vi.stubEnv("DEEPSEEK_API_KEY", "fixture-key");
    vi.stubEnv("DEEPSEEK_MODEL", "fixture-model");
    const fixture = createDeepSeekFixture([mode]);
    const clock = createTestClock();
    const outcome = await judgeTtmcAnswer(question, ambiguousAnswer, {
      fetchImpl: fixture.fetchImpl,
      now: clock.now,
      sleep: async () => undefined,
    });
    expect(outcome).toEqual({ verdict, method: "llm", reasonCode });
    expect(fixture.callCount).toBe(1);
  });

  it("gère un modèle lent sans dépasser le test ni contacter le réseau", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "fixture-key");
    vi.stubEnv("DEEPSEEK_MODEL", "fixture-model");
    vi.useFakeTimers();
    const fixture = createDeepSeekFixture(["slow", "slow"]);
    const promise = judgeTtmcAnswer(question, ambiguousAnswer, {
      fetchImpl: fixture.fetchImpl,
      now: () => Date.now(),
      sleep: async () => undefined,
    });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual({ verdict: "ambiguous", method: "llm", reasonCode: "ambiguous" });
    expect(fixture.callCount).toBe(2);
  });
});
