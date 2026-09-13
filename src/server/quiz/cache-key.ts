import { createHash } from "node:crypto";

export const QUIZ_JUDGE_PROMPT_VERSION = "quiz-judge-v1";
export const QUIZ_JUDGE_POLICY_VERSION = "quiz-judge-v1";

export function quizJudgmentCacheKey(input: {
  questionRevisionId: string;
  packId: string;
  logicalKey: string;
  normalizedAnswer: string;
  modelId: string;
}): string {
  const canonical = JSON.stringify({
    questionRevisionId: input.questionRevisionId,
    packId: input.packId,
    logicalKey: input.logicalKey,
    normalizedAnswer: input.normalizedAnswer,
    promptVersion: QUIZ_JUDGE_PROMPT_VERSION,
    modelId: input.modelId,
    policyVersion: QUIZ_JUDGE_POLICY_VERSION,
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
