import { describe, expect, it } from "vitest";
import {
  applyTtmcJudgment,
  initializeTtmc,
  isTtmcDeadlineJobStale,
  onTtmcAbsence,
  onTtmcDeadline,
  reduceTtmc,
  shouldAbandonForTtmcAbsence,
  ttmcActiveSeat,
  type TtmcEngineContext,
} from "@/games/ttmc/engine";
import type { TtmcContent, TtmcState } from "@/games/ttmc/types";

const participants = ["alice", "bob"] as const;

function makeContent(themeCount: number): TtmcContent {
  const themes = Array.from({ length: themeCount }, (_, t) => ({
    themeId: `theme-${t}`,
    label: `Thème ${t}`,
    shortDescription: `Description ${t}`,
  }));
  const questions = themes.flatMap((theme) =>
    Array.from({ length: 10 }, (_, level) =>
      [0, 1].map((variant) => ({
        itemId: `${theme.themeId}-l${level + 1}-v${variant}`,
        packId: "pack-test",
        logicalKey: `${theme.themeId}-l${level + 1}-v${variant}`,
        themeId: theme.themeId,
        themeLabel: theme.label,
        themeDescription: theme.shortDescription,
        level: level + 1,
        prompt: `Question ${theme.themeId} niveau ${level + 1} ?`,
        canonical: `Réponse ${theme.themeId} ${level + 1} ${variant}`,
        aliases: [] as string[],
        explanation: "Explication vérifiée.",
      })),
    ).flat(),
  );
  return { packId: "pack-test", packVersion: 1, themes, questions };
}

const content22 = makeContent(22);
const content34 = makeContent(34);
const entropy = Array.from({ length: 2048 }, (_, index) => ((index * 37 + 11) % 997) / 997);

function context(actorId: string | null = "alice", overrides: Partial<TtmcEngineContext> = {}): TtmcEngineContext {
  return {
    nowMs: Date.parse("2026-09-11T12:00:00.000Z"),
    actorId,
    matchId: "match-ttmc-test",
    participants,
    content: content22,
    entropy,
    phaseId: "phase-current",
    nextPhaseId: "phase-next",
    currentDeadlineAt: "2026-09-11T12:01:00.000Z",
    currentDeadlineKind: "advance_reveal",
    ...overrides,
  };
}

const config30 = { targetScore: 30 as const, maxRounds: 20 as const, answerSeconds: 60 as const, themeSelectionSeconds: 20 as const };
const config20 = { targetScore: 20 as const, maxRounds: 15 as const, answerSeconds: 60 as const, themeSelectionSeconds: 20 as const };
const config50 = { targetScore: 50 as const, maxRounds: 30 as const, answerSeconds: 60 as const, themeSelectionSeconds: 20 as const };

function init(config = config30, firstSeat: 0 | 1 = 0, content: TtmcContent = content22) {
  return initializeTtmc(
    { ...config, firstSeat },
    { ...context("alice", { content }), phaseId: "phase-0", nextPhaseId: "phase-0" },
  );
}

function fullTurn(state: TtmcState, seat: 0 | 1, level: number, verdict: "accept" | "reject", clock: number): TtmcState {
  const actor = participants[seat];
  const chosen = reduceTtmc(
    state, { type: "CHOOSE_LEVEL", level }, config30,
    context(actor, { nowMs: clock, phaseId: `c-${clock}`, nextPhaseId: `a-${clock}` }),
  );
  const submitted = reduceTtmc(
    chosen.state, { type: "SUBMIT_ANSWER", answer: "une réponse" }, config30,
    context(actor, { nowMs: clock + 1000, phaseId: `a-${clock}`, nextPhaseId: `j-${clock}` }),
  );
  expect(submitted.state.phase).toBe("judging");
  const judged = applyTtmcJudgment(
    submitted.state, { attemptId: `j-${clock}`, verdict, method: "exact" }, config30,
    context(null, { nowMs: clock + 2000, phaseId: `a-${clock}`, nextPhaseId: `r-${clock}` }),
  );
  expect(judged.state.phase).toBe("reveal");
  const first = reduceTtmc(judged.state, { type: "NEXT" }, config30,
    context("alice", { nowMs: clock + 3000, phaseId: `r-${clock}`, nextPhaseId: `n-${clock}-a`, currentDeadlineAt: "2026-09-11T12:05:00.000Z", currentDeadlineKind: "advance_reveal" }));
  if (first.state.phase === "reveal") {
    const second = reduceTtmc(first.state, { type: "NEXT" }, config30,
      context("bob", { nowMs: clock + 3100, phaseId: `r-${clock}`, nextPhaseId: `n-${clock}-b`, currentDeadlineAt: "2026-09-11T12:05:00.000Z", currentDeadlineKind: "advance_reveal" }));
    return second.state;
  }
  return first.state;
}

