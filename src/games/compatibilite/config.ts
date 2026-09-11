import { z } from "zod";

export const compatibilityCategorySchema = z.enum(["quotidien", "absurde", "amitie", "couple"]);
export const compatibilityQuestionCountSchema = z.union([z.literal(10), z.literal(15), z.literal(20)]);
export const compatibilityAnswerSecondsSchema = z.null();

export const compatibiliteConfigSchema = z
  .object({
    questionCount: compatibilityQuestionCountSchema.default(10),
    category: compatibilityCategorySchema.default("amitie"),
    answerSeconds: compatibilityAnswerSecondsSchema.default(null),
  })
  .strict();

export type CompatibilityCategory = z.infer<typeof compatibilityCategorySchema>;
export type CompatibiliteConfig = z.infer<typeof compatibiliteConfigSchema>;

export const DEFAULT_COMPATIBILITE_CONFIG: CompatibiliteConfig = {
  questionCount: 10,
  category: "amitie",
  answerSeconds: null,
};

export const COMPATIBILITE_REVEAL_SECONDS = 8;
export const COMPATIBILITE_MAX_SKIPS = 3;
export const COMPATIBILITE_RESERVE_COUNT = 5;

export function parseCompatibiliteConfig(input: unknown): CompatibiliteConfig {
  return compatibiliteConfigSchema.parse(input);
}
