import "server-only";

import { randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { GEO_ENGINE_VERSION, GEO_RULES_VERSION, onGeoAbsence, onGeoDeadline, shouldAbandonForAbsence } from "@/games/geographie/engine";
import { geoConfigSchema } from "@/games/geographie/config";
import { projectGeo } from "@/games/geographie/projection";
import { getInternalJobSecret } from "@/server/config";
import { entropyValues, hashCommand } from "@/server/hash";
import { loadGeoContent } from "@/server/geo/content";
import { finishJob, failJob, getJobContext, commitMatch, type JobContext, type MatchPlayerSnapshot } from "@/server/matches/repository";
import { unoConfigSchema } from "@/games/uno/config";
import { onUnoAbsence, onUnoDeadline, shouldAbandonForUnoAbsence, UNO_ENGINE_VERSION, UNO_RULES_VERSION } from "@/games/uno/engine";
import { projectUno } from "@/games/uno/projection";
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
import { judgeTrouNoirAnswer } from "@/server/quiz/judge";
import { ttmcConfigSchema } from "@/games/ttmc/config";
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
  const config = trouNoirConfigSchema.parse(context.config);
  const content = await loadTrouNoirContent();
  const players = orderedPlayers(context.players);
  const participants = [players[0].id, players[1].id] as const;
  const identities = players.map((player) => ({ id: player.id, pseudo: player.pseudo })) as [{ id: string; pseudo: string }, { id: string; pseudo: string }];
  const state = trouNoirStateSchema.parse(context.state);
  const payload = context.jobPayload as { attemptId?: unknown };
  const attemptId = typeof payload.attemptId === "string" ? payload.attemptId : null;
  const attempt = state.currentAttempt;
  // Un verdict arrivé après remplacement, annulation ou résolution est ignoré.
  if (state.phase !== "judging" || !attempt || !attemptId || attempt.id !== attemptId) {
    await cancelIfClaimStillExists(job, "STALE_DEADLINE");
    return { jobId: job.jobId, status: "cancelled", reason: "STALE_DEADLINE" };
  }
  const question = content.questions.find((item) => item.itemId === attempt.questionItemId);
  if (!question) {
    await cancelIfClaimStillExists(job, "QUESTION_NOT_IN_PACK");
    return { jobId: job.jobId, status: "cancelled", reason: "QUESTION_NOT_IN_PACK" };
  }
  // La tentative a été figée avant l'échéance : le jugement reste éligible
  // même si l'IA est lente, et ses secondes ne réduisent pas le temps adverse.
  const outcome = await judgeTrouNoirAnswer(question, attempt.rawAnswer);
  const transition = applyTrouNoirJudgment(
    state,
    { attemptId, verdict: outcome.verdict, method: outcome.method },
    config,
    {
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
    },
  );
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
    commandHash: hashCommand(context.matchId, job.jobId, context.jobKind, { attemptId }),
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
  const config = ttmcConfigSchema.parse(context.config);
  const content = await loadTtmcContent();
  const players = orderedPlayers(context.players);
  const participants = [players[0].id, players[1].id] as const;
  const identities = players.map((player) => ({ id: player.id, pseudo: player.pseudo })) as [{ id: string; pseudo: string }, { id: string; pseudo: string }];
  const state = ttmcStateSchema.parse(context.state);
  const payload = context.jobPayload as { attemptId?: unknown };
  const attemptId = typeof payload.attemptId === "string" ? payload.attemptId : null;
  const attempt = state.currentAttempt;
  if (state.phase !== "judging" || !attempt || !attemptId || attempt.id !== attemptId) {
    await cancelIfClaimStillExists(job, "STALE_DEADLINE");
    return { jobId: job.jobId, status: "cancelled", reason: "STALE_DEADLINE" };
  }
  const question = content.questions.find((item) => item.itemId === attempt.questionItemId);
  if (!question) {
    await cancelIfClaimStillExists(job, "QUESTION_NOT_IN_PACK");
    return { jobId: job.jobId, status: "cancelled", reason: "QUESTION_NOT_IN_PACK" };
  }
  const outcome = await judgeTtmcAnswer(question, attempt.rawAnswer);
  const transition = applyTtmcJudgment(
    state,
    { attemptId, verdict: outcome.verdict, method: outcome.method },
    config,
    {
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
    },
  );
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
    commandHash: hashCommand(context.matchId, job.jobId, context.jobKind, { attemptId }),
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

export async function processWorkerJob(job: WorkerJob): Promise<Record<string, unknown>> {
  try {
    const context = await getJobContext(job.jobId, job.leaseToken);
    if (context.gameSlug === "uno") return await processUnoJob(job, context);
    if (context.gameSlug === "trou-noir") return await processTrouNoirJob(job, context);
    if (context.gameSlug === "ttmc") return await processTtmcJob(job, context);
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
