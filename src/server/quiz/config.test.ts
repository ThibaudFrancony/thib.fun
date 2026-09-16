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
      provider: "deepseek",
      apiKey: "fixture-key",
      model: "fixture-model",
      fixtureVerdict: null,
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

  it("active le transport déterministe sans fausse clé uniquement en local", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3000");
    vi.stubEnv("QUIZ_AI_LOCAL_FIXTURE", "accept");
    vi.stubEnv("AI_DAILY_BUDGET_USD", "1");
    vi.stubEnv("AI_DAILY_CALL_LIMIT", "10");
    vi.stubEnv("AI_RESERVED_CALL_COST_USD", "0");

    expect(getQuizAiConfiguration()).toEqual({
      provider: "local-fixture",
      apiKey: null,
      model: "local-quiz-fixture-v1",
      fixtureVerdict: "accept",
      dailyBudgetUsd: 1,
      dailyCallLimit: 10,
      reservedCallCostUsd: 0,
    });
  });

  it.each([
    ["production", "http://127.0.0.1:54321", "http://127.0.0.1:3000"],
    ["test", "https://example.supabase.co", "http://127.0.0.1:3000"],
    ["test", "http://127.0.0.1:54321", "https://preview.example.com"],
  ])("refuse le transport local hors environnement isolé (%s)", (nodeEnv, supabaseUrl, appOrigin) => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl);
    vi.stubEnv("APP_ORIGIN", appOrigin);
    vi.stubEnv("QUIZ_AI_LOCAL_FIXTURE", "accept");
    vi.stubEnv("AI_DAILY_BUDGET_USD", "1");

    expect(getQuizAiConfiguration()).toBeNull();
  });
});
