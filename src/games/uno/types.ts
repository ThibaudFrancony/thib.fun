import { z } from "zod";
import type { ResultSpec } from "@/games/contracts";

export const unoColorSchema = z.enum(["red", "yellow", "green", "blue"]);
export type UnoColor = z.infer<typeof unoColorSchema>;

export const unoSymbolSchema = z.enum([
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "skip", "reverse", "draw2", "wild", "wild4",
]);
export type UnoSymbol = z.infer<typeof unoSymbolSchema>;

export const unoCardSchema = z.object({
  id: z.string().min(1),
  color: unoColorSchema.nullable(),
  symbol: unoSymbolSchema,
}).superRefine((card, context) => {
  const isWild = card.symbol === "wild" || card.symbol === "wild4";
  if (isWild !== (card.color === null)) {
    context.addIssue({ code: "custom", path: ["color"], message: "La couleur d'une carte UNO ne correspond pas à son symbole." });
  }
});

export type UnoCard = z.infer<typeof unoCardSchema>;

export const unoCountersSchema = z.object({
  cardsPlayed: z.number().int().nonnegative(),
  cardsDrawn: z.number().int().nonnegative(),
  penaltyCardsTaken: z.number().int().nonnegative(),
  missedAnnouncements: z.number().int().nonnegative(),
  turns: z.number().int().nonnegative(),
});

export type UnoCounters = z.infer<typeof unoCountersSchema>;

export const unoPendingPenaltySchema = z.object({
  symbol: z.enum(["draw2", "wild4"]),
  count: z.number().int().min(2),
});

export type UnoPendingPenalty = z.infer<typeof unoPendingPenaltySchema>;

export const unoStateSchema = z.object({
  schemaVersion: z.literal(1),
  phase: z.enum(["playing", "after_draw", "finished"]),
  activeSeat: z.union([z.literal(0), z.literal(1)]),
  hands: z.tuple([z.array(unoCardSchema), z.array(unoCardSchema)]),
  drawPile: z.array(unoCardSchema),
  discardPile: z.array(unoCardSchema).min(1),
  activeColor: unoColorSchema,
  drawnCardId: z.string().nullable(),
  /** Cumul de pénalité en attente (règles uno-2). Absent = aucune attente (parties uno-1). */
  pendingPenalty: unoPendingPenaltySchema.nullable().optional(),
  turns: z.number().int().min(0).max(300),
  blockedTurns: z.number().int().min(0).max(2),
  counters: z.tuple([unoCountersSchema, unoCountersSchema]),
  finishedOutcome: z.enum(["win", "draw", "abandoned"]).nullable(),
  finishedReason: z.string().nullable(),
  winnerId: z.string().nullable(),
});

export type UnoState = z.infer<typeof unoStateSchema>;

export const unoActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("PLAY_CARD"),
    cardId: z.string().min(1),
    chosenColor: unoColorSchema.optional(),
    /** Historique : accepté pour compatibilité mais ignoré (plus d'annonce obligatoire). */
    announceLastCard: z.boolean().optional(),
  }).strict(),
  z.object({ type: z.literal("DRAW") }).strict(),
  z.object({
    type: z.literal("PLAY_DRAWN"),
    chosenColor: unoColorSchema.optional(),
    /** Historique : accepté pour compatibilité mais ignoré (plus d'annonce obligatoire). */
    announceLastCard: z.boolean().optional(),
  }).strict(),
  z.object({ type: z.literal("KEEP_DRAWN") }).strict(),
  z.object({ type: z.literal("RESIGN") }).strict(),
]);

export type UnoAction = z.infer<typeof unoActionSchema>;

export type UnoCardView = UnoCard;

export type UnoPlayerView = {
  id: string;
  seat: 0 | 1;
  pseudo: string;
  cardCount: number;
  score: number;
  active: boolean;
};

export type UnoView = {
  kind: "uno";
  stateSchemaVersion: 1;
  phase: UnoState["phase"];
  mySeat: 0 | 1;
  activeSeat: 0 | 1;
  turnSeconds: 20 | 30 | 60;
  activeColor: UnoColor;
  topCard: UnoCardView;
  drawPileCount: number;
  hand: UnoCardView[];
  opponentHand: UnoCardView[] | null;
  drawnCard: UnoCardView | null;
  /**
   * Fenêtre de pioche, exposée au seul joueur actif (décision du 19/09/2026)
   * pour révéler la carte piochée à la fin de l'animation et animer les
   * prises de pénalité en bloc. `[]` pour l'autre joueur, hors phase
   * `playing`, ou quand la pioche est vide (le sommet serait remélangé au
   * moment du tirage). Champ optionnel pour relire les vues persistées.
   */
  nextDrawCards?: UnoCardView[];
  /**
   * Ancien champ mono-carte conservé pour les clients déjà chargés ; `null`
   * pendant une pénalité en attente (prise en bloc). Les nouveaux clients
   * utilisent `nextDrawCards`.
   */
  nextDrawCard?: UnoCardView | null;
  /** La prochaine carte serait jouable après pioche (calcul serveur). */
  nextDrawPlayable?: boolean;
  playableCardIds: string[];
  pendingPenalty: UnoPendingPenalty | null;
  players: [UnoPlayerView, UnoPlayerView];
  turns: number;
  counters: UnoCounters;
  actions: {
    canDraw: boolean;
    canPlay: boolean;
    canPlayDrawn: boolean;
    canKeepDrawn: boolean;
    canResign: boolean;
  };
  result: UnoResultView | null;
};

/** Taille de la fenêtre de pioche exposée au joueur actif (décision du 19/09/2026). */
export const UNO_DRAW_PREVIEW_LIMIT = 8;

export type UnoResultView = {
  outcome: ResultSpec["outcome"];
  winnerId: string | null;
  reason: string;
  players: [{ id: string; score: number | null }, { id: string; score: number | null }];
};
