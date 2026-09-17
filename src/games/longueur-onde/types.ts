import { z } from "zod";
import type { LongueurOndeConfig } from "@/games/longueur-onde/config";

export const longueurOndeCategorySchema = z.enum(["quotidien", "culture", "absurde"]);

export const longueurOndeAxisSchema = z
  .object({
    itemId: z.string().min(1),
    packId: z.string().min(1),
    logicalKey: z.string().min(1),
    leftLabel: z.string().min(1).max(60),
    rightLabel: z.string().min(1).max(60),
    category: longueurOndeCategorySchema,
    exampleClue: z.string().min(1).max(120).optional(),
  })
  .strict();

export type LongueurOndeAxis = z.infer<typeof longueurOndeAxisSchema>;

export const longueurOndeContentSchema = z
  .object({
    packId: z.string().min(1),
    packVersion: z.number().int().positive(),
    axes: z.array(longueurOndeAxisSchema).min(1),
  })
  .strict();

export type LongueurOndeContent = z.infer<typeof longueurOndeContentSchema>;

export const longueurOndeRoundSchema = z
  .object({
    round: z.number().int().positive(),
    axisId: z.string().min(1),
    leftLabel: z.string().min(1).max(60),
    rightLabel: z.string().min(1).max(60),
    clueSeat: z.union([z.literal(0), z.literal(1)]),
    guessSeat: z.union([z.literal(0), z.literal(1)]),
    clue: z.string().min(1).max(120).nullable(),
    target: z.number().int().min(0).max(100),
    guess: z.number().int().min(0).max(100).nullable(),
    error: z.number().int().min(0).max(100).nullable(),
    points: z.number().int().min(0).max(4),
    missedReason: z.enum(["clue_timeout", "guess_timeout"]).nullable(),
  })
  .strict();

export type LongueurOndeRound = z.infer<typeof longueurOndeRoundSchema>;

export const longueurOndeStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    phase: z.enum(["clue", "guessing", "reveal", "finished"]),
    round: z.number().int().positive(),
    firstClueSeat: z.union([z.literal(0), z.literal(1)]),
    clueSeat: z.union([z.literal(0), z.literal(1)]),
    axisIds: z.array(z.string().min(1)).min(1),
    axisId: z.string().min(1),
    target: z.number().int().min(0).max(100),
    clue: z.string().min(1).max(120).nullable(),
    guess: z.number().int().min(0).max(100).nullable(),
    total: z.number().int().nonnegative(),
    lastPoints: z.number().int().min(0).max(4),
    lastError: z.number().int().min(0).max(100).nullable(),
    missed: z.number().int().nonnegative(),
    missedReason: z.enum(["clue_timeout", "guess_timeout"]).nullable(),
    finishedReason: z.enum(["normal", "resign", "claimed_forfeit", "absence"]).nullable(),
    acknowledgedBy: z.array(z.string().min(1)),
    rounds: z.array(longueurOndeRoundSchema),
  })
  .strict();

export type LongueurOndeState = z.infer<typeof longueurOndeStateSchema>;

export const longueurOndeActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SUBMIT_CLUE"), clue: z.string().max(120) }).strict(),
  z.object({ type: z.literal("SUBMIT_GUESS"), position: z.number().int().min(0).max(100) }).strict(),
  z.object({ type: z.literal("NEXT") }).strict(),
  z.object({ type: z.literal("RESIGN") }).strict(),
]);

export type LongueurOndeAction = z.infer<typeof longueurOndeActionSchema>;

export type LongueurOndeViewPlayer = {
  id: string;
  seat: 0 | 1;
  pseudo: string;
};

export type LongueurOndeRoundView = Pick<
  LongueurOndeRound,
  "round" | "leftLabel" | "rightLabel" | "clueSeat" | "guessSeat" | "clue" | "target" | "guess" | "error" | "points" | "missedReason"
>;

export type LongueurOndeResultView = {
  outcome: "cooperative" | "abandoned";
  reason: string;
  winnerId: null;
  total: number;
  maxTotal: number;
  percentage: number | null;
  missed: number;
  averageError: number | null;
  rounds: LongueurOndeRoundView[];
} | null;

export type LongueurOndeView = {
  kind: "longueur-onde";
  stateSchemaVersion: 1;
  phase: LongueurOndeState["phase"];
  rounds: number;
  round: number;
  clueSeat: 0 | 1;
  guessSeat: 0 | 1;
  mySeat: 0 | 1;
  isClueGiver: boolean;
  axis: { itemId: string; leftLabel: string; rightLabel: string; category: LongueurOndeAxis["category"] } | null;
  target: number | null;
  clue: string | null;
  myGuess: number | null;
  total: number;
  lastPoints: number;
  lastError: number | null;
  missed: number;
  players: [LongueurOndeViewPlayer, LongueurOndeViewPlayer];
  result: LongueurOndeResultView;
  allowedActions: string[];
  config: LongueurOndeConfig;
};
