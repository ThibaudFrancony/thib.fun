export type Seat = 0 | 1;

export type Participants = readonly [string, string];

export type EngineContext<Content> = {
  nowMs: number;
  actorId: string | null;
  matchId: string;
  participants: Participants;
  content: Content;
  entropy: readonly number[];
  phaseId: string;
  nextPhaseId: string;
  currentDeadlineAt?: string | null;
  currentDeadlineKind?: string | null;
};

export type DeadlineSpec = {
  kind: string;
  phaseId: string;
  at: string;
  blocking: boolean;
};

export type JobSpec = {
  kind: string;
  phaseId: string | null;
  runAt: string;
  dedupeKey: string;
  payload: Record<string, unknown>;
};

export type RoundRecord = {
  roundNo: number;
  summary: Record<string, unknown>;
  completedAt: string;
};

export type ResultReason =
  | "normal"
  | "round_limit"
  | "turn_limit"
  | "blocked"
  | "dictionary_exhausted"
  | "resign"
  | "claimed_forfeit"
  | "absence"
  | "judging_unavailable"
  | "technical_error";

export type ResultSpec = {
  kind: "competitive" | "cooperative";
  outcome: "win" | "draw" | "cooperative" | "abandoned";
  winnerId: string | null;
  reason: ResultReason;
  sharedScore: number | null;
  players: [
    { userId: string; score: number | null; metrics: Record<string, unknown> },
    { userId: string; score: number | null; metrics: Record<string, unknown> },
  ];
  summary: Record<string, unknown>;
};
