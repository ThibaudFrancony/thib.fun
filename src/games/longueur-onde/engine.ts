import type { EngineContext, JobSpec, ResultSpec, RoundRecord, Seat } from "@/games/contracts";
import {
  LONGUEUR_ONDE_RESERVE_COUNT,
  LONGUEUR_ONDE_REVEAL_SECONDS,
  longueurOndeConfigSchema,
  type LongueurOndeConfig,
} from "@/games/longueur-onde/config";
import {
  longueurOndeActionSchema,
  longueurOndeStateSchema,
  type LongueurOndeAction,
  type LongueurOndeAxis,
  type LongueurOndeContent,
  type LongueurOndeState,
} from "@/games/longueur-onde/types";

export const LONGUEUR_ONDE_RULES_VERSION = "longueur-onde-1";
export const LONGUEUR_ONDE_ENGINE_VERSION = "longueur-onde-engine-1";

export type LongueurOndeEngineContext = EngineContext<LongueurOndeContent>;

export type LongueurOndeTransition = {
  state: LongueurOndeState;
  phaseId: string;
  deadlineAt: string | null;
  deadlineKind: string | null;
  jobs: JobSpec[];
  roundRecords: RoundRecord[];
  result: ResultSpec | null;
  event: { type: string; payload: Record<string, unknown> };
};

export class LongueurOndeRuleError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "LongueurOndeRuleError";
    this.code = code;
  }
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function seatForActor(ctx: LongueurOndeEngineContext): Seat {
  const seat = ctx.participants.indexOf(ctx.actorId ?? "");
  if (seat !== 0 && seat !== 1) throw new LongueurOndeRuleError("NOT_A_PARTICIPANT");
  return seat;
}

function entropyUnit(entropy: readonly number[], index: number): number {
  const value = entropy[index];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value >= 1) {
    throw new LongueurOndeRuleError("INVALID_ENTROPY");
  }
  return value;
}

function shuffled<T>(items: readonly T[], entropy: readonly number[], offset: number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const random = entropyUnit(entropy, offset + result.length - 1 - index);
    const swap = Math.floor(random * (index + 1));
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
}

function axisById(content: LongueurOndeContent, axisId: string): LongueurOndeAxis {
  const axis = content.axes.find((candidate) => candidate.itemId === axisId);
  if (!axis) throw new LongueurOndeRuleError("AXIS_NOT_IN_PACK");
  return axis;
}

function deadlineJob(ctx: LongueurOndeEngineContext, kind: string, phaseId: string, runAt: string): JobSpec {
  return {
    kind,
    phaseId,
    runAt,
    dedupeKey: `${ctx.matchId}:${phaseId}:${kind}`,
    payload: { matchId: ctx.matchId, phaseId, kind },
  };
}

function transition(
  ctx: LongueurOndeEngineContext,
  state: LongueurOndeState,
  options: {
    phaseId?: string;
    deadlineAt: string | null;
    deadlineKind: string | null;
    jobs?: JobSpec[];
    roundRecords?: RoundRecord[];
    result?: ResultSpec | null;
    eventType: string;
    eventPayload?: Record<string, unknown>;
  },
): LongueurOndeTransition {
  return {
    state,
    phaseId: options.phaseId ?? ctx.phaseId,
    deadlineAt: options.deadlineAt,
    deadlineKind: options.deadlineKind,
    jobs: options.jobs ?? [],
    roundRecords: options.roundRecords ?? [],
    result: options.result ?? null,
    event: { type: options.eventType, payload: options.eventPayload ?? {} },
  };
}

export function pointsForError(error: number | null): number {
  if (error === null) return 0;
  if (error <= 4) return 4;
  if (error <= 9) return 3;
  if (error <= 14) return 2;
  return 0;
}

function normalizeClue(input: string): string {
  if (input.includes("\n") || input.includes("\r")) throw new LongueurOndeRuleError("INVALID_CLUE");
  const clue = input.replace(/\s+/g, " ").trim();
  if (!clue || clue.length > 120 || /[0-9]/.test(clue) || /(?:https?:\/\/|www\.)/i.test(clue)) {
    throw new LongueurOndeRuleError("INVALID_CLUE");
  }
  return clue;
}

