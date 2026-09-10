import { z } from "zod";

export const unoTurnSecondsSchema = z.union([z.literal(20), z.literal(30), z.literal(60)]);

export const unoConfigSchema = z.object({
  turnSeconds: unoTurnSecondsSchema,
  format: z.literal("single"),
}).strict();

export type UnoConfig = z.infer<typeof unoConfigSchema>;

/** Server-only extension used by deterministic engine fixtures, never accepted from a room request. */
export const unoRuntimeConfigSchema = unoConfigSchema.extend({
  firstSeat: z.union([z.literal(0), z.literal(1)]).optional(),
});

export type UnoRuntimeConfig = z.infer<typeof unoRuntimeConfigSchema>;

export const DEFAULT_UNO_CONFIG: UnoConfig = {
  turnSeconds: 30,
  format: "single",
};
