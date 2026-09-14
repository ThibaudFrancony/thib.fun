import type { EngineContext, JobSpec, ResultSpec, RoundRecord, Seat } from "@/games/contracts";
import {
  COMPATIBILITE_MAX_SKIPS,
  COMPATIBILITE_RESERVE_COUNT,
  COMPATIBILITE_REVEAL_SECONDS,
  compatibiliteConfigSchema,
  type CompatibiliteConfig,
} from "@/games/compatibilite/config";
import {
  compatibiliteActionSchema,
  compatibiliteStateSchema,
  type CompatibilityContent,
  type CompatibilityQuestion,
  type CompatibiliteAction,
  type CompatibiliteState,
} from "@/games/compatibilite/types";

export const COMPATIBILITE_RULES_VERSION = "compatibilite-1";
export const COMPATIBILITE_ENGINE_VERSION = "compatibilite-engine-1";

export type CompatibiliteEngineContext = EngineContext<CompatibilityContent>;

export type CompatibiliteTransition = {
  state: CompatibiliteState;
  phaseId: string;
  deadlineAt: string | null;
  deadlineKind: string | null;
  jobs: JobSpec[];
  roundRecords: RoundRecord[];
  result: ResultSpec | null;
  event: { type: string; payload: Record<string, unknown> };
};

export class CompatibiliteRuleError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "CompatibiliteRuleError";
    this.code = code;
  }
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function seatForActor(ctx: CompatibiliteEngineContext): Seat {
  const seat = ctx.participants.indexOf(ctx.actorId ?? "");
  if (seat !== 0 && seat !== 1) throw new CompatibiliteRuleError("NOT_A_PARTICIPANT");
  return seat;
}

function randomUnit(entropy: readonly number[], index: number): number {
  const value = entropy[index];
  if (value === undefined || !Number.isFinite(value) || value < 0 || value >= 1) throw new CompatibiliteRuleError("INVALID_ENTROPY");
  return value;
}

