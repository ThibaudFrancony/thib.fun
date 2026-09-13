import { describe, expect, it } from "vitest";
import { initializeTrouNoir, reduceTrouNoir, applyTrouNoirJudgment, onTrouNoirDeadline, trouNoirActiveSeat, type TrouNoirEngineContext } from "@/games/trou-noir/engine";
import type { QuizQuestion, TrouNoirContent, TrouNoirState } from "@/games/trou-noir/types";

const participants = ["alice", "bob"] as const;

function makeQuestions(): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  for (const difficulty of [3, 4, 5, 6]) {
    for (let index = 0; index < 12; index += 1) {
      questions.push({
        itemId: `culture-${difficulty}-${index}`,
        packId: "pack-test",
        logicalKey: `culture-${difficulty}-${index}`,
        category: "culture",
        themeLabel: "Culture",
        difficulty,
        prompt: `Question culture ${difficulty}/${index} ?`,
        canonical: `Réponse ${difficulty} ${index}`,
        aliases: [],
        answerType: "text",
        requiredPrecision: "Réponse exacte.",
        allowSurnameOnly: false,
        allowDescription: false,
        numericTolerance: 0,
        explanation: "Explication vérifiée.",
      });
    }
  }
  return questions;
}

const content: TrouNoirContent = {
  packId: "pack-test",
  packVersion: 1,
  questions: makeQuestions(),
};

const entropy = Array.from({ length: 512 }, (_, index) => ((index * 37 + 11) % 997) / 997);

function context(actorId: string | null = "alice", overrides: Partial<TrouNoirEngineContext> = {}): TrouNoirEngineContext {
  return {
    nowMs: Date.parse("2026-09-11T12:00:00.000Z"),
    actorId,
    matchId: "match-trou-noir-test",
    participants,
    content,
    entropy,
    phaseId: "phase-current",
    nextPhaseId: "phase-next",
    currentDeadlineAt: "2026-09-11T12:01:00.000Z",
    currentDeadlineKind: "turn_timeout",
    ...overrides,
  };
}

function init(maxRounds: 5 | 10 = 5, firstSeat: 0 | 1 = 0) {
  return initializeTrouNoir(
    { maxRounds, answerSeconds: 60, categories: ["culture"], firstSeat },
    context("alice", { phaseId: "phase-0", nextPhaseId: "phase-0" }),
  );
}

function answerFlow(
  state: TrouNoirState,
  seat: 0 | 1,
  rawAnswer: string,
  verdict: "accept" | "reject",
  nowMs: number,
): TrouNoirState {
  const actor = participants[seat];
  const submitted = reduceTrouNoir(
    state,
    { type: "SUBMIT_ANSWER", answer: rawAnswer },
    { maxRounds: 5, answerSeconds: 60, categories: ["culture"] },
    context(actor, { nowMs, phaseId: "p-answer", nextPhaseId: `attempt-${nowMs}-${seat}` }),
  );
  expect(submitted.state.phase).toBe("judging");
  const judged = applyTrouNoirJudgment(
    submitted.state,
    { attemptId: `attempt-${nowMs}-${seat}`, verdict, method: "exact" },
    { maxRounds: 5, answerSeconds: 60, categories: ["culture"] },
    context(null, { nowMs: nowMs + 500, phaseId: `attempt-${nowMs}-${seat}`, nextPhaseId: `reveal-${nowMs}-${seat}` }),
  );
  expect(judged.state.phase).toBe("reveal");
  return judged.state;
}

function closeReveal(state: TrouNoirState, nowMs: number): TrouNoirState {
  const config = { maxRounds: 5, answerSeconds: 60, categories: ["culture"] };
  const first = reduceTrouNoir(
    state,
    { type: "NEXT" },
    config,
    context("alice", { nowMs, phaseId: "reveal-x", nextPhaseId: "reveal-x", currentDeadlineAt: "2026-09-11T12:05:00.000Z", currentDeadlineKind: "advance_reveal" }),
  );
  if (first.state.phase !== "reveal") return first.state;
  const second = reduceTrouNoir(
    first.state,
    { type: "NEXT" },
    config,
    context("bob", { nowMs: nowMs + 100, phaseId: "reveal-x", nextPhaseId: "after-reveal", currentDeadlineAt: "2026-09-11T12:05:00.000Z", currentDeadlineKind: "advance_reveal" }),
  );
  return second.state;
}

