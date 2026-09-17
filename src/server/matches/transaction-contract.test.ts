import { describe, expect, it } from "vitest";
import {
  ABSENCE_GRACE_MS,
  JOB_RETRY_BACKOFF_MS,
  MAX_JOB_ATTEMPTS,
  absenceDedupeKey,
  classifyTransactionCommand,
  deadlineDedupeKey,
  decideCommit,
  decideJobFailure,
  evaluateDeadline,
  inspectReceipt,
  isAbsenceConditionMet,
  isAtOrAfterDeadline,
  isNewerSnapshot,
  judgeDedupeKey,
  outcomeForExit,
  reconcileJobs,
  seatForActor,
  snapshotKey,
  technicalErrorOutcome,
  validateCommitIdentity,
  validateJobLease,
  type CommitIdentity,
  type CommitSnapshot,
  type ExistingJob,
  type JobCommitDescriptor,
  type ReceiptRecord,
} from "@/server/matches/transaction-contract";

const MATCH = "00000000-0000-4000-8000-000000000001";
const OTHER_MATCH = "00000000-0000-4000-8000-000000000002";
const PHASE = "00000000-0000-4000-8000-000000000011";
const OTHER_PHASE = "00000000-0000-4000-8000-000000000012";
const ALICE = "00000000-0000-4000-8000-000000000101";
const BOB = "00000000-0000-4000-8000-000000000102";
const COMMAND = "00000000-0000-4000-8000-000000000201";
const OTHER_COMMAND = "00000000-0000-4000-8000-000000000202";
const JOB = "00000000-0000-4000-8000-000000000301";
const LEASE = "00000000-0000-4000-8000-000000000302";
const HASH = "a".repeat(64);

const nowMs = Date.parse("2026-09-13T12:00:00.000Z");
const deadlineAt = new Date(nowMs + 10_000).toISOString();
const expiredAt = new Date(nowMs - 1).toISOString();

function identity(overrides: Partial<CommitIdentity> = {}): CommitIdentity {
  return {
    matchId: MATCH,
    phaseId: PHASE,
    stateVersion: 7,
    actorId: ALICE,
    actorSeat: 0,
    source: "player",
    commandId: COMMAND,
    commandType: "MOVE",
    commandHash: HASH,
    jobId: null,
    leaseToken: null,
    ...overrides,
  };
}

function snapshot(overrides: Partial<CommitSnapshot> = {}): CommitSnapshot {
  return {
    matchId: MATCH,
    phaseId: PHASE,
    stateVersion: 7,
    participants: [ALICE, BOB],
    ...overrides,
  };
}

function job(overrides: Partial<JobCommitDescriptor> = {}): JobCommitDescriptor {
  return {
    jobId: JOB,
    leaseToken: LEASE,
    matchId: MATCH,
    kind: "turn_timeout",
    phaseId: PHASE,
    status: "running",
    leaseUntilMs: nowMs + 30_000,
    ...overrides,
  };
}

function jobIdentity(overrides: Partial<CommitIdentity> = {}): CommitIdentity {
  return identity({
    actorId: null,
    actorSeat: null,
    source: "job",
    commandId: JOB,
    commandType: "turn_timeout",
    jobId: JOB,
    leaseToken: LEASE,
    ...overrides,
  });
}

