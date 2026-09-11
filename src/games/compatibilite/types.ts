import { z } from "zod";
import type { CompatibilityCategory } from "@/games/compatibilite/config";

export const compatibilityOptionSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/),
    label: z.string().min(1).max(80),
  })
  .strict();

export const compatibilityQuestionSchema = z
  .object({
    itemId: z.string().min(1),
    packId: z.string().min(1),
    logicalKey: z.string().min(1),
    category: z.enum(["quotidien", "absurde", "amitie", "couple"]),
    prompt: z.string().min(1).max(240),
    options: z.array(compatibilityOptionSchema).min(2).max(4),
    sensitivity: z.enum(["light", "personal"]),
    explanation: z.string().max(240).optional(),
  })
  .strict()
  .superRefine((question, ctx) => {
    const ids = question.options.map((option) => option.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Les IDs d'options doivent être uniques." });
    }
    if (question.category !== "couple" && question.sensitivity === "personal") {
      ctx.addIssue({ code: "custom", path: ["sensitivity"], message: "Une question personnelle est réservée à la catégorie couple." });
    }
  });

export type CompatibilityQuestion = z.infer<typeof compatibilityQuestionSchema>;

export const compatibilityContentSchema = z
  .object({
    packId: z.string().min(1),
    packVersion: z.number().int().positive(),
    questions: z.array(compatibilityQuestionSchema).min(1),
  })
  .strict();

export type CompatibilityContent = z.infer<typeof compatibilityContentSchema>;

const nullableChoiceSchema = z.string().min(1).nullable();

export const compatibilityRoundSchema = z
  .object({
    questionId: z.string().min(1),
    prompt: z.string().min(1).max(240),
    options: z.array(compatibilityOptionSchema).min(2).max(4),
    choices: z.tuple([z.string().min(1), z.string().min(1)]),
    isMatch: z.boolean(),
  })
  .strict();

export type CompatibilityRound = z.infer<typeof compatibilityRoundSchema>;

export const compatibiliteStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    phase: z.enum(["answering", "reveal", "finished"]),
    questionIndex: z.number().int().nonnegative(),
    questionIds: z.array(z.string().min(1)).min(1),
    reserveIds: z.array(z.string().min(1)),
    currentQuestionId: z.string().min(1),
    choices: z.tuple([nullableChoiceSchema, nullableChoiceSchema]),
    submitted: z.tuple([z.boolean(), z.boolean()]),
    matches: z.number().int().nonnegative(),
    compared: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    acknowledgedBy: z.array(z.string().min(1)),
    finishedReason: z.enum(["normal", "resign", "claimed_forfeit", "absence"]).nullable(),
    rounds: z.array(compatibilityRoundSchema),
  })
  .strict();

export type CompatibiliteState = z.infer<typeof compatibiliteStateSchema>;

export const compatibiliteActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SUBMIT_CHOICE"), optionId: z.string().min(1).max(32) }).strict(),
  z.object({ type: z.literal("SKIP_QUESTION") }).strict(),
  z.object({ type: z.literal("NEXT") }).strict(),
  z.object({ type: z.literal("RESIGN") }).strict(),
  z.object({ type: z.literal("CLAIM_FORFEIT") }).strict(),
]);

export type CompatibiliteAction = z.infer<typeof compatibiliteActionSchema>;

export type CompatibilityViewPlayer = {
  id: string;
  seat: 0 | 1;
  pseudo: string;
  submitted: boolean;
};

export type CompatibiliteResultView = {
  outcome: "cooperative" | "abandoned";
  reason: string;
  winnerId: null;
  matches: number;
  compared: number;
  skipped: number;
  sharedScore: number | null;
  rounds: CompatibilityRound[];
} | null;

export type CompatibiliteView = {
  kind: "compatibilite";
  stateSchemaVersion: 1;
  phase: CompatibiliteState["phase"];
  category: CompatibilityCategory;
  mySeat: 0 | 1;
  questionIndex: number;
  questionCount: number;
  question: { itemId: string; prompt: string; options: CompatibilityQuestion["options"] } | null;
  myChoice: string | null;
  mySubmitted: boolean;
  opponentSubmitted: boolean;
  opponentChoice: string | null;
  matches: number;
  compared: number;
  skipped: number;
  skipsRemaining: number;
  sharedScore: number | null;
  players: [CompatibilityViewPlayer, CompatibilityViewPlayer];
  result: CompatibiliteResultView;
  allowedActions: string[];
};
