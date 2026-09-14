import type { EngineContext, JobSpec, ResultSpec, RoundRecord, Seat } from "@/games/contracts";
import {
  TROU_NOIR_DIFFICULTIES,
  trouNoirConfigSchema,
  trouNoirRuntimeConfigSchema,
  type TrouNoirConfig,
  type TrouNoirRuntimeConfig,
} from "@/games/trou-noir/config";
import { normalizeAnswer } from "@/games/trou-noir/judge";
import {
  trouNoirActionSchema,
  trouNoirStateSchema,
  type PendingAttempt,
  type PendingRoundEntry,
  type QuestionRevisionRef,
  type QuizQuestion,
  type ScheduleEntry,
  type TrouNoirAction,
  type TrouNoirContent,
  type TrouNoirState,
} from "@/games/trou-noir/types";

export const TROU_NOIR_RULES_VERSION = "trou-noir-1";
export const TROU_NOIR_ENGINE_VERSION = "trou-noir-engine-1";

export const TROU_NOIR_INITIAL_RESERVE = 100;
export const TROU_NOIR_PENALTY = 10;
export const TROU_NOIR_REVEAL_SECONDS = 12;
export const TROU_NOIR_CONTEST_SECONDS = 20;
export const TROU_NOIR_MAX_TECHNICAL_REPLACEMENTS = 2;

export type TrouNoirEngineContext = EngineContext<TrouNoirContent>;

export type TrouNoirTransition = {
  state: TrouNoirState;
  phaseId: string;
  deadlineAt: string | null;
  deadlineKind: string | null;
  jobs: JobSpec[];
  roundRecords: RoundRecord[];
  result: ResultSpec | null;
  event: { type: string; payload: Record<string, unknown> };
};

export class TrouNoirRuleError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "TrouNoirRuleError";
    this.code = code;
  }
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function seatForActor(ctx: TrouNoirEngineContext): Seat {
  const seat = ctx.participants.indexOf(ctx.actorId ?? "");
  if (seat !== 0 && seat !== 1) throw new TrouNoirRuleError("NOT_A_PARTICIPANT");
  return seat;
}

export function trouNoirActiveSeat(state: Pick<TrouNoirState, "firstSeat" | "round" | "turnInRound">): Seat {
  return ((state.firstSeat + state.round - 1 + state.turnInRound) % 2) as Seat;
}

function randomUnit(entropy: readonly number[], index: number): number {
  const value = entropy[index];
  if (value === undefined || !Number.isFinite(value) || value < 0 || value >= 1) throw new TrouNoirRuleError("INVALID_ENTROPY");
  return value;
}

function shuffled<T>(items: readonly T[], entropy: readonly number[], offset = 0): T[] {
  const result = [...items];
  for (let index = result.length - 1, cursor = offset; index > 0; index -= 1, cursor += 1) {
    const swap = Math.floor(randomUnit(entropy, cursor) * (index + 1));
    const item = result[index];
    result[index] = result[swap];
    result[swap] = item;
  }
  return result;
}

function questionById(content: TrouNoirContent, itemId: string): QuizQuestion {
  const question = content.questions.find((item) => item.itemId === itemId);
  if (!question) throw new TrouNoirRuleError("QUESTION_NOT_IN_PACK");
  return question;
}

function deadlineJob(
  ctx: TrouNoirEngineContext,
  kind: string,
  phaseId: string,
  runAt: string,
  blocking: boolean,
): JobSpec {
  return {
    kind,
    phaseId,
    runAt,
    dedupeKey: `${ctx.matchId}:${phaseId}:${kind}`,
    payload: { matchId: ctx.matchId, phaseId, kind, blocking },
  };
}

function judgeJob(ctx: TrouNoirEngineContext, attemptId: string, nowMs: number): JobSpec {
  const expectedPhaseId = attemptId;
  return {
    kind: "judge_answer",
    phaseId: expectedPhaseId,
    runAt: iso(nowMs),
    dedupeKey: `${ctx.matchId}:${attemptId}:judge:v1`,
    payload: {
      matchId: ctx.matchId,
      attemptId,
      phaseId: expectedPhaseId,
      expectedPhaseId,
    },
  };
}

