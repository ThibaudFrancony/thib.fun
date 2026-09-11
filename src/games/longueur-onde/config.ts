import { z } from "zod";

export const longueurOndeRoundsSchema = z.union([z.literal(6), z.literal(8), z.literal(10)]);
export const longueurOndeClueSecondsSchema = z.union([z.literal(60), z.literal(90), z.literal(120)]);
export const longueurOndeGuessSecondsSchema = z.union([z.literal(30), z.literal(60), z.literal(90)]);

export const longueurOndeConfigSchema = z
  .object({
    rounds: longueurOndeRoundsSchema.default(8),
    clueSeconds: longueurOndeClueSecondsSchema.default(90),
    guessSeconds: longueurOndeGuessSecondsSchema.default(60),
  })
  .strict();

export type LongueurOndeConfig = z.infer<typeof longueurOndeConfigSchema>;

export const DEFAULT_LONGUEUR_ONDE_CONFIG: LongueurOndeConfig = {
  rounds: 8,
  clueSeconds: 90,
  guessSeconds: 60,
};

export const LONGUEUR_ONDE_REVEAL_SECONDS = 8;
export const LONGUEUR_ONDE_RESERVE_COUNT = 2;

export function parseLongueurOndeConfig(input: unknown): LongueurOndeConfig {
  return longueurOndeConfigSchema.parse(input);
}
