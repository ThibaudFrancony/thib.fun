import { z } from "zod";

export const geoDifficultySchema = z.enum(["easy", "medium", "hard"]);
export const geoSelectionSchema = z.enum(["random", "challenge"]);

export const geoConfigSchema = z.object({
  rounds: z.union([z.literal(5), z.literal(10), z.literal(15)]).default(10),
  turnSeconds: z.union([z.literal(30), z.literal(60), z.literal(90)]).default(60),
  difficulty: geoDifficultySchema.default("easy"),
  selection: geoSelectionSchema.default("random"),
});

export const geoRuntimeConfigSchema = geoConfigSchema.extend({
  firstSeat: z.union([z.literal(0), z.literal(1)]).optional(),
  challengeSelections: z
    .tuple([z.array(z.string()), z.array(z.string())])
    .optional(),
});

export type GeoConfig = z.infer<typeof geoConfigSchema>;
export type GeoRuntimeConfig = z.infer<typeof geoRuntimeConfigSchema>;

export const DEFAULT_GEO_CONFIG: GeoConfig = {
  rounds: 10,
  turnSeconds: 60,
  difficulty: "easy",
  selection: "random",
};

export function parseGeoConfig(input: unknown): GeoConfig {
  return geoConfigSchema.parse(input);
}

export function challengeSelectionLength(rounds: GeoConfig["rounds"], seat: 0 | 1, firstSeat: 0 | 1): number {
  const firstCount = Math.ceil(rounds / 2);
  const secondCount = Math.floor(rounds / 2);
  return seat === firstSeat ? firstCount : secondCount;
}