function metricsFor(state: LongueurOndeState, seat: Seat): Record<string, unknown> {
  const rounds = state.rounds;
  const clueRounds = rounds.filter((round) => round.clueSeat === seat);
  const guessRounds = rounds.filter((round) => round.guessSeat === seat);
  const errors = guessRounds.flatMap((round) => (round.error === null ? [] : [round.error]));
  return {
    cluesGiven: clueRounds.filter((round) => round.clue !== null).length,
    guessesMade: guessRounds.filter((round) => round.guess !== null).length,
    missedClues: clueRounds.filter((round) => round.missedReason === "clue_timeout").length,
    missedGuesses: guessRounds.filter((round) => round.missedReason === "guess_timeout").length,
    guessErrorSum: errors.reduce((sum, error) => sum + error, 0),
    guessCount: errors.length,
  };
}

function resultFor(state: LongueurOndeState, ctx: LongueurOndeEngineContext, config: LongueurOndeConfig): ResultSpec {
  const normal = state.finishedReason === "normal";
  const sharedScore = normal ? state.total : null;
  return {
    kind: "cooperative",
    outcome: normal ? "cooperative" : "abandoned",
    winnerId: null,
    reason: state.finishedReason ?? "absence",
    sharedScore,
    players: [
      { userId: ctx.participants[0], score: null, metrics: metricsFor(state, 0) },
      { userId: ctx.participants[1], score: null, metrics: metricsFor(state, 1) },
    ],
    summary: {
      total: state.total,
      maxTotal: config.rounds * 4,
      percentage: normal ? Math.round((100 * state.total) / (config.rounds * 4)) : null,
      missed: state.missed,
      averageError: averageError(state.rounds),
    },
  };
}

function averageError(rounds: readonly LongueurOndeState["rounds"][number][]): number | null {
  const errors = rounds.flatMap((round) => (round.error === null ? [] : [round.error]));
  return errors.length === 0 ? null : Math.round(errors.reduce((sum, error) => sum + error, 0) / errors.length);
}

function roundRecord(state: LongueurOndeState, axis: LongueurOndeAxis, completedAt: string): RoundRecord {
  return {
    roundNo: state.round,
    completedAt,
    summary: {
      axisId: axis.itemId,
      leftLabel: axis.leftLabel,
      rightLabel: axis.rightLabel,
      clueSeat: state.clueSeat,
      guessSeat: (1 - state.clueSeat) as Seat,
      clue: state.clue,
      target: state.target,
      guess: state.guess,
      error: state.lastError,
      points: state.lastPoints,
      missedReason: state.missedReason,
    },
  };
}

function nextRound(
  ctx: LongueurOndeEngineContext,
  state: LongueurOndeState,
  config: LongueurOndeConfig,
  content: LongueurOndeContent,
  eventType: string,
): LongueurOndeTransition {
  const nextAxisId = state.axisIds[state.round];
  if (!nextAxisId) throw new LongueurOndeRuleError("CONTENT_UNAVAILABLE");
  const nextClueSeat = (1 - state.clueSeat) as Seat;
  const next: LongueurOndeState = {
    ...state,
    phase: "clue",
    round: state.round + 1,
    clueSeat: nextClueSeat,
    axisId: nextAxisId,
    target: Math.floor(entropyUnit(ctx.entropy, 0) * 101),
    clue: null,
    guess: null,
    lastPoints: 0,
    lastError: null,
    missedReason: null,
    acknowledgedBy: [],
    finishedReason: null,
  };
  const deadlineAt = iso(ctx.nowMs + config.clueSeconds * 1000);
  return transition(ctx, next, {
    phaseId: ctx.nextPhaseId,
    deadlineAt,
    deadlineKind: "clue_timeout",
    jobs: [deadlineJob(ctx, "clue_timeout", ctx.nextPhaseId, deadlineAt)],
    eventType,
    eventPayload: { round: next.round, clueSeat: nextClueSeat },
  });
}

function revealTransition(
  ctx: LongueurOndeEngineContext,
  state: LongueurOndeState,
  eventType: string,
): LongueurOndeTransition {
  const deadlineAt = iso(ctx.nowMs + LONGUEUR_ONDE_REVEAL_SECONDS * 1000);
  return transition(ctx, { ...state, phase: "reveal" }, {
    phaseId: ctx.nextPhaseId,
    deadlineAt,
    deadlineKind: "advance_reveal",
    jobs: [deadlineJob(ctx, "advance_reveal", ctx.nextPhaseId, deadlineAt)],
    eventType,
    eventPayload: { round: state.round },
  });
}

