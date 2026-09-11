import { z } from "zod";

export const ttmcTargetSchema = z.union([z.literal(20), z.literal(30), z.literal(50)]);
export const ttmcMaxRoundsSchema = z.union([z.literal(15), z.literal(20), z.literal(30)]);
export const ttmcAnswerSecondsSchema = z.union([z.literal(30), z.literal(60), z.literal(90)]);

export const ttmcConfigSchema = z
  .object({
    targetScore: ttmcTargetSchema.default(30),
    maxRounds: ttmcMaxRoundsSchema.default(20),
    answerSeconds: ttmcAnswerSecondsSchema.default(60),
    themeSelectionSeconds: z.literal(20).default(20),
  })
  .strict()
  .superRefine((value, ctx) => {
    const expected =
      value.targetScore === 20 ? 15 : value.targetScore === 30 ? 20 : 30;
    if (value.maxRounds !== expected) {
      ctx.addIssue({
        code: "custom",
        message: `maxRounds doit être ${expected} pour targetScore ${value.targetScore}.`,
      });
    }
  });

export const ttmcRuntimeConfigSchema = ttmcConfigSchema.extend({
  firstSeat: z.union([z.literal(0), z.literal(1)]).optional(),
});

export type TtmcConfig = z.infer<typeof ttmcConfigSchema>;
export type TtmcRuntimeConfig = z.infer<typeof ttmcRuntimeConfigSchema>;

export const DEFAULT_TTMC_CONFIG: TtmcConfig = {
  targetScore: 30,
  maxRounds: 20,
  answerSeconds: 60,
  themeSelectionSeconds: 20,
};

export const TTMC_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const TTMC_CHOOSE_SECONDS = 20;
export const TTMC_REVEAL_SECONDS = 12;
export const TTMC_CONTEST_SECONDS = 20;
export const TTMC_MAX_TECHNICAL_REPLACEMENTS = 2;

export function parseTtmcConfig(input: unknown): TtmcConfig {
  return ttmcConfigSchema.parse(input);
}

/** Nombre de thèmes distincts exigés : maxRounds principaux + 2 secours. */
export function requiredThemesForConfig(config: Pick<TtmcConfig, "maxRounds">): number {
  return config.maxRounds + 2;
}