function shuffled<T>(items: readonly T[], entropy: readonly number[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(randomUnit(entropy, result.length - index - 1) * (index + 1));
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
}

function questionById(content: CompatibilityContent, itemId: string): CompatibilityQuestion {
  const question = content.questions.find((item) => item.itemId === itemId);
  if (!question) throw new CompatibiliteRuleError("QUESTION_NOT_IN_PACK");
  return question;
}

function currentQuestion(state: CompatibiliteState, content: CompatibilityContent): CompatibilityQuestion {
  return questionById(content, state.currentQuestionId);
}

function deadlineJob(ctx: CompatibiliteEngineContext, phaseId: string, runAt: string): JobSpec {
  return {
    kind: "advance_reveal",
    phaseId,
    runAt,
    dedupeKey: `${ctx.matchId}:${phaseId}:advance_reveal`,
    payload: { matchId: ctx.matchId, phaseId, kind: "advance_reveal" },
  };
}

function transition(
  ctx: CompatibiliteEngineContext,
  state: CompatibiliteState,
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
): CompatibiliteTransition {
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

function sharedScore(matches: number, compared: number): number | null {
  return compared === 0 ? null : Math.round((100 * matches) / compared);
}

function resultFor(
  state: CompatibiliteState,
  ctx: CompatibiliteEngineContext,
  config: CompatibiliteConfig,
): ResultSpec {
  const normal = state.finishedReason === "normal";
  const score = normal ? sharedScore(state.matches, state.compared) : null;
  const metrics = (seat: Seat): Record<string, unknown> => ({
    agreements: state.matches,
    compared: state.compared,
    skipped: state.skipped,
    category: config.category,
    seat,
  });
  return {
    kind: "cooperative",
    outcome: normal ? "cooperative" : "abandoned",
    winnerId: null,
    reason: state.finishedReason ?? "absence",
    sharedScore: score,
    players: [
      { userId: ctx.participants[0], score: null, metrics: metrics(0) },
      { userId: ctx.participants[1], score: null, metrics: metrics(1) },
    ],
    summary: {
      category: config.category,
      matches: state.matches,
      compared: state.compared,
      skipped: state.skipped,
      sharedScore: score,
    },
  };
}

function finishedState(state: CompatibiliteState, reason: CompatibiliteState["finishedReason"]): CompatibiliteState {
  return { ...state, phase: "finished", finishedReason: reason, acknowledgedBy: [] };
}

function revealTransition(ctx: CompatibiliteEngineContext, state: CompatibiliteState): CompatibiliteTransition {
  const phaseId = ctx.nextPhaseId;
  const deadlineAt = iso(ctx.nowMs + COMPATIBILITE_REVEAL_SECONDS * 1000);
  return transition(ctx, state, {
    phaseId,
    deadlineAt,
    deadlineKind: "advance_reveal",
    jobs: [deadlineJob(ctx, phaseId, deadlineAt)],
    eventType: "CHOICES_REVEALED",
    eventPayload: { questionIndex: state.questionIndex },
  });
}

function roundRecord(
  state: CompatibiliteState,
  question: CompatibilityQuestion,
  completedAt: string,
): RoundRecord {
  return {
    roundNo: state.compared + 1,
    completedAt,
    summary: {
      questionId: question.itemId,
      logicalKey: question.logicalKey,
      category: question.category,
      prompt: question.prompt,
      options: question.options,
      choices: state.choices,
      isMatch: state.choices[0] !== null && state.choices[0] === state.choices[1],
    },
  };
}

function closeReveal(
  ctx: CompatibiliteEngineContext,
  state: CompatibiliteState,
  config: CompatibiliteConfig,
  content: CompatibilityContent,
  eventType: string,
): CompatibiliteTransition {
  const question = currentQuestion(state, content);
  if (state.choices[0] === null || state.choices[1] === null) {
    throw new CompatibiliteRuleError("INCOMPLETE_REVEAL");
  }
  const matched = state.choices[0] === state.choices[1];
  const nextCompared = state.compared + 1;
  const nextMatches = state.matches + (matched ? 1 : 0);
  const choices: [string, string] = [state.choices[0], state.choices[1]];
  const nextRounds = [
    ...state.rounds,
    {
      questionId: question.itemId,
      prompt: question.prompt,
      options: question.options,
      choices,
      isMatch: matched,
    },
  ];
  const base: CompatibiliteState = {
    ...state,
    rounds: nextRounds,
    compared: nextCompared,
    matches: nextMatches,
    acknowledgedBy: [],
  };
  if (nextCompared >= config.questionCount) {
    const finished = finishedState(base, "normal");
    const result = resultFor(finished, ctx, config);
    return transition(ctx, finished, {
      phaseId: ctx.nextPhaseId,
      deadlineAt: null,
      deadlineKind: null,
      result,
      roundRecords: [roundRecord(state, question, iso(ctx.nowMs))],
      eventType: "MATCH_FINISHED",
      eventPayload: { reason: "normal", matches: nextMatches, compared: nextCompared },
    });
  }
  const nextIndex = state.questionIndex + 1;
  const nextId = state.questionIds[nextIndex];
  if (!nextId) throw new CompatibiliteRuleError("CONTENT_UNAVAILABLE");
  const next: CompatibiliteState = {
    ...base,
    phase: "answering",
    questionIndex: nextIndex,
    currentQuestionId: nextId,
    choices: [null, null],
    submitted: [false, false],
  };
  return transition(ctx, next, {
    phaseId: ctx.nextPhaseId,
    deadlineAt: null,
    deadlineKind: null,
    roundRecords: [roundRecord(state, question, iso(ctx.nowMs))],
    eventType,
    eventPayload: { isMatch: matched, compared: nextCompared },
  });
}

export function initializeCompatibilite(
  configInput: unknown,
  ctx: CompatibiliteEngineContext,
): CompatibiliteTransition {
  const config = compatibiliteConfigSchema.parse(configInput);
  const content = ctx.content;
  const eligible = content.questions.filter((question) => question.category === config.category);
  if (eligible.length < config.questionCount + COMPATIBILITE_RESERVE_COUNT) {
    throw new CompatibiliteRuleError("CONTENT_UNAVAILABLE");
  }
  const ids = shuffled(eligible.map((question) => question.itemId), ctx.entropy);
  const state: CompatibiliteState = {
    schemaVersion: 1,
    phase: "answering",
    questionIndex: 0,
    questionIds: ids.slice(0, config.questionCount),
    reserveIds: ids.slice(config.questionCount, config.questionCount + COMPATIBILITE_RESERVE_COUNT),
    currentQuestionId: ids[0]!,
    choices: [null, null],
    submitted: [false, false],
    matches: 0,
    compared: 0,
    skipped: 0,
    acknowledgedBy: [],
    finishedReason: null,
    rounds: [],
  };
  return transition(ctx, state, {
    phaseId: ctx.phaseId,
    deadlineAt: null,
    deadlineKind: null,
    eventType: "MATCH_STARTED",
    eventPayload: { category: config.category, questionCount: config.questionCount },
  });
}

function resign(
  ctx: CompatibiliteEngineContext,
  state: CompatibiliteState,
  config: CompatibiliteConfig,
  reason: "resign" | "claimed_forfeit",
): CompatibiliteTransition {
  const finished = finishedState(state, reason);
  const result = resultFor(finished, ctx, config);
  return transition(ctx, finished, {
    phaseId: ctx.nextPhaseId,
    deadlineAt: null,
    deadlineKind: null,
    result,
    eventType: reason === "resign" ? "PLAYER_RESIGNED" : "FORFEIT_CLAIMED",
    eventPayload: { actorId: ctx.actorId },
  });
}

export function reduceCompatibilite(
  stateInput: unknown,
  actionInput: unknown,
  configInput: unknown,
  ctx: CompatibiliteEngineContext,
): CompatibiliteTransition {
  const state = compatibiliteStateSchema.parse(stateInput);
  const action = compatibiliteActionSchema.parse(actionInput) as CompatibiliteAction;
  const config = compatibiliteConfigSchema.parse(configInput);
  const content = ctx.content;
  const seat = seatForActor(ctx);
  if (state.phase === "finished") throw new CompatibiliteRuleError("MATCH_FINISHED");

  if (action.type === "RESIGN") return resign(ctx, state, config, "resign");
  if (action.type === "CLAIM_FORFEIT") return resign(ctx, state, config, "claimed_forfeit");

  if (action.type === "SUBMIT_CHOICE") {
    if (state.phase !== "answering") throw new CompatibiliteRuleError("WRONG_PHASE");
    if (state.submitted[seat]) throw new CompatibiliteRuleError("ALREADY_SUBMITTED");
    const question = currentQuestion(state, content);
    if (!question.options.some((option) => option.id === action.optionId)) {
      throw new CompatibiliteRuleError("INVALID_OPTION");
    }
    const choices: [string | null, string | null] = [...state.choices] as [string | null, string | null];
    const submitted: [boolean, boolean] = [...state.submitted] as [boolean, boolean];
    choices[seat] = action.optionId;
    submitted[seat] = true;
    const next: CompatibiliteState = { ...state, choices, submitted };
    if (submitted[0] && submitted[1]) return revealTransition(ctx, { ...next, phase: "reveal" });
    return transition(ctx, next, {
      deadlineAt: null,
      deadlineKind: null,
      eventType: "CHOICE_SUBMITTED",
      eventPayload: { seat },
    });
  }

  if (action.type === "SKIP_QUESTION") {
    if (state.phase !== "answering") throw new CompatibiliteRuleError("WRONG_PHASE");
    const reserveId = state.reserveIds[0];
    if (state.skipped >= COMPATIBILITE_MAX_SKIPS) throw new CompatibiliteRuleError("SKIP_LIMIT_REACHED");
    if (!reserveId) throw new CompatibiliteRuleError("NO_RESERVE_AVAILABLE");
    const questionIds = [...state.questionIds];
    questionIds[state.questionIndex] = reserveId;
    const next: CompatibiliteState = {
      ...state,
      questionIds,
      reserveIds: state.reserveIds.slice(1),
      currentQuestionId: reserveId,
      choices: [null, null],
      submitted: [false, false],
      skipped: state.skipped + 1,
    };
    return transition(ctx, next, {
      phaseId: ctx.nextPhaseId,
      deadlineAt: null,
      deadlineKind: null,
      eventType: "QUESTION_SKIPPED",
      eventPayload: { questionIndex: state.questionIndex, skipped: next.skipped },
    });
  }

  if (state.phase !== "reveal") throw new CompatibiliteRuleError("WRONG_PHASE");
  if (state.acknowledgedBy.includes(ctx.actorId ?? "")) throw new CompatibiliteRuleError("ALREADY_ACKNOWLEDGED");
  const acknowledgedBy = [...state.acknowledgedBy, ctx.actorId ?? ""];
  if (acknowledgedBy.length < 2) {
    return transition(ctx, { ...state, acknowledgedBy }, {
      deadlineAt: ctx.currentDeadlineAt ?? null,
      deadlineKind: ctx.currentDeadlineKind ?? "advance_reveal",
      eventType: "REVEAL_ACKNOWLEDGED",
      eventPayload: { seat },
    });
  }
  return closeReveal(ctx, { ...state, acknowledgedBy }, config, content, "REVEAL_CLOSED");
}

export function onCompatibiliteDeadline(
  stateInput: unknown,
  kind: string,
  configInput: unknown,
  ctx: CompatibiliteEngineContext,
): CompatibiliteTransition {
  const state = compatibiliteStateSchema.parse(stateInput);
  const config = compatibiliteConfigSchema.parse(configInput);
  if (state.phase === "finished") throw new CompatibiliteRuleError("MATCH_FINISHED");
  if (state.phase !== "reveal" || kind !== "advance_reveal") throw new CompatibiliteRuleError("STALE_DEADLINE");
  return closeReveal(ctx, state, config, ctx.content, "REVEAL_TIMED_OUT");
}

export function shouldAbandonForCompatibiliteAbsence(lastSeenAt: readonly [string, string], nowMs: number): boolean {
  const ages = lastSeenAt.map((value) => nowMs - Date.parse(value));
  return ages.every((age) => age >= 120_000) || ages.some((age) => age >= 180_000);
}

export function onCompatibiliteAbsence(
  stateInput: unknown,
  configInput: unknown,
  ctx: CompatibiliteEngineContext,
): CompatibiliteTransition {
  const state = compatibiliteStateSchema.parse(stateInput);
  const config = compatibiliteConfigSchema.parse(configInput);
  if (state.phase === "finished") throw new CompatibiliteRuleError("MATCH_FINISHED");
  const finished = finishedState(state, "absence");
  const result = resultFor(finished, ctx, config);
  return transition(ctx, finished, {
    phaseId: ctx.nextPhaseId,
    deadlineAt: null,
    deadlineKind: null,
    result,
    eventType: "MATCH_ABANDONED",
    eventPayload: { reason: "absence" },
  });
}

export function isCompatibiliteDeadlineJobStale(jobPhaseId: string | null | undefined, currentPhaseId: string): boolean {
  if (!jobPhaseId) return false;
  return jobPhaseId !== currentPhaseId;
}
