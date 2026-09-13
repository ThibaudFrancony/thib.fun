import { z } from "zod";
import type { JobSpec, ResultReason, Seat } from "@/games/contracts";

export const ABSENCE_FORFEIT_AFTER_MS = 90_000;
export const ABSENCE_BOTH_PLAYERS_AFTER_MS = 120_000;
export const ABSENCE_ONE_PLAYER_AFTER_MS = 180_000;
export const MAX_JOB_ATTEMPTS = 5;
export const JOB_RETRY_BACKOFF_MS = [1_000, 2_000, 4_000, 8_000] as const;

const uuidSchema = z.string().uuid();
const commandHashSchema = z.string().regex(/^[0-9a-f]{64}$/);
const seatSchema = z.union([z.literal(0), z.literal(1)]);

/**
 * The identity that the trusted server sends to the commit RPC.
 * `actorSeat` is derived from the authenticated actor and the match players;
 * it is not a value that a browser is allowed to choose.
 */
export const commitIdentitySchema = z.object({
  matchId: uuidSchema,
  phaseId: uuidSchema,
  stateVersion: z.number().int().nonnegative(),
  actorId: uuidSchema.nullable(),
  actorSeat: seatSchema.nullable(),
  source: z.enum(["player", "job"]),
  commandId: uuidSchema,
  commandType: z.string().trim().min(1).max(80),
  commandHash: commandHashSchema,
  jobId: uuidSchema.nullable(),
  leaseToken: uuidSchema.nullable(),
}).strict();

export type CommitIdentity = z.infer<typeof commitIdentitySchema>;

export type MatchKind = "competitive" | "cooperative";
export type TransactionSource = "player" | "job";
export type JobStatus = "pending" | "running" | "done" | "cancelled" | "failed";

export type SnapshotKey = {
  matchId: string;
  phaseId: string;
  stateVersion: number;
};

export type CommitSnapshot = SnapshotKey & {
  participants: readonly [string, string];
};

export type TransactionCommandClass =
  | "normal_move"
  | "resign"
  | "claim_forfeit"
  | "cooperative_interruption"
  | "absence"
  | "judgment"
  | "preparation"
  | "deadline_job"
  | "unsupported_job";

export const TRANSACTION_COMMAND_RULES = {
  normal_move: {
    source: "player",
    deadline: "blocking_at_or_after_rejected",
    actor: "authenticated_seat",
  },
  resign: {
    source: "player",
    deadline: "allowed_after_current_deadline",
    actor: "authenticated_seat",
  },
  claim_forfeit: {
    source: "player",
    deadline: "allowed_after_current_deadline_if_absence_90s",
    actor: "authenticated_seat",
  },
  cooperative_interruption: {
    source: "player",
    deadline: "same_exit_rule_without_winner",
    actor: "authenticated_seat",
  },
  absence: {
    source: "job",
    deadline: "phase_independent_due_check",
    actor: "system_job_with_lease",
  },
  judgment: {
    source: "job",
    deadline: "job_due_without_player_deadline",
    actor: "system_job_with_lease_and_attempt",
  },
  preparation: {
    source: "job",
    deadline: "blocking_phase_deadline_due",
    actor: "system_job_with_lease_and_phase",
  },
  deadline_job: {
    source: "job",
    deadline: "blocking_phase_deadline_due",
    actor: "system_job_with_lease_and_phase",
  },
  unsupported_job: {
    source: "job",
    deadline: "rejected",
    actor: "system_job_with_lease",
  },
} as const;

const PREPARATION_JOB_KINDS = new Set(["preparation_timeout", "choose_level_timeout"]);
const DEADLINE_JOB_KINDS = new Set(["turn_timeout", "advance_reveal", "contest_timeout"]);
const KNOWN_JOB_KINDS = new Set([
  "check_absence",
  "judge_answer",
  ...PREPARATION_JOB_KINDS,
  ...DEADLINE_JOB_KINDS,
  "release_ai_reservation",
]);

