import { z } from "zod";

export const geoCitySchema = z.object({
  inseeCode: z.string().regex(/^(?:\d{5}|2[AB]\d{3})$/),
  name: z.string().min(1).max(120),
  departmentCode: z.string().min(2).max(3),
  departmentName: z.string().min(1).max(120),
  latitude: z.number().finite().min(41).max(52),
  longitude: z.number().finite().min(-6).max(10),
  population: z.number().int().nonnegative(),
  populationYear: z.number().int().positive(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  sourceUrl: z.string().url(),
});

export type GeoCity = z.infer<typeof geoCitySchema>;

export type GeoContent = {
  packId: string;
  packVersion: number;
  cities: readonly GeoCity[];
};

export const geoPlacementSchema = z.object({
  latitude: z.number().finite().min(41).max(52),
  longitude: z.number().finite().min(-6).max(10),
  distanceKm: z.number().finite().nonnegative(),
  points: z.number().int().min(0).max(1000),
});

export type GeoPlacement = z.infer<typeof geoPlacementSchema>;

export const geoMetricsSchema = z.object({
  distanceSumKm: z.number().finite().nonnegative(),
  validPlacements: z.number().int().nonnegative(),
  missedPlacements: z.number().int().nonnegative(),
  bestDistanceKm: z.number().finite().nonnegative().nullable(),
});

export type GeoMetrics = z.infer<typeof geoMetricsSchema>;

export const geoFinishedReasonSchema = z.enum([
  "round_limit",
  "resign",
  "claimed_forfeit",
  "absence",
  "technical_error",
]);

export const geoFinishedOutcomeSchema = z.enum(["win", "draw", "abandoned"]);

export const geoStateSchema = z.object({
  schemaVersion: z.literal(1),
  phase: z.enum(["select_cities", "placing", "reveal", "finished"]),
  round: z.number().int().min(1),
  firstSeat: z.union([z.literal(0), z.literal(1)]),
  turnInRound: z.union([z.literal(0), z.literal(1)]),
  cityIds: z.array(z.string()),
  challengeSelections: z.tuple([z.array(z.string()), z.array(z.string())]),
  challengeConfirmed: z.tuple([z.boolean(), z.boolean()]),
  placements: z.tuple([geoPlacementSchema.nullable(), geoPlacementSchema.nullable()]),
  submitted: z.tuple([z.boolean(), z.boolean()]),
  totals: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  metrics: z.tuple([geoMetricsSchema, geoMetricsSchema]),
  acknowledgedBy: z.array(z.string()),
  finishedOutcome: geoFinishedOutcomeSchema.nullable(),
  finishedReason: geoFinishedReasonSchema.nullable(),
  winnerId: z.string().nullable(),
});

export type GeoState = z.infer<typeof geoStateSchema>;

export const geoActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SET_CITY_SELECTION"), cityIds: z.array(z.string()).max(15) }),
  z.object({ type: z.literal("CONFIRM_CITY_SELECTION") }),
  z.object({
    type: z.literal("PLACE_CITY"),
    latitude: z.number().finite(),
    longitude: z.number().finite(),
  }),
  z.object({ type: z.literal("NEXT") }),
  z.object({ type: z.literal("RESIGN") }),
]);

export type GeoAction = z.infer<typeof geoActionSchema>;

export type GeoViewPlayer = {
  id: string;
  seat: 0 | 1;
  pseudo: string;
  score: number;
  submitted: boolean;
  active: boolean;
  placement: { latitude: number; longitude: number } | null;
};

export type GeoView = {
  kind: "geographie";
  stateSchemaVersion: 1;
  phase: GeoState["phase"];
  round: number;
  rounds: number;
  turnSeconds: number;
  difficulty: "easy" | "medium" | "hard";
  selection: "random" | "challenge";
  mySeat: 0 | 1;
  target: { id: string; name: string; departmentName: string } | null;
  targetPoint: { latitude: number; longitude: number } | null;
  players: [GeoViewPlayer, GeoViewPlayer];
  challenge: {
    mySelection: { id: string; name: string; departmentName: string }[];
    myConfirmed: boolean;
    opponentConfirmed: boolean;
    required: number;
  } | null;
  acknowledged: boolean;
  totals: [number, number];
  lastRound: {
    target: { id: string; name: string; departmentName: string; latitude: number; longitude: number };
    placements: [GeoPlacement | null, GeoPlacement | null];
    totals: [number, number];
  } | null;
  result: ResultView | null;
};

export type ResultView = {
  outcome: "win" | "draw" | "abandoned";
  winnerId: string | null;
  reason: string;
  players: [{ id: string; score: number | null }, { id: string; score: number | null }];
};
