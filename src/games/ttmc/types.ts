import { z } from "zod";

export const ttmcQuestionSchema = z.object({
  itemId: z.string().min(1),
  packId: z.string().min(1),
  logicalKey: z.string().min(1),
  themeId: z.string().min(1),
  themeLabel: z.string().min(1).max(120),
  themeDescription: z.string().min(1).max(240),
  level: z.number().int().min(1).max(10),
  prompt: z.string().min(1).max(500),
  canonical: z.string().min(1).max(240),
  aliases: z.array(z.string().max(240)).default([]),
  explanation: z.string().min(1).max(400),
});

export type TtmcQuestion = z.infer<typeof ttmcQuestionSchema>;

export type TtmcContent = {
  packId: string;
  packVersion: number;
  themes: readonly { themeId: string; label: string; shortDescription: string }[];
  questions: readonly TtmcQuestion[];
};

export const questionRefSchema = z.object({
  itemId: z.string().min(1),
  packId: z.string().min(1),
});

export type QuestionRevisionRef = z.infer<typeof questionRefSchema>;

export const contestStateSchema = z.object({
  attemptId: z.string().min(1),
  requesterId: z.string().min(1),
  status: z.enum(["pending", "resolved"]),
  accepted: z.boolean().nullable(),
  requestedAt: z.string().min(1),
  expiresAt: z.string().min(1),
});

export type ContestState = z.infer<typeof contestStateSchema>;

export const pendingAttemptSchema = z.object({
  id: z.string().min(1),
  seat: z.union([z.literal(0), z.literal(1)]),
  questionItemId: z.string().min(1),
  level: z.number().int().min(1).max(10),
  rawAnswer: z.string().max(240),
  normalizedAnswer: z.string().max(240),
  submittedAt: z.string().min(1),
  timeout: z.boolean(),
});

export type PendingAttempt = z.infer<typeof pendingAttemptSchema>;

export const playerCountersSchema = z.object({
  correct: z.number().int().nonnegative(),
  incorrect: z.number().int().nonnegative(),
  timeouts: z.number().int().nonnegative(),
  chosenLevelSum: z.number().int().nonnegative(),
  answeredCount: z.number().int().nonnegative(),
  correctByLevel: z.record(z.string(), z.number().int().nonnegative()),
  attemptsByLevel: z.record(z.string(), z.number().int().nonnegative()),
});

export type PlayerCounters = z.infer<typeof playerCountersSchema>;

export const themeAllocationSchema = z.object({
  themeId: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  byLevel: z.record(
    z.string(),
    z.tuple([questionRefSchema, questionRefSchema]),
  ),
});

export type ThemeAllocation = z.infer<typeof themeAllocationSchema>;

export const turnSummarySchema = z.object({
  seat: z.union([z.literal(0), z.literal(1)]),
  themeId: z.string().min(1),
  themeLabel: z.string().min(1),
  level: z.number().int().min(1).max(10),
  questionItemId: z.string().min(1),
  verdict: z.enum(["accept", "reject"]),
  method: z.string().min(1),
  points: z.number().int().nonnegative(),
  totalAfter: z.number().int().nonnegative(),
});

export type TurnSummary = z.infer<typeof turnSummarySchema>;

export const ttmcStateSchema = z.object({
  schemaVersion: z.literal(1),
  phase: z.enum(["choose_level", "answering", "judging", "reveal", "finished"]),
  round: z.number().int().min(1),
  turnInRound: z.union([z.literal(0), z.literal(1)]),
  firstSeat: z.union([z.literal(0), z.literal(1)]),
  scores: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
  themes: z.array(themeAllocationSchema),
  spareByLevel: z.record(z.string(), z.array(questionRefSchema)),
  chosenLevel: z.number().int().min(1).max(10).nullable(),
  currentQuestionId: z.string().nullable(),
  currentAttempt: pendingAttemptSchema.nullable(),
  pendingVerdict: z.enum(["accept", "reject"]).nullable(),
  pendingMethod: z.string().nullable().default(null),
  pendingFirstTurn: turnSummarySchema.nullable().default(null),
  contest: contestStateSchema.nullable(),
  replacementCount: z.number().int().nonnegative(),
  acknowledgedBy: z.array(z.string()),
  counters: z.tuple([playerCountersSchema, playerCountersSchema]),
  finishedOutcome: z.enum(["win", "draw", "abandoned"]).nullable(),
  finishedReason: z.string().nullable(),
  winnerId: z.string().nullable(),
});

export type TtmcState = z.infer<typeof ttmcStateSchema>;

export const ttmcActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("CHOOSE_LEVEL"), level: z.number().int().min(1).max(10) }).strict(),
  z.object({ type: z.literal("SUBMIT_ANSWER"), answer: z.string().max(240) }).strict(),
  z.object({ type: z.literal("CONTEST"), attemptId: z.string().min(1) }).strict(),
  z
    .object({
      type: z.literal("RESOLVE_CONTEST"),
      attemptId: z.string().min(1),
      accept: z.boolean(),
    })
    .strict(),
  z.object({ type: z.literal("NEXT") }).strict(),
  z.object({ type: z.literal("RESIGN") }).strict(),
]);

export type TtmcAction = z.infer<typeof ttmcActionSchema>;

export type TtmcViewPlayer = {
  id: string;
  seat: 0 | 1;
  pseudo: string;
  score: number;
  active: boolean;
  correct: number;
  incorrect: number;
  timeouts: number;
  averageLevel: number | null;
};

export type TtmcReveal = {
  attemptId: string;
  submittedAnswer: string;
  expectedAnswer: string;
  explanation: string;
  verdict: "accept" | "reject";
  points: number;
  timeout: boolean;
  contestable: boolean;
  contest: {
    status: "pending" | "resolved";
    accepted: boolean | null;
    requesterIsMe: boolean;
    expiresAt: string;
  } | null;
} | null;

export type TtmcResultView = {
  outcome: "win" | "draw" | "abandoned";
  winnerId: string | null;
  reason: string;
  players: [{ id: string; score: number | null }, { id: string; score: number | null }];
} | null;

export type TtmcView = {
  kind: "ttmc";
  stateSchemaVersion: 1;
  phase: TtmcState["phase"];
  round: number;
  maxRounds: number;
  targetScore: number;
  answerSeconds: number;
  themeSelectionSeconds: number;
  mySeat: 0 | 1;
  activeSeat: 0 | 1;
  activePlayerId: string | null;
  theme: { themeId: string; label: string; description: string } | null;
  chosenLevel: number | null;
  lastChanceOfRound: boolean;
  technicalReplacement: boolean;
  question: { prompt: string; level: number; addresseeIsMe: boolean } | null;
  judging: { submitted: boolean; mine: boolean } | null;
  reveal: TtmcReveal;
  acknowledged: boolean;
  players: [TtmcViewPlayer, TtmcViewPlayer];
  result: TtmcResultView;
  allowedActions: string[];
};
