import { z } from "zod";

export const skyjoFormatSchema = z.enum(["short", "full"]);
export const skyjoTurnSecondsSchema = z.union([z.literal(30), z.literal(60), z.literal(90)]);

export const skyjoConfigSchema = z
  .object({
    format: skyjoFormatSchema.default("short"),
    turnSeconds: skyjoTurnSecondsSchema.default(60),
  })
  .strict();

export type SkyjoConfig = z.infer<typeof skyjoConfigSchema>;

export const skyjoRuntimeConfigSchema = skyjoConfigSchema.extend({
  firstSeat: z.union([z.literal(0), z.literal(1)]).optional(),
});

export type SkyjoRuntimeConfig = z.infer<typeof skyjoRuntimeConfigSchema>;

export const DEFAULT_SKYJO_CONFIG: SkyjoConfig = {
  format: "short",
  turnSeconds: 60,
};

export const SKYJO_SETUP_SECONDS = 60;
export const SKYJO_REVEAL_SECONDS = 10;
export const SKYJO_MAX_TURNS_PER_ROUND = 200;
export const SKYJO_SHORT_ROUNDS = 3;
export const SKYJO_FULL_SCORE_THRESHOLD = 100;
export const SKYJO_FULL_MAX_ROUNDS = 20;

export function skyjoMaxRoundsFor(config: Pick<SkyjoConfig, "format">): number {
  return config.format === "short" ? SKYJO_SHORT_ROUNDS : SKYJO_FULL_MAX_ROUNDS;
}
