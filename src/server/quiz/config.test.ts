import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getQuizAiConfiguration, requireQuizAiConfiguration } from "@/server/quiz/config";

afterEach(() => vi.unstubAllEnvs());

describe("configuration IA des quiz", () => {
  it("refuse une configuration incomplète avant le démarrage", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    vi.stubEnv("DEEPSEEK_MODEL", "fixture-model");
    vi.stubEnv("AI_DAILY_BUDGET_USD", "1");
    expect(getQuizAiConfiguration()).toBeNull();
    expect(() => requireQuizAiConfiguration()).toThrow("AI_CONFIGURATION_REQUIRED");
  });

  it("retourne les limites serveur sans publier de valeur implicite de prix", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "fixture-key");
    vi.stubEnv("DEEPSEEK_MODEL", "fixture-model");
    vi.stubEnv("AI_DAILY_BUDGET_USD", "1.25");
    vi.stubEnv("AI_DAILY_CALL_LIMIT", "7");
    vi.stubEnv("AI_RESERVED_CALL_COST_USD", "0");
    expect(getQuizAiConfiguration()).toEqual({
      apiKey: "fixture-key",
      model: "fixture-model",
      dailyBudgetUsd: 1.25,
      dailyCallLimit: 7,
      reservedCallCostUsd: 0,
    });
  });

  it.each([
    ["AI_DAILY_BUDGET_USD", "0"],
    ["AI_DAILY_BUDGET_USD", "not-a-number"],
    ["AI_DAILY_CALL_LIMIT", "0"],
    ["AI_DAILY_CALL_LIMIT", "1.5"],
    ["AI_RESERVED_CALL_COST_USD", "-0.1"],
    ["AI_RESERVED_CALL_COST_USD", "2"],
  ])("refuse %s=%s", (name, value) => {
    vi.stubEnv("DEEPSEEK_API_KEY", "fixture-key");
    vi.stubEnv("DEEPSEEK_MODEL", "fixture-model");
    vi.stubEnv("AI_DAILY_BUDGET_USD", "1");
    vi.stubEnv(name, value);
    expect(getQuizAiConfiguration()).toBeNull();
  });
});