export function classifyTransactionCommand(
  source: TransactionSource,
  commandType: string,
  matchKind: MatchKind,
): TransactionCommandClass {
  if (source === "player") {
    if (commandType === "RESIGN") return matchKind === "cooperative" ? "cooperative_interruption" : "resign";
    if (commandType === "CLAIM_FORFEIT") return matchKind === "cooperative" ? "cooperative_interruption" : "claim_forfeit";
    return "normal_move";
  }
  if (commandType === "check_absence") return "absence";
  if (commandType === "judge_answer") return "judgment";
  if (PREPARATION_JOB_KINDS.has(commandType)) return "preparation";
  if (DEADLINE_JOB_KINDS.has(commandType)) return "deadline_job";
  return "unsupported_job";
}

export function snapshotKey(snapshot: SnapshotKey): string {
  return `${snapshot.matchId}:${snapshot.phaseId}:${snapshot.stateVersion}`;
}

export function isNewerSnapshot(candidate: SnapshotKey, current: SnapshotKey): boolean {
  return candidate.matchId === current.matchId && candidate.stateVersion > current.stateVersion;
}

export function seatForActor(participants: readonly [string, string], actorId: string): Seat | null {
  if (participants[0] === actorId) return 0;
  if (participants[1] === actorId) return 1;
  return null;
}

export type ReceiptRecord = {
  commandId: string;
  actorId: string | null;
  commandType: string;
  payloadHash: string;
  committedVersion: number;
  response: Record<string, unknown>;
};

export type ReceiptDecision =
  | { kind: "apply" }
  | { kind: "replay"; committedVersion: number; response: Record<string, unknown> }
  | { kind: "reject"; code: "COMMAND_ID_REUSED" };

/**
 * Receipts are compared on actor, command type and the business hash. The
 * expected version is deliberately absent: a retry after another transition
 * must still be able to replay the already committed result.
 */
export function inspectReceipt(
  receipt: ReceiptRecord | null | undefined,
  identity: Pick<CommitIdentity, "actorId" | "commandType" | "commandHash">,
): ReceiptDecision {
  if (!receipt) return { kind: "apply" };
  if (
    receipt.actorId === identity.actorId &&
    receipt.commandType === identity.commandType &&
    receipt.payloadHash === identity.commandHash
  ) {
    return { kind: "replay", committedVersion: receipt.committedVersion, response: receipt.response };
  }
  return { kind: "reject", code: "COMMAND_ID_REUSED" };
}

function parsedTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isAtOrAfterDeadline(nowMs: number, deadlineAt: string | null | undefined): boolean {
  const deadlineMs = parsedTime(deadlineAt);
  return deadlineMs !== null && nowMs >= deadlineMs;
}

export function isClaimForfeitAvailable(opponentLastSeenAt: string | null | undefined, nowMs: number): boolean {
  const lastSeenMs = parsedTime(opponentLastSeenAt);
  return lastSeenMs !== null && nowMs - lastSeenMs >= ABSENCE_FORFEIT_AFTER_MS;
}

export function isAbsenceConditionMet(
  playersLastSeenAt: readonly [string | null | undefined, string | null | undefined],
  nowMs: number,
): boolean {
  const staleFor = playersLastSeenAt.map((lastSeenAt) => {
    const lastSeenMs = parsedTime(lastSeenAt);
    return lastSeenMs === null ? null : nowMs - lastSeenMs;
  });
  const stalePlayers = staleFor.filter((ageMs): ageMs is number => ageMs !== null);
  return stalePlayers.filter((ageMs) => ageMs >= ABSENCE_BOTH_PLAYERS_AFTER_MS).length === 2
    || stalePlayers.some((ageMs) => ageMs >= ABSENCE_ONE_PLAYER_AFTER_MS);
}

export type DeadlineDecision =
  | { allowed: true; mode: "player" | "exit" | "job" }
  | { allowed: false; code: "DEADLINE_EXPIRED" | "FORFEIT_NOT_AVAILABLE" | "JOB_NOT_DUE" | "STALE_JOB" | "UNSUPPORTED_COMMAND" }
  | { allowed: false; disposition: "absence_noop" };

export type DeadlineCheck = {
  source: TransactionSource;
  commandType: string;
  matchKind: MatchKind;
  nowMs: number;
  blockingDeadlineAt: string | null;
  jobRunAt?: string | null;
  jobPhaseId?: string | null;
  currentPhaseId?: string;
  opponentLastSeenAt?: string | null;
  absenceCondition?: boolean;
};

