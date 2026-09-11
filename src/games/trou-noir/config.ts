import { z } from "zod";

export const trouNoirCategorySchema = z.enum([
  "culture",
  "histoire-geo",
  "cuisine",
  "sport",
  "sciences",
]);

export type TrouNoirCategory = z.infer<typeof trouNoirCategorySchema>;

export const trouNoirConfigSchema = z
  .object({
    maxRounds: z.union([z.literal(5), z.literal(10)]).default(10),
    answerSeconds: z.union([z.literal(30), z.literal(60), z.literal(90)]).default(60),
    categories: z.array(trouNoirCategorySchema).min(1).max(5),
  })
  .strict();

export const trouNoirRuntimeConfigSchema = trouNoirConfigSchema.extend({
  firstSeat: z.union([z.literal(0), z.literal(1)]).optional(),
});

export type TrouNoirConfig = z.infer<typeof trouNoirConfigSchema>;
export type TrouNoirRuntimeConfig = z.infer<typeof trouNoirRuntimeConfigSchema>;

export const DEFAULT_TROU_NOIR_CONFIG: TrouNoirConfig = {
  maxRounds: 10,
  answerSeconds: 60,
  categories: ["culture", "histoire-geo", "cuisine", "sport", "sciences"],
};

export const TROU_NOIR_DIFFICULTIES = [3, 4, 5, 6] as const;

export function parseTrouNoirConfig(input: unknown): TrouNoirConfig {
  return trouNoirConfigSchema.parse(input);
}
