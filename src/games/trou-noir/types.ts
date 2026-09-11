import { z } from "zod";
import { trouNoirCategorySchema } from "@/games/trou-noir/config";

export const quizAnswerTypeSchema = z.enum(["person", "place", "text", "number", "date"]);

export const quizQuestionSchema = z.object({
  itemId: z.string().min(1),
  packId: z.string().min(1),
  logicalKey: z.string().min(1),
  category: trouNoirCategorySchema,
  themeLabel: z.string().min(1).max(120),
  difficulty: z.number().int().min(3).max(6),
  prompt: z.string().min(1).max(500),
  canonical: z.string().min(1).max(240),
  aliases: z.array(z.string().max(240)).default([]),
  answerType: quizAnswerTypeSchema,
  requiredPrecision: z.string().min(1).max(240),
  allowSurnameOnly: z.boolean().default(false),
  allowDescription: z.boolean().default(false),
  numericValue: z.number().finite().optional(),
  numericTolerance: z.number().finite().nonnegative().default(0),
  explanation: z.string().min(1).max(400),
});

export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

export type TrouNoirContent = {
  packId: string;
  packVersion: number;
  questions: readonly QuizQuestion[];
};

export const questionRefSchema = z.object({
  itemId: z.string().min(1),
  packId: z.string().min(1),
});

export type QuestionRevisionRef = z.infer<typeof questionRefSchema>;

export const scheduleEntrySchema = z.object({
  category: trouNoirCategorySchema,
  difficulty: z.number().int().min(3).max(6),
  questions: z.tuple([questionRefSchema, questionRefSchema]),
  replacements: z.tuple([
    z.array(questionRefSchema),
    z.array(questionRefSchema),
  ]),
});

export type ScheduleEntry = z.infer<typeof scheduleEntrySchema>;

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
  rawAnswer: z.string().max(240),
  normalizedAnswer: z.string().max(240),
  submittedAt: z.string().min(1),
  timeout: z.boolean(),
});

export type PendingAttempt = z.infer<typeof pendingAttemptSchema>;

export const perPlayerStatsSchema = z.object({
  correct: z.number().int().nonnegative(),
  incorrect: z.number().int().nonnegative(),
  timeouts: z.number().int().nonnegative(),
  contestsAccepted: z.number().int().nonnegative().default(0),
});

export type PerPlayerStats = z.infer<typeof perPlayerStatsSchema>;

export const pendingRoundEntrySchema = z.object({
  playerId: z.string().min(1),
  questionPrompt: z.string(),
  canonical: z.string(),
  submittedAnswer: z.string(),
  verdict: z.enum(["accept", "reject"]),
  method: z.string().min(1),
  delta: z.union([z.literal(0), z.literal(-10)]),
  reserveAfter: z.number().int().min(0).max(100),
});

export type PendingRoundEntry = z.infer<typeof pendingRoundEntrySchema>;

export const trouNoirStateSchema = z.object({
  schemaVersion: z.literal(1),
  phase: z.enum(["answering", "judging", "reveal", "finished"]),
  round: z.number().int().min(1),
  turnInRound: z.union([z.literal(0), z.literal(1)]),
  firstSeat: z.union([z.literal(0), z.literal(1)]),
  reserves: z.tuple([
    z.number().int().min(0).max(100),
    z.number().int().min(0).max(100),
  ]),
  schedule: z.array(scheduleEntrySchema),
  currentAttempt: pendingAttemptSchema.nullable(),
  pendingVerdict: z.enum(["accept", "reject"]).nullable(),
  pendingMethod: z.string().nullable().default(null),
  pendingRoundEntry: pendingRoundEntrySchema.nullable().default(null),
  contest: contestStateSchema.nullable(),
  replacementCount: z.number().int().nonnegative(),
  consecutiveVoids: z.number().int().nonnegative(),
  acknowledgedBy: z.array(z.string()),
  perPlayer: z.tuple([perPlayerStatsSchema, perPlayerStatsSchema]),
  finishedOutcome: z.enum(["win", "draw", "abandoned"]).nullable(),
  finishedReason: z.string().nullable(),
  winnerId: z.string().nullable(),
});

export type TrouNoirState = z.infer<typeof trouNoirStateSchema>;

export const trouNoirActionSchema = z.discriminatedUnion("type", [
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
  z.object({ type: z.literal("CLAIM_FORFEIT") }).strict(),
]);

export type TrouNoirAction = z.infer<typeof trouNoirActionSchema>;

export type TrouNoirViewPlayer = {
  id: string;
  seat: 0 | 1;
  pseudo: string;
  reserve: number;
  active: boolean;
  correct: number;
  incorrect: number;
  timeouts: number;
};

export type TrouNoirReveal = {
  attemptId: string;
  submittedAnswer: string;
  expectedAnswer: string;
  explanation: string;
  verdict: "accept" | "reject";
  impact: 0 | -10;
  timeout: boolean;
  contestable: boolean;
  contest: {
    status: "pending" | "resolved";
    accepted: boolean | null;
    requesterIsMe: boolean;
    expiresAt: string;
  } | null;
} | null;

export type TrouNoirResultView = {
  outcome: "win" | "draw" | "abandoned";
  winnerId: string | null;
  reason: string;
  players: [{ id: string; score: number | null }, { id: string; score: number | null }];
} | null;

export type TrouNoirView = {
  kind: "trou-noir";
  stateSchemaVersion: 1;
  phase: TrouNoirState["phase"];
  round: number;
  maxRounds: number;
  answerSeconds: number;
  mySeat: 0 | 1;
  activeSeat: 0 | 1;
  activePlayerId: string | null;
  question: {
    prompt: string;
    category: string;
    difficulty: number;
    addresseeIsMe: boolean;
  } | null;
  judging: { submitted: boolean; mine: boolean } | null;
  reveal: TrouNoirReveal;
  acknowledged: boolean;
  players: [TrouNoirViewPlayer, TrouNoirViewPlayer];
  result: TrouNoirResultView;
  allowedActions: string[];
};