/**
 * The DB clock decides the boundary. Player moves are rejected at the exact
 * deadline; exits remain admissible so a stalled turn cannot prevent a player
 * from leaving. System jobs are due from their persisted run_at and phase;
 * `check_absence` is the intentional phase-independent exception.
 */
export function evaluateDeadline(check: DeadlineCheck): DeadlineDecision {
  const commandClass = classifyTransactionCommand(check.source, check.commandType, check.matchKind);

  if (commandClass === "unsupported_job") return { allowed: false, code: "UNSUPPORTED_COMMAND" };

  if (commandClass === "normal_move") {
    return isAtOrAfterDeadline(check.nowMs, check.blockingDeadlineAt)
      ? { allowed: false, code: "DEADLINE_EXPIRED" }
      : { allowed: true, mode: "player" };
  }

  if (commandClass === "resign" || commandClass === "cooperative_interruption") {
    return { allowed: true, mode: "exit" };
  }

  if (commandClass === "claim_forfeit") {
    return isClaimForfeitAvailable(check.opponentLastSeenAt, check.nowMs)
      ? { allowed: true, mode: "exit" }
      : { allowed: false, code: "FORFEIT_NOT_AVAILABLE" };
  }

  if (commandClass === "absence") {
    const runAtMs = parsedTime(check.jobRunAt);
    if (runAtMs === null || check.nowMs < runAtMs) return { allowed: false, code: "JOB_NOT_DUE" };
    if (check.absenceCondition !== true) return { allowed: false, disposition: "absence_noop" };
    return { allowed: true, mode: "job" };
  }

  if (check.jobPhaseId !== check.currentPhaseId) return { allowed: false, code: "STALE_JOB" };

  const runAtMs = parsedTime(check.jobRunAt);
  if (runAtMs === null || check.nowMs < runAtMs) return { allowed: false, code: "JOB_NOT_DUE" };

  if (commandClass === "judgment") return { allowed: true, mode: "job" };

  const deadlineMs = parsedTime(check.blockingDeadlineAt);
  if (deadlineMs === null || check.nowMs < deadlineMs) return { allowed: false, code: "JOB_NOT_DUE" };
  return { allowed: true, mode: "job" };
}

export type JobCommitDescriptor = {
  jobId: string;
  leaseToken: string;
  matchId: string;
  kind: string;
  phaseId: string | null;
  status: JobStatus;
  leaseUntilMs: number | null;
};

export type CommitErrorCode =
  | "INVALID_ENVELOPE"
  | "MATCH_ID_MISMATCH"
  | "PHASE_CONFLICT"
  | "VERSION_CONFLICT"
  | "NOT_A_PARTICIPANT"
  | "ACTOR_SEAT_MISMATCH"
  | "INVALID_COMMIT_SOURCE"
  | "INVALID_COMMAND_TYPE"
  | "INVALID_JOB_COMMAND"
  | "INVALID_JOB_TYPE"
  | "JOB_LEASE_INVALID"
  | "STALE_JOB"
  | "DEADLINE_EXPIRED"
  | "FORFEIT_NOT_AVAILABLE"
  | "JOB_NOT_DUE"
  | "UNSUPPORTED_COMMAND";

export function validateCommitIdentity(identity: CommitIdentity, snapshot: CommitSnapshot): CommitErrorCode | null {
  if (!commitIdentitySchema.safeParse(identity).success) return "INVALID_ENVELOPE";
  if (identity.matchId !== snapshot.matchId) return "MATCH_ID_MISMATCH";
  if (identity.phaseId !== snapshot.phaseId) return "PHASE_CONFLICT";
  if (identity.stateVersion !== snapshot.stateVersion) return "VERSION_CONFLICT";

  if (identity.source === "player") {
    if (identity.jobId !== null || identity.leaseToken !== null) return "INVALID_COMMIT_SOURCE";
    if (!identity.actorId) return "NOT_A_PARTICIPANT";
    const actualSeat = seatForActor(snapshot.participants, identity.actorId);
    if (actualSeat === null) return "NOT_A_PARTICIPANT";
    if (actualSeat !== identity.actorSeat) return "ACTOR_SEAT_MISMATCH";
    if (KNOWN_JOB_KINDS.has(identity.commandType)) return "INVALID_COMMAND_TYPE";
    return null;
  }

  if (identity.actorId !== null || identity.actorSeat !== null) return "INVALID_COMMIT_SOURCE";
  if (identity.jobId === null || identity.leaseToken === null) return "INVALID_JOB_COMMAND";
  if (!KNOWN_JOB_KINDS.has(identity.commandType)) return "INVALID_JOB_TYPE";
  if (identity.commandId !== identity.jobId) return "INVALID_JOB_COMMAND";
  return null;
}