function transition(
  ctx: TrouNoirEngineContext,
  state: TrouNoirState,
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
): TrouNoirTransition {
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

function answeringTransition(
  ctx: TrouNoirEngineContext,
  state: TrouNoirState,
  config: TrouNoirConfig,
  eventType: string,
  phaseId?: string,
  eventPayload?: Record<string, unknown>,
): TrouNoirTransition {
  const deadlineAt = iso(ctx.nowMs + config.answerSeconds * 1000);
  const pid = phaseId ?? ctx.nextPhaseId;
  return transition(ctx, state, {
    phaseId: pid,
    deadlineAt,
    deadlineKind: "turn_timeout",
    jobs: [deadlineJob(ctx, "turn_timeout", pid, deadlineAt, true)],
    eventType,
    eventPayload,
  });
}

function revealTransition(
  ctx: TrouNoirEngineContext,
  state: TrouNoirState,
  eventType: string,
  phaseId?: string,
  eventPayload?: Record<string, unknown>,
): TrouNoirTransition {
  const deadlineAt = iso(ctx.nowMs + TROU_NOIR_REVEAL_SECONDS * 1000);
  const pid = phaseId ?? ctx.nextPhaseId;
  return transition(ctx, state, {
    phaseId: pid,
    deadlineAt,
    deadlineKind: "advance_reveal",
    jobs: [deadlineJob(ctx, "advance_reveal", pid, deadlineAt, true)],
    eventType,
    eventPayload,
  });
}

function emptyStats(): { correct: number; incorrect: number; timeouts: number; contestsAccepted: number } {
  return { correct: 0, incorrect: 0, timeouts: 0, contestsAccepted: 0 };
}

function buildSchedule(
  content: TrouNoirContent,
  config: TrouNoirRuntimeConfig,
  entropy: readonly number[],
): ScheduleEntry[] {
  const byCategoryDifficulty = new Map<string, QuizQuestion[]>();
  for (const question of content.questions) {
    if (!config.categories.includes(question.category)) continue;
    if (!TROU_NOIR_DIFFICULTIES.includes(question.difficulty as (typeof TROU_NOIR_DIFFICULTIES)[number])) continue;
    const key = `${question.category}:${question.difficulty}`;
    const list = byCategoryDifficulty.get(key) ?? [];
    list.push(question);
    byCategoryDifficulty.set(key, list);
  }
  const shuffledPools = new Map<string, QuizQuestion[]>();
  let cursor = 2 + config.categories.length + TROU_NOIR_DIFFICULTIES.length;
  for (const [key, pool] of byCategoryDifficulty) {
    shuffledPools.set(key, shuffled(pool, entropy, cursor));
    cursor += Math.max(pool.length, 1);
  }
  // Catégories en rotation uniforme : liste mélangée répétée en cycle.
  const categories = shuffled(config.categories, entropy, 1);
  // Difficultés appariées par manche : on choisit à chaque manche la difficulté
  // la moins utilisée pour cette catégorie (départage déterministe par l'entropie
  // injectée). À défaut de couverture, le start est refusé (CONTENT_UNAVAILABLE).
  const difficultyTiebreak = shuffled([...TROU_NOIR_DIFFICULTIES], entropy, 1 + config.categories.length);
  const usedCount = new Map<string, number>();
  const usedKeys = new Set<string>();
  const schedule: ScheduleEntry[] = [];

  for (let round = 0; round < config.maxRounds; round += 1) {
    const category = categories[round % categories.length]!;
    const candidates = [...TROU_NOIR_DIFFICULTIES].sort((a, b) => {
      const usage = (usedCount.get(`${category}:${a}`) ?? 0) - (usedCount.get(`${category}:${b}`) ?? 0);
      if (usage !== 0) return usage;
      return difficultyTiebreak.indexOf(a) - difficultyTiebreak.indexOf(b);
    });
    let difficulty: number | null = null;
    for (const candidate of candidates) {
      const pool = shuffledPools.get(`${category}:${candidate}`) ?? [];
      const fresh = pool.filter((item) => !usedKeys.has(item.logicalKey)).length;
      if (fresh >= 6) {
        difficulty = candidate;
        break;
      }
    }
    if (difficulty === null) throw new TrouNoirRuleError("CONTENT_UNAVAILABLE");
    const pool = shuffledPools.get(`${category}:${difficulty}`) ?? [];
    // 2 questions + 2 remplacements par tour = 6 questions distinctes par manche.
    const picked: QuizQuestion[] = [];
    for (const candidate of pool) {
      if (usedKeys.has(candidate.logicalKey)) continue;
      picked.push(candidate);
      if (picked.length >= 6) break;
    }
    if (picked.length < 6) throw new TrouNoirRuleError("CONTENT_UNAVAILABLE");
    for (const item of picked) usedKeys.add(item.logicalKey);
    usedCount.set(`${category}:${difficulty}`, (usedCount.get(`${category}:${difficulty}`) ?? 0) + 1);
    const ref = (item: QuizQuestion): QuestionRevisionRef => ({ itemId: item.itemId, packId: item.packId });
    schedule.push({
      category,
      difficulty,
      questions: [ref(picked[0]!), ref(picked[1]!)],
      replacements: [
        [ref(picked[2]!), ref(picked[3]!)],
        [ref(picked[4]!), ref(picked[5]!)],
      ],
    });
  }
  return schedule;
}

function currentQuestionRef(state: TrouNoirState): QuestionRevisionRef {
  const entry = state.schedule[state.round - 1];
  const ref = entry?.questions[state.turnInRound];
  if (!ref) throw new TrouNoirRuleError("QUESTION_NOT_IN_PACK");
  return ref;
}

function resultFor(
  state: TrouNoirState,
  ctx: TrouNoirEngineContext,
  reason: ResultSpec["reason"],
  outcomeOverride?: ResultSpec["outcome"],
  winnerSeatOverride?: Seat | null,
): ResultSpec {
  const [first, second] = state.reserves;
  const outcome =
    outcomeOverride ?? (first === second ? "draw" : "win");
  const winnerSeat =
    winnerSeatOverride !== undefined
      ? winnerSeatOverride
      : outcome === "win"
        ? ((first > second ? 0 : 1) as Seat)
        : null;
  const metricsFor = (seat: Seat) => ({
    correct: state.perPlayer[seat].correct,
    incorrect: state.perPlayer[seat].incorrect,
    timeouts: state.perPlayer[seat].timeouts,
    contestsAccepted: state.perPlayer[seat].contestsAccepted ?? 0,
    questionsPlayed:
      state.perPlayer[seat].correct + state.perPlayer[seat].incorrect,
  });
  return {
    kind: "competitive",
    outcome,
    winnerId: winnerSeat === null ? null : ctx.participants[winnerSeat],
    reason,
    sharedScore: null,
    players: [
      { userId: ctx.participants[0], score: first, metrics: metricsFor(0) },
      { userId: ctx.participants[1], score: second, metrics: metricsFor(1) },
    ],
    summary: {
      reserves: state.reserves,
      rounds: state.round,
      maxRounds: state.schedule.length,
      perPlayer: state.perPlayer,
    },
  };
}

function finishedState(state: TrouNoirState, result: ResultSpec): TrouNoirState {
  return {
    ...state,
    phase: "finished",
    currentAttempt: null,
    pendingVerdict: null,
    contest: null,
    acknowledgedBy: [],
    finishedOutcome: result.outcome === "win" ? "win" : result.outcome === "draw" ? "draw" : "abandoned",
    finishedReason: result.reason,
    winnerId: result.winnerId,
  };
}

function applyCloseOfReveal(
  ctx: TrouNoirEngineContext,
  state: TrouNoirState,
  config: TrouNoirConfig,
): TrouNoirTransition {
  const attempt = state.currentAttempt;
  const verdict = state.pendingVerdict;
  if (!attempt || !verdict) throw new TrouNoirRuleError("ILLEGAL_MOVE");
  const seat = attempt.seat;
  const delta = verdict === "accept" ? 0 : -TROU_NOIR_PENALTY;
  const reserves: [number, number] = [...state.reserves] as [number, number];
  reserves[seat] = Math.max(0, reserves[seat] + delta);
  const perPlayer: [TrouNoirState["perPlayer"][0], TrouNoirState["perPlayer"][1]] = [
    { ...state.perPlayer[0] },
    { ...state.perPlayer[1] },
  ];
  const contestAccepted =
    state.contest?.status === "resolved" && state.contest.accepted === true;
  if (verdict === "accept") {
    perPlayer[seat] = {
      ...perPlayer[seat],
      correct: perPlayer[seat].correct + 1,
      contestsAccepted: (perPlayer[seat].contestsAccepted ?? 0) + (contestAccepted ? 1 : 0),
    };
  } else if (attempt.timeout) perPlayer[seat] = { ...perPlayer[seat], incorrect: perPlayer[seat].incorrect + 1, timeouts: perPlayer[seat].timeouts + 1 };
  else perPlayer[seat] = { ...perPlayer[seat], incorrect: perPlayer[seat].incorrect + 1 };

  const question = questionById(ctx.content, attempt.questionItemId);
  const entry: PendingRoundEntry = {
    playerId: ctx.participants[seat],
    questionPrompt: question.prompt,
    canonical: question.canonical,
    submittedAnswer: attempt.rawAnswer,
    verdict,
    method: state.pendingMethod ?? (attempt.timeout ? "timeout" : "llm"),
    delta: delta as 0 | -10,
    reserveAfter: reserves[seat],
  };

  const roundEntry = state.schedule[state.round - 1]!;
  const roundRecords: RoundRecord[] = [];
  let roundAdvance: { round: number; turnInRound: 0 | 1 };
  if (state.turnInRound === 0) {
    roundAdvance = { round: state.round, turnInRound: 1 };
  } else {
    const first = state.pendingRoundEntry;
    roundRecords.push({
      roundNo: state.round,
      completedAt: iso(ctx.nowMs),
      summary: {
        round: state.round,
        category: roundEntry.category,
        difficulty: roundEntry.difficulty,
        entries: first ? [first, entry] : [entry],
      },
    });
    roundAdvance = { round: state.round + 1, turnInRound: 0 };
  }

  const finishedByZero = reserves[0] === 0 || reserves[1] === 0;
  const lastRoundDone = state.turnInRound === 1 && state.round >= config.maxRounds;
  // Toujours terminer le deuxième tour de la manche pour équilibrer les occasions.
  if (state.turnInRound === 1 && (finishedByZero || lastRoundDone)) {
    const next: TrouNoirState = {
      ...state,
      reserves,
      perPlayer,
      pendingRoundEntry: null,
      currentAttempt: null,
      pendingVerdict: null,
      pendingMethod: null,
      contest: null,
      acknowledgedBy: [],
      consecutiveVoids: 0,
    };
    const result = resultFor(next, ctx, finishedByZero ? "normal" : "round_limit");
    return transition(ctx, finishedState(next, result), {
      phaseId: ctx.nextPhaseId,
      deadlineAt: null,
      deadlineKind: null,
      roundRecords,
      result,
      eventType: "MATCH_FINISHED",
      eventPayload: { round: state.round },
    });
  }

  const next: TrouNoirState = {
    ...state,
    phase: "answering",
    round: roundAdvance.round,
    turnInRound: roundAdvance.turnInRound,
    reserves,
    perPlayer,
    currentAttempt: null,
    pendingVerdict: null,
    pendingMethod: null,
    pendingRoundEntry: state.turnInRound === 0 ? entry : null,
    contest: null,
    acknowledgedBy: [],
    consecutiveVoids: 0,
  };
  return answeringTransition(ctx, next, config, state.turnInRound === 0 ? "TURN_ADVANCED" : "ROUND_ADVANCED");
}

export function initializeTrouNoir(configInput: unknown, ctx: TrouNoirEngineContext): TrouNoirTransition {
  const config = trouNoirRuntimeConfigSchema.parse(configInput);
  const schedule = buildSchedule(contentOrThrow(ctx.content), config, ctx.entropy);
  const firstSeat = config.firstSeat ?? (Math.floor(randomUnit(ctx.entropy, 0) * 2) as Seat);
  const state: TrouNoirState = {
    schemaVersion: 1,
    phase: "answering",
    round: 1,
    turnInRound: 0,
    firstSeat,
    reserves: [TROU_NOIR_INITIAL_RESERVE, TROU_NOIR_INITIAL_RESERVE],
    schedule,
    currentAttempt: null,
    pendingVerdict: null,
    pendingMethod: null,
    pendingRoundEntry: null,
    contest: null,
    replacementCount: 0,
    consecutiveVoids: 0,
    acknowledgedBy: [],
    perPlayer: [emptyStats(), emptyStats()],
    finishedOutcome: null,
    finishedReason: null,
    winnerId: null,
  };
  return answeringTransition({ ...ctx, nextPhaseId: ctx.phaseId }, state, config, "MATCH_STARTED", ctx.phaseId);
}

function contentOrThrow(content: TrouNoirContent): TrouNoirContent {
  if (!content || !Array.isArray(content.questions) || content.questions.length === 0) {
    throw new TrouNoirRuleError("CONTENT_UNAVAILABLE");
  }
  return content;
}

export function reduceTrouNoir(
  stateInput: unknown,
  actionInput: TrouNoirAction,
  configInput: unknown,
  ctx: TrouNoirEngineContext,
): TrouNoirTransition {
  const state = trouNoirStateSchema.parse(stateInput);
  const action = trouNoirActionSchema.parse(actionInput);
  const config = trouNoirConfigSchema.parse(configInput);
  if (state.phase === "finished") throw new TrouNoirRuleError("MATCH_FINISHED");
  const actorSeat = seatForActor(ctx);

  switch (action.type) {
    case "SUBMIT_ANSWER": {
      if (state.phase !== "answering") throw new TrouNoirRuleError("WRONG_PHASE");
      if (trouNoirActiveSeat(state) !== actorSeat) throw new TrouNoirRuleError("NOT_YOUR_TURN");
      if (state.currentAttempt) throw new TrouNoirRuleError("ALREADY_SUBMITTED");
      const trimmed = action.answer.trim();
      if (!trimmed || action.answer.length > 240) throw new TrouNoirRuleError("INVALID_ANSWER");
      const ref = currentQuestionRef(state);
      const attempt: PendingAttempt = {
        id: ctx.nextPhaseId,
        seat: actorSeat,
        questionItemId: ref.itemId,
        rawAnswer: action.answer.slice(0, 240),
        normalizedAnswer: normalizeAnswer(action.answer),
        submittedAt: iso(ctx.nowMs),
        timeout: false,
      };
      const next: TrouNoirState = { ...state, phase: "judging", currentAttempt: attempt };
      return transition(ctx, next, {
        phaseId: ctx.nextPhaseId,
        deadlineAt: null,
        deadlineKind: null,
        jobs: [judgeJob(ctx, attempt.id, ctx.nowMs)],
        eventType: "ANSWER_SUBMITTED",
        eventPayload: { attemptId: attempt.id, seat: actorSeat, phaseId: ctx.nextPhaseId },
      });
    }
    case "CONTEST": {
      if (state.phase !== "reveal") throw new TrouNoirRuleError("WRONG_PHASE");
      if (!state.currentAttempt || state.pendingVerdict !== "reject") {
        throw new TrouNoirRuleError("CONTEST_NOT_ALLOWED");
      }
      if (state.currentAttempt.timeout) throw new TrouNoirRuleError("CONTEST_NOT_ALLOWED");
      if (state.currentAttempt.seat !== actorSeat) throw new TrouNoirRuleError("CONTEST_NOT_ALLOWED");
      if (state.currentAttempt.id !== action.attemptId) throw new TrouNoirRuleError("CONTEST_NOT_ALLOWED");
      if (state.contest) throw new TrouNoirRuleError("CONTEST_ALREADY_OPEN");
      if (state.acknowledgedBy.includes(ctx.actorId ?? "")) {
        // Confirmer NEXT vaut renoncement à contester.
        throw new TrouNoirRuleError("CONTEST_NOT_ALLOWED");
      }
      const requestedAt = iso(ctx.nowMs);
      const expiresAt = iso(ctx.nowMs + TROU_NOIR_CONTEST_SECONDS * 1000);
      const pid = ctx.nextPhaseId;
      const next: TrouNoirState = {
        ...state,
        contest: {
          attemptId: action.attemptId,
          requesterId: ctx.actorId ?? "",
          status: "pending",
          accepted: null,
          requestedAt,
          expiresAt,
        },
        acknowledgedBy: [],
      };
      return transition(ctx, next, {
        phaseId: pid,
        deadlineAt: expiresAt,
        deadlineKind: "contest_timeout",
        jobs: [deadlineJob(ctx, "contest_timeout", pid, expiresAt, true)],
        eventType: "CONTEST_OPENED",
        eventPayload: { attemptId: action.attemptId },
      });
    }
    case "RESOLVE_CONTEST": {
      if (state.phase !== "reveal" || !state.contest || state.contest.status !== "pending") {
        throw new TrouNoirRuleError("NO_CONTEST_PENDING");
      }
      if (state.currentAttempt?.id !== action.attemptId || state.contest.attemptId !== action.attemptId) {
        throw new TrouNoirRuleError("NO_CONTEST_PENDING");
      }
      const requesterSeat = ctx.participants.indexOf(state.contest.requesterId);
      if (requesterSeat === actorSeat) throw new TrouNoirRuleError("CONTEST_NOT_ALLOWED");
      if (actorSeat !== (1 - (state.currentAttempt?.seat ?? 0)) as Seat) {
        throw new TrouNoirRuleError("CONTEST_NOT_ALLOWED");
      }
      const next: TrouNoirState = {
        ...state,
        contest: { ...state.contest, status: "resolved", accepted: action.accept },
        pendingVerdict: action.accept ? "accept" : state.pendingVerdict,
        pendingMethod: action.accept ? "opponent" : state.pendingMethod,
      };
      return transition(ctx, next, {
        phaseId: ctx.phaseId,
        deadlineAt: ctx.currentDeadlineAt ?? iso(ctx.nowMs + TROU_NOIR_REVEAL_SECONDS * 1000),
        deadlineKind: ctx.currentDeadlineKind ?? "contest_timeout",
        eventType: "CONTEST_RESOLVED",
        eventPayload: { attemptId: action.attemptId, accept: action.accept },
      });
    }
    case "NEXT": {
      if (state.phase !== "reveal") throw new TrouNoirRuleError("WRONG_PHASE");
      if (state.contest?.status === "pending") throw new TrouNoirRuleError("CONTEST_PENDING");
      if (state.acknowledgedBy.includes(ctx.actorId ?? "")) throw new TrouNoirRuleError("ALREADY_ACKNOWLEDGED");
      const acknowledgedBy = [...state.acknowledgedBy, ctx.actorId ?? ""];
      if (acknowledgedBy.length < 2) {
        return transition(ctx, { ...state, acknowledgedBy }, {
          phaseId: ctx.phaseId,
          deadlineAt: ctx.currentDeadlineAt ?? iso(ctx.nowMs + TROU_NOIR_REVEAL_SECONDS * 1000),
          deadlineKind: ctx.currentDeadlineKind ?? "advance_reveal",
          eventType: "REVEAL_ACKNOWLEDGED",
        });
      }
      return applyCloseOfReveal(ctx, { ...state, acknowledgedBy }, config);
    }
    case "RESIGN":
      return resignTransition(ctx, state, actorSeat, "resign");
    case "CLAIM_FORFEIT":
      return resignTransition(ctx, state, actorSeat, "claimed_forfeit");
  }
}

function resignTransition(
  ctx: TrouNoirEngineContext,
  state: TrouNoirState,
  actorSeat: Seat,
  reason: "resign" | "claimed_forfeit",
): TrouNoirTransition {
  const beforeFirstTurn =
    state.round === 1 && state.turnInRound === 0 && state.pendingRoundEntry === null;
  const winner = (1 - actorSeat) as Seat;
  const result = resultFor(
    state,
    ctx,
    reason,
    beforeFirstTurn ? "abandoned" : "win",
    beforeFirstTurn ? null : reason === "claimed_forfeit" ? actorSeat : winner,
  );
  return transition(ctx, finishedState(state, result), {
    phaseId: ctx.nextPhaseId,
    deadlineAt: null,
    deadlineKind: null,
    result,
    eventType: reason === "resign" ? "PLAYER_RESIGNED" : "FORFEIT_CLAIMED",
    eventPayload: { actorId: ctx.actorId },
  });
}

/** Verdict du worker après correction (déterministe ou DeepSeek). */
export function applyTrouNoirJudgment(
  stateInput: unknown,
  input: {
    attemptId: string;
    verdict: "accept" | "reject" | "ambiguous";
    method: string;
    reasonCode?: string;
    modelId?: string;
    promptVersion?: string;
    latencyMs?: number;
    source?: "deterministic" | "cache" | "llm";
  },
  configInput: unknown,
  ctx: TrouNoirEngineContext,
): TrouNoirTransition {
  const state = trouNoirStateSchema.parse(stateInput);
  const config = trouNoirConfigSchema.parse(configInput);
  if (state.phase !== "judging") throw new TrouNoirRuleError("STALE_DEADLINE");
  const attempt = state.currentAttempt;
  if (!attempt || attempt.id !== input.attemptId) throw new TrouNoirRuleError("STALE_DEADLINE");

  if (input.verdict === "ambiguous") {
    const consecutive = state.consecutiveVoids + 1;
    if (consecutive > TROU_NOIR_MAX_TECHNICAL_REPLACEMENTS) {
      const result = resultFor(state, ctx, "judging_unavailable", "abandoned", null);
      return transition(ctx, finishedState({ ...state, consecutiveVoids: consecutive }, result), {
        phaseId: ctx.nextPhaseId,
        deadlineAt: null,
        deadlineKind: null,
        result,
        eventType: "JUDGING_UNAVAILABLE",
        eventPayload: {
          attemptId: input.attemptId,
          phaseId: ctx.phaseId,
          reasonCode: input.reasonCode ?? "judging_unavailable",
          modelId: input.modelId ?? null,
          promptVersion: input.promptVersion ?? null,
          latencyMs: input.latencyMs ?? null,
          source: input.source ?? null,
        },
      });
    }
    // Question void : remplacement de même catégorie/niveau, sans pénalité.
    const schedule = state.schedule.map((entry) => ({
      ...entry,
      questions: [...entry.questions] as ScheduleEntry["questions"],
      replacements: [ [...entry.replacements[0]], [...entry.replacements[1]] ] as ScheduleEntry["replacements"],
    }));
    const entry = schedule[state.round - 1]!;
    const spares = entry.replacements[state.turnInRound];
    const replacement = spares.shift();
    if (!replacement) throw new TrouNoirRuleError("CONTENT_UNAVAILABLE");
    entry.questions[state.turnInRound] = replacement;
    const next: TrouNoirState = {
      ...state,
      schedule,
      phase: "answering",
      currentAttempt: null,
      pendingVerdict: null,
      pendingMethod: null,
      replacementCount: state.replacementCount + 1,
      consecutiveVoids: consecutive,
    };
    return answeringTransition(ctx, next, config, "QUESTION_REPLACED", undefined, {
      attemptId: input.attemptId,
      phaseId: ctx.phaseId,
      reasonCode: input.reasonCode ?? "ambiguous",
      modelId: input.modelId ?? null,
      promptVersion: input.promptVersion ?? null,
      latencyMs: input.latencyMs ?? null,
      source: input.source ?? null,
    });
  }

  const next: TrouNoirState = {
    ...state,
    phase: "reveal",
    pendingVerdict: input.verdict,
    pendingMethod: input.method,
    acknowledgedBy: [],
  };
  return revealTransition(ctx, next, "JUDGMENT_RECEIVED", ctx.nextPhaseId, {
    attemptId: input.attemptId,
    phaseId: ctx.phaseId,
    verdict: input.verdict,
    method: input.method,
    reasonCode: input.reasonCode ?? null,
    modelId: input.modelId ?? null,
    promptVersion: input.promptVersion ?? null,
    latencyMs: input.latencyMs ?? null,
    source: input.source ?? null,
  });
}

export function onTrouNoirDeadline(
  stateInput: unknown,
  kind: string,
  configInput: unknown,
  ctx: TrouNoirEngineContext,
): TrouNoirTransition {
  const state = trouNoirStateSchema.parse(stateInput);
  const config = trouNoirConfigSchema.parse(configInput);
  if (state.phase === "finished") throw new TrouNoirRuleError("MATCH_FINISHED");

  if (kind === "turn_timeout" && state.phase === "answering") {
    const seat = trouNoirActiveSeat(state);
    const ref = currentQuestionRef(state);
    const attempt: PendingAttempt = {
      id: ctx.nextPhaseId,
      seat,
      questionItemId: ref.itemId,
      rawAnswer: "",
      normalizedAnswer: "",
      submittedAt: iso(ctx.nowMs),
      timeout: true,
    };
    const next: TrouNoirState = {
      ...state,
      phase: "reveal",
      currentAttempt: attempt,
      pendingVerdict: "reject",
      pendingMethod: "timeout",
      contest: null,
      acknowledgedBy: [],
    };
    return revealTransition(ctx, next, "ANSWER_TIMED_OUT", ctx.nextPhaseId, {
      attemptId: attempt.id,
      phaseId: attempt.id,
    });
  }
  if (kind === "advance_reveal" && state.phase === "reveal") {
    if (state.contest?.status === "pending") throw new TrouNoirRuleError("STALE_DEADLINE");
    return applyCloseOfReveal(ctx, state, config);
  }
  if (kind === "contest_timeout" && state.phase === "reveal") {
    const next: TrouNoirState = state.contest?.status === "pending"
      ? { ...state, contest: { ...state.contest, status: "resolved", accepted: false } }
      : state;
    return applyCloseOfReveal(ctx, next, config);
  }
  throw new TrouNoirRuleError("STALE_DEADLINE");
}

export function shouldAbandonForTrouNoirAbsence(lastSeenAt: readonly [string, string], nowMs: number): boolean {
  const ages = lastSeenAt.map((value) => nowMs - Date.parse(value));
  return ages.every((age) => age >= 120_000) || ages.some((age) => age >= 180_000);
}

export function onTrouNoirAbsence(
  stateInput: unknown,
  configInput: unknown,
  ctx: TrouNoirEngineContext,
): TrouNoirTransition {
  const state = trouNoirStateSchema.parse(stateInput);
  trouNoirConfigSchema.parse(configInput);
  if (state.phase === "finished") throw new TrouNoirRuleError("MATCH_FINISHED");
  const result = resultFor(state, ctx, "absence", "abandoned", null);
  return transition(ctx, finishedState(state, result), {
    phaseId: ctx.nextPhaseId,
    deadlineAt: null,
    deadlineKind: null,
    result,
    eventType: "MATCH_ABANDONED",
    eventPayload: { reason: "absence" },
  });
}