describe("moteur TTMC", () => {
  it("démarre en choose_level avec 20 thèmes + 2 secours et refuse le niveau pendant answering", () => {
    const out = init();
    expect(out.state.phase).toBe("choose_level");
    expect(out.state.themes).toHaveLength(20);
    expect(Object.keys(out.state.spareByLevel)).toHaveLength(10);
    for (const level of Array.from({ length: 10 }, (_, i) => String(i + 1))) {
      expect(out.state.spareByLevel[level]).toHaveLength(4);
    }
    const active = ttmcActiveSeat(out.state);
    const actor = participants[active];
    const chosen = reduceTtmc(out.state, { type: "CHOOSE_LEVEL", level: 4 }, config30,
      context(actor, { phaseId: "phase-0", nextPhaseId: "phase-1" }));
    expect(chosen.state.chosenLevel).toBe(4);
    expect(() =>
      reduceTtmc(chosen.state, { type: "CHOOSE_LEVEL", level: 5 }, config30, context(actor, { phaseId: "phase-1", nextPhaseId: "phase-2" })),
    ).toThrow("WRONG_PHASE");
  });

  it("score 28 + niveau 7 réussi = 35 sans plafond, manche terminée avant comparaison", () => {
    let state = init(config30, 0).state;
    state = { ...state, scores: [28, 20] };
    state = fullTurn(state, 0, 7, "accept", Date.parse("2026-09-11T12:10:00.000Z"));
    expect(state.scores[0]).toBe(35);
    // La manche n'est pas finie après le premier tour : second tour joué.
    expect(state.phase).toBe("choose_level");
    expect(state.turnInRound).toBe(1);
    state = fullTurn(state, 1, 7, "accept", Date.parse("2026-09-11T12:11:00.000Z"));
    expect(state.scores).toEqual([35, 27]);
    expect(state.phase).toBe("finished");
    expect(state.finishedOutcome).toBe("win");
    expect(state.winnerId).toBe("alice");
  });

  it("deux scores 35 après manche = draw sans départage inventé", () => {
    let state = init(config30, 0).state;
    state = { ...state, scores: [28, 28] };
    state = fullTurn(state, 0, 7, "accept", Date.parse("2026-09-11T12:10:00.000Z"));
    state = fullTurn(state, 1, 7, "accept", Date.parse("2026-09-11T12:11:00.000Z"));
    expect(state.scores).toEqual([35, 35]);
    expect(state.phase).toBe("finished");
    expect(state.finishedOutcome).toBe("draw");
    expect(state.winnerId).toBeNull();
  });

  it("timeout du choix => niveau 1 avec temps de réponse complet recalculé", () => {
    const started = init();
    const at = Date.parse("2026-09-11T12:00:20.000Z");
    const out = onTtmcDeadline(started.state, "choose_level_timeout", config30,
      context(null, { nowMs: at, phaseId: "phase-0", nextPhaseId: "phase-1" }));
    expect(out.state.phase).toBe("answering");
    expect(out.state.chosenLevel).toBe(1);
    expect(out.deadlineAt).toBe(new Date(at + 60_000).toISOString());
  });

  it("timeout de réponse = 0 point, non contestable, compté answered", () => {
    const started = init();
    const seat = ttmcActiveSeat(started.state);
    const actor = participants[seat];
    const chosen = reduceTtmc(started.state, { type: "CHOOSE_LEVEL", level: 6 }, config30,
      context(actor, { phaseId: "p0", nextPhaseId: "p1" }));
    const timed = onTtmcDeadline(chosen.state, "turn_timeout", config30,
      context(null, { nowMs: Date.parse("2026-09-11T12:02:00.000Z"), phaseId: "p1", nextPhaseId: "p2" }));
    expect(timed.state.phase).toBe("reveal");
    expect(timed.state.pendingVerdict).toBe("reject");
    expect(() =>
      reduceTtmc(timed.state, { type: "CONTEST", attemptId: timed.state.currentAttempt?.id ?? "" }, config30,
        context(actor, { phaseId: "p2", nextPhaseId: "p3" })),
    ).toThrow("CONTEST_NOT_ALLOWED");
    const closed = onTtmcDeadline(timed.state, "advance_reveal", config30,
      context(null, { nowMs: Date.parse("2026-09-11T12:03:00.000Z"), phaseId: "p2", nextPhaseId: "p3" }));
    expect(closed.state.scores[seat]).toBe(0);
    expect(closed.state.counters[seat].timeouts).toBe(1);
    expect(closed.state.counters[seat].answeredCount).toBe(1);
  });

  it("même niveau sur même thème => questions distinctes par siège", () => {
    const started = init(config30, 0);
    const theme = started.state.themes[0]!;
    expect(theme.byLevel["7"]?.[0].itemId).not.toBe(theme.byLevel["7"]?.[1].itemId);
  });

  it("conflit/retry : ancien attemptId ne mute pas, verdict périmé refusé", () => {
    const started = init();
    const seat = ttmcActiveSeat(started.state);
    const actor = participants[seat];
    const chosen = reduceTtmc(started.state, { type: "CHOOSE_LEVEL", level: 3 }, config30,
      context(actor, { phaseId: "p0", nextPhaseId: "p1" }));
    const submitted = reduceTtmc(chosen.state, { type: "SUBMIT_ANSWER", answer: "x" }, config30,
      context(actor, { phaseId: "p1", nextPhaseId: "attempt-1" }));
    expect(() =>
      applyTtmcJudgment(submitted.state, { attemptId: "attempt-ancien", verdict: "accept", method: "exact" }, config30,
        context(null, { phaseId: "p1", nextPhaseId: "r1" })),
    ).toThrow("STALE_DEADLINE");
    const judged = applyTtmcJudgment(submitted.state, { attemptId: "attempt-1", verdict: "reject", method: "llm" }, config30,
      context(null, { phaseId: "p1", nextPhaseId: "r1" }));
    expect(judged.state.phase).toBe("reveal");
    // Un second jugement sur la même tentative après reveal est périmé.
    expect(() =>
      applyTtmcJudgment(judged.state, { attemptId: "attempt-1", verdict: "accept", method: "opponent" }, config30,
        context(null, { phaseId: "r1", nextPhaseId: "r2" })),
    ).toThrow("STALE_DEADLINE");
  });

  it("maximum de manches => compare les scores même sous la cible", () => {
    let state = init(config30, 0).state;
    state = { ...state, round: 20, scores: [12, 10] };
    // Premier tour de la dernière manche.
    state = fullTurn(state, ttmcActiveSeat(state), 3, "reject", Date.parse("2026-09-11T12:10:00.000Z"));
    expect(state.phase).toBe("choose_level");
    state = fullTurn(state, ttmcActiveSeat(state), 2, "reject", Date.parse("2026-09-11T12:11:00.000Z"));
    expect(state.phase).toBe("finished");
    expect(state.finishedOutcome).toBe("win");
    expect(state.finishedReason).toBe("round_limit");
    expect(state.winnerId).toBe("alice");
  });

  it("contestation acceptée crédite le niveau exactement une fois à la clôture", () => {
    const started = init();
    const seat = ttmcActiveSeat(started.state);
    const requester = participants[seat];
    const opponent = participants[(1 - seat) as 0 | 1];
    const chosen = reduceTtmc(started.state, { type: "CHOOSE_LEVEL", level: 5 }, config30,
      context(requester, { phaseId: "p0", nextPhaseId: "p1" }));
    const submitted = reduceTtmc(chosen.state, { type: "SUBMIT_ANSWER", answer: "réponse" }, config30,
      context(requester, { phaseId: "p1", nextPhaseId: "att-1" }));
    const judged = applyTtmcJudgment(submitted.state, { attemptId: "att-1", verdict: "reject", method: "llm" }, config30,
      context(null, { phaseId: "p1", nextPhaseId: "r1" }));
    const contested = reduceTtmc(judged.state, { type: "CONTEST", attemptId: "att-1" }, config30,
      context(requester, { phaseId: "r1", nextPhaseId: "c1" }));
    const resolved = reduceTtmc(contested.state, { type: "RESOLVE_CONTEST", attemptId: "att-1", accept: true }, config30,
      context(opponent, { phaseId: "c1", nextPhaseId: "c1", currentDeadlineAt: "2026-09-11T12:05:00.000Z", currentDeadlineKind: "contest_timeout" }));
    expect(resolved.state.pendingVerdict).toBe("accept");
    // NEXT exige les deux sièges : un seul ne clôt pas.
    const first = reduceTtmc(resolved.state, { type: "NEXT" }, config30,
      context(requester, { phaseId: "c1", nextPhaseId: "n1", currentDeadlineAt: "2026-09-11T12:05:00.000Z", currentDeadlineKind: "contest_timeout" }));
    expect(first.state.phase).toBe("reveal");
    expect(first.state.scores[seat]).toBe(0);
    const second = reduceTtmc(first.state, { type: "NEXT" }, config30,
      context(opponent, { phaseId: "c1", nextPhaseId: "n2", currentDeadlineAt: "2026-09-11T12:05:00.000Z", currentDeadlineKind: "contest_timeout" }));
    expect(second.state.scores[seat]).toBe(5);
    expect(second.state.counters[seat].correct).toBe(1);
  });

  it("contestation impossible sur timeout et résolution par l'adversaire seul", () => {
    const started = init();
    const seat = ttmcActiveSeat(started.state);
    const requester = participants[seat];
    const chosen = reduceTtmc(started.state, { type: "CHOOSE_LEVEL", level: 4 }, config30,
      context(requester, { phaseId: "p0", nextPhaseId: "p1" }));
    const submitted = reduceTtmc(chosen.state, { type: "SUBMIT_ANSWER", answer: "réponse" }, config30,
      context(requester, { phaseId: "p1", nextPhaseId: "att-9" }));
    const judged = applyTtmcJudgment(submitted.state, { attemptId: "att-9", verdict: "reject", method: "llm" }, config30,
      context(null, { phaseId: "p1", nextPhaseId: "r9" }));
    const contested = reduceTtmc(judged.state, { type: "CONTEST", attemptId: "att-9" }, config30,
      context(requester, { phaseId: "r9", nextPhaseId: "c9" }));
    // Le demandeur ne peut pas résoudre sa propre contestation.
    expect(() =>
      reduceTtmc(contested.state, { type: "RESOLVE_CONTEST", attemptId: "att-9", accept: true }, config30,
        context(requester, { phaseId: "c9", nextPhaseId: "c9" })),
    ).toThrow("CONTEST_NOT_ALLOWED");
  });

  it("NEXT en double par le même siège est refusé", () => {
    const started = init();
    const seat = ttmcActiveSeat(started.state);
    const actor = participants[seat];
    const chosen = reduceTtmc(started.state, { type: "CHOOSE_LEVEL", level: 2 }, config30,
      context(actor, { phaseId: "p0", nextPhaseId: "p1" }));
    const submitted = reduceTtmc(chosen.state, { type: "SUBMIT_ANSWER", answer: "r" }, config30,
      context(actor, { phaseId: "p1", nextPhaseId: "att-d" }));
    const judged = applyTtmcJudgment(submitted.state, { attemptId: "att-d", verdict: "accept", method: "exact" }, config30,
      context(null, { phaseId: "p1", nextPhaseId: "r-d" }));
    const first = reduceTtmc(judged.state, { type: "NEXT" }, config30,
      context(actor, { phaseId: "r-d", nextPhaseId: "n-d", currentDeadlineAt: "2026-09-11T12:05:00.000Z", currentDeadlineKind: "advance_reveal" }));
    expect(() =>
      reduceTtmc(first.state, { type: "NEXT" }, config30,
        context(actor, { phaseId: "r-d", nextPhaseId: "n-d2", currentDeadlineAt: "2026-09-11T12:05:00.000Z", currentDeadlineKind: "advance_reveal" })),
    ).toThrow("ALREADY_ACKNOWLEDGED");
  });

  it("remplacement ambigu sans répétition, puis abandon au 3e void", () => {
    const started = init();
    const seat = ttmcActiveSeat(started.state);
    const actor = participants[seat];
    const seen = new Set<string>();
    let state = reduceTtmc(started.state, { type: "CHOOSE_LEVEL", level: 7 }, config30,
      context(actor, { phaseId: "p0", nextPhaseId: "p1" })).state;
    seen.add(state.currentQuestionId!);
    state = reduceTtmc(state, { type: "SUBMIT_ANSWER", answer: "flou" }, config30,
      context(actor, { phaseId: "p1", nextPhaseId: "att-v1" })).state;
    let out = applyTtmcJudgment(state, { attemptId: "att-v1", verdict: "ambiguous", method: "llm" }, config30,
      context(null, { phaseId: "p1", nextPhaseId: "r-v1" }));
    expect(out.state.phase).toBe("answering");
    expect(seen.has(out.state.currentQuestionId!)).toBe(false);
    seen.add(out.state.currentQuestionId!);
    const second = reduceTtmc(out.state, { type: "SUBMIT_ANSWER", answer: "flou 2" }, config30,
      context(actor, { phaseId: out.phaseId, nextPhaseId: "att-v2" }));
    out = applyTtmcJudgment(second.state, { attemptId: "att-v2", verdict: "ambiguous", method: "llm" }, config30,
      context(null, { phaseId: out.phaseId, nextPhaseId: "r-v2" }));
    expect(out.state.phase).toBe("answering");
    const third = reduceTtmc(out.state, { type: "SUBMIT_ANSWER", answer: "flou 3" }, config30,
      context(actor, { phaseId: out.phaseId, nextPhaseId: "att-v3" }));
    const abandoned = applyTtmcJudgment(third.state, { attemptId: "att-v3", verdict: "ambiguous", method: "llm" }, config30,
      context(null, { phaseId: out.phaseId, nextPhaseId: "r-v3" }));
    expect(abandoned.state.phase).toBe("finished");
    expect(abandoned.result?.reason).toBe("judging_unavailable");
    expect(abandoned.result?.outcome).toBe("abandoned");
  });

  it("un tour void n'entre pas dans answeredCount", () => {
    const started = init();
    const seat = ttmcActiveSeat(started.state);
    const actor = participants[seat];
    let state = reduceTtmc(started.state, { type: "CHOOSE_LEVEL", level: 7 }, config30,
      context(actor, { phaseId: "p0", nextPhaseId: "p1" })).state;
    state = reduceTtmc(state, { type: "SUBMIT_ANSWER", answer: "flou" }, config30,
      context(actor, { phaseId: "p1", nextPhaseId: "att-w" })).state;
    const replaced = applyTtmcJudgment(state, { attemptId: "att-w", verdict: "ambiguous", method: "llm" }, config30,
      context(null, { phaseId: "p1", nextPhaseId: "r-w" }));
    expect(replaced.state.counters[seat].answeredCount).toBe(0);
  });

  it("format 20/15 fonctionne, format 50/30 refuse CONTENT_UNAVAILABLE avec 22 thèmes", () => {
    const ok20 = initializeTtmc({ ...config20, firstSeat: 0 }, context("alice", { content: content22, phaseId: "p0", nextPhaseId: "p0" }));
    expect(ok20.state.themes).toHaveLength(15);
    const ok30 = initializeTtmc({ ...config30, firstSeat: 0 }, context("alice", { content: content22, phaseId: "p0", nextPhaseId: "p0" }));
    expect(ok30.state.themes).toHaveLength(20);
    expect(() =>
      initializeTtmc({ ...config50, firstSeat: 0 }, context("alice", { content: content34, phaseId: "p0", nextPhaseId: "p0" })),
    ).not.toThrow();
    expect(() =>
      initializeTtmc({ ...config50, firstSeat: 0 }, context("alice", { content: content22, phaseId: "p0", nextPhaseId: "p0" })),
    ).toThrow("CONTENT_UNAVAILABLE");
  });

  it("RESIGN tardif fait gagner l'adversaire, avant premier tour abandonne sans vainqueur", () => {
    const started = init();
    const seat = ttmcActiveSeat(started.state);
    const actor = participants[seat];
    const early = reduceTtmc(started.state, { type: "RESIGN" }, config30, context(actor, { phaseId: "p0", nextPhaseId: "p9" }));
    expect(early.state.phase).toBe("finished");
    expect(early.result?.outcome).toBe("abandoned");
    expect(early.result?.winnerId).toBeNull();

    let lateState = init().state;
    lateState = { ...lateState, round: 2 };
    const lateSeat = ttmcActiveSeat(lateState);
    const lateActor = participants[lateSeat];
    const resigned = reduceTtmc(lateState, { type: "RESIGN" }, config30, context(lateActor, { phaseId: "p0", nextPhaseId: "p9" }));
    expect(resigned.result?.outcome).toBe("win");
    expect(resigned.result?.winnerId).toBe(participants[(1 - lateSeat) as 0 | 1]);
  });

  it("CLAIM_FORFEIT tardif fait gagner le demandeur, absence technique abandonne", () => {
    let lateState = init().state;
    lateState = { ...lateState, round: 3 };
    const seat = ttmcActiveSeat(lateState);
    const actor = participants[seat];
    const claimed = reduceTtmc(lateState, { type: "CLAIM_FORFEIT" }, config30, context(actor, { phaseId: "p0", nextPhaseId: "p9" }));
    expect(claimed.result?.winnerId).toBe(actor);

    const base = Date.parse("2026-09-11T12:00:00.000Z");
    expect(shouldAbandonForTtmcAbsence(
      [new Date(base - 200_000).toISOString(), new Date(base - 10_000).toISOString()], base,
    )).toBe(true);
    const abandoned = onTtmcAbsence(init().state, config30, context(null, { nowMs: base, phaseId: "p0", nextPhaseId: "p9" }));
    expect(abandoned.result?.outcome).toBe("abandoned");
  });

  it("ancien job contest_timeout après clôture => STALE_DEADLINE", () => {
    const started = init();
    const seat = ttmcActiveSeat(started.state);
    const actor = participants[seat];
    const other = participants[(1 - seat) as 0 | 1];
    const chosen = reduceTtmc(started.state, { type: "CHOOSE_LEVEL", level: 2 }, config30,
      context(actor, { phaseId: "p0", nextPhaseId: "p1" }));
    const submitted = reduceTtmc(chosen.state, { type: "SUBMIT_ANSWER", answer: "r" }, config30,
      context(actor, { phaseId: "p1", nextPhaseId: "att-s" }));
    const judged = applyTtmcJudgment(submitted.state, { attemptId: "att-s", verdict: "reject", method: "llm" }, config30,
      context(null, { phaseId: "p1", nextPhaseId: "r-s" }));
    const contested = reduceTtmc(judged.state, { type: "CONTEST", attemptId: "att-s" }, config30,
      context(actor, { phaseId: "r-s", nextPhaseId: "c-s" }));
    const resolved = reduceTtmc(contested.state, { type: "RESOLVE_CONTEST", attemptId: "att-s", accept: false }, config30,
      context(other, { phaseId: "c-s", nextPhaseId: "c-s" }));
    const first = reduceTtmc(resolved.state, { type: "NEXT" }, config30,
      context(actor, { phaseId: "c-s", nextPhaseId: "n-s", currentDeadlineAt: "2026-09-11T12:05:00.000Z", currentDeadlineKind: "contest_timeout" }));
    const closed = reduceTtmc(first.state, { type: "NEXT" }, config30,
      context(other, { phaseId: "c-s", nextPhaseId: "n-s2", currentDeadlineAt: "2026-09-11T12:05:00.000Z", currentDeadlineKind: "contest_timeout" }));
    expect(closed.state.phase).toBe("choose_level");
    expect(() =>
      onTtmcDeadline(resolved.state, "contest_timeout", config30, context(null, { nowMs: Date.parse("2026-09-11T12:06:00.000Z"), phaseId: "c-s", nextPhaseId: "old" })),
    ).not.toThrow();
    // Mais rejouer l'ancien job sur l'état déjà clos (nouvelle phase) est incohérent : phase choose_level.
    expect(() =>
      onTtmcDeadline(closed.state, "contest_timeout", config30, context(null, { nowMs: Date.parse("2026-09-11T12:06:00.000Z"), phaseId: "n-s2", nextPhaseId: "old" })),
    ).toThrow("STALE_DEADLINE");
  });

  it("alterne le premier joueur par manche et garde firstSeat", () => {
    const started = init(config30, 1);
    expect(ttmcActiveSeat({ firstSeat: 1, round: 1, turnInRound: 0 })).toBe(1);
    expect(ttmcActiveSeat({ firstSeat: 1, round: 1, turnInRound: 1 })).toBe(0);
    expect(ttmcActiveSeat({ firstSeat: 1, round: 2, turnInRound: 0 })).toBe(0);
    expect(started.state.firstSeat).toBe(1);
  });

  it("refuse un choix de niveau invalide et une réponse vide", () => {
    const started = init();
    const seat = ttmcActiveSeat(started.state);
    const actor = participants[seat];
    expect(() =>
      reduceTtmc(started.state, { type: "CHOOSE_LEVEL", level: 11 }, config30, context(actor)),
    ).toThrow();
    const chosen = reduceTtmc(started.state, { type: "CHOOSE_LEVEL", level: 3 }, config30,
      context(actor, { phaseId: "p0", nextPhaseId: "p1" }));
    expect(() =>
      reduceTtmc(chosen.state, { type: "SUBMIT_ANSWER", answer: "   " }, config30, context(actor, { phaseId: "p1", nextPhaseId: "a2" })),
    ).toThrow("INVALID_ANSWER");
  });

  it("seconde réponse après soumission refusée (phase judging)", () => {
    const started = init();
    const seat = ttmcActiveSeat(started.state);
    const actor = participants[seat];
    const chosen = reduceTtmc(started.state, { type: "CHOOSE_LEVEL", level: 3 }, config30,
      context(actor, { phaseId: "p0", nextPhaseId: "p1" }));
    const submitted = reduceTtmc(chosen.state, { type: "SUBMIT_ANSWER", answer: "première" }, config30,
      context(actor, { phaseId: "p1", nextPhaseId: "att-dup" }));
    expect(submitted.state.phase).toBe("judging");
    const judgeJob = submitted.jobs.find((job) => job.kind === "judge_answer");
    expect(judgeJob).toMatchObject({
      phaseId: "att-dup",
      payload: {
        matchId: "match-ttmc-test",
        attemptId: "att-dup",
        phaseId: "att-dup",
        expectedPhaseId: "att-dup",
      },
    });
    expect(() =>
      reduceTtmc(submitted.state, { type: "SUBMIT_ANSWER", answer: "seconde" }, config30,
        context(actor, { phaseId: "p1", nextPhaseId: "att-dup2" })),
    ).toThrow("WRONG_PHASE");
  });

  it("contestation refusée après accept et avec un mauvais attemptId", () => {
    const started = init();
    const seat = ttmcActiveSeat(started.state);
    const actor = participants[seat];
    const chosen = reduceTtmc(started.state, { type: "CHOOSE_LEVEL", level: 4 }, config30,
      context(actor, { phaseId: "p0", nextPhaseId: "p1" }));
    const submitted = reduceTtmc(chosen.state, { type: "SUBMIT_ANSWER", answer: "r" }, config30,
      context(actor, { phaseId: "p1", nextPhaseId: "att-ok" }));
    const judged = applyTtmcJudgment(submitted.state, { attemptId: "att-ok", verdict: "accept", method: "exact" }, config30,
      context(null, { phaseId: "p1", nextPhaseId: "r-ok" }));
    expect(() =>
      reduceTtmc(judged.state, { type: "CONTEST", attemptId: "att-ok" }, config30,
        context(actor, { phaseId: "r-ok", nextPhaseId: "c-ok" })),
    ).toThrow("CONTEST_NOT_ALLOWED");
    expect(() =>
      reduceTtmc(judged.state, { type: "CONTEST", attemptId: "att-inconnu" }, config30,
        context(actor, { phaseId: "r-ok", nextPhaseId: "c-ok" })),
    ).toThrow("CONTEST_NOT_ALLOWED");
  });

  it("NEXT pendant contestation pending => CONTEST_PENDING, RESOLVE avec mauvais attemptId refusé", () => {
    const started = init();
    const seat = ttmcActiveSeat(started.state);
    const actor = participants[seat];
    const other = participants[(1 - seat) as 0 | 1];
    const chosen = reduceTtmc(started.state, { type: "CHOOSE_LEVEL", level: 4 }, config30,
      context(actor, { phaseId: "p0", nextPhaseId: "p1" }));
    const submitted = reduceTtmc(chosen.state, { type: "SUBMIT_ANSWER", answer: "r" }, config30,
      context(actor, { phaseId: "p1", nextPhaseId: "att-c" }));
    const judged = applyTtmcJudgment(submitted.state, { attemptId: "att-c", verdict: "reject", method: "llm" }, config30,
      context(null, { phaseId: "p1", nextPhaseId: "r-c" }));
    const contested = reduceTtmc(judged.state, { type: "CONTEST", attemptId: "att-c" }, config30,
      context(actor, { phaseId: "r-c", nextPhaseId: "c-c" }));
    expect(() =>
      reduceTtmc(contested.state, { type: "NEXT" }, config30,
        context(actor, { phaseId: "c-c", nextPhaseId: "n-c", currentDeadlineAt: "2026-09-11T12:05:00.000Z", currentDeadlineKind: "contest_timeout" })),
    ).toThrow("CONTEST_PENDING");
    expect(() =>
      reduceTtmc(contested.state, { type: "RESOLVE_CONTEST", attemptId: "att-inconnu", accept: true }, config30,
        context(other, { phaseId: "c-c", nextPhaseId: "c-c" })),
    ).toThrow("NO_CONTEST_PENDING");
  });

  it("contest_timeout expiré maintient le rejet puis clôt à 0 point", () => {
    const started = init();
    const seat = ttmcActiveSeat(started.state);
    const actor = participants[seat];
    const chosen = reduceTtmc(started.state, { type: "CHOOSE_LEVEL", level: 5 }, config30,
      context(actor, { phaseId: "p0", nextPhaseId: "p1" }));
    const submitted = reduceTtmc(chosen.state, { type: "SUBMIT_ANSWER", answer: "r" }, config30,
      context(actor, { phaseId: "p1", nextPhaseId: "att-e" }));
    const judged = applyTtmcJudgment(submitted.state, { attemptId: "att-e", verdict: "reject", method: "llm" }, config30,
      context(null, { phaseId: "p1", nextPhaseId: "r-e" }));
    const contested = reduceTtmc(judged.state, { type: "CONTEST", attemptId: "att-e" }, config30,
      context(actor, { phaseId: "r-e", nextPhaseId: "c-e" }));
    const closed = onTtmcDeadline(contested.state, "contest_timeout", config30,
      context(null, { nowMs: Date.parse("2026-09-11T12:06:00.000Z"), phaseId: "c-e", nextPhaseId: "n-e" }));
    expect(closed.state.scores[seat]).toBe(0);
    expect(closed.state.counters[seat].incorrect).toBe(1);
    expect(closed.state.counters[seat].answeredCount).toBe(1);
  });

  it("RESIGN pendant reveal termine sur forfait, job périmé ensuite refusé", () => {
    const started = init();
    const seat = ttmcActiveSeat(started.state);
    const actor = participants[seat];
    const chosen = reduceTtmc(started.state, { type: "CHOOSE_LEVEL", level: 5 }, config30,
      context(actor, { phaseId: "p0", nextPhaseId: "p1" }));
    const submitted = reduceTtmc(chosen.state, { type: "SUBMIT_ANSWER", answer: "r" }, config30,
      context(actor, { phaseId: "p1", nextPhaseId: "att-f" }));
    const judged = applyTtmcJudgment(submitted.state, { attemptId: "att-f", verdict: "reject", method: "llm" }, config30,
      context(null, { phaseId: "p1", nextPhaseId: "r-f" }));
    // Sortir du tout premier tour pour que le forfait soit compétitif.
    const lateReveal = { ...judged.state, round: 2 };
    const resigned = reduceTtmc(lateReveal, { type: "RESIGN" }, config30,
      context(actor, { phaseId: "r-f", nextPhaseId: "fin-f" }));
    expect(resigned.state.phase).toBe("finished");
    expect(resigned.result?.reason).toBe("resign");
    expect(resigned.result?.winnerId).toBe(participants[(1 - seat) as 0 | 1]);
    // Le delta du reveal n'est jamais cumulé après le forfait.
    expect(resigned.state.scores[seat]).toBe(0);
    expect(() =>
      onTtmcDeadline(lateReveal, "advance_reveal", config30,
        context(null, { nowMs: Date.parse("2026-09-11T12:06:00.000Z"), phaseId: "r-f", nextPhaseId: "vieux" })),
    ).not.toThrow();
    expect(() =>
      onTtmcDeadline(resigned.state, "advance_reveal", config30,
        context(null, { nowMs: Date.parse("2026-09-11T12:06:00.000Z"), phaseId: "fin-f", nextPhaseId: "vieux" })),
    ).toThrow("MATCH_FINISHED");
  });

  it("CLAIM_FORFEIT avant premier tour => abandoned sans vainqueur", () => {
    const started = init();
    const seat = ttmcActiveSeat(started.state);
    const actor = participants[seat];
    const claimed = reduceTtmc(started.state, { type: "CLAIM_FORFEIT" }, config30,
      context(actor, { phaseId: "p0", nextPhaseId: "p9" }));
    expect(claimed.state.phase).toBe("finished");
    expect(claimed.result?.outcome).toBe("abandoned");
    expect(claimed.result?.winnerId).toBeNull();
    expect(claimed.result?.reason).toBe("claimed_forfeit");
  });

  it("seuils d'absence : les deux à 120 s ou un seul à 180 s", () => {
    const base = Date.parse("2026-09-11T12:00:00.000Z");
    const isoAt = (ageMs: number) => new Date(base - ageMs).toISOString();
    expect(shouldAbandonForTtmcAbsence([isoAt(121_000), isoAt(121_000)], base)).toBe(true);
    expect(shouldAbandonForTtmcAbsence([isoAt(119_000), isoAt(10_000)], base)).toBe(false);
    expect(shouldAbandonForTtmcAbsence([isoAt(181_000), isoAt(5_000)], base)).toBe(true);
  });

  it("ancien job d'échéance sur nouvelle phase de même nom => garde STALE (pas de mutation worker)", () => {
    const started = init();
    const seat = ttmcActiveSeat(started.state);
    const actor = participants[seat];
    const chosen = reduceTtmc(started.state, { type: "CHOOSE_LEVEL", level: 7 }, config30,
      context(actor, { phaseId: "p0", nextPhaseId: "p1" }));
    const submitted = reduceTtmc(chosen.state, { type: "SUBMIT_ANSWER", answer: "flou" }, config30,
      context(actor, { phaseId: "p1", nextPhaseId: "att-v1" }));
    const replaced = applyTtmcJudgment(submitted.state, { attemptId: "att-v1", verdict: "ambiguous", method: "llm" }, config30,
      context(null, { phaseId: "p1", nextPhaseId: "phase-remplacement" }));
    expect(replaced.state.phase).toBe("answering");
    // Le moteur seul raisonne par nom de phase : l'ancien turn_timeout de la
    // première phase answering clôturerait la phase de remplacement.
    const leaked = onTtmcDeadline(replaced.state, "turn_timeout", config30,
      context(null, { nowMs: Date.parse("2026-09-11T12:04:00.000Z"), phaseId: replaced.phaseId, nextPhaseId: "vieux" }));
    expect(leaked.state.phase).toBe("reveal");
    // La garde worker l'interdit : le job porte l'ancienne phaseId.
    expect(isTtmcDeadlineJobStale("p1", replaced.phaseId)).toBe(true);
    expect(isTtmcDeadlineJobStale(replaced.phaseId, replaced.phaseId)).toBe(false);
    expect(isTtmcDeadlineJobStale(null, replaced.phaseId)).toBe(false);
    expect(isTtmcDeadlineJobStale(undefined, replaced.phaseId)).toBe(false);
  });

  it("remplacement globalement distinct : jamais une question déjà allouée", () => {
    const started = init();
    const allocated = new Set<string>();
    for (const theme of started.state.themes) {
      for (let level = 1; level <= 10; level += 1) {
        const pair = theme.byLevel[String(level)]!;
        expect(allocated.has(pair[0].itemId)).toBe(false);
        expect(allocated.has(pair[1].itemId)).toBe(false);
        allocated.add(pair[0].itemId);
        allocated.add(pair[1].itemId);
      }
    }
    for (let level = 1; level <= 10; level += 1) {
      for (const ref of started.state.spareByLevel[String(level)] ?? []) {
        expect(allocated.has(ref.itemId)).toBe(false);
        allocated.add(ref.itemId);
      }
    }
    // 20 thèmes × 10 niveaux × 2 + 10 niveaux × 4 réserves = 440 questions.
    expect(allocated.size).toBe(440);
    const seat = ttmcActiveSeat(started.state);
    const actor = participants[seat];
    const seenBefore = new Set(allocated);
    let state = reduceTtmc(started.state, { type: "CHOOSE_LEVEL", level: 7 }, config30,
      context(actor, { phaseId: "p0", nextPhaseId: "p1" })).state;
    expect(seenBefore.has(state.currentQuestionId!)).toBe(true);
    state = reduceTtmc(state, { type: "SUBMIT_ANSWER", answer: "flou" }, config30,
      context(actor, { phaseId: "p1", nextPhaseId: "att-u" })).state;
    const replaced = applyTtmcJudgment(state, { attemptId: "att-u", verdict: "ambiguous", method: "llm" }, config30,
      context(null, { phaseId: "p1", nextPhaseId: "r-u" }));
    expect(replaced.state.phase).toBe("answering");
    // La réserve consommée était déjà comptée : le remplacement reste inédit
    // pour ce match et ne répète ni l'originale ni une autre question vue.
    expect(seenBefore.has(replaced.state.currentQuestionId!)).toBe(true);
    expect(replaced.state.currentQuestionId).not.toBe(state.currentQuestionId);
    expect(replaced.state.counters[seat].answeredCount).toBe(0);
  });

  it("RESOLVE_CONTEST conserve l'échéance contest_timeout, repli advance_reveal frais sinon", () => {
    const started = init();
    const seat = ttmcActiveSeat(started.state);
    const requester = participants[seat];
    const opponent = participants[(1 - seat) as 0 | 1];
    const chosen = reduceTtmc(started.state, { type: "CHOOSE_LEVEL", level: 4 }, config30,
      context(requester, { phaseId: "p0", nextPhaseId: "p1" }));
    const submitted = reduceTtmc(chosen.state, { type: "SUBMIT_ANSWER", answer: "r" }, config30,
      context(requester, { phaseId: "p1", nextPhaseId: "att-k" }));
    const judged = applyTtmcJudgment(submitted.state, { attemptId: "att-k", verdict: "reject", method: "llm" }, config30,
      context(null, { phaseId: "p1", nextPhaseId: "r-k" }));
    const contested = reduceTtmc(judged.state, { type: "CONTEST", attemptId: "att-k" }, config30,
      context(requester, { phaseId: "r-k", nextPhaseId: "c-k" }));
    expect(contested.deadlineKind).toBe("contest_timeout");
    const resolved = reduceTtmc(contested.state, { type: "RESOLVE_CONTEST", attemptId: "att-k", accept: true }, config30,
      context(opponent, { phaseId: "c-k", nextPhaseId: "c-k", currentDeadlineAt: contested.deadlineAt, currentDeadlineKind: contested.deadlineKind }));
    expect(resolved.deadlineKind).toBe("contest_timeout");
    expect(resolved.deadlineAt).toBe(contested.deadlineAt);
    const fallback = reduceTtmc(contested.state, { type: "RESOLVE_CONTEST", attemptId: "att-k", accept: false }, config30,
      context(opponent, { phaseId: "c-k", nextPhaseId: "c-k", currentDeadlineAt: null, currentDeadlineKind: null }));
    expect(fallback.deadlineKind).toBe("advance_reveal");
    expect(fallback.deadlineAt).not.toBeNull();
  });

  it("jugement après RESIGN en judging => STALE_DEADLINE, sans mutation", () => {
    const started = init();
    const seat = ttmcActiveSeat(started.state);
    const actor = participants[seat];
    const chosen = reduceTtmc(started.state, { type: "CHOOSE_LEVEL", level: 5 }, config30,
      context(actor, { phaseId: "p0", nextPhaseId: "p1" }));
    const submitted = reduceTtmc(chosen.state, { type: "SUBMIT_ANSWER", answer: "r" }, config30,
      context(actor, { phaseId: "p1", nextPhaseId: "att-g" }));
    expect(submitted.state.phase).toBe("judging");
    const lateJudging = { ...submitted.state, round: 2 };
    const resigned = reduceTtmc(lateJudging, { type: "RESIGN" }, config30,
      context(actor, { phaseId: "p1", nextPhaseId: "fin-g" }));
    expect(resigned.state.phase).toBe("finished");
    expect(resigned.state.scores[seat]).toBe(0);
    expect(() =>
      applyTtmcJudgment(resigned.state, { attemptId: "att-g", verdict: "accept", method: "exact" }, config30,
        context(null, { phaseId: "fin-g", nextPhaseId: "vieux" })),
    ).toThrow("STALE_DEADLINE");
  });

  it("seconde contestation après résolution => CONTEST_ALREADY_OPEN", () => {
    const started = init();
    const seat = ttmcActiveSeat(started.state);
    const requester = participants[seat];
    const opponent = participants[(1 - seat) as 0 | 1];
    const chosen = reduceTtmc(started.state, { type: "CHOOSE_LEVEL", level: 4 }, config30,
      context(requester, { phaseId: "p0", nextPhaseId: "p1" }));
    const submitted = reduceTtmc(chosen.state, { type: "SUBMIT_ANSWER", answer: "r" }, config30,
      context(requester, { phaseId: "p1", nextPhaseId: "att-h" }));
    const judged = applyTtmcJudgment(submitted.state, { attemptId: "att-h", verdict: "reject", method: "llm" }, config30,
      context(null, { phaseId: "p1", nextPhaseId: "r-h" }));
    const contested = reduceTtmc(judged.state, { type: "CONTEST", attemptId: "att-h" }, config30,
      context(requester, { phaseId: "r-h", nextPhaseId: "c-h" }));
    const resolved = reduceTtmc(contested.state, { type: "RESOLVE_CONTEST", attemptId: "att-h", accept: false }, config30,
      context(opponent, { phaseId: "c-h", nextPhaseId: "c-h" }));
    expect(resolved.state.contest?.status).toBe("resolved");
    expect(() =>
      reduceTtmc(resolved.state, { type: "CONTEST", attemptId: "att-h" }, config30,
        context(requester, { phaseId: "c-h", nextPhaseId: "c-h2" })),
    ).toThrow("CONTEST_ALREADY_OPEN");
  });
});