export function validateJobLease(
  identity: CommitIdentity,
  snapshot: CommitSnapshot,
  job: JobCommitDescriptor,
  nowMs: number,
): CommitErrorCode | null {
  if (
    identity.source !== "job" ||
    identity.jobId !== job.jobId ||
    identity.leaseToken !== job.leaseToken ||
    job.matchId !== snapshot.matchId ||
    job.status !== "running" ||
    job.leaseUntilMs === null ||
    job.leaseUntilMs <= nowMs
  ) {
    return "JOB_LEASE_INVALID";
  }
  if (job.kind !== identity.commandType) return "INVALID_JOB_TYPE";
  if (identity.commandType === "check_absence") {
    return job.phaseId === null ? null : "STALE_JOB";
  }
  return job.phaseId === snapshot.phaseId ? null : "STALE_JOB";
}

export type CommitDecision =
  | { kind: "apply"; committedVersion: number }
  | { kind: "replay"; committedVersion: number; response: Record<string, unknown> }
  | { kind: "reject"; code: CommitErrorCode | "COMMAND_ID_REUSED" }
  | { kind: "noop"; code: "ABSENCE_NOT_DUE" };

export function decideCommit(input: {
  snapshot: CommitSnapshot;
  identity: CommitIdentity;
  receipt?: ReceiptRecord | null;
  deadline: DeadlineCheck;
  job?: JobCommitDescriptor;
}): CommitDecision {
  const receipt = inspectReceipt(input.receipt, input.identity);
  if (receipt.kind === "replay") return receipt;
  if (receipt.kind === "reject") return receipt;

  const identityError = validateCommitIdentity(input.identity, input.snapshot);
  if (identityError) return { kind: "reject", code: identityError };

  if (input.identity.source === "job") {
    if (!input.job) return { kind: "reject", code: "JOB_LEASE_INVALID" };
    const leaseError = validateJobLease(input.identity, input.snapshot, input.job, input.deadline.nowMs);
    if (leaseError) return { kind: "reject", code: leaseError };
  }

  const deadline = evaluateDeadline(input.deadline);
  if (deadline.allowed) return { kind: "apply", committedVersion: input.snapshot.stateVersion + 1 };
  if ("disposition" in deadline) return { kind: "noop", code: "ABSENCE_NOT_DUE" };
  return { kind: "reject", code: deadline.code };
}

export type ExitKind = "resign" | "claimed_forfeit" | "absence";

export type ExitOutcome = {
  outcome: "win" | "abandoned";
  winnerId: string | null;
  sharedScore: number | null;
  reason: Extract<ResultReason, "resign" | "claimed_forfeit" | "absence">;
};

export function outcomeForExit(input: {
  matchKind: MatchKind;
  exit: ExitKind;
  actorId: string;
  opponentId: string;
  firstTurnStarted: boolean;
}): ExitOutcome {
  if (input.matchKind === "cooperative" || input.exit === "absence" || !input.firstTurnStarted) {
    return { outcome: "abandoned", winnerId: null, sharedScore: null, reason: input.exit === "absence" ? "absence" : input.exit };
  }
  return {
    outcome: "win",
    winnerId: input.exit === "resign" ? input.opponentId : input.actorId,
    sharedScore: null,
    reason: input.exit,
  };
}

export function technicalErrorOutcome(): {
  outcome: "abandoned";
  winnerId: null;
  sharedScore: null;
  reason: "technical_error";
} {
  return { outcome: "abandoned", winnerId: null, sharedScore: null, reason: "technical_error" };
}

export function deadlineDedupeKey(matchId: string, phaseId: string, kind: string): string {
  return `${matchId}:${phaseId}:${kind}`;
}

