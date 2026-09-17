import { z } from "zod";
import type { ResultSpec } from "@/games/contracts";

export const skyjoCardSchema = z.object({
  id: z.string().min(1),
  value: z.number().int().min(-2).max(12),
});

export type SkyjoCard = z.infer<typeof skyjoCardSchema>;

export const skyjoCellSchema = z
  .object({
    card: skyjoCardSchema,
    revealed: z.boolean(),
  })
  .nullable();

export type SkyjoCell = z.infer<typeof skyjoCellSchema>;

const gridSchema = z.array(skyjoCellSchema).length(12);

export const skyjoRoundSummarySchema = z.object({
  round: z.number().int().min(1),
  triggerSeat: z.union([z.literal(0), z.literal(1)]).nullable(),
  raw: z.tuple([z.number().int(), z.number().int()]),
  final: z.tuple([z.number().int(), z.number().int()]),
  penalizedSeat: z.union([z.literal(0), z.literal(1)]).nullable(),
  clears: z.number().int().nonnegative(),
  turns: z.number().int().nonnegative(),
  cumulativeAfter: z.tuple([z.number().int(), z.number().int()]),
});

export type SkyjoRoundSummary = z.infer<typeof skyjoRoundSummarySchema>;

export const skyjoCountersSchema = z.object({
  rawPointsSum: z.tuple([z.number().int(), z.number().int()]),
  penalties: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
  columnClears: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
  automaticTurns: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
});

export type SkyjoCounters = z.infer<typeof skyjoCountersSchema>;

export const skyjoStateSchema = z.object({
  schemaVersion: z.literal(1),
  phase: z.enum(["setup", "choose_source", "resolve_draw", "replace_discard", "round_reveal", "finished"]),
  round: z.number().int().min(1),
  activeSeat: z.union([z.literal(0), z.literal(1)]),
  firstSeat: z.union([z.literal(0), z.literal(1)]),
  grids: z.tuple([gridSchema, gridSchema]),
  initialReady: z.tuple([z.boolean(), z.boolean()]),
  initialSums: z.tuple([z.number().int().nullable(), z.number().int().nullable()]),
  drawPile: z.array(skyjoCardSchema),
  discardPile: z.array(skyjoCardSchema),
  removed: z.array(skyjoCardSchema),
  heldCard: skyjoCardSchema.nullable(),
  heldSource: z.enum(["draw", "discard"]).nullable(),
  closingSeat: z.union([z.literal(0), z.literal(1)]).nullable(),
  finalTurnsRemaining: z.union([z.literal(0), z.literal(1)]),
  turns: z.number().int().min(0).max(200),
  cumulative: z.tuple([z.number().int(), z.number().int()]),
  acknowledgedBy: z.array(z.string()),
  roundSummary: skyjoRoundSummarySchema.nullable(),
  counters: skyjoCountersSchema,
  finishedOutcome: z.enum(["win", "draw", "abandoned"]).nullable(),
  finishedReason: z.string().nullable(),
  winnerId: z.string().nullable(),
});

export type SkyjoState = z.infer<typeof skyjoStateSchema>;

export const skyjoActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("REVEAL_INITIAL"), slots: z.tuple([z.number().int().min(0).max(11), z.number().int().min(0).max(11)]) }).strict(),
  z.object({ type: z.literal("TAKE_DRAW") }).strict(),
  z.object({ type: z.literal("TAKE_DISCARD") }).strict(),
  z.object({ type: z.literal("REPLACE"), slot: z.number().int().min(0).max(11) }).strict(),
  z.object({ type: z.literal("DISCARD_AND_REVEAL"), slot: z.number().int().min(0).max(11) }).strict(),
  z.object({ type: z.literal("NEXT") }).strict(),
  z.object({ type: z.literal("RESIGN") }).strict(),
]);

export type SkyjoAction = z.infer<typeof skyjoActionSchema>;

export type SkyjoCellView =
  | { slot: number; revealed: false; empty?: false }
  | { slot: number; revealed: true; value: number }
  | { slot: number; revealed: false; empty: true };

export type SkyjoHeldView = { value: number; source: "draw" | "discard" } | { hidden: true } | null;

export type SkyjoResultView = {
  outcome: ResultSpec["outcome"];
  winnerId: string | null;
  reason: string;
  players: [{ id: string; score: number | null }, { id: string; score: number | null }];
} | null;

export type SkyjoView = {
  kind: "skyjo";
  stateSchemaVersion: 1;
  phase: SkyjoState["phase"];
  round: number;
  maxRounds: number;
  format: "short" | "full";
  turnSeconds: 30 | 60 | 90;
  mySeat: 0 | 1;
  activeSeat: 0 | 1;
  activePlayerId: string | null;
  myGrid: SkyjoCellView[];
  opponentGrid: SkyjoCellView[];
  held: SkyjoHeldView;
  discardTop: number | null;
  discardCount: number;
  drawCount: number;
  removedCount: number;
  revealedCount: [number, number];
  remainingCount: [number, number];
  closingSeat: 0 | 1 | null;
  lastTurn: boolean;
  cumulative: [number, number];
  roundSummary: SkyjoRoundSummary | null;
  acknowledged: boolean;
  players: [
    { id: string; seat: 0 | 1; pseudo: string; score: number; active: boolean },
    { id: string; seat: 0 | 1; pseudo: string; score: number; active: boolean },
  ];
  result: SkyjoResultView;
  allowedActions: string[];
};