function closeReveal(
  ctx: LongueurOndeEngineContext,
  state: LongueurOndeState,
  config: LongueurOndeConfig,
  content: LongueurOndeContent,
  eventType: string,
): LongueurOndeTransition {
  const axis = axisById(content, state.axisId);
  const completedAt = iso(ctx.nowMs);
  const error = state.guess === null ? null : Math.abs(state.target - state.guess);
  const points = pointsForError(error);
  const completedRound: LongueurOndeState["rounds"][number] = {
    round: state.round,
    axisId: axis.itemId,
    leftLabel: axis.leftLabel,
    rightLabel: axis.rightLabel,
    clueSeat: state.clueSeat,
    guessSeat: (1 - state.clueSeat) as Seat,
    clue: state.clue,
    target: state.target,
    guess: state.guess,
    error,
    points,
    missedReason: state.missedReason,
  };
  const nextState: LongueurOndeState = {
    ...state,
    rounds: [...state.rounds, completedRound],
    total: state.total + points,
    lastPoints: points,
    lastError: error,
    acknowledgedBy: [],
  };
  const record = roundRecord({ ...nextState, lastPoints: points, lastError: error }, axis, completedAt);
  if (state.round >= config.rounds) {
    const finished: LongueurOndeState = { ...nextState, phase: "finished", finishedReason: "normal" };
    return transition(ctx, finished, {
      phaseId: ctx.nextPhaseId,
      deadlineAt: null,
      deadlineKind: null,
      roundRecords: [record],
      result: resultFor(finished, ctx, config),
      eventType: "MATCH_FINISHED",
      eventPayload: { round: state.round, points, total: finished.total },
    });
  }
  return nextRound(ctx, nextState, config, content, eventType);
}

function abandon(
  ctx: LongueurOndeEngineContext,
  state: LongueurOndeState,
  config: LongueurOndeConfig,
  reason: "resign" | "claimed_forfeit" | "absence",
): LongueurOndeTransition {
  const finished = { ...state, phase: "finished" as const, finishedReason: reason, acknowledgedBy: [] };
  return transition(ctx, finished, {
    phaseId: ctx.nextPhaseId,
    deadlineAt: null,
    deadlineKind: null,
    result: resultFor(finished, ctx, config),
    eventType: reason === "absence" ? "MATCH_ABANDONED" : reason === "resign" ? "PLAYER_RESIGNED" : "FORFEIT_CLAIMED",
    eventPayload: { reason, actorId: ctx.actorId },
  });
}

export function initializeLongueurOnde(
  configInput: unknown,
  ctx: LongueurOndeEngineContext,
): LongueurOndeTransition {
  const config = longueurOndeConfigSchema.parse(configInput);
  if (ctx.content.axes.length < config.rounds + LONGUEUR_ONDE_RESERVE_COUNT) {
    throw new LongueurOndeRuleError("CONTENT_UNAVAILABLE");
  }
  const axisIds = shuffled(ctx.content.axes.map((axis) => axis.itemId), ctx.entropy, 3).slice(0, config.rounds + LONGUEUR_ONDE_RESERVE_COUNT);
  const clueSeat = Math.floor(entropyUnit(ctx.entropy, 1) * 2) as Seat;
  const state: LongueurOndeState = {
    schemaVersion: 1,
    phase: "clue",
    round: 1,
    firstClueSeat: clueSeat,
    clueSeat,
    axisIds,
    axisId: axisIds[0]!,
    target: Math.floor(entropyUnit(ctx.entropy, 0) * 101),
    clue: null,
    guess: null,
    total: 0,
    lastPoints: 0,
    lastError: null,
    missed: 0,
    missedReason: null,
    finishedReason: null,
    acknowledgedBy: [],
    rounds: [],
  };
  const deadlineAt = iso(ctx.nowMs + config.clueSeconds * 1000);
  return transition(ctx, state, {
    phaseId: ctx.phaseId,
    deadlineAt,
    deadlineKind: "clue_timeout",
    jobs: [deadlineJob(ctx, "clue_timeout", ctx.phaseId, deadlineAt)],
    eventType: "MATCH_STARTED",
    eventPayload: { rounds: config.rounds, clueSeat },
  });
}

