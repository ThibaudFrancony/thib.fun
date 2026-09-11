import type { EngineContext, JobSpec, ResultSpec, RoundRecord, Seat } from "@/games/contracts";
import {
  TTMC_CHOOSE_SECONDS,
  TTMC_CONTEST_SECONDS,
  TTMC_LEVELS,
  TTMC_MAX_TECHNICAL_REPLACEMENTS,
  TTMC_REVEAL_SECONDS,
  requiredThemesForConfig,
  ttmcConfigSchema,
  ttmcRuntimeConfigSchema,
  type TtmcConfig,
  type TtmcRuntimeConfig,
} from "@/games/ttmc/config";
import { normalizeTtmcAnswer } from "@/games/ttmc/judge";
import {
  ttmcActionSchema,
  ttmcStateSchema,
  type PendingAttempt,
  type PlayerCounters,
  type QuestionRevisionRef,
  type ThemeAllocation,
  type TtmcAction,
  type TtmcContent,
  type TtmcQuestion,
  type TtmcState,
  type TurnSummary,
} from "@/games/ttmc/types";

export const TTMC_RULES_VERSION = "ttmc-1";
export const TTMC_ENGINE_VERSION = "ttmc-engine-1";

export type TtmcEngineContext = EngineContext<TtmcContent>;

export type TtmcTransition = {
  state: TtmcState;
  phaseId: string;
  deadlineAt: string | null;
  deadlineKind: string | null;
  jobs: JobSpec[];
  roundRecords: RoundRecord[];
  result: ResultSpec | null;
  event: { type: string; payload: Record<string, unknown> };
};

export class TtmcRuleError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "TtmcRuleError";
    this.code = code;
  }
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function seatForActor(ctx: TtmcEngineContext): Seat {
  const seat = ctx.participants.indexOf(ctx.actorId ?? "");
  if (seat !== 0 && seat !== 1) throw new TtmcRuleError("NOT_A_PARTICIPANT");
  return seat;
}

export function ttmcActiveSeat(
  state: Pick<TtmcState, "firstSeat" | "round" | "turnInRound">,
): Seat {
  return ((state.firstSeat + state.round - 1 + state.turnInRound) % 2) as Seat;
}

