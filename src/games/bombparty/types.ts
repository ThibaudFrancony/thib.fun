import { z } from "zod";
import type { ResultSpec } from "@/games/contracts";

export const bombpartyWordEntrySchema = z.object({
  id: z.string().min(1),
  displayForm: z.string().min(1),
  normalizedForm: z.string().min(2).max(30).regex(/^[a-z]+$/),
});

export type BombpartyWordEntry = z.infer<typeof bombpartyWordEntrySchema>;

/**
 * Contenu résolu côté serveur uniquement : lexique + index séquence→mots.
 * Jamais sérialisé dans l'état du match ni exposé au navigateur.
 */
export const bombpartyContentSchema = z.object({
  packId: z.string().min(1),
  packChecksum: z.string().min(1),
  words: z.array(bombpartyWordEntrySchema),
  bySequence: z.record(z.string(), z.array(z.string())),
});

export type BombpartyContent = z.infer<typeof bombpartyContentSchema>;

export const bombpartyAcceptedWordSchema = z.object({
  playerId: z.string(),
  word: z.string().min(1),
  sequence: z.string().min(2).max(3),
  turn: z.number().int().min(1),
});

export type BombpartyAcceptedWord = z.infer<typeof bombpartyAcceptedWordSchema>;

export const bombpartyStateSchema = z.object({
  schemaVersion: z.literal(1),
  phase: z.enum(["playing", "finished"]),
  activeSeat: z.union([z.literal(0), z.literal(1)]),
  lives: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  turn: z.number().int().min(1),
  validWordsTotal: z.number().int().min(0),
  sequence: z.string().min(2).max(3).regex(/^[a-z]+$/),
  recentSequences: z.array(z.string().min(2).max(3)).max(5),
  usedWords: z.array(z.string().min(2).max(30)).max(1500),
  acceptedWords: z.array(bombpartyAcceptedWordSchema).max(200),
  packId: z.string().min(1),
  packChecksum: z.string().min(1),
  correctCounts: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  timeoutCounts: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  // Statistiques de réponse par siège (ordre des sièges 0/1) : la moyenne et
  // la longueur maximale sont individuelles, pas partagées entre joueurs.
  sumResponseMs: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  responseCount: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  longestWordLength: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  turnStartedAt: z.string().min(1),
  finishedOutcome: z.enum(["win", "draw", "abandoned"]).nullable(),
  finishedReason: z.string().nullable(),
  winnerId: z.string().nullable(),
});

export type BombpartyState = z.infer<typeof bombpartyStateSchema>;

export const bombpartyActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SUBMIT_WORD"), word: z.string().min(1).max(60) }).strict(),
  z.object({ type: z.literal("RESIGN") }).strict(),
]);

export type BombpartyAction = z.infer<typeof bombpartyActionSchema>;

export type BombpartyResultView = {
  outcome: ResultSpec["outcome"];
  winnerId: string | null;
  reason: string;
  players: [{ id: string; score: number | null }, { id: string; score: number | null }];
} | null;

export type BombpartyView = {
  kind: "bombparty";
  stateSchemaVersion: 1;
  phase: BombpartyState["phase"];
  turn: number;
  maxTurns: number;
  turnSeconds: number;
  initialSeconds: number;
  sequenceDifficulty: "easy" | "normal" | "hard";
  mySeat: 0 | 1;
  activeSeat: 0 | 1;
  activePlayerId: string | null;
  sequence: string;
  lives: [number, number];
  scores: [number, number];
  timeouts: [number, number];
  validWordsTotal: number;
  acceptedWords: BombpartyAcceptedWord[];
  recentWords: BombpartyAcceptedWord[];
  longestWordLength: number;
  meanAcceptedResponseMs: number | null;
  players: [
    { id: string; seat: 0 | 1; pseudo: string; score: number; lives: number; active: boolean },
    { id: string; seat: 0 | 1; pseudo: string; score: number; lives: number; active: boolean },
  ];
  result: BombpartyResultView;
  allowedActions: string[];
};