export function reduceLongueurOnde(
  stateInput: unknown,
  actionInput: unknown,
  configInput: unknown,
  ctx: LongueurOndeEngineContext,
): LongueurOndeTransition {
  const state = longueurOndeStateSchema.parse(stateInput);
  const action = longueurOndeActionSchema.parse(actionInput) as LongueurOndeAction;
  const config = longueurOndeConfigSchema.parse(configInput);
  const seat = seatForActor(ctx);
  if (state.phase === "finished") throw new LongueurOndeRuleError("MATCH_FINISHED");
  if (action.type === "RESIGN") return abandon(ctx, state, config, "resign");
  if (action.type === "CLAIM_FORFEIT") return abandon(ctx, state, config, "claimed_forfeit");

  if (action.type === "SUBMIT_CLUE") {
    if (state.phase !== "clue") throw new LongueurOndeRuleError("WRONG_PHASE");
    if (seat !== state.clueSeat) throw new LongueurOndeRuleError("NOT_YOUR_TURN");
    if (state.clue !== null) throw new LongueurOndeRuleError("ALREADY_SUBMITTED");
    const clue = normalizeClue(action.clue);
    const next: LongueurOndeState = { ...state, phase: "guessing", clue };
    const deadlineAt = iso(ctx.nowMs + config.guessSeconds * 1000);
    return transition(ctx, next, {
      phaseId: ctx.nextPhaseId,
      deadlineAt,
      deadlineKind: "guess_timeout",
      jobs: [deadlineJob(ctx, "guess_timeout", ctx.nextPhaseId, deadlineAt)],
      eventType: "CLUE_SUBMITTED",
      eventPayload: { round: state.round },
    });
  }

  if (action.type === "SUBMIT_GUESS") {
    if (state.phase !== "guessing") throw new LongueurOndeRuleError("WRONG_PHASE");
    if (seat === state.clueSeat) throw new LongueurOndeRuleError("NOT_YOUR_TURN");
    if (state.guess !== null) throw new LongueurOndeRuleError("ALREADY_SUBMITTED");
    return revealTransition(ctx, { ...state, guess: action.position }, "GUESS_SUBMITTED");
  }

  if (state.phase !== "reveal") throw new LongueurOndeRuleError("WRONG_PHASE");
  if (state.acknowledgedBy.includes(ctx.actorId ?? "")) throw new LongueurOndeRuleError("ALREADY_ACKNOWLEDGED");
  const acknowledgedBy = [...state.acknowledgedBy, ctx.actorId ?? ""];
  if (acknowledgedBy.length < 2) {
    return transition(ctx, { ...state, acknowledgedBy }, {
      deadlineAt: ctx.currentDeadlineAt ?? null,
      deadlineKind: ctx.currentDeadlineKind ?? "advance_reveal",
      eventType: "REVEAL_ACKNOWLEDGED",
      eventPayload: { seat },
    });
  }
  return closeReveal(ctx, { ...state, acknowledgedBy }, config, ctx.content, "REVEAL_CLOSED");
}

export function onLongueurOndeDeadline(
  stateInput: unknown,
  kind: string,
  configInput: unknown,
  ctx: LongueurOndeEngineContext,
): LongueurOndeTransition {
  const state = longueurOndeStateSchema.parse(stateInput);
  const config = longueurOndeConfigSchema.parse(configInput);
  if (state.phase === "finished") throw new LongueurOndeRuleError("MATCH_FINISHED");
  if (state.phase === "clue" && kind === "clue_timeout") {
    return revealTransition(ctx, { ...state, missed: state.missed + 1, missedReason: "clue_timeout", clue: null, guess: null }, "CLUE_TIMED_OUT");
  }
  if (state.phase === "guessing" && kind === "guess_timeout") {
    return revealTransition(ctx, { ...state, missed: state.missed + 1, missedReason: "guess_timeout", guess: null }, "GUESS_TIMED_OUT");
  }
  if (state.phase === "reveal" && kind === "advance_reveal") {
    return closeReveal(ctx, state, config, ctx.content, "REVEAL_TIMED_OUT");
  }
  throw new LongueurOndeRuleError("STALE_DEADLINE");
}

export function shouldAbandonForLongueurOndeAbsence(lastSeenAt: readonly [string, string], nowMs: number): boolean {
  const ages = lastSeenAt.map((value) => nowMs - Date.parse(value));
  return ages.every((age) => age >= 120_000) || ages.some((age) => age >= 180_000);
}

export function onLongueurOndeAbsence(
  stateInput: unknown,
  configInput: unknown,
  ctx: LongueurOndeEngineContext,
): LongueurOndeTransition {
  const state = longueurOndeStateSchema.parse(stateInput);
  const config = longueurOndeConfigSchema.parse(configInput);
  if (state.phase === "finished") throw new LongueurOndeRuleError("MATCH_FINISHED");
  return abandon(ctx, state, config, "absence");
}

export function isLongueurOndeDeadlineJobStale(jobPhaseId: string | null | undefined, currentPhaseId: string): boolean {
  return Boolean(jobPhaseId && jobPhaseId !== currentPhaseId);
}
