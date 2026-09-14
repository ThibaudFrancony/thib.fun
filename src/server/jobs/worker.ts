import "server-only";

import { randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { GEO_ENGINE_VERSION, GEO_RULES_VERSION, onGeoAbsence, onGeoDeadline, shouldAbandonForAbsence } from "@/games/geographie/engine";
import { geoConfigSchema } from "@/games/geographie/config";
import { projectGeo } from "@/games/geographie/projection";
import { getInternalJobSecret } from "@/server/config";
import { entropyValues, hashCommand } from "@/server/hash";
import { loadGeoContent } from "@/server/geo/content";
import {
  commitMatch,
  failJob,
  finishJob,
  getJobContext,
  prepareQuizJudgment,
  releaseAiReservation,
  reserveAiUsage,
  settleAiUsage,
  type JobContext,
  type MatchPlayerSnapshot,
} from "@/server/matches/repository";
import { unoConfigSchema } from "@/games/uno/config";
import { onUnoAbsence, onUnoDeadline, shouldAbandonForUnoAbsence, UNO_ENGINE_VERSION, UNO_RULES_VERSION } from "@/games/uno/engine";
import { projectUno } from "@/games/uno/projection";
import { skyjoConfigSchema } from "@/games/skyjo/config";
import {
  isSkyjoDeadlineJobStale,
  onSkyjoAbsence,
  onSkyjoDeadline,
  shouldAbandonForSkyjoAbsence,
  SKYJO_ENGINE_VERSION,
  SKYJO_RULES_VERSION,
} from "@/games/skyjo/engine";
import { projectSkyjo } from "@/games/skyjo/projection";
import { trouNoirConfigSchema } from "@/games/trou-noir/config";
import {
  applyTrouNoirJudgment,
  onTrouNoirAbsence,
  onTrouNoirDeadline,
  shouldAbandonForTrouNoirAbsence,
  TROU_NOIR_ENGINE_VERSION,
  TROU_NOIR_RULES_VERSION,
} from "@/games/trou-noir/engine";
import { projectTrouNoir } from "@/games/trou-noir/projection";
import { trouNoirStateSchema } from "@/games/trou-noir/types";
import { loadTrouNoirContent } from "@/server/quiz/content";
import { deterministicJudge as deterministicTrouNoirJudge } from "@/games/trou-noir/judge";
import { quizJudgmentCacheKey, QUIZ_JUDGE_POLICY_VERSION, QUIZ_JUDGE_PROMPT_VERSION } from "@/server/quiz/cache-key";
import { getQuizAiConfiguration } from "@/server/quiz/config";
import { judgeTrouNoirAnswer } from "@/server/quiz/judge";
import type { JudgeRuntime } from "@/server/quiz/judge-runtime";
import { ttmcConfigSchema } from "@/games/ttmc/config";
import { deterministicTtmcJudge } from "@/games/ttmc/judge";
import {
  applyTtmcJudgment,
  isTtmcDeadlineJobStale,
  onTtmcAbsence,
  onTtmcDeadline,
  shouldAbandonForTtmcAbsence,
  TTMC_ENGINE_VERSION,
  TTMC_RULES_VERSION,
} from "@/games/ttmc/engine";
import { projectTtmc } from "@/games/ttmc/projection";
import { ttmcStateSchema } from "@/games/ttmc/types";
import { loadTtmcContent } from "@/server/ttmc/content";
import { judgeTtmcAnswer } from "@/server/ttmc/judge";
import { bombpartyConfigSchema } from "@/games/bombparty/config";
import {
  isBombpartyDeadlineJobStale,
  onBombpartyAbsence,
  onBombpartyDeadline,
  shouldAbandonForBombpartyAbsence,
  BOMBPARTY_ENGINE_VERSION,
  BOMBPARTY_RULES_VERSION,
} from "@/games/bombparty/engine";
import { projectBombparty } from "@/games/bombparty/projection";
import { loadBombpartyContent } from "@/server/bombparty/content";
import { navalConfigSchema } from "@/games/bataille-navale/config";
import {
  isNavalDeadlineJobStale,
  onNavalAbsence,
  onNavalDeadline,
  shouldAbandonForNavalAbsence,
  NAVAL_ENGINE_VERSION,
  NAVAL_RULES_VERSION,
} from "@/games/bataille-navale/engine";
import { projectNaval } from "@/games/bataille-navale/projection";
import { compatibiliteConfigSchema } from "@/games/compatibilite/config";
import {
  isCompatibiliteDeadlineJobStale,
  onCompatibiliteAbsence,
  onCompatibiliteDeadline,
  shouldAbandonForCompatibiliteAbsence,
  COMPATIBILITE_ENGINE_VERSION,
  COMPATIBILITE_RULES_VERSION,
} from "@/games/compatibilite/engine";
import { projectCompatibilite } from "@/games/compatibilite/projection";
import { loadCompatibiliteContent } from "@/server/compatibilite/content";
import { longueurOndeConfigSchema } from "@/games/longueur-onde/config";
import {
  isLongueurOndeDeadlineJobStale,
  onLongueurOndeAbsence,
  onLongueurOndeDeadline,
  shouldAbandonForLongueurOndeAbsence,
  LONGUEUR_ONDE_ENGINE_VERSION,
  LONGUEUR_ONDE_RULES_VERSION,
} from "@/games/longueur-onde/engine";
import { projectLongueurOnde } from "@/games/longueur-onde/projection";
import { loadLongueurOndeContent } from "@/server/longueur-onde/content";

export const workerJobSchema = z.object({
  jobId: z.string().uuid(),
  leaseToken: z.string().uuid(),
}).strict();

export const workerRequestSchema = z.object({
  jobs: z.array(workerJobSchema).min(1).max(4),
}).strict();

export type WorkerJob = z.infer<typeof workerJobSchema>;

export function hasValidWorkerSecret(received: string | null): boolean {
  const expected = getInternalJobSecret();
  if (!expected || !received) return false;
  const expectedBytes = Buffer.from(expected, "utf8");
  const receivedBytes = Buffer.from(received, "utf8");
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}

function errorCode(error: unknown): string {
  return error instanceof Error && error.message.length <= 120 ? error.message : "WORKER_ERROR";
}

function orderedPlayers(players: MatchPlayerSnapshot[]): [MatchPlayerSnapshot, MatchPlayerSnapshot] {
  const ordered = [...players].sort((first, second) => first.seat - second.seat);
  if (ordered.length !== 2 || ordered[0]?.seat !== 0 || ordered[1]?.seat !== 1) throw new Error("INVALID_MATCH_PLAYERS");
  return [ordered[0], ordered[1]];
}

function isStaleJob(code: string): boolean {
  return ["JOB_LEASE_INVALID", "STALE_JOB", "STALE_DEADLINE", "MATCH_NOT_ACTIVE", "MATCH_NOT_FOUND"].includes(code);
}

async function cancelIfClaimStillExists(job: WorkerJob, code: string): Promise<void> {
  try {
    await finishJob(job.jobId, job.leaseToken, "cancelled", code);
  } catch {
    // A player transition may have cancelled the job while the worker was running.
  }
}

type QuizQuestionForJudgment = {
  itemId: string;
  packId: string;
  logicalKey: string;
  canonical: string;
  aliases: readonly string[];
};

type PersistedQuizJudgment = {
  outcome: {
    verdict: "accept" | "reject" | "ambiguous";
    method: string;
    reasonCode: string;
  };
  modelId?: string;
  promptVersion?: string;
  latencyMs?: number;
  source: "deterministic" | "cache" | "llm";
};

async function judgeQuizAttempt<Question extends QuizQuestionForJudgment>(args: {
  job: WorkerJob;
  attemptId: string;
  question: Question;
  rawAnswer: string;
  normalizedAnswer: string;
  deterministicVerdict: "accept" | "reject" | "undecided";
  judge: (question: Question, rawAnswer: string, runtime?: JudgeRuntime) => Promise<{
    verdict: "accept" | "reject" | "ambiguous";
    method: string;
    reasonCode: string;
  }>;
}): Promise<PersistedQuizJudgment> {
  if (args.deterministicVerdict !== "undecided") {
    return {
      outcome: await args.judge(args.question, args.rawAnswer),
      source: "deterministic",
    };
  }

  const configuration = getQuizAiConfiguration();
  if (!configuration) throw new Error("AI_CONFIGURATION_REQUIRED");
  const cacheKey = quizJudgmentCacheKey({
    questionRevisionId: args.question.itemId,
    packId: args.question.packId,
    logicalKey: args.question.logicalKey,
    normalizedAnswer: args.normalizedAnswer,
    modelId: configuration.model,
  });
  const prepared = await prepareQuizJudgment({
    jobId: args.job.jobId,
    leaseToken: args.job.leaseToken,
    attemptId: args.attemptId,
    cacheKey,
    modelId: configuration.model,
    promptVersion: QUIZ_JUDGE_PROMPT_VERSION,
    policyVersion: QUIZ_JUDGE_POLICY_VERSION,
  });
  if (prepared.status === "cache_hit") {
    return {
      outcome: {
        verdict: prepared.verdict.verdict,
        method: "llm",
        reasonCode: prepared.verdict.reasonCode ?? "cached_verdict",
      },
      modelId: configuration.model,
      promptVersion: QUIZ_JUDGE_PROMPT_VERSION,
      source: "cache",
    };
  }
  if (prepared.status === "attempt_limit") {
    return {
      outcome: { verdict: "ambiguous", method: "llm", reasonCode: "ai_attempt_limit" },
      modelId: configuration.model,
      promptVersion: QUIZ_JUDGE_PROMPT_VERSION,
      source: "llm",
    };
  }

  const startedAt = Date.now();
  const runtime: JudgeRuntime = {
    reserveAttempt: async () => {
      const reservation = await reserveAiUsage({
        jobId: args.job.jobId,
        leaseToken: args.job.leaseToken,
        attemptId: args.attemptId,
        provider: "deepseek",
        modelId: configuration.model,
        reservedCostUsd: configuration.reservedCallCostUsd,
        dailyBudgetUsd: configuration.dailyBudgetUsd,
        dailyCallLimit: configuration.dailyCallLimit,
      });
      return reservation.status === "reserved" ? { callNo: reservation.callNo } : null;
    },
    settleAttempt: async (settlement) => {
      await settleAiUsage({
        jobId: args.job.jobId,
        leaseToken: args.job.leaseToken,
        attemptId: args.attemptId,
        callNo: settlement.callNo,
        provider: "deepseek",
        modelId: configuration.model,
        status: settlement.status,
        verdict: settlement.verdict,
        reasonCode: settlement.reasonCode,
        inputTokens: settlement.inputTokens,
        outputTokens: settlement.outputTokens,
        actualCostUsd: settlement.actualCostUsd,
        cacheKey,
        promptVersion: QUIZ_JUDGE_PROMPT_VERSION,
        policyVersion: QUIZ_JUDGE_POLICY_VERSION,
      });
    },
  };
  const outcome = await args.judge(args.question, args.rawAnswer, runtime);
  return {
    outcome,
    modelId: configuration.model,
    promptVersion: QUIZ_JUDGE_PROMPT_VERSION,
    latencyMs: Math.max(0, Date.now() - startedAt),
    source: "llm",
  };
}

function judgePayload(context: JobContext): { attemptId: string; expectedPhaseId: string } | null {
  const payload = context.jobPayload;
  const attemptId = typeof payload.attemptId === "string" ? payload.attemptId : null;
  const phaseId = typeof payload.phaseId === "string" ? payload.phaseId : null;
  const expectedPhaseId = typeof payload.expectedPhaseId === "string"
    ? payload.expectedPhaseId
    : null;
  const matchId = typeof payload.matchId === "string" ? payload.matchId : null;
  if (!attemptId || !phaseId || !expectedPhaseId || !matchId) return null;
  if (
    matchId !== context.matchId
    || context.jobPhaseId !== context.phaseId
    || phaseId !== context.phaseId
    || expectedPhaseId !== context.phaseId
  ) return null;
  return { attemptId, expectedPhaseId };
}

function isCurrentJudgeAttempt(context: JobContext, attemptId: string, state: { phase?: string; currentAttempt?: { id?: string } | null }): boolean {
  return state.phase === "judging" && state.currentAttempt?.id === attemptId;
}

async function processGeographyJob(job: WorkerJob, context: JobContext): Promise<Record<string, unknown>> {
  if (context.jobKind === "check_absence") {
    return processAbsenceJob(job, context);
  }
  if (!["preparation_timeout", "turn_timeout", "advance_reveal"].includes(context.jobKind)) {
    await cancelIfClaimStillExists(job, "UNSUPPORTED_JOB");
    return { jobId: job.jobId, status: "cancelled", reason: "UNSUPPORTED_JOB" };
  }
  const config = geoConfigSchema.parse(context.config);
  const content = await loadGeoContent();
  const players = orderedPlayers(context.players);
  const participants = [players[0].id, players[1].id] as const;
  const identities = players.map((player) => ({ id: player.id, pseudo: player.pseudo })) as [{ id: string; pseudo: string }, { id: string; pseudo: string }];
  const transition = onGeoDeadline(context.state, context.jobKind, config, {
    nowMs: Date.parse(context.serverNow),
    actorId: null,
    matchId: context.matchId,
    participants,
    content,
    entropy: entropyValues(),
    phaseId: context.phaseId,
    nextPhaseId: randomUUID(),
    currentDeadlineAt: context.deadlineAt,
    currentDeadlineKind: context.deadlineKind,
  });
  const views = participants.map((viewerId) => ({
    viewerId,
    payload: projectGeo(transition.state, config, content, viewerId, participants, identities),
  }));
  const response = await commitMatch({
    matchId: context.matchId,
    expectedVersion: context.version,
    actorId: null,
    commandId: job.jobId,
    commandHash: hashCommand(context.matchId, job.jobId, context.jobKind, {
      jobPhaseId: context.jobPhaseId,
      payload: context.jobPayload,
    }),
    source: "job",
    jobId: job.jobId,
    leaseToken: job.leaseToken,
    jobKind: context.jobKind,
    previousPhaseId: context.phaseId,
    next: {
      state: transition.state,
      phaseId: transition.phaseId,
      deadlineAt: transition.deadlineAt,
      deadlineKind: transition.deadlineKind,
    },
    views,
    jobsToUpsert: transition.jobs,
    jobsToCancel: [],
    roundRecords: transition.roundRecords,
    event: transition.event,
    result: transition.result,
    rulesVersion: GEO_RULES_VERSION,
    engineVersion: GEO_ENGINE_VERSION,
  });
  return { jobId: job.jobId, matchId: context.matchId, status: "committed", version: response.version };
}

async function processAbsenceJob(job: WorkerJob, context: JobContext): Promise<Record<string, unknown>> {
  const players = orderedPlayers(context.players);
  const lastSeenAt = players.map((player) => player.lastSeenAt).filter((value): value is string => typeof value === "string") as string[];
  if (lastSeenAt.length !== 2 || !shouldAbandonForAbsence([lastSeenAt[0], lastSeenAt[1]], Date.parse(context.serverNow))) {
    const response = await finishJob(job.jobId, job.leaseToken, "done");
    return { jobId: job.jobId, matchId: context.matchId, status: "checked", response };
  }
  const config = geoConfigSchema.parse(context.config);
  const content = await loadGeoContent();
  const participants = [players[0].id, players[1].id] as const;
  const identities = players.map((player) => ({ id: player.id, pseudo: player.pseudo })) as [{ id: string; pseudo: string }, { id: string; pseudo: string }];
  const transition = onGeoAbsence(context.state, config, {
    nowMs: Date.parse(context.serverNow),
    actorId: null,
    matchId: context.matchId,
    participants,
    content,
    entropy: [],
    phaseId: context.phaseId,
    nextPhaseId: randomUUID(),
    currentDeadlineAt: context.deadlineAt,
    currentDeadlineKind: context.deadlineKind,
  });
  const views = participants.map((viewerId) => ({
    viewerId,
    payload: projectGeo(transition.state, config, content, viewerId, participants, identities),
  }));
  const response = await commitMatch({
    matchId: context.matchId,
    expectedVersion: context.version,
    actorId: null,
    commandId: job.jobId,
    commandHash: hashCommand(context.matchId, job.jobId, context.jobKind, { lastSeenAt }),
    source: "job",
    jobId: job.jobId,
    leaseToken: job.leaseToken,
    jobKind: context.jobKind,
    previousPhaseId: context.phaseId,
    next: {
      state: transition.state,
      phaseId: transition.phaseId,
      deadlineAt: transition.deadlineAt,
      deadlineKind: transition.deadlineKind,
    },
    views,
    jobsToUpsert: transition.jobs,
    jobsToCancel: [],
    roundRecords: transition.roundRecords,
    event: transition.event,
    result: transition.result,
    rulesVersion: GEO_RULES_VERSION,
    engineVersion: GEO_ENGINE_VERSION,
  });
  return { jobId: job.jobId, matchId: context.matchId, status: "committed", version: response.version };
}

async function processAiReservationReleaseJob(job: WorkerJob, context: JobContext): Promise<Record<string, unknown>> {
  const payload = context.jobPayload;
  const attemptId = typeof payload.attemptId === "string" ? payload.attemptId : null;
  const callNo = typeof payload.callNo === "number" && Number.isInteger(payload.callNo) ? payload.callNo : null;
  const matchId = typeof payload.matchId === "string" ? payload.matchId : null;
  if (!attemptId || !callNo || ![1, 2].includes(callNo) || matchId !== context.matchId) {
    await cancelIfClaimStillExists(job, "INVALID_JOB_DATA");
    return { jobId: job.jobId, status: "cancelled", reason: "INVALID_JOB_DATA" };
  }
  const response = await releaseAiReservation({
    jobId: job.jobId,
    leaseToken: job.leaseToken,
    attemptId,
    callNo,
  });
  return { jobId: job.jobId, matchId: context.matchId, status: "released", release: response };
}

async function processUnoJob(job: WorkerJob, context: JobContext): Promise<Record<string, unknown>> {
  if (context.jobKind === "check_absence") return processUnoAbsenceJob(job, context);
  if (context.jobKind !== "turn_timeout") {
    await cancelIfClaimStillExists(job, "UNSUPPORTED_JOB");
    return { jobId: job.jobId, status: "cancelled", reason: "UNSUPPORTED_JOB" };
  }
  const config = unoConfigSchema.parse(context.config);
  const players = orderedPlayers(context.players);
  const participants = [players[0].id, players[1].id] as const;
  const identities = players.map((player) => ({ id: player.id, pseudo: player.pseudo })) as [{ id: string; pseudo: string }, { id: string; pseudo: string }];
  const transition = onUnoDeadline(context.state, context.jobKind, config, {
    nowMs: Date.parse(context.serverNow), actorId: null, matchId: context.matchId, participants,
    content: null, entropy: entropyValues(), phaseId: context.phaseId, nextPhaseId: randomUUID(),
    currentDeadlineAt: context.deadlineAt, currentDeadlineKind: context.deadlineKind,
  });
  const views = participants.map((viewerId) => ({ viewerId, payload: projectUno(transition.state, config, viewerId, participants, identities) }));
  const response = await commitMatch({
    matchId: context.matchId, expectedVersion: context.version, actorId: null, commandId: job.jobId,
    commandHash: hashCommand(context.matchId, job.jobId, context.jobKind, { jobPhaseId: context.jobPhaseId, payload: context.jobPayload }),
    source: "job", jobId: job.jobId, leaseToken: job.leaseToken, jobKind: context.jobKind,
    previousPhaseId: context.phaseId,
    next: { state: transition.state, phaseId: transition.phaseId, deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind },
    views, jobsToUpsert: transition.jobs, jobsToCancel: [], roundRecords: transition.roundRecords,
    event: transition.event, result: transition.result, rulesVersion: UNO_RULES_VERSION, engineVersion: UNO_ENGINE_VERSION,
  });
  return { jobId: job.jobId, matchId: context.matchId, status: "committed", version: response.version };
}

async function processUnoAbsenceJob(job: WorkerJob, context: JobContext): Promise<Record<string, unknown>> {
  const players = orderedPlayers(context.players);
  const lastSeenAt = players.map((player) => player.lastSeenAt).filter((value): value is string => typeof value === "string") as string[];
  if (lastSeenAt.length !== 2 || !shouldAbandonForUnoAbsence([lastSeenAt[0], lastSeenAt[1]], Date.parse(context.serverNow))) {
    const response = await finishJob(job.jobId, job.leaseToken, "done");
    return { jobId: job.jobId, matchId: context.matchId, status: "checked", response };
  }
  const config = unoConfigSchema.parse(context.config);
  const participants = [players[0].id, players[1].id] as const;
  const identities = players.map((player) => ({ id: player.id, pseudo: player.pseudo })) as [{ id: string; pseudo: string }, { id: string; pseudo: string }];
  const transition = onUnoAbsence(context.state, config, {
    nowMs: Date.parse(context.serverNow), actorId: null, matchId: context.matchId, participants,
    content: null, entropy: [], phaseId: context.phaseId, nextPhaseId: randomUUID(),
    currentDeadlineAt: context.deadlineAt, currentDeadlineKind: context.deadlineKind,
  });
  const views = participants.map((viewerId) => ({ viewerId, payload: projectUno(transition.state, config, viewerId, participants, identities) }));
  const response = await commitMatch({
    matchId: context.matchId, expectedVersion: context.version, actorId: null, commandId: job.jobId,
    commandHash: hashCommand(context.matchId, job.jobId, context.jobKind, { lastSeenAt }), source: "job",
    jobId: job.jobId, leaseToken: job.leaseToken, jobKind: context.jobKind, previousPhaseId: context.phaseId,
    next: { state: transition.state, phaseId: transition.phaseId, deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind },
    views, jobsToUpsert: transition.jobs, jobsToCancel: [], roundRecords: transition.roundRecords,
    event: transition.event, result: transition.result, rulesVersion: UNO_RULES_VERSION, engineVersion: UNO_ENGINE_VERSION,
  });
  return { jobId: job.jobId, matchId: context.matchId, status: "committed", version: response.version };
}

async function processTrouNoirJob(job: WorkerJob, context: JobContext): Promise<Record<string, unknown>> {
  if (context.jobKind === "check_absence") return processTrouNoirAbsenceJob(job, context);
  if (context.jobKind === "judge_answer") return processTrouNoirJudgeJob(job, context);
  if (!["turn_timeout", "advance_reveal", "contest_timeout"].includes(context.jobKind)) {
    await cancelIfClaimStillExists(job, "UNSUPPORTED_JOB");
    return { jobId: job.jobId, status: "cancelled", reason: "UNSUPPORTED_JOB" };
  }
  const config = trouNoirConfigSchema.parse(context.config);
  const content = await loadTrouNoirContent();
  const players = orderedPlayers(context.players);
  const participants = [players[0].id, players[1].id] as const;
  const identities = players.map((player) => ({ id: player.id, pseudo: player.pseudo })) as [{ id: string; pseudo: string }, { id: string; pseudo: string }];
  const transition = onTrouNoirDeadline(context.state, context.jobKind, config, {
    nowMs: Date.parse(context.serverNow),
    actorId: null,
    matchId: context.matchId,
    participants,
    content,
    entropy: [],
    phaseId: context.phaseId,
    nextPhaseId: randomUUID(),
    currentDeadlineAt: context.deadlineAt,
    currentDeadlineKind: context.deadlineKind,
  });
  const parsedState = trouNoirStateSchema.parse(transition.state);
  const views = participants.map((viewerId) => ({
    viewerId,
    payload: projectTrouNoir(parsedState, config, content, viewerId, participants, identities, config, parsedState),
  }));
  const response = await commitMatch({
    matchId: context.matchId,
    expectedVersion: context.version,
    actorId: null,
    commandId: job.jobId,
    commandHash: hashCommand(context.matchId, job.jobId, context.jobKind, {
      jobPhaseId: context.jobPhaseId,
      payload: context.jobPayload,
    }),
    source: "job",
    jobId: job.jobId,
    leaseToken: job.leaseToken,
    jobKind: context.jobKind,
    previousPhaseId: context.phaseId,
    next: {
      state: transition.state,
      phaseId: transition.phaseId,
      deadlineAt: transition.deadlineAt,
      deadlineKind: transition.deadlineKind,
    },
    views,
    jobsToUpsert: transition.jobs,
    jobsToCancel: [],
    roundRecords: transition.roundRecords,
    event: transition.event,
    result: transition.result,
    rulesVersion: TROU_NOIR_RULES_VERSION,
    engineVersion: TROU_NOIR_ENGINE_VERSION,
  });
  return { jobId: job.jobId, matchId: context.matchId, status: "committed", version: response.version };
}

async function processTrouNoirJudgeJob(job: WorkerJob, context: JobContext): Promise<Record<string, unknown>> {
  const state = trouNoirStateSchema.parse(context.state);
  const payload = judgePayload(context);
  const attemptId = payload?.attemptId ?? null;
  const attempt = state.currentAttempt;
  // Un verdict arrivé après remplacement, annulation ou résolution est ignoré.
  if (!payload || !attemptId || !isCurrentJudgeAttempt(context, attemptId, state) || !attempt) {
    await cancelIfClaimStillExists(job, "STALE_DEADLINE");
    return { jobId: job.jobId, status: "cancelled", reason: "STALE_DEADLINE" };
  }
  const config = trouNoirConfigSchema.parse(context.config);
  const content = await loadTrouNoirContent();
  const question = content.questions.find((item) => item.itemId === attempt.questionItemId);
  if (!question) {
    await cancelIfClaimStillExists(job, "QUESTION_NOT_IN_PACK");
    return { jobId: job.jobId, status: "cancelled", reason: "QUESTION_NOT_IN_PACK" };
  }
  // La tentative a été figée avant l'échéance : le jugement reste éligible
  // même si l'IA est lente, et ses secondes ne réduisent pas le temps adverse.
  const judged = await judgeQuizAttempt({
    job,
    attemptId,
    question,
    rawAnswer: attempt.rawAnswer,
    normalizedAnswer: attempt.normalizedAnswer,
    deterministicVerdict: deterministicTrouNoirJudge(question, attempt.rawAnswer),
    judge: judgeTrouNoirAnswer,
  });
  // Une autre transition peut avoir gagné pendant l'appel hors transaction.
  // Le snapshot frais fournit aussi l'horloge DB la plus proche du commit.
  const latestContext = await getJobContext(job.jobId, job.leaseToken);
  const latestState = trouNoirStateSchema.parse(latestContext.state);
  if (!judgePayload(latestContext) || !isCurrentJudgeAttempt(latestContext, attemptId, latestState)) {
    await cancelIfClaimStillExists(job, "STALE_DEADLINE");
    return { jobId: job.jobId, status: "cancelled", reason: "STALE_DEADLINE" };
  }
  const latestAttempt = latestState.currentAttempt;
  if (
    !latestAttempt
    || latestAttempt.id !== attempt.id
    || latestAttempt.questionItemId !== attempt.questionItemId
    || latestAttempt.rawAnswer !== attempt.rawAnswer
    || latestAttempt.normalizedAnswer !== attempt.normalizedAnswer
  ) {
    await cancelIfClaimStillExists(job, "STALE_DEADLINE");
    return { jobId: job.jobId, status: "cancelled", reason: "STALE_DEADLINE" };
  }
  const latestPlayers = orderedPlayers(latestContext.players);
  const latestParticipants = [latestPlayers[0].id, latestPlayers[1].id] as const;
  const latestIdentities = latestPlayers.map((player) => ({ id: player.id, pseudo: player.pseudo })) as [{ id: string; pseudo: string }, { id: string; pseudo: string }];
  const transition = applyTrouNoirJudgment(
    latestState,
    {
      attemptId,
      verdict: judged.outcome.verdict,
      method: judged.outcome.method,
      reasonCode: judged.outcome.reasonCode,
      modelId: judged.modelId,
      promptVersion: judged.promptVersion,
      latencyMs: judged.latencyMs,
      source: judged.source,
    },
    config,
    {
      nowMs: Date.parse(latestContext.serverNow),
      actorId: null,
      matchId: latestContext.matchId,
      participants: latestParticipants,
      content,
      entropy: [],
      phaseId: latestContext.phaseId,
      nextPhaseId: randomUUID(),
      currentDeadlineAt: latestContext.deadlineAt,
      currentDeadlineKind: latestContext.deadlineKind,
    },
  );
  const parsedState = trouNoirStateSchema.parse(transition.state);
  const views = latestParticipants.map((viewerId) => ({
    viewerId,
    payload: projectTrouNoir(parsedState, config, content, viewerId, latestParticipants, latestIdentities, config, parsedState),
  }));
  const response = await commitMatch({
    matchId: latestContext.matchId,
    expectedVersion: latestContext.version,
    actorId: null,
    commandId: job.jobId,
    commandHash: hashCommand(latestContext.matchId, job.jobId, latestContext.jobKind, { attemptId }),
    source: "job",
    jobId: job.jobId,
    leaseToken: job.leaseToken,
    jobKind: latestContext.jobKind,
    previousPhaseId: latestContext.phaseId,
    next: {
      state: transition.state,
      phaseId: transition.phaseId,
      deadlineAt: transition.deadlineAt,
      deadlineKind: transition.deadlineKind,
    },
    views,
    jobsToUpsert: transition.jobs,
    jobsToCancel: [],
    roundRecords: transition.roundRecords,
    event: transition.event,
    result: transition.result,
    rulesVersion: TROU_NOIR_RULES_VERSION,
    engineVersion: TROU_NOIR_ENGINE_VERSION,
  });
  return { jobId: job.jobId, matchId: context.matchId, status: "committed", version: response.version };
}

async function processTrouNoirAbsenceJob(job: WorkerJob, context: JobContext): Promise<Record<string, unknown>> {
  const players = orderedPlayers(context.players);
  const lastSeenAt = players.map((player) => player.lastSeenAt).filter((value): value is string => typeof value === "string") as string[];
  if (lastSeenAt.length !== 2 || !shouldAbandonForTrouNoirAbsence([lastSeenAt[0], lastSeenAt[1]], Date.parse(context.serverNow))) {
    const response = await finishJob(job.jobId, job.leaseToken, "done");
    return { jobId: job.jobId, matchId: context.matchId, status: "checked", response };
  }
  const config = trouNoirConfigSchema.parse(context.config);
  const content = await loadTrouNoirContent();
  const participants = [players[0].id, players[1].id] as const;
  const identities = players.map((player) => ({ id: player.id, pseudo: player.pseudo })) as [{ id: string; pseudo: string }, { id: string; pseudo: string }];
  const transition = onTrouNoirAbsence(context.state, config, {
    nowMs: Date.parse(context.serverNow),
    actorId: null,
    matchId: context.matchId,
    participants,
    content,
    entropy: [],
    phaseId: context.phaseId,
    nextPhaseId: randomUUID(),
    currentDeadlineAt: context.deadlineAt,
    currentDeadlineKind: context.deadlineKind,
  });
  const parsedState = trouNoirStateSchema.parse(transition.state);
  const views = participants.map((viewerId) => ({
    viewerId,
    payload: projectTrouNoir(parsedState, config, content, viewerId, participants, identities, config, parsedState),
  }));
  const response = await commitMatch({
    matchId: context.matchId, expectedVersion: context.version, actorId: null, commandId: job.jobId,
    commandHash: hashCommand(context.matchId, job.jobId, context.jobKind, { lastSeenAt }), source: "job",
    jobId: job.jobId, leaseToken: job.leaseToken, jobKind: context.jobKind, previousPhaseId: context.phaseId,
    next: { state: transition.state, phaseId: transition.phaseId, deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind },
    views, jobsToUpsert: transition.jobs, jobsToCancel: [], roundRecords: transition.roundRecords,
    event: transition.event, result: transition.result, rulesVersion: TROU_NOIR_RULES_VERSION, engineVersion: TROU_NOIR_ENGINE_VERSION,
  });
  return { jobId: job.jobId, matchId: context.matchId, status: "committed", version: response.version };
}

async function processTtmcJob(job: WorkerJob, context: JobContext): Promise<Record<string, unknown>> {
  if (context.jobKind === "check_absence") return processTtmcAbsenceJob(job, context);
  if (context.jobKind === "judge_answer") return processTtmcJudgeJob(job, context);
  if (!["choose_level_timeout", "turn_timeout", "advance_reveal", "contest_timeout"].includes(context.jobKind)) {
    await cancelIfClaimStillExists(job, "UNSUPPORTED_JOB");
    return { jobId: job.jobId, status: "cancelled", reason: "UNSUPPORTED_JOB" };
  }
  // Un job d'une ancienne phase ne mute jamais la phase courante, même de
  // même nom (remplacement answering, manche choose_level suivante).
  // Les jobs judge_answer suivent un autre chemin avec garde par attemptId.
  if (isTtmcDeadlineJobStale(context.jobPhaseId, context.phaseId)) {
    await cancelIfClaimStillExists(job, "STALE_DEADLINE");
    return { jobId: job.jobId, status: "cancelled", reason: "STALE_DEADLINE" };
  }
  const config = ttmcConfigSchema.parse(context.config);
  const content = await loadTtmcContent();
  const players = orderedPlayers(context.players);
  const participants = [players[0].id, players[1].id] as const;
  const identities = players.map((player) => ({ id: player.id, pseudo: player.pseudo })) as [{ id: string; pseudo: string }, { id: string; pseudo: string }];
  const transition = onTtmcDeadline(context.state, context.jobKind, config, {
    nowMs: Date.parse(context.serverNow),
    actorId: null,
    matchId: context.matchId,
    participants,
    content,
    entropy: [],
    phaseId: context.phaseId,
    nextPhaseId: randomUUID(),
    currentDeadlineAt: context.deadlineAt,
    currentDeadlineKind: context.deadlineKind,
  });
  const parsedState = ttmcStateSchema.parse(transition.state);
  const views = participants.map((viewerId) => ({
    viewerId,
    payload: projectTtmc(parsedState, config, content, viewerId, participants, identities, config, parsedState),
  }));
  const response = await commitMatch({
    matchId: context.matchId,
    expectedVersion: context.version,
    actorId: null,
    commandId: job.jobId,
    commandHash: hashCommand(context.matchId, job.jobId, context.jobKind, {
      jobPhaseId: context.jobPhaseId,
      payload: context.jobPayload,
    }),
    source: "job",
    jobId: job.jobId,
    leaseToken: job.leaseToken,
    jobKind: context.jobKind,
    previousPhaseId: context.phaseId,
    next: {
      state: transition.state,
      phaseId: transition.phaseId,
      deadlineAt: transition.deadlineAt,
      deadlineKind: transition.deadlineKind,
    },
    views,
    jobsToUpsert: transition.jobs,
    jobsToCancel: [],
    roundRecords: transition.roundRecords,
    event: transition.event,
    result: transition.result,
    rulesVersion: TTMC_RULES_VERSION,
    engineVersion: TTMC_ENGINE_VERSION,
  });
  return { jobId: job.jobId, matchId: context.matchId, status: "committed", version: response.version };
}

async function processTtmcJudgeJob(job: WorkerJob, context: JobContext): Promise<Record<string, unknown>> {
  const state = ttmcStateSchema.parse(context.state);
  const payload = judgePayload(context);
  const attemptId = payload?.attemptId ?? null;
  const attempt = state.currentAttempt;
  if (!payload || !attemptId || !isCurrentJudgeAttempt(context, attemptId, state) || !attempt) {
    await cancelIfClaimStillExists(job, "STALE_DEADLINE");
    return { jobId: job.jobId, status: "cancelled", reason: "STALE_DEADLINE" };
  }
  const config = ttmcConfigSchema.parse(context.config);
  const content = await loadTtmcContent();
  const question = content.questions.find((item) => item.itemId === attempt.questionItemId);
  if (!question) {
    await cancelIfClaimStillExists(job, "QUESTION_NOT_IN_PACK");
    return { jobId: job.jobId, status: "cancelled", reason: "QUESTION_NOT_IN_PACK" };
  }
  const judged = await judgeQuizAttempt({
    job,
    attemptId,
    question,
    rawAnswer: attempt.rawAnswer,
    normalizedAnswer: attempt.normalizedAnswer,
    deterministicVerdict: deterministicTtmcJudge(question, attempt.rawAnswer),
    judge: judgeTtmcAnswer,
  });
  const latestContext = await getJobContext(job.jobId, job.leaseToken);
  const latestState = ttmcStateSchema.parse(latestContext.state);
  if (!judgePayload(latestContext) || !isCurrentJudgeAttempt(latestContext, attemptId, latestState)) {
    await cancelIfClaimStillExists(job, "STALE_DEADLINE");
    return { jobId: job.jobId, status: "cancelled", reason: "STALE_DEADLINE" };
  }
  const latestAttempt = latestState.currentAttempt;
  if (
    !latestAttempt
    || latestAttempt.id !== attempt.id
    || latestAttempt.questionItemId !== attempt.questionItemId
    || latestAttempt.rawAnswer !== attempt.rawAnswer
    || latestAttempt.normalizedAnswer !== attempt.normalizedAnswer
  ) {
    await cancelIfClaimStillExists(job, "STALE_DEADLINE");
    return { jobId: job.jobId, status: "cancelled", reason: "STALE_DEADLINE" };
  }
  const latestPlayers = orderedPlayers(latestContext.players);
  const latestParticipants = [latestPlayers[0].id, latestPlayers[1].id] as const;
  const latestIdentities = latestPlayers.map((player) => ({ id: player.id, pseudo: player.pseudo })) as [{ id: string; pseudo: string }, { id: string; pseudo: string }];
  const transition = applyTtmcJudgment(
    latestState,
    {
      attemptId,
      verdict: judged.outcome.verdict,
      method: judged.outcome.method,
      reasonCode: judged.outcome.reasonCode,
      modelId: judged.modelId,
      promptVersion: judged.promptVersion,
      latencyMs: judged.latencyMs,
      source: judged.source,
    },
    config,
    {
      nowMs: Date.parse(latestContext.serverNow),
      actorId: null,
      matchId: latestContext.matchId,
      participants: latestParticipants,
      content,
      entropy: [],
      phaseId: latestContext.phaseId,
      nextPhaseId: randomUUID(),
      currentDeadlineAt: latestContext.deadlineAt,
      currentDeadlineKind: latestContext.deadlineKind,
    },
  );
  const parsedState = ttmcStateSchema.parse(transition.state);
  const views = latestParticipants.map((viewerId) => ({
    viewerId,
    payload: projectTtmc(parsedState, config, content, viewerId, latestParticipants, latestIdentities, config, parsedState),
  }));
  const response = await commitMatch({
    matchId: latestContext.matchId,
    expectedVersion: latestContext.version,
    actorId: null,
    commandId: job.jobId,
    commandHash: hashCommand(latestContext.matchId, job.jobId, latestContext.jobKind, { attemptId }),
    source: "job",
    jobId: job.jobId,
    leaseToken: job.leaseToken,
    jobKind: latestContext.jobKind,
    previousPhaseId: latestContext.phaseId,
    next: {
      state: transition.state,
      phaseId: transition.phaseId,
      deadlineAt: transition.deadlineAt,
      deadlineKind: transition.deadlineKind,
    },
    views,
    jobsToUpsert: transition.jobs,
    jobsToCancel: [],
    roundRecords: transition.roundRecords,
    event: transition.event,
    result: transition.result,
    rulesVersion: TTMC_RULES_VERSION,
    engineVersion: TTMC_ENGINE_VERSION,
  });
  return { jobId: job.jobId, matchId: latestContext.matchId, status: "committed", version: response.version };
}

async function processTtmcAbsenceJob(job: WorkerJob, context: JobContext): Promise<Record<string, unknown>> {
  const players = orderedPlayers(context.players);
  const lastSeenAt = players.map((player) => player.lastSeenAt).filter((value): value is string => typeof value === "string") as string[];
  if (lastSeenAt.length !== 2 || !shouldAbandonForTtmcAbsence([lastSeenAt[0], lastSeenAt[1]], Date.parse(context.serverNow))) {
    const response = await finishJob(job.jobId, job.leaseToken, "done");
    return { jobId: job.jobId, matchId: context.matchId, status: "checked", response };
  }
  const config = ttmcConfigSchema.parse(context.config);
  const content = await loadTtmcContent();
  const participants = [players[0].id, players[1].id] as const;
  const identities = players.map((player) => ({ id: player.id, pseudo: player.pseudo })) as [{ id: string; pseudo: string }, { id: string; pseudo: string }];
  const transition = onTtmcAbsence(context.state, config, {
    nowMs: Date.parse(context.serverNow),
    actorId: null,
    matchId: context.matchId,
    participants,
    content,
    entropy: [],
    phaseId: context.phaseId,
    nextPhaseId: randomUUID(),
    currentDeadlineAt: context.deadlineAt,
    currentDeadlineKind: context.deadlineKind,
  });
  const parsedState = ttmcStateSchema.parse(transition.state);
  const views = participants.map((viewerId) => ({
    viewerId,
    payload: projectTtmc(parsedState, config, content, viewerId, participants, identities, config, parsedState),
  }));
  const response = await commitMatch({
    matchId: context.matchId, expectedVersion: context.version, actorId: null, commandId: job.jobId,
    commandHash: hashCommand(context.matchId, job.jobId, context.jobKind, { lastSeenAt }), source: "job",
    jobId: job.jobId, leaseToken: job.leaseToken, jobKind: context.jobKind, previousPhaseId: context.phaseId,
    next: { state: transition.state, phaseId: transition.phaseId, deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind },
    views, jobsToUpsert: transition.jobs, jobsToCancel: [], roundRecords: transition.roundRecords,
    event: transition.event, result: transition.result, rulesVersion: TTMC_RULES_VERSION, engineVersion: TTMC_ENGINE_VERSION,
  });
  return { jobId: job.jobId, matchId: context.matchId, status: "committed", version: response.version };
}

async function processSkyjoJob(job: WorkerJob, context: JobContext): Promise<Record<string, unknown>> {
  if (context.jobKind === "check_absence") return processSkyjoAbsenceJob(job, context);
  if (!["preparation_timeout", "turn_timeout", "advance_reveal"].includes(context.jobKind)) {
    await cancelIfClaimStillExists(job, "UNSUPPORTED_JOB");
    return { jobId: job.jobId, status: "cancelled", reason: "UNSUPPORTED_JOB" };
  }
  if (isSkyjoDeadlineJobStale(context.jobPhaseId, context.phaseId)) {
    await cancelIfClaimStillExists(job, "STALE_DEADLINE");
    return { jobId: job.jobId, status: "cancelled", reason: "STALE_DEADLINE" };
  }
  const config = skyjoConfigSchema.parse(context.config);
  const players = orderedPlayers(context.players);
  const participants = [players[0].id, players[1].id] as const;
  const identities = players.map((player) => ({ id: player.id, pseudo: player.pseudo })) as [{ id: string; pseudo: string }, { id: string; pseudo: string }];
  const transition = onSkyjoDeadline(context.state, context.jobKind, config, {
    nowMs: Date.parse(context.serverNow), actorId: null, matchId: context.matchId, participants,
    content: null, entropy: entropyValues(), phaseId: context.phaseId, nextPhaseId: randomUUID(),
    currentDeadlineAt: context.deadlineAt, currentDeadlineKind: context.deadlineKind,
  });
  const views = participants.map((viewerId) => ({ viewerId, payload: projectSkyjo(transition.state, config, viewerId, participants, identities) }));
  const response = await commitMatch({
    matchId: context.matchId, expectedVersion: context.version, actorId: null, commandId: job.jobId,
    commandHash: hashCommand(context.matchId, job.jobId, context.jobKind, { jobPhaseId: context.jobPhaseId, payload: context.jobPayload }),
    source: "job", jobId: job.jobId, leaseToken: job.leaseToken, jobKind: context.jobKind,
    previousPhaseId: context.phaseId,
    next: { state: transition.state, phaseId: transition.phaseId, deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind },
    views, jobsToUpsert: transition.jobs, jobsToCancel: [], roundRecords: transition.roundRecords,
    event: transition.event, result: transition.result, rulesVersion: SKYJO_RULES_VERSION, engineVersion: SKYJO_ENGINE_VERSION,
  });
  return { jobId: job.jobId, matchId: context.matchId, status: "committed", version: response.version };
}

async function processSkyjoAbsenceJob(job: WorkerJob, context: JobContext): Promise<Record<string, unknown>> {
  const players = orderedPlayers(context.players);
  const lastSeenAt = players.map((player) => player.lastSeenAt).filter((value): value is string => typeof value === "string") as string[];
  if (lastSeenAt.length !== 2 || !shouldAbandonForSkyjoAbsence([lastSeenAt[0], lastSeenAt[1]], Date.parse(context.serverNow))) {
    const response = await finishJob(job.jobId, job.leaseToken, "done");
    return { jobId: job.jobId, matchId: context.matchId, status: "checked", response };
  }
  const config = skyjoConfigSchema.parse(context.config);
  const participants = [players[0].id, players[1].id] as const;
  const identities = players.map((player) => ({ id: player.id, pseudo: player.pseudo })) as [{ id: string; pseudo: string }, { id: string; pseudo: string }];
  const transition = onSkyjoAbsence(context.state, config, {
    nowMs: Date.parse(context.serverNow), actorId: null, matchId: context.matchId, participants,
    content: null, entropy: [], phaseId: context.phaseId, nextPhaseId: randomUUID(),
    currentDeadlineAt: context.deadlineAt, currentDeadlineKind: context.deadlineKind,
  });
  const views = participants.map((viewerId) => ({ viewerId, payload: projectSkyjo(transition.state, config, viewerId, participants, identities) }));
  const response = await commitMatch({
    matchId: context.matchId, expectedVersion: context.version, actorId: null, commandId: job.jobId,
    commandHash: hashCommand(context.matchId, job.jobId, context.jobKind, { lastSeenAt }), source: "job",
    jobId: job.jobId, leaseToken: job.leaseToken, jobKind: context.jobKind, previousPhaseId: context.phaseId,
    next: { state: transition.state, phaseId: transition.phaseId, deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind },
    views, jobsToUpsert: transition.jobs, jobsToCancel: [], roundRecords: transition.roundRecords,
    event: transition.event, result: transition.result, rulesVersion: SKYJO_RULES_VERSION, engineVersion: SKYJO_ENGINE_VERSION,
  });
  return { jobId: job.jobId, matchId: context.matchId, status: "committed", version: response.version };
}

async function processBombpartyJob(job: WorkerJob, context: JobContext): Promise<Record<string, unknown>> {
  if (context.jobKind === "check_absence") return processBombpartyAbsenceJob(job, context);
  if (context.jobKind !== "turn_timeout") {
    await cancelIfClaimStillExists(job, "UNSUPPORTED_JOB");
    return { jobId: job.jobId, status: "cancelled", reason: "UNSUPPORTED_JOB" };
  }
  // Un job d'un tour précédent ne mute jamais le tour courant.
  if (isBombpartyDeadlineJobStale(context.jobPhaseId, context.phaseId)) {
    await cancelIfClaimStillExists(job, "STALE_DEADLINE");
    return { jobId: job.jobId, status: "cancelled", reason: "STALE_DEADLINE" };
  }
  const config = bombpartyConfigSchema.parse(context.config);
  const content = await loadBombpartyContent();
  const players = orderedPlayers(context.players);
  const participants = [players[0].id, players[1].id] as const;
  const identities = players.map((player) => ({ id: player.id, pseudo: player.pseudo })) as [{ id: string; pseudo: string }, { id: string; pseudo: string }];
  const transition = onBombpartyDeadline(context.state, context.jobKind, config, {
    nowMs: Date.parse(context.serverNow), actorId: null, matchId: context.matchId, participants,
    content, entropy: entropyValues(), phaseId: context.phaseId, nextPhaseId: randomUUID(),
    currentDeadlineAt: context.deadlineAt, currentDeadlineKind: context.deadlineKind,
  });
  const views = participants.map((viewerId) => ({ viewerId, payload: projectBombparty(transition.state, config, viewerId, participants, identities) }));
  const response = await commitMatch({
    matchId: context.matchId, expectedVersion: context.version, actorId: null, commandId: job.jobId,
    commandHash: hashCommand(context.matchId, job.jobId, context.jobKind, { jobPhaseId: context.jobPhaseId, payload: context.jobPayload }),
    source: "job", jobId: job.jobId, leaseToken: job.leaseToken, jobKind: context.jobKind,
    previousPhaseId: context.phaseId,
    next: { state: transition.state, phaseId: transition.phaseId, deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind },
    views, jobsToUpsert: transition.jobs, jobsToCancel: [], roundRecords: transition.roundRecords,
    event: transition.event, result: transition.result, rulesVersion: BOMBPARTY_RULES_VERSION, engineVersion: BOMBPARTY_ENGINE_VERSION,
  });
  return { jobId: job.jobId, matchId: context.matchId, status: "committed", version: response.version };
}

async function processBombpartyAbsenceJob(job: WorkerJob, context: JobContext): Promise<Record<string, unknown>> {
  const players = orderedPlayers(context.players);
  const lastSeenAt = players.map((player) => player.lastSeenAt).filter((value): value is string => typeof value === "string") as string[];
  if (lastSeenAt.length !== 2 || !shouldAbandonForBombpartyAbsence([lastSeenAt[0], lastSeenAt[1]], Date.parse(context.serverNow))) {
    const response = await finishJob(job.jobId, job.leaseToken, "done");
    return { jobId: job.jobId, matchId: context.matchId, status: "checked", response };
  }
  const config = bombpartyConfigSchema.parse(context.config);
  const content = await loadBombpartyContent();
  const participants = [players[0].id, players[1].id] as const;
  const identities = players.map((player) => ({ id: player.id, pseudo: player.pseudo })) as [{ id: string; pseudo: string }, { id: string; pseudo: string }];
  const transition = onBombpartyAbsence(context.state, config, {
    nowMs: Date.parse(context.serverNow), actorId: null, matchId: context.matchId, participants,
    content, entropy: [], phaseId: context.phaseId, nextPhaseId: randomUUID(),
    currentDeadlineAt: context.deadlineAt, currentDeadlineKind: context.deadlineKind,
  });
  const views = participants.map((viewerId) => ({ viewerId, payload: projectBombparty(transition.state, config, viewerId, participants, identities) }));
  const response = await commitMatch({
    matchId: context.matchId, expectedVersion: context.version, actorId: null, commandId: job.jobId,
    commandHash: hashCommand(context.matchId, job.jobId, context.jobKind, { lastSeenAt }), source: "job",
    jobId: job.jobId, leaseToken: job.leaseToken, jobKind: context.jobKind, previousPhaseId: context.phaseId,
    next: { state: transition.state, phaseId: transition.phaseId, deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind },
    views, jobsToUpsert: transition.jobs, jobsToCancel: [], roundRecords: transition.roundRecords,
    event: transition.event, result: transition.result, rulesVersion: BOMBPARTY_RULES_VERSION, engineVersion: BOMBPARTY_ENGINE_VERSION,
  });
  return { jobId: job.jobId, matchId: context.matchId, status: "committed", version: response.version };
}

async function processNavalJob(job: WorkerJob, context: JobContext): Promise<Record<string, unknown>> {
  if (context.jobKind === "check_absence") return processNavalAbsenceJob(job, context);
  if (context.jobKind !== "preparation_timeout" && context.jobKind !== "turn_timeout") {
    await cancelIfClaimStillExists(job, "UNSUPPORTED_JOB");
    return { jobId: job.jobId, status: "cancelled", reason: "UNSUPPORTED_JOB" };
  }
  // Un job d'une ancienne phase ne mute jamais la phase courante.
  if (isNavalDeadlineJobStale(context.jobPhaseId, context.phaseId)) {
    await cancelIfClaimStillExists(job, "STALE_DEADLINE");
    return { jobId: job.jobId, status: "cancelled", reason: "STALE_DEADLINE" };
  }
  const config = navalConfigSchema.parse(context.config);
  const players = orderedPlayers(context.players);
  const participants = [players[0].id, players[1].id] as const;
  const identities = players.map((player) => ({ id: player.id, pseudo: player.pseudo })) as [{ id: string; pseudo: string }, { id: string; pseudo: string }];
  const transition = onNavalDeadline(context.state, context.jobKind, config, {
    nowMs: Date.parse(context.serverNow), actorId: null, matchId: context.matchId, participants,
    content: null, entropy: entropyValues(), phaseId: context.phaseId, nextPhaseId: randomUUID(),
    currentDeadlineAt: context.deadlineAt, currentDeadlineKind: context.deadlineKind,
  });
  const views = participants.map((viewerId) => ({ viewerId, payload: projectNaval(transition.state, config, viewerId, participants, identities) }));
  const response = await commitMatch({
    matchId: context.matchId, expectedVersion: context.version, actorId: null, commandId: job.jobId,
    commandHash: hashCommand(context.matchId, job.jobId, context.jobKind, { jobPhaseId: context.jobPhaseId, payload: context.jobPayload }),
    source: "job", jobId: job.jobId, leaseToken: job.leaseToken, jobKind: context.jobKind,
    previousPhaseId: context.phaseId,
    next: { state: transition.state, phaseId: transition.phaseId, deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind },
    views, jobsToUpsert: transition.jobs, jobsToCancel: [], roundRecords: transition.roundRecords,
    event: transition.event, result: transition.result, rulesVersion: NAVAL_RULES_VERSION, engineVersion: NAVAL_ENGINE_VERSION,
  });
  return { jobId: job.jobId, matchId: context.matchId, status: "committed", version: response.version };
}

async function processNavalAbsenceJob(job: WorkerJob, context: JobContext): Promise<Record<string, unknown>> {
  const players = orderedPlayers(context.players);
  const lastSeenAt = players.map((player) => player.lastSeenAt).filter((value): value is string => typeof value === "string") as string[];
  if (lastSeenAt.length !== 2 || !shouldAbandonForNavalAbsence([lastSeenAt[0], lastSeenAt[1]], Date.parse(context.serverNow))) {
    const response = await finishJob(job.jobId, job.leaseToken, "done");
    return { jobId: job.jobId, matchId: context.matchId, status: "checked", response };
  }
  const config = navalConfigSchema.parse(context.config);
  const participants = [players[0].id, players[1].id] as const;
  const identities = players.map((player) => ({ id: player.id, pseudo: player.pseudo })) as [{ id: string; pseudo: string }, { id: string; pseudo: string }];
  const transition = onNavalAbsence(context.state, config, {
    nowMs: Date.parse(context.serverNow), actorId: null, matchId: context.matchId, participants,
    content: null, entropy: [], phaseId: context.phaseId, nextPhaseId: randomUUID(),
    currentDeadlineAt: context.deadlineAt, currentDeadlineKind: context.deadlineKind,
  });
  const views = participants.map((viewerId) => ({ viewerId, payload: projectNaval(transition.state, config, viewerId, participants, identities) }));
  const response = await commitMatch({
    matchId: context.matchId, expectedVersion: context.version, actorId: null, commandId: job.jobId,
    commandHash: hashCommand(context.matchId, job.jobId, context.jobKind, { lastSeenAt }), source: "job",
    jobId: job.jobId, leaseToken: job.leaseToken, jobKind: context.jobKind, previousPhaseId: context.phaseId,
    next: { state: transition.state, phaseId: transition.phaseId, deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind },
    views, jobsToUpsert: transition.jobs, jobsToCancel: [], roundRecords: transition.roundRecords,
    event: transition.event, result: transition.result, rulesVersion: NAVAL_RULES_VERSION, engineVersion: NAVAL_ENGINE_VERSION,
  });
  return { jobId: job.jobId, matchId: context.matchId, status: "committed", version: response.version };
}

async function processCompatibiliteJob(job: WorkerJob, context: JobContext): Promise<Record<string, unknown>> {
  if (context.jobKind === "check_absence") return processCompatibiliteAbsenceJob(job, context);
  if (context.jobKind !== "advance_reveal") {
    await cancelIfClaimStillExists(job, "UNSUPPORTED_JOB");
    return { jobId: job.jobId, status: "cancelled", reason: "UNSUPPORTED_JOB" };
  }
  if (isCompatibiliteDeadlineJobStale(context.jobPhaseId, context.phaseId)) {
    await cancelIfClaimStillExists(job, "STALE_DEADLINE");
    return { jobId: job.jobId, status: "cancelled", reason: "STALE_DEADLINE" };
  }
  const config = compatibiliteConfigSchema.parse(context.config);
  const content = await loadCompatibiliteContent();
  const players = orderedPlayers(context.players);
  const participants = [players[0].id, players[1].id] as const;
  const identities = players.map((player) => ({ id: player.id, pseudo: player.pseudo })) as [{ id: string; pseudo: string }, { id: string; pseudo: string }];
  const transition = onCompatibiliteDeadline(context.state, context.jobKind, config, {
    nowMs: Date.parse(context.serverNow), actorId: null, matchId: context.matchId, participants,
    content, entropy: [], phaseId: context.phaseId, nextPhaseId: randomUUID(),
    currentDeadlineAt: context.deadlineAt, currentDeadlineKind: context.deadlineKind,
  });
  const views = participants.map((viewerId) => ({ viewerId, payload: projectCompatibilite(transition.state, config, content, viewerId, participants, identities) }));
  const response = await commitMatch({
    matchId: context.matchId, expectedVersion: context.version, actorId: null, commandId: job.jobId,
    commandHash: hashCommand(context.matchId, job.jobId, context.jobKind, { jobPhaseId: context.jobPhaseId, payload: context.jobPayload }),
    source: "job", jobId: job.jobId, leaseToken: job.leaseToken, jobKind: context.jobKind,
    previousPhaseId: context.phaseId,
    next: { state: transition.state, phaseId: transition.phaseId, deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind },
    views, jobsToUpsert: transition.jobs, jobsToCancel: [], roundRecords: transition.roundRecords,
    event: transition.event, result: transition.result, rulesVersion: COMPATIBILITE_RULES_VERSION, engineVersion: COMPATIBILITE_ENGINE_VERSION,
  });
  return { jobId: job.jobId, matchId: context.matchId, status: "committed", version: response.version };
}

async function processLongueurOndeJob(job: WorkerJob, context: JobContext): Promise<Record<string, unknown>> {
  if (context.jobKind === "check_absence") return processLongueurOndeAbsenceJob(job, context);
  if (!["clue_timeout", "guess_timeout", "advance_reveal"].includes(context.jobKind)) {
    await cancelIfClaimStillExists(job, "UNSUPPORTED_JOB");
    return { jobId: job.jobId, status: "cancelled", reason: "UNSUPPORTED_JOB" };
  }
  if (isLongueurOndeDeadlineJobStale(context.jobPhaseId, context.phaseId)) {
    await cancelIfClaimStillExists(job, "STALE_DEADLINE");
    return { jobId: job.jobId, status: "cancelled", reason: "STALE_DEADLINE" };
  }
  const config = longueurOndeConfigSchema.parse(context.config);
  const content = await loadLongueurOndeContent();
  const players = orderedPlayers(context.players);
  const participants = [players[0].id, players[1].id] as const;
  const identities = players.map((player) => ({ id: player.id, pseudo: player.pseudo })) as [{ id: string; pseudo: string }, { id: string; pseudo: string }];
  const transition = onLongueurOndeDeadline(context.state, context.jobKind, config, {
    nowMs: Date.parse(context.serverNow), actorId: null, matchId: context.matchId, participants,
    content, entropy: entropyValues(), phaseId: context.phaseId, nextPhaseId: randomUUID(),
    currentDeadlineAt: context.deadlineAt, currentDeadlineKind: context.deadlineKind,
  });
  const views = participants.map((viewerId) => ({ viewerId, payload: projectLongueurOnde(transition.state, config, content, viewerId, participants, identities) }));
  const response = await commitMatch({
    matchId: context.matchId, expectedVersion: context.version, actorId: null, commandId: job.jobId,
    commandHash: hashCommand(context.matchId, job.jobId, context.jobKind, { jobPhaseId: context.jobPhaseId, payload: context.jobPayload }),
    source: "job", jobId: job.jobId, leaseToken: job.leaseToken, jobKind: context.jobKind, previousPhaseId: context.phaseId,
    next: { state: transition.state, phaseId: transition.phaseId, deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind },
    views, jobsToUpsert: transition.jobs, jobsToCancel: [], roundRecords: transition.roundRecords,
    event: transition.event, result: transition.result, rulesVersion: LONGUEUR_ONDE_RULES_VERSION, engineVersion: LONGUEUR_ONDE_ENGINE_VERSION,
  });
  return { jobId: job.jobId, matchId: context.matchId, status: "committed", version: response.version };
}

async function processLongueurOndeAbsenceJob(job: WorkerJob, context: JobContext): Promise<Record<string, unknown>> {
  const players = orderedPlayers(context.players);
  const lastSeenAt = players.map((player) => player.lastSeenAt).filter((value): value is string => typeof value === "string") as string[];
  if (lastSeenAt.length !== 2 || !shouldAbandonForLongueurOndeAbsence([lastSeenAt[0], lastSeenAt[1]], Date.parse(context.serverNow))) {
    const response = await finishJob(job.jobId, job.leaseToken, "done");
    return { jobId: job.jobId, matchId: context.matchId, status: "checked", response };
  }
  const config = longueurOndeConfigSchema.parse(context.config);
  const content = await loadLongueurOndeContent();
  const participants = [players[0].id, players[1].id] as const;
  const identities = players.map((player) => ({ id: player.id, pseudo: player.pseudo })) as [{ id: string; pseudo: string }, { id: string; pseudo: string }];
  const transition = onLongueurOndeAbsence(context.state, config, {
    nowMs: Date.parse(context.serverNow), actorId: null, matchId: context.matchId, participants,
    content, entropy: [], phaseId: context.phaseId, nextPhaseId: randomUUID(),
    currentDeadlineAt: context.deadlineAt, currentDeadlineKind: context.deadlineKind,
  });
  const views = participants.map((viewerId) => ({ viewerId, payload: projectLongueurOnde(transition.state, config, content, viewerId, participants, identities) }));
  const response = await commitMatch({
    matchId: context.matchId, expectedVersion: context.version, actorId: null, commandId: job.jobId,
    commandHash: hashCommand(context.matchId, job.jobId, context.jobKind, { lastSeenAt }), source: "job",
    jobId: job.jobId, leaseToken: job.leaseToken, jobKind: context.jobKind, previousPhaseId: context.phaseId,
    next: { state: transition.state, phaseId: transition.phaseId, deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind },
    views, jobsToUpsert: transition.jobs, jobsToCancel: [], roundRecords: transition.roundRecords,
    event: transition.event, result: transition.result, rulesVersion: LONGUEUR_ONDE_RULES_VERSION, engineVersion: LONGUEUR_ONDE_ENGINE_VERSION,
  });
  return { jobId: job.jobId, matchId: context.matchId, status: "committed", version: response.version };
}

async function processCompatibiliteAbsenceJob(job: WorkerJob, context: JobContext): Promise<Record<string, unknown>> {
  const players = orderedPlayers(context.players);
  const lastSeenAt = players.map((player) => player.lastSeenAt).filter((value): value is string => typeof value === "string") as string[];
  if (lastSeenAt.length !== 2 || !shouldAbandonForCompatibiliteAbsence([lastSeenAt[0], lastSeenAt[1]], Date.parse(context.serverNow))) {
    const response = await finishJob(job.jobId, job.leaseToken, "done");
    return { jobId: job.jobId, matchId: context.matchId, status: "checked", response };
  }
  const config = compatibiliteConfigSchema.parse(context.config);
  const content = await loadCompatibiliteContent();
  const participants = [players[0].id, players[1].id] as const;
  const identities = players.map((player) => ({ id: player.id, pseudo: player.pseudo })) as [{ id: string; pseudo: string }, { id: string; pseudo: string }];
  const transition = onCompatibiliteAbsence(context.state, config, {
    nowMs: Date.parse(context.serverNow), actorId: null, matchId: context.matchId, participants,
    content, entropy: [], phaseId: context.phaseId, nextPhaseId: randomUUID(),
    currentDeadlineAt: context.deadlineAt, currentDeadlineKind: context.deadlineKind,
  });
  const views = participants.map((viewerId) => ({ viewerId, payload: projectCompatibilite(transition.state, config, content, viewerId, participants, identities) }));
  const response = await commitMatch({
    matchId: context.matchId, expectedVersion: context.version, actorId: null, commandId: job.jobId,
    commandHash: hashCommand(context.matchId, job.jobId, context.jobKind, { lastSeenAt }), source: "job",
    jobId: job.jobId, leaseToken: job.leaseToken, jobKind: context.jobKind, previousPhaseId: context.phaseId,
    next: { state: transition.state, phaseId: transition.phaseId, deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind },
    views, jobsToUpsert: transition.jobs, jobsToCancel: [], roundRecords: transition.roundRecords,
    event: transition.event, result: transition.result, rulesVersion: COMPATIBILITE_RULES_VERSION, engineVersion: COMPATIBILITE_ENGINE_VERSION,
  });
  return { jobId: job.jobId, matchId: context.matchId, status: "committed", version: response.version };
}

export async function processWorkerJob(job: WorkerJob): Promise<Record<string, unknown>> {
  try {
    const context = await getJobContext(job.jobId, job.leaseToken);
    if (context.jobKind === "release_ai_reservation") return await processAiReservationReleaseJob(job, context);
    if (context.gameSlug === "uno") return await processUnoJob(job, context);
    if (context.gameSlug === "skyjo") return await processSkyjoJob(job, context);
    if (context.gameSlug === "trou-noir") return await processTrouNoirJob(job, context);
    if (context.gameSlug === "ttmc") return await processTtmcJob(job, context);
    if (context.gameSlug === "bombparty") return await processBombpartyJob(job, context);
    if (context.gameSlug === "bataille-navale") return await processNavalJob(job, context);
    if (context.gameSlug === "compatibilite") return await processCompatibiliteJob(job, context);
    if (context.gameSlug === "longueur-onde") return await processLongueurOndeJob(job, context);
    if (context.gameSlug !== "geographie") {
      await cancelIfClaimStillExists(job, "GAME_NOT_IMPLEMENTED");
      return { jobId: job.jobId, status: "cancelled", reason: "GAME_NOT_IMPLEMENTED" };
    }
    return await processGeographyJob(job, context);
  } catch (error) {
    const code = errorCode(error);
    if (isStaleJob(code)) {
      await cancelIfClaimStillExists(job, code);
      return { jobId: job.jobId, status: "ignored", reason: code };
    }
    try {
      const retry = await failJob(job.jobId, job.leaseToken, code);
      return { jobId: job.jobId, status: "retry_scheduled", reason: code, retry };
    } catch {
      return { jobId: job.jobId, status: "unresolved", reason: code };
    }
  }
}