describe("contrat transactionnel commun — règles d'échéance", () => {
  it("distingue les commandes joueur des jobs et les interruptions coopératives", () => {
    expect(classifyTransactionCommand("player", "MOVE", "competitive")).toBe("normal_move");
    expect(classifyTransactionCommand("player", "RESIGN", "competitive")).toBe("resign");
    expect(classifyTransactionCommand("player", "CLAIM_FORFEIT", "competitive")).toBe("normal_move");
    expect(classifyTransactionCommand("player", "RESIGN", "cooperative")).toBe("cooperative_interruption");
    expect(classifyTransactionCommand("job", "check_absence", "competitive")).toBe("absence");
    expect(classifyTransactionCommand("job", "judge_answer", "competitive")).toBe("judgment");
    expect(classifyTransactionCommand("job", "preparation_timeout", "competitive")).toBe("preparation");
    expect(classifyTransactionCommand("job", "turn_timeout", "competitive")).toBe("deadline_job");
  });

  it("rejette un coup normal à la deadline exacte, sans deadline de joueur si elle est nulle", () => {
    expect(isAtOrAfterDeadline(nowMs, new Date(nowMs).toISOString())).toBe(true);
    expect(evaluateDeadline({
      source: "player",
      commandType: "MOVE",
      matchKind: "competitive",
      nowMs,
      blockingDeadlineAt: new Date(nowMs).toISOString(),
    })).toEqual({ allowed: false, code: "DEADLINE_EXPIRED" });
    expect(evaluateDeadline({
      source: "player",
      commandType: "MOVE",
      matchKind: "competitive",
      nowMs,
      blockingDeadlineAt: null,
    })).toEqual({ allowed: true, mode: "player" });
  });

  it("laisse RESIGN passer après expiration, sans commande de forfait", () => {
    expect(evaluateDeadline({
      source: "player",
      commandType: "RESIGN",
      matchKind: "competitive",
      nowMs,
      blockingDeadlineAt: expiredAt,
    })).toEqual({ allowed: true, mode: "exit" });
    expect(evaluateDeadline({
      source: "player",
      commandType: "CLAIM_FORFEIT",
      matchKind: "competitive",
      nowMs,
      blockingDeadlineAt: expiredAt,
      opponentLastSeenAt: new Date(nowMs - ABSENCE_GRACE_MS).toISOString(),
    })).toEqual({ allowed: false, code: "DEADLINE_EXPIRED" });
  });

  it("applique la grâce d'absence unique de 30 secondes", () => {
    const recent = new Date(nowMs - ABSENCE_GRACE_MS + 1).toISOString();
    const stale = new Date(nowMs - ABSENCE_GRACE_MS).toISOString();

    expect(isAbsenceConditionMet([stale, recent], nowMs)).toBe(true);
    expect(isAbsenceConditionMet([stale, stale], nowMs)).toBe(true);
    expect(isAbsenceConditionMet([recent, recent], nowMs)).toBe(false);
  });

  it("sépare jugement, préparation, timeout de phase et absence", () => {
    expect(evaluateDeadline({
      source: "job",
      commandType: "judge_answer",
      matchKind: "competitive",
      nowMs,
      blockingDeadlineAt: null,
      jobRunAt: new Date(nowMs).toISOString(),
      jobPhaseId: PHASE,
      currentPhaseId: PHASE,
    })).toEqual({ allowed: true, mode: "job" });
    expect(evaluateDeadline({
      source: "job",
      commandType: "preparation_timeout",
      matchKind: "competitive",
      nowMs,
      blockingDeadlineAt: new Date(nowMs).toISOString(),
      jobRunAt: new Date(nowMs).toISOString(),
      jobPhaseId: PHASE,
      currentPhaseId: PHASE,
    })).toEqual({ allowed: true, mode: "job" });
    expect(evaluateDeadline({
      source: "job",
      commandType: "turn_timeout",
      matchKind: "competitive",
      nowMs,
      blockingDeadlineAt: expiredAt,
      jobRunAt: new Date(nowMs).toISOString(),
      jobPhaseId: OTHER_PHASE,
      currentPhaseId: PHASE,
    })).toEqual({ allowed: false, code: "STALE_JOB" });
    expect(evaluateDeadline({
      source: "job",
      commandType: "check_absence",
      matchKind: "competitive",
      nowMs,
      blockingDeadlineAt: deadlineAt,
      jobRunAt: expiredAt,
      jobPhaseId: null,
      currentPhaseId: OTHER_PHASE,
      absenceCondition: false,
    })).toEqual({ allowed: false, disposition: "absence_noop" });
    expect(evaluateDeadline({
      source: "job",
      commandType: "check_absence",
      matchKind: "cooperative",
      nowMs,
      blockingDeadlineAt: deadlineAt,
      jobRunAt: expiredAt,
      jobPhaseId: null,
      currentPhaseId: OTHER_PHASE,
      absenceCondition: true,
    })).toEqual({ allowed: true, mode: "job" });
  });

  it("produit un abandon sans gagnant pour les interruptions coopératives et techniques", () => {
    expect(outcomeForExit({ matchKind: "competitive", exit: "resign", actorId: ALICE, opponentId: BOB, firstTurnStarted: true }))
      .toEqual({ outcome: "win", winnerId: BOB, sharedScore: null, reason: "resign" });
    expect(outcomeForExit({ matchKind: "competitive", exit: "resign", actorId: ALICE, opponentId: BOB, firstTurnStarted: false }))
      .toEqual({ outcome: "abandoned", winnerId: null, sharedScore: null, reason: "resign" });
    expect(outcomeForExit({ matchKind: "competitive", exit: "absence", actorId: ALICE, opponentId: BOB, firstTurnStarted: true }))
      .toEqual({ outcome: "win", winnerId: BOB, sharedScore: null, reason: "absence" });
    expect(outcomeForExit({ matchKind: "cooperative", exit: "absence", actorId: ALICE, opponentId: BOB, firstTurnStarted: true }))
      .toEqual({ outcome: "abandoned", winnerId: null, sharedScore: null, reason: "absence" });
    expect(technicalErrorOutcome()).toEqual({ outcome: "abandoned", winnerId: null, sharedScore: null, reason: "technical_error" });
  });
});