function randomUnit(entropy: readonly number[], index: number): number {
  const value = entropy[index] ?? 0;
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new TtmcRuleError("INVALID_ENTROPY");
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

function questionById(content: TtmcContent, itemId: string): TtmcQuestion {
  const question = content.questions.find((item) => item.itemId === itemId);
  if (!question) throw new TtmcRuleError("QUESTION_NOT_IN_PACK");
  return question;
}

function deadlineJob(
  ctx: TtmcEngineContext,
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

function judgeJob(ctx: TtmcEngineContext, attemptId: string, nowMs: number): JobSpec {
  return {
    kind: "judge_answer",
    phaseId: ctx.phaseId,
    runAt: iso(nowMs),
    dedupeKey: `${ctx.matchId}:${attemptId}:judge:v1`,
    payload: { matchId: ctx.matchId, attemptId },
  };
}

function transition(
  ctx: TtmcEngineContext,
  state: TtmcState,
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
): TtmcTransition {
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

function chooseLevelTransition(
  ctx: TtmcEngineContext,
  state: TtmcState,
  eventType: string,
  phaseId?: string,
): TtmcTransition {
  const deadlineAt = iso(ctx.nowMs + TTMC_CHOOSE_SECONDS * 1000);
  const pid = phaseId ?? ctx.nextPhaseId;
  return transition(ctx, state, {
    phaseId: pid,
    deadlineAt,
    deadlineKind: "choose_level_timeout",
    jobs: [deadlineJob(ctx, "choose_level_timeout", pid, deadlineAt, true)],
    eventType,
  });
}

function answeringTransition(
  ctx: TtmcEngineContext,
  state: TtmcState,
  config: TtmcConfig,
  eventType: string,
  phaseId?: string,
): TtmcTransition {
  const deadlineAt = iso(ctx.nowMs + config.answerSeconds * 1000);
  const pid = phaseId ?? ctx.nextPhaseId;
  return transition(ctx, state, {
    phaseId: pid,
    deadlineAt,
    deadlineKind: "turn_timeout",
    jobs: [deadlineJob(ctx, "turn_timeout", pid, deadlineAt, true)],
    eventType,
  });
}

function revealTransition(
  ctx: TtmcEngineContext,
  state: TtmcState,
  eventType: string,
  phaseId?: string,
): TtmcTransition {
  const deadlineAt = iso(ctx.nowMs + TTMC_REVEAL_SECONDS * 1000);
  const pid = phaseId ?? ctx.nextPhaseId;
  return transition(ctx, state, {
    phaseId: pid,
    deadlineAt,
    deadlineKind: "advance_reveal",
    jobs: [deadlineJob(ctx, "advance_reveal", pid, deadlineAt, true)],
    eventType,
  });
}

function emptyCounters(): PlayerCounters {
  return {
    correct: 0,
    incorrect: 0,
    timeouts: 0,
    chosenLevelSum: 0,
    answeredCount: 0,
    correctByLevel: {},
    attemptsByLevel: {},
  };
}

function currentTheme(state: TtmcState): ThemeAllocation {
  const theme = state.themes[state.round - 1];
  if (!theme) throw new TtmcRuleError("CONTENT_UNAVAILABLE");
  return theme;
}

function refForSeat(theme: ThemeAllocation, level: number, seat: Seat): QuestionRevisionRef {
  const pair = theme.byLevel[String(level)];
  const ref = pair?.[seat];
  if (!ref) throw new TtmcRuleError("QUESTION_NOT_IN_PACK");
  return ref;
}

function buildAllocation(
  content: TtmcContent,
  config: TtmcRuntimeConfig,
  entropy: readonly number[],
): { themes: ThemeAllocation[]; spareByLevel: Record<string, QuestionRevisionRef[]> } {
  const byTheme = new Map<string, TtmcQuestion[]>();
  for (const question of content.questions) {
    const list = byTheme.get(question.themeId) ?? [];
    list.push(question);
    byTheme.set(question.themeId, list);
  }
  const completeThemeIds: string[] = [];
  for (const [themeId, items] of byTheme) {
    let complete = true;
    for (const level of TTMC_LEVELS) {
      const count = items.filter((item) => item.level === level).length;
      if (count < 2) {
        complete = false;
        break;
      }
    }
    if (complete) completeThemeIds.push(themeId);
  }
  if (completeThemeIds.length < requiredThemesForConfig(config)) {
    throw new TtmcRuleError("CONTENT_UNAVAILABLE");
  }
  const ordered = shuffled(completeThemeIds, entropy, 1);
  const mainIds = ordered.slice(0, config.maxRounds);
  const backupIds = ordered.slice(config.maxRounds, config.maxRounds + 2);
  if (mainIds.length < config.maxRounds || backupIds.length < 2) {
    throw new TtmcRuleError("CONTENT_UNAVAILABLE");
  }

  const themeMeta = new Map(content.themes.map((theme) => [theme.themeId, theme]));
  let cursor = 2 + completeThemeIds.length;
  const shuffledByThemeLevel = new Map<string, TtmcQuestion[]>();
  for (const themeId of [...mainIds, ...backupIds]) {
    const items = byTheme.get(themeId) ?? [];
    for (const level of TTMC_LEVELS) {
      const pool = items.filter((item) => item.level === level);
      shuffledByThemeLevel.set(`${themeId}:${level}`, shuffled(pool, entropy, cursor));
      cursor += Math.max(pool.length, 1);
    }
  }

  const usedKeys = new Set<string>();
  const themes: ThemeAllocation[] = mainIds.map((themeId) => {
    const meta = themeMeta.get(themeId);
    const byLevel: Record<string, [QuestionRevisionRef, QuestionRevisionRef]> = {};
    for (const level of TTMC_LEVELS) {
      const pool = (shuffledByThemeLevel.get(`${themeId}:${level}`) ?? []).filter(
        (item) => !usedKeys.has(item.logicalKey),
      );
      if (pool.length < 2) throw new TtmcRuleError("CONTENT_UNAVAILABLE");
      const [first, second] = [pool[0]!, pool[1]!];
      usedKeys.add(first.logicalKey);
      usedKeys.add(second.logicalKey);
      const ref = (item: TtmcQuestion): QuestionRevisionRef => ({ itemId: item.itemId, packId: item.packId });
      byLevel[String(level)] = [ref(first), ref(second)];
    }
    return {
      themeId,
      label: meta?.label ?? themeId,
      description: meta?.shortDescription ?? "",
      byLevel,
    };
  });

  const spareByLevel: Record<string, QuestionRevisionRef[]> = {};
  for (const level of TTMC_LEVELS) {
    const queue: QuestionRevisionRef[] = [];
    for (const themeId of backupIds) {
      const pool = (shuffledByThemeLevel.get(`${themeId}:${level}`) ?? []).filter(
        (item) => !usedKeys.has(item.logicalKey),
      );
      for (const item of pool.slice(0, 2)) {
        usedKeys.add(item.logicalKey);
        queue.push({ itemId: item.itemId, packId: item.packId });
      }
    }
    if (queue.length < 4) throw new TtmcRuleError("CONTENT_UNAVAILABLE");
    spareByLevel[String(level)] = queue.slice(0, 4);
  }
  return { themes, spareByLevel };
}

function resultFor(
  state: TtmcState,
  ctx: TtmcEngineContext,
  config: TtmcConfig,
  reason: ResultSpec["reason"],
  outcomeOverride?: ResultSpec["outcome"],
  winnerSeatOverride?: Seat | null,
): ResultSpec {
  const [first, second] = state.scores;
  const outcome = outcomeOverride ?? (first === second ? "draw" : "win");
  const winnerSeat =
    winnerSeatOverride !== undefined
      ? winnerSeatOverride
      : outcome === "win"
        ? ((first > second ? 0 : 1) as Seat)
        : null;
  const metricsFor = (seat: Seat) => {
    const counters = state.counters[seat];
    return {
      correct: counters.correct,
      incorrect: counters.incorrect,
      timeouts: counters.timeouts,
      chosenLevelSum: counters.chosenLevelSum,
      answeredCount: counters.answeredCount,
      averageLevel: counters.answeredCount > 0 ? counters.chosenLevelSum / counters.answeredCount : null,
      correctByLevel: counters.correctByLevel,
      attemptsByLevel: counters.attemptsByLevel,
    };
  };
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
      scores: state.scores,
      rounds: state.round,
      maxRounds: config.maxRounds,
      targetScore: config.targetScore,
      counters: state.counters,
    },
  };
}

function finishedState(state: TtmcState, result: ResultSpec): TtmcState {
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
  ctx: TtmcEngineContext,
  state: TtmcState,
  config: TtmcConfig,
): TtmcTransition {
  const attempt = state.currentAttempt;
  const verdict = state.pendingVerdict;
  const level = state.chosenLevel;
  if (!attempt || !verdict || !level) throw new TtmcRuleError("ILLEGAL_MOVE");
  if (attempt.id !== state.currentAttempt?.id) throw new TtmcRuleError("STALE_DEADLINE");
  const seat = attempt.seat;
  const points = verdict === "accept" ? level : 0;
  const scores: [number, number] = [...state.scores] as [number, number];
  scores[seat] += points;

  const counters: [PlayerCounters, PlayerCounters] = [
    {
      ...state.counters[0],
      correctByLevel: { ...state.counters[0].correctByLevel },
      attemptsByLevel: { ...state.counters[0].attemptsByLevel },
    },
    {
      ...state.counters[1],
      correctByLevel: { ...state.counters[1].correctByLevel },
      attemptsByLevel: { ...state.counters[1].attemptsByLevel },
    },
  ];
  const levelKey = String(level);
  counters[seat].attemptsByLevel[levelKey] = (counters[seat].attemptsByLevel[levelKey] ?? 0) + 1;
  counters[seat].answeredCount += 1;
  counters[seat].chosenLevelSum += level;
  if (verdict === "accept") {
    counters[seat].correct += 1;
    counters[seat].correctByLevel[levelKey] = (counters[seat].correctByLevel[levelKey] ?? 0) + 1;
  } else if (attempt.timeout) {
    counters[seat].incorrect += 1;
    counters[seat].timeouts += 1;
  } else {
    counters[seat].incorrect += 1;
  }

  const theme = currentTheme(state);
  const question = questionById(ctx.content, attempt.questionItemId);
  const turn: TurnSummary = {
    seat,
    themeId: theme.themeId,
    themeLabel: theme.label,
    level,
    questionItemId: attempt.questionItemId,
    verdict,
    method: state.pendingMethod ?? (attempt.timeout ? "timeout" : "llm"),
    points,
    totalAfter: scores[seat],
  };
  void question;

  let roundRecords: RoundRecord[] = [];
  if (state.turnInRound === 1) {
    const first = state.pendingFirstTurn;
    roundRecords = [
      {
        roundNo: state.round,
        completedAt: iso(ctx.nowMs),
        summary: {
          round: state.round,
          themeId: theme.themeId,
          themeLabel: theme.label,
          entries: first ? [first, turn] : [turn],
        },
      },
    ];
  }

  const roundComplete = state.turnInRound === 1;
  const reachedTarget = scores[0] >= config.targetScore || scores[1] >= config.targetScore;
  const roundsExhausted = roundComplete && state.round >= config.maxRounds;
  // Fin seulement après le deuxième tour de la manche où la cible est atteinte.
  if (roundComplete && (reachedTarget || roundsExhausted)) {
    const next: TtmcState = {
      ...state,
      scores,
      counters,
      pendingFirstTurn: null,
      currentAttempt: null,
      pendingVerdict: null,
      pendingMethod: null,
      contest: null,
      acknowledgedBy: [],
      replacementCount: 0,
      chosenLevel: null,
      currentQuestionId: null,
    };
    const result = resultFor(next, ctx, config, roundsExhausted ? "round_limit" : "normal");
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

  if (state.turnInRound === 0) {
    const next: TtmcState = {
      ...state,
      phase: "choose_level",
      turnInRound: 1,
      scores,
      counters,
      chosenLevel: null,
      currentQuestionId: null,
      currentAttempt: null,
      pendingVerdict: null,
      pendingMethod: null,
      pendingFirstTurn: turn,
      contest: null,
      acknowledgedBy: [],
      replacementCount: 0,
    };
    return chooseLevelTransition(ctx, next, "TURN_ADVANCED");
  }

  const next: TtmcState = {
    ...state,
    phase: "choose_level",
    round: state.round + 1,
    turnInRound: 0,
    scores,
    counters,
    chosenLevel: null,
    currentQuestionId: null,
    currentAttempt: null,
    pendingVerdict: null,
    pendingMethod: null,
    pendingFirstTurn: null,
    contest: null,
    acknowledgedBy: [],
    replacementCount: 0,
  };
  return chooseLevelTransition(ctx, next, "ROUND_ADVANCED");
}

export function initializeTtmc(configInput: unknown, ctx: TtmcEngineContext): TtmcTransition {
  const config = ttmcRuntimeConfigSchema.parse(configInput);
  if (!ctx.content || !Array.isArray(ctx.content.questions) || ctx.content.questions.length === 0) {
    throw new TtmcRuleError("CONTENT_UNAVAILABLE");
  }
  const { themes, spareByLevel } = buildAllocation(ctx.content, config, ctx.entropy);
  const firstSeat = config.firstSeat ?? (Math.floor(randomUnit(ctx.entropy, 0) * 2) as Seat);
  const state: TtmcState = {
    schemaVersion: 1,
    phase: "choose_level",
    round: 1,
    turnInRound: 0,
    firstSeat,
    scores: [0, 0],
    themes,
    spareByLevel,
    chosenLevel: null,
    currentQuestionId: null,
    currentAttempt: null,
    pendingVerdict: null,
    pendingMethod: null,
    pendingFirstTurn: null,
    contest: null,
    replacementCount: 0,
    acknowledgedBy: [],
    counters: [emptyCounters(), emptyCounters()],
    finishedOutcome: null,
    finishedReason: null,
    winnerId: null,
  };
  return chooseLevelTransition({ ...ctx, nextPhaseId: ctx.phaseId }, state, "MATCH_STARTED", ctx.phaseId);
}

export function reduceTtmc(
  stateInput: unknown,
  actionInput: TtmcAction,
  configInput: unknown,
  ctx: TtmcEngineContext,
): TtmcTransition {
  const state = ttmcStateSchema.parse(stateInput);
  const action = ttmcActionSchema.parse(actionInput);
  const config = ttmcConfigSchema.parse(configInput);
  if (state.phase === "finished") throw new TtmcRuleError("MATCH_FINISHED");
  const actorSeat = seatForActor(ctx);

  switch (action.type) {
    case "CHOOSE_LEVEL": {
      if (state.phase !== "choose_level") throw new TtmcRuleError("WRONG_PHASE");
      if (ttmcActiveSeat(state) !== actorSeat) throw new TtmcRuleError("NOT_YOUR_TURN");
      const theme = currentTheme(state);
      const ref = refForSeat(theme, action.level, actorSeat);
      const next: TtmcState = {
        ...state,
        phase: "answering",
        chosenLevel: action.level,
        currentQuestionId: ref.itemId,
        currentAttempt: null,
        replacementCount: 0,
      };
      return answeringTransition(ctx, next, config, "LEVEL_CHOSEN");
    }
    case "SUBMIT_ANSWER": {
      if (state.phase !== "answering") throw new TtmcRuleError("WRONG_PHASE");
      if (ttmcActiveSeat(state) !== actorSeat) throw new TtmcRuleError("NOT_YOUR_TURN");
      if (state.currentAttempt) throw new TtmcRuleError("ALREADY_SUBMITTED");
      if (!state.chosenLevel || !state.currentQuestionId) throw new TtmcRuleError("ILLEGAL_MOVE");
      const trimmed = action.answer.trim();
      if (!trimmed || action.answer.length > 240) throw new TtmcRuleError("INVALID_ANSWER");
      const attempt: PendingAttempt = {
        id: ctx.nextPhaseId,
        seat: actorSeat,
        questionItemId: state.currentQuestionId,
        level: state.chosenLevel,
        rawAnswer: action.answer.slice(0, 240),
        normalizedAnswer: normalizeTtmcAnswer(action.answer),
        submittedAt: iso(ctx.nowMs),
        timeout: false,
      };
      const next: TtmcState = { ...state, phase: "judging", currentAttempt: attempt };
      return transition(ctx, next, {
        phaseId: ctx.nextPhaseId,
        deadlineAt: null,
        deadlineKind: null,
        jobs: [judgeJob(ctx, attempt.id, ctx.nowMs)],
        eventType: "ANSWER_SUBMITTED",
        eventPayload: { attemptId: attempt.id, seat: actorSeat },
      });
    }
    case "CONTEST": {
      if (state.phase !== "reveal") throw new TtmcRuleError("WRONG_PHASE");
      if (!state.currentAttempt || state.pendingVerdict !== "reject") {
        throw new TtmcRuleError("CONTEST_NOT_ALLOWED");
      }
      if (state.currentAttempt.timeout) throw new TtmcRuleError("CONTEST_NOT_ALLOWED");
      if (state.currentAttempt.seat !== actorSeat) throw new TtmcRuleError("CONTEST_NOT_ALLOWED");
      if (state.currentAttempt.id !== action.attemptId) throw new TtmcRuleError("CONTEST_NOT_ALLOWED");
      if (state.contest) throw new TtmcRuleError("CONTEST_ALREADY_OPEN");
      if (state.acknowledgedBy.includes(ctx.actorId ?? "")) {
        throw new TtmcRuleError("CONTEST_NOT_ALLOWED");
      }
      const requestedAt = iso(ctx.nowMs);
      const expiresAt = iso(ctx.nowMs + TTMC_CONTEST_SECONDS * 1000);
      const pid = ctx.nextPhaseId;
      const next: TtmcState = {
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
        throw new TtmcRuleError("NO_CONTEST_PENDING");
      }
      if (state.currentAttempt?.id !== action.attemptId || state.contest.attemptId !== action.attemptId) {
        throw new TtmcRuleError("NO_CONTEST_PENDING");
      }
      const requesterSeat = ctx.participants.indexOf(state.contest.requesterId);
      if (requesterSeat === actorSeat) throw new TtmcRuleError("CONTEST_NOT_ALLOWED");
      if (actorSeat !== ((1 - (state.currentAttempt?.seat ?? 0)) as Seat)) {
        throw new TtmcRuleError("CONTEST_NOT_ALLOWED");
      }
      const next: TtmcState = {
        ...state,
        contest: { ...state.contest, status: "resolved", accepted: action.accept },
        pendingVerdict: action.accept ? "accept" : state.pendingVerdict,
        pendingMethod: action.accept ? "opponent" : state.pendingMethod,
      };
      // La résolution ne change pas l'échéance en cours : on la conserve telle
      // quelle (en général le contest_timeout posé à l'ouverture). Un repli
      // advance_reveal frais n'est créé que si aucune échéance n'existe.
      return transition(ctx, next, {
        phaseId: ctx.phaseId,
        deadlineAt: ctx.currentDeadlineAt ?? iso(ctx.nowMs + TTMC_REVEAL_SECONDS * 1000),
        deadlineKind: ctx.currentDeadlineKind ?? "advance_reveal",
        eventType: "CONTEST_RESOLVED",
        eventPayload: { attemptId: action.attemptId, accept: action.accept },
      });
    }
    case "NEXT": {
      if (state.phase !== "reveal") throw new TtmcRuleError("WRONG_PHASE");
      if (state.contest?.status === "pending") throw new TtmcRuleError("CONTEST_PENDING");
      if (state.acknowledgedBy.includes(ctx.actorId ?? "")) throw new TtmcRuleError("ALREADY_ACKNOWLEDGED");
      const acknowledgedBy = [...state.acknowledgedBy, ctx.actorId ?? ""];
      const distinct = new Set(acknowledgedBy);
      if (distinct.size < 2) {
        const seats = [...distinct].map((id) => ctx.participants.indexOf(id));
        if (seats.some((seat) => seat !== 0 && seat !== 1)) throw new TtmcRuleError("NOT_A_PARTICIPANT");
        return transition(ctx, { ...state, acknowledgedBy }, {
          phaseId: ctx.phaseId,
          deadlineAt: ctx.currentDeadlineAt ?? iso(ctx.nowMs + TTMC_REVEAL_SECONDS * 1000),
          deadlineKind: ctx.currentDeadlineKind ?? "advance_reveal",
          eventType: "REVEAL_ACKNOWLEDGED",
        });
      }
      const uniqueSeats = new Set(
        acknowledgedBy.map((id) => ctx.participants.indexOf(id)),
      );
      if (uniqueSeats.size < 2) throw new TtmcRuleError("ALREADY_ACKNOWLEDGED");
      return applyCloseOfReveal(ctx, { ...state, acknowledgedBy }, config);
    }
    case "RESIGN":
      return resignTransition(ctx, state, config, actorSeat, "resign");
    case "CLAIM_FORFEIT":
      return resignTransition(ctx, state, config, actorSeat, "claimed_forfeit");
  }
}

function resignTransition(
  ctx: TtmcEngineContext,
  state: TtmcState,
  config: TtmcConfig,
  actorSeat: Seat,
  reason: "resign" | "claimed_forfeit",
): TtmcTransition {
  const beforeFirstTurn =
    state.round === 1 && state.turnInRound === 0 && state.pendingFirstTurn === null;
  const winner = (1 - actorSeat) as Seat;
  const result = resultFor(
    state,
    ctx,
    config,
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
export function applyTtmcJudgment(
  stateInput: unknown,
  input: { attemptId: string; verdict: "accept" | "reject" | "ambiguous"; method: string },
  configInput: unknown,
  ctx: TtmcEngineContext,
): TtmcTransition {
  const state = ttmcStateSchema.parse(stateInput);
  const config = ttmcConfigSchema.parse(configInput);
  if (state.phase !== "judging") throw new TtmcRuleError("STALE_DEADLINE");
  const attempt = state.currentAttempt;
  if (!attempt || attempt.id !== input.attemptId) throw new TtmcRuleError("STALE_DEADLINE");

  if (input.verdict === "ambiguous") {
    const consecutive = state.replacementCount + 1;
    if (consecutive > TTMC_MAX_TECHNICAL_REPLACEMENTS) {
      const result = resultFor(state, ctx, config, "judging_unavailable", "abandoned", null);
      return transition(ctx, finishedState({ ...state, replacementCount: consecutive }, result), {
        phaseId: ctx.nextPhaseId,
        deadlineAt: null,
        deadlineKind: null,
        result,
        eventType: "JUDGING_UNAVAILABLE",
      });
    }
    // Remplacement même niveau, sans pénalité, sans réutiliser une question vue.
    const spareByLevel: Record<string, QuestionRevisionRef[]> = Object.fromEntries(
      Object.entries(state.spareByLevel).map(([level, queue]) => [level, [...queue]]),
    );
    const queue = spareByLevel[String(attempt.level)] ?? [];
    const replacement = queue.shift();
    if (!replacement) {
      const result = resultFor(state, ctx, config, "judging_unavailable", "abandoned", null);
      return transition(ctx, finishedState({ ...state, replacementCount: consecutive }, result), {
        phaseId: ctx.nextPhaseId,
        deadlineAt: null,
        deadlineKind: null,
        result,
        eventType: "JUDGING_UNAVAILABLE",
      });
    }
    spareByLevel[String(attempt.level)] = queue;
    const next: TtmcState = {
      ...state,
      spareByLevel,
      phase: "answering",
      currentQuestionId: replacement.itemId,
      currentAttempt: null,
      pendingVerdict: null,
      pendingMethod: null,
      replacementCount: consecutive,
    };
    return answeringTransition(ctx, next, config, "QUESTION_REPLACED");
  }

  const next: TtmcState = {
    ...state,
    phase: "reveal",
    pendingVerdict: input.verdict,
    pendingMethod: input.method,
    acknowledgedBy: [],
  };
  return revealTransition(ctx, next, "JUDGMENT_RECEIVED", ctx.nextPhaseId);
}

export function onTtmcDeadline(
  stateInput: unknown,
  kind: string,
  configInput: unknown,
  ctx: TtmcEngineContext,
): TtmcTransition {
  const state = ttmcStateSchema.parse(stateInput);
  const config = ttmcConfigSchema.parse(configInput);
  if (state.phase === "finished") throw new TtmcRuleError("MATCH_FINISHED");

  if (kind === "choose_level_timeout" && state.phase === "choose_level") {
    const seat = ttmcActiveSeat(state);
    const theme = currentTheme(state);
    const ref = refForSeat(theme, 1, seat);
    const next: TtmcState = {
      ...state,
      phase: "answering",
      chosenLevel: 1,
      currentQuestionId: ref.itemId,
      currentAttempt: null,
      replacementCount: 0,
    };
    return answeringTransition(ctx, next, config, "LEVEL_TIMED_OUT", ctx.nextPhaseId);
  }
  if (kind === "turn_timeout" && state.phase === "answering") {
    const seat = ttmcActiveSeat(state);
    const level = state.chosenLevel ?? 1;
    const questionId = state.currentQuestionId ?? refForSeat(currentTheme(state), level, seat).itemId;
    const attempt: PendingAttempt = {
      id: ctx.nextPhaseId,
      seat,
      questionItemId: questionId,
      level,
      rawAnswer: "",
      normalizedAnswer: "",
      submittedAt: iso(ctx.nowMs),
      timeout: true,
    };
    const next: TtmcState = {
      ...state,
      chosenLevel: level,
      currentQuestionId: questionId,
      phase: "reveal",
      currentAttempt: attempt,
      pendingVerdict: "reject",
      pendingMethod: "timeout",
      contest: null,
      acknowledgedBy: [],
    };
    return revealTransition(ctx, next, "ANSWER_TIMED_OUT", ctx.nextPhaseId);
  }
  if (kind === "advance_reveal" && state.phase === "reveal") {
    if (state.contest?.status === "pending") throw new TtmcRuleError("STALE_DEADLINE");
    return applyCloseOfReveal(ctx, state, config);
  }
  if (kind === "contest_timeout" && state.phase === "reveal") {
    const next: TtmcState =
      state.contest?.status === "pending"
        ? { ...state, contest: { ...state.contest, status: "resolved", accepted: false } }
        : state;
    return applyCloseOfReveal(ctx, next, config);
  }
  throw new TtmcRuleError("STALE_DEADLINE");
}

export function shouldAbandonForTtmcAbsence(
  lastSeenAt: readonly [string, string],
  nowMs: number,
): boolean {
  const ages = lastSeenAt.map((value) => nowMs - Date.parse(value));
  return ages.every((age) => age >= 120_000) || ages.some((age) => age >= 180_000);
}

/**
 * Garde anti-rejeu des jobs d'échéance TTMC : un job créé pour une phase ne
 * doit jamais muter une phase ultérieure portant le même nom. Sans elle,
 * l'ancien `turn_timeout` volerait le temps complet d'une question de
 * remplacement (nouvelle phase answering) et l'ancien `choose_level_timeout`
 * réinitialiserait la manche suivante (nouvelle phase choose_level).
 * Les jobs `judge_answer` sont exclus : leur phaseId est celle du dépôt
 * (answering) alors que l'état courant est déjà en judging ; leur garde est
 * l'attemptId, vérifié dans le worker avant tout jugement.
 */
export function isTtmcDeadlineJobStale(
  jobPhaseId: string | null | undefined,
  currentPhaseId: string,
): boolean {
  if (!jobPhaseId) return false;
  return jobPhaseId !== currentPhaseId;
}

export function onTtmcAbsence(
  stateInput: unknown,
  configInput: unknown,
  ctx: TtmcEngineContext,
): TtmcTransition {
  const state = ttmcStateSchema.parse(stateInput);
  const config = ttmcConfigSchema.parse(configInput);
  if (state.phase === "finished") throw new TtmcRuleError("MATCH_FINISHED");
  const result = resultFor(state, ctx, config, "absence", "abandoned", null);
  return transition(ctx, finishedState(state, result), {
    phaseId: ctx.nextPhaseId,
    deadlineAt: null,
    deadlineKind: null,
    result,
    eventType: "MATCH_ABANDONED",
    eventPayload: { reason: "absence" },
  });
}