export function judgeDedupeKey(matchId: string, attemptId: string): string {
  return `${matchId}:${attemptId}:judge:v1`;
}

export function absenceDedupeKey(matchId: string, sequence: number): string {
  return `${matchId}:absence:${sequence}`;
}

export type ExistingJob = {
  id: string;
  dedupeKey: string;
  status: JobStatus;
};

export type JobReconciliation = {
  cancelledJobIds: string[];
  unknownCancelIds: string[];
  retainedJobIds: string[];
  insertedJobs: JobSpec[];
  ignoredTerminalDedupeKeys: string[];
};

/**
 * Reconciliation is deliberately explicit. A phase transition does not
 * cancel every pending job; only the IDs in `jobsToCancel` are cancelled.
 * A terminal job is never reactivated by an upsert with the same dedupe key.
 */
export function reconcileJobs(
  existing: readonly ExistingJob[],
  jobsToUpsert: readonly JobSpec[],
  jobsToCancel: readonly string[],
): JobReconciliation {
  const byId = new Map(existing.map((job) => [job.id, job]));
  const cancelled = new Set<string>();
  const cancelledJobIds: string[] = [];
  const unknownCancelIds: string[] = [];

  for (const jobId of jobsToCancel) {
    const job = byId.get(jobId);
    if (!job) {
      unknownCancelIds.push(jobId);
    } else if (job.status === "pending" || job.status === "running") {
      cancelled.add(jobId);
      cancelledJobIds.push(jobId);
    }
  }

  const existingByKey = new Map(existing.map((job) => [job.dedupeKey, job]));
  const insertedByKey = new Map<string, JobSpec>();
  const retainedJobIds: string[] = [];
  const insertedJobs: JobSpec[] = [];
  const ignoredTerminalDedupeKeys: string[] = [];

  for (const job of jobsToUpsert) {
    const current = existingByKey.get(job.dedupeKey);
    if (current) {
      if ((current.status === "pending" || current.status === "running") && !cancelled.has(current.id)) {
        retainedJobIds.push(current.id);
      } else {
        ignoredTerminalDedupeKeys.push(job.dedupeKey);
      }
      continue;
    }
    if (insertedByKey.has(job.dedupeKey)) continue;
    insertedByKey.set(job.dedupeKey, job);
    insertedJobs.push(job);
  }

  return { cancelledJobIds, unknownCancelIds, retainedJobIds, insertedJobs, ignoredTerminalDedupeKeys };
}

export type JobFailureCause = "worker_error" | "ai_unavailable" | "lease_expired" | "stale_data" | "database_unavailable";

export type JobFailureDecision =
  | { disposition: "retry"; jobStatus: "pending"; runAtMs: number; delayMs: number }
  | { disposition: "technical_error"; jobStatus: "failed"; result: ReturnType<typeof technicalErrorOutcome> }
  | { disposition: "reclaim"; jobStatus: "unchanged"; code: "JOB_LEASE_INVALID" }
  | { disposition: "cancel"; jobStatus: "cancelled"; code: "STALE_JOB" }
  | { disposition: "preserve_and_alert"; jobStatus: "unchanged"; code: "DATABASE_UNAVAILABLE" };

export function decideJobFailure(input: { attempts: number; nowMs: number; cause: JobFailureCause }): JobFailureDecision {
  if (input.cause === "lease_expired") return { disposition: "reclaim", jobStatus: "unchanged", code: "JOB_LEASE_INVALID" };
  if (input.cause === "stale_data") return { disposition: "cancel", jobStatus: "cancelled", code: "STALE_JOB" };
  if (input.cause === "database_unavailable") {
    return { disposition: "preserve_and_alert", jobStatus: "unchanged", code: "DATABASE_UNAVAILABLE" };
  }
  if (input.attempts >= MAX_JOB_ATTEMPTS) {
    return { disposition: "technical_error", jobStatus: "failed", result: technicalErrorOutcome() };
  }
  const delayMs = JOB_RETRY_BACKOFF_MS[Math.max(0, input.attempts - 1)] ?? JOB_RETRY_BACKOFF_MS.at(-1)!;
  return { disposition: "retry", jobStatus: "pending", runAtMs: input.nowMs + delayMs, delayMs };
}