describe("moteur Trou Noir", () => {
  it("initialise réserves, tirage apparié et premier joueur", () => {
    const transition = init();
    expect(transition.state.phase).toBe("answering");
    expect(transition.state.reserves).toEqual([100, 100]);
    expect(transition.state.round).toBe(1);
    expect(transition.state.turnInRound).toBe(0);
    expect(transition.deadlineKind).toBe("turn_timeout");
    expect(transition.jobs).toHaveLength(1);
    for (const entry of transition.state.schedule) {
      expect(entry.questions[0].itemId).not.toBe(entry.questions[1].itemId);
    }
    const keys = transition.state.schedule.flatMap((entry) => [
      entry.questions[0].itemId,
      entry.questions[1].itemId,
      ...entry.replacements[0].map((ref) => ref.itemId),
      ...entry.replacements[1].map((ref) => ref.itemId),
    ]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("refuse le démarrage sans couverture suffisante", () => {
    expect(() =>
      initializeTrouNoir(
        { maxRounds: 10, answerSeconds: 60, categories: ["sport"], firstSeat: 0 as const },
        context("alice", { phaseId: "p0", nextPhaseId: "p0" }),
      ),
    ).toThrow("CONTENT_UNAVAILABLE");
  });

  it("seul le joueur actif peut répondre", () => {
    const { state } = init(5, 0);
    expect(trouNoirActiveSeat(state)).toBe(0);
    expect(() =>
      reduceTrouNoir(
        state,
        { type: "SUBMIT_ANSWER", answer: "x" },
        { maxRounds: 5, answerSeconds: 60, categories: ["culture"] },
        context("bob"),
      ),
    ).toThrow("NOT_YOUR_TURN");
  });

  it("bonne réponse conserve la réserve, mauvaise fait perdre 10", () => {
    let state = init(5, 0).state;
    state = answerFlow(state, 0, "bonne", "accept", Date.parse("2026-09-11T12:00:10.000Z"));
    state = closeReveal(state, Date.parse("2026-09-11T12:00:30.000Z"));
    expect(state.reserves).toEqual([100, 100]);
    expect(state.perPlayer[0].correct).toBe(1);
    state = answerFlow(state, 1, "mauvaise", "reject", Date.parse("2026-09-11T12:01:10.000Z"));
    state = closeReveal(state, Date.parse("2026-09-11T12:01:30.000Z"));
    expect(state.reserves).toEqual([100, 90]);
    expect(state.perPlayer[1].incorrect).toBe(1);
  });

  it("à 10 de réserve, le second joue encore ; double échec => égalité", () => {
    let state = init(5, 0).state;
    state = { ...state, reserves: [10, 10] };
    // Premier tour : l'actif (siège 0) rate.
    state = answerFlow(state, 0, "mauvaise", "reject", Date.parse("2026-09-11T12:00:10.000Z"));
    state = closeReveal(state, Date.parse("2026-09-11T12:00:30.000Z"));
    // La manche n'est pas finie : second tour toujours à jouer malgré le 0.
    expect(state.phase).toBe("answering");
    expect(state.reserves).toEqual([0, 10]);
    expect(state.turnInRound).toBe(1);
    // Second tour : l'autre rate aussi.
    state = answerFlow(state, 1, "mauvaise", "reject", Date.parse("2026-09-11T12:01:10.000Z"));
    const closed = reduceTrouNoir(
      { ...state },
      { type: "NEXT" },
      { maxRounds: 5, answerSeconds: 60, categories: ["culture"] },
      context("alice", { nowMs: Date.parse("2026-09-11T12:01:30.000Z"), phaseId: "r", nextPhaseId: "r2", currentDeadlineAt: "2026-09-11T12:05:00.000Z", currentDeadlineKind: "advance_reveal" }),
    );
    const finished = reduceTrouNoir(
      closed.state,
      { type: "NEXT" },
      { maxRounds: 5, answerSeconds: 60, categories: ["culture"] },
      context("bob", { nowMs: Date.parse("2026-09-11T12:01:31.000Z"), phaseId: "r", nextPhaseId: "r2", currentDeadlineAt: "2026-09-11T12:05:00.000Z", currentDeadlineKind: "advance_reveal" }),
    );
    expect(finished.state.phase).toBe("finished");
    expect(finished.result?.outcome).toBe("draw");
    expect(finished.state.reserves).toEqual([0, 0]);
  });

  it("expiration sans réponse => révélation temps écoulé puis -10 non contestable", () => {
    const { state } = init(5, 0);
    const timedOut = onTrouNoirDeadline(
      state,
      "turn_timeout",
      { maxRounds: 5, answerSeconds: 60, categories: ["culture"] },
      context(null, { nowMs: Date.parse("2026-09-11T12:02:00.000Z"), phaseId: "p-answer", nextPhaseId: "p-timeout" }),
    );
    expect(timedOut.state.phase).toBe("reveal");
    expect(timedOut.state.currentAttempt?.timeout).toBe(true);
    expect(timedOut.state.pendingVerdict).toBe("reject");
    expect(() =>
      reduceTrouNoir(
        timedOut.state,
        { type: "CONTEST", attemptId: timedOut.state.currentAttempt!.id },
        { maxRounds: 5, answerSeconds: 60, categories: ["culture"] },
        context("alice", { nowMs: Date.parse("2026-09-11T12:02:05.000Z") }),
      ),
    ).toThrow("CONTEST_NOT_ALLOWED");
  });

  it("contestation acceptée transforme -10 en 0, une seule fois", () => {
    let state = init(5, 0).state;
    state = answerFlow(state, 0, "discutable", "reject", Date.parse("2026-09-11T12:00:10.000Z"));
    const attemptId = state.currentAttempt!.id;
    const contested = reduceTrouNoir(
      state,
      { type: "CONTEST", attemptId },
      { maxRounds: 5, answerSeconds: 60, categories: ["culture"] },
      context("alice", { nowMs: Date.parse("2026-09-11T12:00:20.000Z"), phaseId: "rev", nextPhaseId: "contest-phase" }),
    );
    expect(contested.state.contest?.status).toBe("pending");
    // NEXT ne contourne pas la fenêtre de l'autre.
    expect(() =>
      reduceTrouNoir(
        contested.state,
        { type: "NEXT" },
        { maxRounds: 5, answerSeconds: 60, categories: ["culture"] },
        context("alice", { nowMs: Date.parse("2026-09-11T12:00:21.000Z") }),
      ),
    ).toThrow("CONTEST_PENDING");
    const resolved = reduceTrouNoir(
      contested.state,
      { type: "RESOLVE_CONTEST", attemptId, accept: true },
      { maxRounds: 5, answerSeconds: 60, categories: ["culture"] },
      context("bob", { nowMs: Date.parse("2026-09-11T12:00:25.000Z"), phaseId: "contest-phase", nextPhaseId: "contest-phase", currentDeadlineAt: contested.deadlineAt, currentDeadlineKind: "contest_timeout" }),
    );
    expect(resolved.state.pendingVerdict).toBe("accept");
    const closed = closeReveal(resolved.state, Date.parse("2026-09-11T12:00:40.000Z"));
    expect(closed.reserves).toEqual([100, 100]);
    // Une seule contestation : la seconde est refusée.
    expect(() =>
      reduceTrouNoir(
        contested.state,
        { type: "CONTEST", attemptId },
        { maxRounds: 5, answerSeconds: 60, categories: ["culture"] },
        context("alice", { nowMs: Date.parse("2026-09-11T12:00:22.000Z") }),
      ),
    ).toThrow("CONTEST_ALREADY_OPEN");
  });

  it("question invalide => deux remplacements sans pénalité, puis abandon technique au 3e void consécutif", () => {
    const { state } = init(5, 0);
    const submitted = reduceTrouNoir(
      state,
      { type: "SUBMIT_ANSWER", answer: "doute" },
      { maxRounds: 5, answerSeconds: 60, categories: ["culture"] },
      context("alice", { nowMs: Date.parse("2026-09-11T12:00:10.000Z"), phaseId: "pa", nextPhaseId: "att-1" }),
    );
    const replaced = applyTrouNoirJudgment(
      submitted.state,
      { attemptId: "att-1", verdict: "ambiguous", method: "llm" },
      { maxRounds: 5, answerSeconds: 60, categories: ["culture"] },
      context(null, { nowMs: Date.parse("2026-09-11T12:00:12.000Z"), phaseId: "att-1", nextPhaseId: "pa2" }),
    );
    expect(replaced.state.phase).toBe("answering");
    expect(replaced.state.reserves).toEqual([100, 100]);
    expect(replaced.state.replacementCount).toBe(1);
    expect(replaced.state.consecutiveVoids).toBe(1);
    const submitted2 = reduceTrouNoir(
      replaced.state,
      { type: "SUBMIT_ANSWER", answer: "doute" },
      { maxRounds: 5, answerSeconds: 60, categories: ["culture"] },
      context("alice", { nowMs: Date.parse("2026-09-11T12:00:20.000Z"), phaseId: "pa2", nextPhaseId: "att-2" }),
    );
    const replaced2 = applyTrouNoirJudgment(
      submitted2.state,
      { attemptId: "att-2", verdict: "ambiguous", method: "llm" },
      { maxRounds: 5, answerSeconds: 60, categories: ["culture"] },
      context(null, { nowMs: Date.parse("2026-09-11T12:00:22.000Z"), phaseId: "att-2", nextPhaseId: "pa3" }),
    );
    expect(replaced2.state.phase).toBe("answering");
    expect(replaced2.state.replacementCount).toBe(2);
    expect(replaced2.state.consecutiveVoids).toBe(2);
    expect(replaced2.state.reserves).toEqual([100, 100]);
    const submitted3 = reduceTrouNoir(
      replaced2.state,
      { type: "SUBMIT_ANSWER", answer: "doute" },
      { maxRounds: 5, answerSeconds: 60, categories: ["culture"] },
      context("alice", { nowMs: Date.parse("2026-09-11T12:00:30.000Z"), phaseId: "pa3", nextPhaseId: "att-3" }),
    );
    const abandoned = applyTrouNoirJudgment(
      submitted3.state,
      { attemptId: "att-3", verdict: "ambiguous", method: "llm" },
      { maxRounds: 5, answerSeconds: 60, categories: ["culture"] },
      context(null, { nowMs: Date.parse("2026-09-11T12:00:32.000Z"), phaseId: "att-3", nextPhaseId: "pa4" }),
    );
    expect(abandoned.state.phase).toBe("finished");
    expect(abandoned.result?.outcome).toBe("abandoned");
    expect(abandoned.result?.reason).toBe("judging_unavailable");
  });

  it("après 5 manches en format court, le plus haut score gagne sans tour bonus", () => {
    const config = { maxRounds: 5 as const, answerSeconds: 60 as const, categories: ["culture"] as ["culture"] };
    let state = init(5, 0).state;
    let clock = Date.parse("2026-09-11T12:00:10.000Z");
    for (let round = 0; round < 5; round += 1) {
      for (let turn = 0; turn < 2; turn += 1) {
        const seat = trouNoirActiveSeat(state);
        // Alice (siège 0) réussit, Bob échoue : écart net par manche.
        const verdict = seat === 0 ? "accept" : "reject";
        state = answerFlow(state, seat, verdict === "accept" ? "bonne" : "mauvaise", verdict, clock);
        clock += 20_000;
        state = closeReveal(state, clock);
        clock += 20_000;
        if (state.phase === "finished") break;
      }
      if (state.phase === "finished") break;
    }
    expect(state.phase).toBe("finished");
    expect(state.reserves[0]).toBeGreaterThan(state.reserves[1]);
    void config;
  });

  it("phase judging : pas de seconde réponse, verdict périmé rejeté", () => {
    const config = { maxRounds: 5, answerSeconds: 60, categories: ["culture"] };
    const { state } = init(5, 0);
    const submitted = reduceTrouNoir(
      state,
      { type: "SUBMIT_ANSWER", answer: "doute" },
      config,
      context("alice", { nowMs: Date.parse("2026-09-11T12:00:10.000Z"), phaseId: "pa", nextPhaseId: "att-1" }),
    );
    expect(submitted.state.phase).toBe("judging");
    expect(submitted.jobs.some((job) => job.kind === "judge_answer")).toBe(true);
    const judgeJob = submitted.jobs.find((job) => job.kind === "judge_answer");
    expect(judgeJob).toMatchObject({
      phaseId: "att-1",
      payload: {
        matchId: "match-trou-noir-test",
        attemptId: "att-1",
        phaseId: "att-1",
        expectedPhaseId: "att-1",
      },
    });
    expect(submitted.deadlineAt).toBeNull();
    // Aucune nouvelle réponse pendant le jugement, même par l'autre joueur.
    expect(() =>
      reduceTrouNoir(submitted.state, { type: "SUBMIT_ANSWER", answer: "x" }, config, context("bob", { nowMs: Date.parse("2026-09-11T12:00:11.000Z") })),
    ).toThrow("WRONG_PHASE");
    // Verdict avec un mauvais attemptId : ignoré comme périmé.
    expect(() =>
      applyTrouNoirJudgment(
        submitted.state,
        { attemptId: "att-perime", verdict: "accept", method: "exact" },
        config,
        context(null, { nowMs: Date.parse("2026-09-11T12:00:12.000Z"), phaseId: "att-1", nextPhaseId: "rev-1" }),
      ),
    ).toThrow("STALE_DEADLINE");
    // Verdict valide -> reveal, puis un second verdict identique est périmé.
    const judged = applyTrouNoirJudgment(
      submitted.state,
      { attemptId: "att-1", verdict: "reject", method: "exact" },
      config,
      context(null, { nowMs: Date.parse("2026-09-11T12:00:12.000Z"), phaseId: "att-1", nextPhaseId: "rev-1" }),
    );
    expect(judged.state.phase).toBe("reveal");
    expect(() =>
      applyTrouNoirJudgment(
        judged.state,
        { attemptId: "att-1", verdict: "accept", method: "exact" },
        config,
        context(null, { nowMs: Date.parse("2026-09-11T12:00:13.000Z"), phaseId: "rev-1", nextPhaseId: "rev-2" }),
      ),
    ).toThrow("STALE_DEADLINE");
  });

  it("timeouts : contest_timeout expiré maintient le rejet, advance_reveal clôture", () => {
    const config = { maxRounds: 5, answerSeconds: 60, categories: ["culture"] };
    let state = init(5, 0).state;
    state = answerFlow(state, 0, "discutable", "reject", Date.parse("2026-09-11T12:00:10.000Z"));
    const attemptId = state.currentAttempt!.id;
    const contested = reduceTrouNoir(
      state,
      { type: "CONTEST", attemptId },
      config,
      context("alice", { nowMs: Date.parse("2026-09-11T12:00:20.000Z"), phaseId: "rev", nextPhaseId: "contest-phase" }),
    );
    const expired = onTrouNoirDeadline(
      contested.state,
      "contest_timeout",
      config,
      context(null, { nowMs: Date.parse("2026-09-11T12:00:45.000Z"), phaseId: "contest-phase", nextPhaseId: "after" }),
    );
    expect(expired.state.phase).toBe("answering");
    expect(expired.state.reserves).toEqual([90, 100]);
    expect(expired.state.perPlayer[0].incorrect).toBe(1);
    expect(expired.state.perPlayer[0].contestsAccepted).toBe(0);
    // Deadline d'une ancienne phase de révélation après clôture : périmée.
    expect(() =>
      onTrouNoirDeadline(
        expired.state,
        "advance_reveal",
        config,
        context(null, { nowMs: Date.parse("2026-09-11T12:00:50.000Z"), phaseId: "rev", nextPhaseId: "after2" }),
      ),
    ).toThrow("STALE_DEADLINE");
  });

  it("contestation acceptée compte contestsAccepted une seule fois, y compris dans ResultSpec", () => {
    const config = { maxRounds: 5, answerSeconds: 60, categories: ["culture"] };
    let state = init(5, 0).state;
    state = answerFlow(state, 0, "discutable", "reject", Date.parse("2026-09-11T12:00:10.000Z"));
    const attemptId = state.currentAttempt!.id;
    const contested = reduceTrouNoir(
      state,
      { type: "CONTEST", attemptId },
      config,
      context("alice", { nowMs: Date.parse("2026-09-11T12:00:20.000Z"), phaseId: "rev", nextPhaseId: "contest-phase" }),
    );
    const resolved = reduceTrouNoir(
      contested.state,
      { type: "RESOLVE_CONTEST", attemptId, accept: true },
      config,
      context("bob", { nowMs: Date.parse("2026-09-11T12:00:25.000Z"), phaseId: "contest-phase", nextPhaseId: "contest-phase", currentDeadlineAt: contested.deadlineAt, currentDeadlineKind: "contest_timeout" }),
    );
    // Seconde résolution du même litige : refusée, pas de double comptage.
    expect(() =>
      reduceTrouNoir(
        resolved.state,
        { type: "RESOLVE_CONTEST", attemptId, accept: true },
        config,
        context("bob", { nowMs: Date.parse("2026-09-11T12:00:26.000Z"), phaseId: "contest-phase", nextPhaseId: "contest-phase" }),
      ),
    ).toThrow("NO_CONTEST_PENDING");
    const closed = closeReveal(resolved.state, Date.parse("2026-09-11T12:00:40.000Z"));
    expect(closed.perPlayer[0].correct).toBe(1);
    expect(closed.perPlayer[0].contestsAccepted).toBe(1);
    expect(closed.perPlayer[0].incorrect).toBe(0);
    // Une clôture rejouée via la deadline converge sans recompter :
    // contest_timeout sur l'état reveal déjà résolu ferme exactement une fois,
    // puis toute deadline rejouée sur l'état fermé est périmée.
    const replayed = onTrouNoirDeadline(
      resolved.state,
      "contest_timeout",
      config,
      context(null, { nowMs: Date.parse("2026-09-11T12:01:00.000Z"), phaseId: "contest-phase", nextPhaseId: "late" }),
    );
    expect(replayed.state.phase).toBe("answering");
    expect(replayed.state.perPlayer[0].correct).toBe(1);
    expect(replayed.state.perPlayer[0].contestsAccepted).toBe(1);
    expect(replayed.state.reserves).toEqual([100, 100]);
    expect(() =>
      onTrouNoirDeadline(
        replayed.state,
        "contest_timeout",
        config,
        context(null, { nowMs: Date.parse("2026-09-11T12:01:10.000Z"), phaseId: "late", nextPhaseId: "later" }),
      ),
    ).toThrow("STALE_DEADLINE");
    // Le compteur survit jusqu'au résultat final via une partie complète.
    let running: TrouNoirState = closed;
    let clock = Date.parse("2026-09-11T12:00:50.000Z");
    for (let step = 0; step < 20 && running.phase !== "finished"; step += 1) {
      const seat = trouNoirActiveSeat(running);
      running = answerFlow(running, seat, "mauvaise", "reject", clock);
      clock += 20_000;
      running = closeReveal(running, clock);
      clock += 20_000;
    }
    expect(running.phase).toBe("finished");
    expect(running.perPlayer[0].contestsAccepted).toBe(1);
  });

  it("forfait : RESIGN fait gagner l'adversaire, CLAIM_FORFEIT le demandeur, abandon avant le premier tour", () => {
    const config = { maxRounds: 5, answerSeconds: 60, categories: ["culture"] };
    const fresh = init(5, 0).state;
    const resigned = reduceTrouNoir(
      fresh,
      { type: "RESIGN" },
      config,
      context("alice", { nowMs: Date.parse("2026-09-11T12:00:05.000Z"), phaseId: "p0", nextPhaseId: "p-resign" }),
    );
    expect(resigned.state.phase).toBe("finished");
    expect(resigned.result?.outcome).toBe("abandoned");
    expect(resigned.result?.winnerId).toBeNull();
    // CLAIM_FORFEIT avant le premier tour : aucun tour joué => abandon sans vainqueur.
    const claimedEarly = reduceTrouNoir(
      fresh,
      { type: "CLAIM_FORFEIT" },
      config,
      context("alice", { nowMs: Date.parse("2026-09-11T12:00:06.000Z"), phaseId: "p0", nextPhaseId: "p-claim-early" }),
    );
    expect(claimedEarly.state.phase).toBe("finished");
    expect(claimedEarly.result?.outcome).toBe("abandoned");
    expect(claimedEarly.result?.winnerId).toBeNull();
    expect(claimedEarly.result?.reason).toBe("claimed_forfeit");
    // Après un tour joué, le forfait départage réellement.
    let played = answerFlow(fresh, 0, "bonne", "accept", Date.parse("2026-09-11T12:00:10.000Z"));
    played = closeReveal(played, Date.parse("2026-09-11T12:00:30.000Z"));
    const resignLate = reduceTrouNoir(
      played,
      { type: "RESIGN" },
      config,
      context("alice", { nowMs: Date.parse("2026-09-11T12:01:00.000Z"), phaseId: "p1", nextPhaseId: "p-resign2" }),
    );
    expect(resignLate.result?.outcome).toBe("win");
    expect(resignLate.result?.winnerId).toBe("bob");
    expect(resignLate.result?.reason).toBe("resign");
    const claimed = reduceTrouNoir(
      played,
      { type: "CLAIM_FORFEIT" },
      config,
      context("alice", { nowMs: Date.parse("2026-09-11T12:01:00.000Z"), phaseId: "p1", nextPhaseId: "p-claim" }),
    );
    expect(claimed.result?.outcome).toBe("win");
    expect(claimed.result?.winnerId).toBe("alice");
    expect(claimed.result?.reason).toBe("claimed_forfeit");
  });

  it("NEXT exige deux confirmations distinctes sans contestation en cours", () => {
    const config = { maxRounds: 5, answerSeconds: 60, categories: ["culture"] };
    let state = init(5, 0).state;
    state = answerFlow(state, 0, "mauvaise", "reject", Date.parse("2026-09-11T12:00:10.000Z"));
    const first = reduceTrouNoir(
      state,
      { type: "NEXT" },
      config,
      context("alice", { nowMs: Date.parse("2026-09-11T12:00:30.000Z"), phaseId: "rev", nextPhaseId: "rev", currentDeadlineAt: "2026-09-11T12:05:00.000Z", currentDeadlineKind: "advance_reveal" }),
    );
    expect(first.state.phase).toBe("reveal");
    expect(first.state.acknowledgedBy).toEqual(["alice"]);
    // Le même joueur ne peut pas confirmer deux fois.
    expect(() =>
      reduceTrouNoir(
        first.state,
        { type: "NEXT" },
        config,
        context("alice", { nowMs: Date.parse("2026-09-11T12:00:31.000Z"), phaseId: "rev", nextPhaseId: "rev" }),
      ),
    ).toThrow("ALREADY_ACKNOWLEDGED");
    const second = reduceTrouNoir(
      first.state,
      { type: "NEXT" },
      config,
      context("bob", { nowMs: Date.parse("2026-09-11T12:00:32.000Z"), phaseId: "rev", nextPhaseId: "after", currentDeadlineAt: "2026-09-11T12:05:00.000Z", currentDeadlineKind: "advance_reveal" }),
    );
    expect(second.state.phase).toBe("answering");
    expect(second.state.reserves).toEqual([90, 100]);
  });
});