describe("contrat transactionnel commun — snapshot, reçu et siège", () => {
  it("compose une clé de snapshot monotone par partie et version", () => {
    expect(snapshotKey(snapshot())).toBe(`${MATCH}:${PHASE}:7`);
    expect(isNewerSnapshot(snapshot({ stateVersion: 8 }), snapshot())).toBe(true);
    expect(isNewerSnapshot(snapshot({ phaseId: OTHER_PHASE, stateVersion: 8 }), snapshot())).toBe(true);
    expect(isNewerSnapshot(snapshot({ matchId: OTHER_MATCH, stateVersion: 8 }), snapshot())).toBe(false);
    expect(seatForActor([ALICE, BOB], ALICE)).toBe(0);
    expect(seatForActor([ALICE, BOB], BOB)).toBe(1);
    expect(seatForActor([ALICE, BOB], OTHER_MATCH)).toBeNull();
  });

  it("rejoue le reçu exact et refuse toute réutilisation divergente", () => {
    const receipt: ReceiptRecord = {
      commandId: COMMAND,
      actorId: ALICE,
      commandType: "MOVE",
      payloadHash: HASH,
      committedVersion: 8,
      response: { version: 8 },
    };
    expect(inspectReceipt(receipt, identity())).toEqual({ kind: "replay", committedVersion: 8, response: { version: 8 } });
    expect(inspectReceipt(receipt, identity({ actorId: BOB, actorSeat: 1 }))).toEqual({ kind: "reject", code: "COMMAND_ID_REUSED" });
    expect(inspectReceipt(receipt, identity({ commandType: "RESIGN" }))).toEqual({ kind: "reject", code: "COMMAND_ID_REUSED" });
    expect(inspectReceipt(receipt, identity({ commandHash: "b".repeat(64) }))).toEqual({ kind: "reject", code: "COMMAND_ID_REUSED" });
    expect(inspectReceipt(null, identity())).toEqual({ kind: "apply" });
  });

  it("contrôle match, phase, version et siège authentifié avant mutation", () => {
    expect(validateCommitIdentity(identity(), snapshot())).toBeNull();
    expect(validateCommitIdentity(identity({ matchId: OTHER_MATCH }), snapshot())).toBe("MATCH_ID_MISMATCH");
    expect(validateCommitIdentity(identity({ phaseId: OTHER_PHASE }), snapshot())).toBe("PHASE_CONFLICT");
    expect(validateCommitIdentity(identity({ stateVersion: 6 }), snapshot())).toBe("VERSION_CONFLICT");
    expect(validateCommitIdentity(identity({ actorId: BOB, actorSeat: 0 }), snapshot())).toBe("ACTOR_SEAT_MISMATCH");
    expect(validateCommitIdentity(identity({ actorId: OTHER_MATCH, actorSeat: 1 }), snapshot())).toBe("NOT_A_PARTICIPANT");
    expect(validateCommitIdentity(identity({ commandHash: "not-a-sha" }), snapshot())).toBe("INVALID_ENVELOPE");
  });

  it("contrôle le bail et autorise check_absence sans le lier à une phase", () => {
    expect(validateJobLease(jobIdentity(), snapshot(), job(), nowMs)).toBeNull();
    expect(validateJobLease(jobIdentity({ commandType: "judge_answer" }), snapshot(), job(), nowMs)).toBe("INVALID_JOB_TYPE");
    const absenceIdentity = jobIdentity({ commandId: JOB, commandType: "check_absence" });
    expect(validateJobLease(absenceIdentity, snapshot(), job({ kind: "check_absence", phaseId: null }), nowMs)).toBeNull();
    expect(validateJobLease(absenceIdentity, snapshot(), job({ kind: "check_absence", phaseId: PHASE }), nowMs)).toBe("STALE_JOB");
    expect(validateJobLease(jobIdentity(), snapshot(), job({ leaseUntilMs: nowMs }), nowMs)).toBe("JOB_LEASE_INVALID");
    expect(validateJobLease(jobIdentity(), snapshot(), job({ phaseId: OTHER_PHASE }), nowMs)).toBe("STALE_JOB");
  });

  it("rejoue un reçu avant les contrôles de version et d'échéance", () => {
    const receipt: ReceiptRecord = {
      commandId: COMMAND,
      actorId: ALICE,
      commandType: "MOVE",
      payloadHash: HASH,
      committedVersion: 8,
      response: { version: 8 },
    };
    const decision = decideCommit({
      snapshot: snapshot({ phaseId: OTHER_PHASE, stateVersion: 8 }),
      identity: identity({ phaseId: PHASE, stateVersion: 7 }),
      receipt,
      deadline: {
        source: "player",
        commandType: "MOVE",
        matchKind: "competitive",
        nowMs,
        blockingDeadlineAt: expiredAt,
      },
    });
    expect(decision).toEqual({ kind: "replay", committedVersion: 8, response: { version: 8 } });
  });
});

