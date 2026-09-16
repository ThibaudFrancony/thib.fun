import "server-only";

export type LocalQuizFixtureVerdict = "accept" | "reject" | "ambiguous";

type QuizAiConfigurationBase = {
  dailyBudgetUsd: number;
  dailyCallLimit: number;
  reservedCallCostUsd: number;
};

export type QuizJudgeTransportConfiguration =
  | {
      provider: "deepseek";
      apiKey: string;
      model: string;
      fixtureVerdict: null;
    }
  | {
      provider: "local-fixture";
      apiKey: null;
      model: "local-quiz-fixture-v1";
      fixtureVerdict: LocalQuizFixtureVerdict;
    };

export type QuizAiConfiguration = QuizAiConfigurationBase & QuizJudgeTransportConfiguration;

function positiveNumber(value: string | undefined): number | null {
  if (!value || !/^\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function nonNegativeNumber(value: string | undefined): number | null {
  if (!value || !/^\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function positiveInteger(value: string | undefined, fallback: number): number | null {
  if (!value) return fallback;
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function isLoopbackUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return new Set(["localhost", "127.0.0.1", "::1"]).has(new URL(value).hostname);
  } catch {
    return false;
  }
}

function localFixtureVerdict(): LocalQuizFixtureVerdict | null {
  const value = process.env.QUIZ_AI_LOCAL_FIXTURE?.trim();
  if (value !== "accept" && value !== "reject" && value !== "ambiguous") return null;
  if (process.env.NODE_ENV === "production") return null;
  if (!isLoopbackUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) || !isLoopbackUrl(process.env.APP_ORIGIN)) return null;
  return value;
}

export function getQuizJudgeTransportConfiguration(): QuizJudgeTransportConfiguration | null {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  const model = process.env.DEEPSEEK_MODEL?.trim();
  const fixtureVerdict = localFixtureVerdict();
  if (fixtureVerdict) {
    return {
      provider: "local-fixture",
      apiKey: null,
      model: "local-quiz-fixture-v1",
      fixtureVerdict,
    };
  }
  if (!apiKey || !model) return null;
  return { provider: "deepseek", apiKey, model, fixtureVerdict: null };
}

/** Configuration complète vérifiée avant le lancement d'une partie quiz. */
export function getQuizAiConfiguration(): QuizAiConfiguration | null {
  const transport = getQuizJudgeTransportConfiguration();
  const dailyBudgetUsd = positiveNumber(process.env.AI_DAILY_BUDGET_USD);
  const dailyCallLimit = positiveInteger(process.env.AI_DAILY_CALL_LIMIT, 1000);
  const reservedCallCostUsd = process.env.AI_RESERVED_CALL_COST_USD
    ? nonNegativeNumber(process.env.AI_RESERVED_CALL_COST_USD)
    : 0;

  if (!transport || dailyBudgetUsd === null || dailyCallLimit === null || reservedCallCostUsd === null) {
    return null;
  }
  if (reservedCallCostUsd > dailyBudgetUsd) return null;
  return {
    ...transport,
    dailyBudgetUsd,
    dailyCallLimit,
    reservedCallCostUsd,
  };
}

export function requireQuizAiConfiguration(): QuizAiConfiguration {
  const configuration = getQuizAiConfiguration();
  if (!configuration) throw new Error("AI_CONFIGURATION_REQUIRED");
  return configuration;
}
