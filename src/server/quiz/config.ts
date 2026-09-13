import "server-only";

export type QuizAiConfiguration = {
  apiKey: string;
  model: string;
  dailyBudgetUsd: number;
  dailyCallLimit: number;
  reservedCallCostUsd: number;
};

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

/** Configuration complète vérifiée avant le lancement d'une partie quiz. */
export function getQuizAiConfiguration(): QuizAiConfiguration | null {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  const model = process.env.DEEPSEEK_MODEL?.trim();
  const dailyBudgetUsd = positiveNumber(process.env.AI_DAILY_BUDGET_USD);
  const dailyCallLimit = positiveInteger(process.env.AI_DAILY_CALL_LIMIT, 1000);
  const reservedCallCostUsd = process.env.AI_RESERVED_CALL_COST_USD
    ? nonNegativeNumber(process.env.AI_RESERVED_CALL_COST_USD)
    : 0;

  if (!apiKey || !model || dailyBudgetUsd === null || dailyCallLimit === null || reservedCallCostUsd === null) {
    return null;
  }
  if (reservedCallCostUsd > dailyBudgetUsd) return null;
  return { apiKey, model, dailyBudgetUsd, dailyCallLimit, reservedCallCostUsd };
}

export function requireQuizAiConfiguration(): QuizAiConfiguration {
  const configuration = getQuizAiConfiguration();
  if (!configuration) throw new Error("AI_CONFIGURATION_REQUIRED");
  return configuration;
}