describe("contrat transactionnel commun — concurrence et jobs", () => {
  it("ne permet qu'une transition pour deux commandId différents sur la même version", () => {
    const first = decideCommit({
      snapshot: snapshot(),
      identity: identity(),
      deadline: { source: "player", commandType: "MOVE", matchKind: "competitive", nowMs, blockingDeadlineAt: deadlineAt },
    });
    expect(first).toEqual({ kind: "apply", committedVersion: 8 });
    const second = decideCommit({
      snapshot: snapshot({ stateVersion: 8 }),
      identity: identity({ commandId: OTHER_COMMAND, commandHash: "b".repeat(64) }),
      deadline: { source: "player", commandType: "MOVE", matchKind: "competitive", nowMs, blockingDeadlineAt: deadlineAt },
    });
    expect(second).toEqual({ kind: "reject", code: "VERSION_CONFLICT" });
  });

  it("sérialise deux commandes concurrentes sur le même snapshot", async () => {
    let current = snapshot();
    let receipt: ReceiptRecord | null = null;
    let receiptCommandId: string | null = null;
    let tail = Promise.resolve();

    const commit = (command: CommitIdentity) => {
      const run = tail.then(() => {
        const decision = decideCommit({
          snapshot: current,
          identity: command,
          receipt,
          deadline: { source: "player", commandType: "MOVE", matchKind: "competitive", nowMs, blockingDeadlineAt: deadlineAt },
        });
        if (decision.kind === "apply") {
          current = snapshot({ stateVersion: decision.committedVersion });
          receipt = {
            commandId: command.commandId,
            actorId: command.actorId,
            commandType: command.commandType,
            payloadHash: command.commandHash,
            committedVersion: decision.committedVersion,
            response: { version: decision.committedVersion },
          };
          receiptCommandId = command.commandId;
        }
        return decision;
      });
      tail = run.then(() => undefined);
      return run;
    };

    const [first, second] = await Promise.all([
      commit(identity()),
      commit(identity({ commandId: OTHER_COMMAND, commandHash: "b".repeat(64) })),
    ]);

    expect([first.kind, second.kind].sort()).toEqual(["apply", "reject"]);
    expect(current.stateVersion).toBe(8);
    expect(receiptCommandId).toBe(COMMAND);
  });

  it("rend le replay concurrent distinct d'une collision de commandId", () => {
    const firstReceipt: ReceiptRecord = {
      commandId: COMMAND,
      actorId: ALICE,
      commandType: "MOVE",
      payloadHash: HASH,
      committedVersion: 8,
      response: { version: 8, applied: true },
    };
    const retry = decideCommit({
      snapshot: snapshot({ stateVersion: 8, phaseId: OTHER_PHASE }),
      identity: identity({ stateVersion: 7 }),
      receipt: firstReceipt,
      deadline: { source: "player", commandType: "MOVE", matchKind: "competitive", nowMs, blockingDeadlineAt: expiredAt },
    });
    const collision = decideCommit({
      snapshot: snapshot({ stateVersion: 8, phaseId: OTHER_PHASE }),
      identity: identity({ stateVersion: 7, commandType: "RESIGN", commandHash: "b".repeat(64) }),
      receipt: firstReceipt,
      deadline: { source: "player", commandType: "RESIGN", matchKind: "competitive", nowMs, blockingDeadlineAt: expiredAt },
    });
    expect(retry).toEqual({ kind: "replay", committedVersion: 8, response: { version: 8, applied: true } });
    expect(collision).toEqual({ kind: "reject", code: "COMMAND_ID_REUSED" });
  });

  it("conserve, remplace ou annule seulement les jobs explicitement désignés", () => {
    const oldKey = deadlineDedupeKey(MATCH, PHASE, "turn_timeout");
    const currentKey = deadlineDedupeKey(MATCH, OTHER_PHASE, "turn_timeout");
    const terminalKey = deadlineDedupeKey(MATCH, PHASE, "advance_reveal");
    const existing: ExistingJob[] = [
      { id: "old", dedupeKey: oldKey, status: "pending" },
      { id: "current", dedupeKey: currentKey, status: "running" },
      { id: "done", dedupeKey: terminalKey, status: "done" },
    ];
    const replacement = {
      kind: "turn_timeout",
      phaseId: OTHER_PHASE,
      runAt: deadlineAt,
      dedupeKey: deadlineDedupeKey(MATCH, OTHER_PHASE, "turn_timeout"),
      payload: { matchId: MATCH, phaseId: OTHER_PHASE, kind: "turn_timeout" },
    };
    const result = reconcileJobs(existing, [
      { kind: "turn_timeout", phaseId: PHASE, runAt: deadlineAt, dedupeKey: oldKey, payload: {} },
      replacement,
      { kind: "advance_reveal", phaseId: PHASE, runAt: deadlineAt, dedupeKey: terminalKey, payload: {} },
      { kind: "advance_reveal", phaseId: OTHER_PHASE, runAt: deadlineAt, dedupeKey: deadlineDedupeKey(MATCH, OTHER_PHASE, "advance_reveal"), payload: {} },
    ], ["old"]);
    expect(result.cancelledJobIds).toEqual(["old"]);
    expect(result.retainedJobIds).toEqual(["current"]);
    expect(result.ignoredTerminalDedupeKeys).toEqual([oldKey, terminalKey]);
    expect(result.insertedJobs.map((jobItem) => jobItem.dedupeKey)).toEqual([
      deadlineDedupeKey(MATCH, OTHER_PHASE, "advance_reveal"),
    ]);
  });

  it("génère des clés différentes pour un remplacement de phase et les jobs récurrents", () => {
    expect(deadlineDedupeKey(MATCH, PHASE, "turn_timeout")).not.toBe(deadlineDedupeKey(MATCH, OTHER_PHASE, "turn_timeout"));
    expect(judgeDedupeKey(MATCH, COMMAND)).toBe(`${MATCH}:${COMMAND}:judge:v1`);
    expect(absenceDedupeKey(MATCH, 0)).not.toBe(absenceDedupeKey(MATCH, 1));
  });

  it("reprogramme les erreurs transitoires, récupère les baux expirés et termine sans victoire après cinq échecs", () => {
    expect(decideJobFailure({ attempts: 1, nowMs, cause: "worker_error" })).toEqual({
      disposition: "retry", jobStatus: "pending", runAtMs: nowMs + JOB_RETRY_BACKOFF_MS[0], delayMs: JOB_RETRY_BACKOFF_MS[0],
    });
    expect(decideJobFailure({ attempts: 2, nowMs, cause: "ai_unavailable" })).toEqual({
      disposition: "retry", jobStatus: "pending", runAtMs: nowMs + JOB_RETRY_BACKOFF_MS[1], delayMs: JOB_RETRY_BACKOFF_MS[1],
    });
    expect(decideJobFailure({ attempts: MAX_JOB_ATTEMPTS, nowMs, cause: "ai_unavailable" })).toEqual({
      disposition: "technical_error", jobStatus: "failed", result: technicalErrorOutcome(),
    });
    expect(decideJobFailure({ attempts: MAX_JOB_ATTEMPTS, nowMs, cause: "lease_expired" })).toEqual({
      disposition: "reclaim", jobStatus: "unchanged", code: "JOB_LEASE_INVALID",
    });
    expect(decideJobFailure({ attempts: MAX_JOB_ATTEMPTS, nowMs, cause: "stale_data" })).toEqual({
      disposition: "cancel", jobStatus: "cancelled", code: "STALE_JOB",
    });
    expect(decideJobFailure({ attempts: MAX_JOB_ATTEMPTS, nowMs, cause: "database_unavailable" })).toEqual({
      disposition: "preserve_and_alert", jobStatus: "unchanged", code: "DATABASE_UNAVAILABLE",
    });
  });
});
