import { z } from "zod";

export const bombpartyLivesSchema = z.union([z.literal(3), z.literal(5)]);
export const bombpartyInitialSecondsSchema = z.union([z.literal(10), z.literal(15), z.literal(20)]);
export const bombpartyDifficultySchema = z.enum(["easy", "normal", "hard"]);

export const bombpartyConfigSchema = z
  .object({
    lives: bombpartyLivesSchema.default(3),
    initialSeconds: bombpartyInitialSecondsSchema.default(15),
    sequenceDifficulty: bombpartyDifficultySchema.default("normal"),
  })
  .strict();

export type BombpartyConfig = z.infer<typeof bombpartyConfigSchema>;

export const bombpartyRuntimeConfigSchema = bombpartyConfigSchema.extend({
  firstSeat: z.union([z.literal(0), z.literal(1)]).optional(),
});

export type BombpartyRuntimeConfig = z.infer<typeof bombpartyRuntimeConfigSchema>;

export const DEFAULT_BOMBPARTY_CONFIG: BombpartyConfig = {
  lives: 3,
  initialSeconds: 15,
  sequenceDifficulty: "normal",
};

export const BOMBPARTY_MAX_TURNS = 200;
export const BOMBPARTY_MIN_TURN_SECONDS = 5;

/** Durée du tour fixée au début du tour, décroissante par paliers de 6 mots valides. */
export function turnSecondsFor(validWordsTotal: number, initialSeconds: number): number {
  return Math.max(BOMBPARTY_MIN_TURN_SECONDS, initialSeconds - Math.floor(validWordsTotal / 6));
}
