import { describe, expect, it } from "vitest";
import { applyTrouNoirJudgment, initializeTrouNoir, reduceTrouNoir } from "@/games/trou-noir/engine";
import { projectTrouNoir } from "@/games/trou-noir/projection";
import type { TrouNoirContent } from "@/games/trou-noir/types";

const participants = ["alice", "bob"] as const;
const identities = [
  { id: "alice", pseudo: "Alice" },
  { id: "bob", pseudo: "Bob" },
] as const;

function content(): TrouNoirContent {
  const questions = [];
  for (const difficulty of [3, 4, 5, 6]) {
    for (let index = 0; index < 12; index += 1) {
      questions.push({
        itemId: `culture-${difficulty}-${index}`,
        packId: "pack-test",
        logicalKey: `culture-${difficulty}-${index}`,
        category: "culture" as const,
        themeLabel: "Culture",
        difficulty,
        prompt: `Question ${difficulty}/${index} ?`,
        canonical: `Réponse ${difficulty} ${index}`,
        aliases: [] as string[],
        answerType: "text" as const,
        requiredPrecision: "Réponse exacte.",
        allowSurnameOnly: false,
        allowDescription: false,
        numericTolerance: 0,
        explanation: "Explication vérifiée.",
      });
    }
  }
  return { packId: "pack-test", packVersion: 1, questions };
}

const entropy = Array.from({ length: 512 }, (_, index) => ((index * 37 + 11) % 997) / 997);

describe("projection Trou Noir", () => {
  it("ne fuit ni solution ni programme avant la révélation", () => {
    const { state } = initializeTrouNoir(
      { maxRounds: 5, answerSeconds: 60, categories: ["culture"], firstSeat: 0 },
      {
        nowMs: Date.parse("2026-09-11T12:00:00.000Z"),
        actorId: "alice",
        matchId: "m1",
        participants,
        content: content(),
        entropy,
        phaseId: "p0",
        nextPhaseId: "p0",
      },
    );
    for (const viewer of participants) {
      const view = projectTrouNoir(
        state,
        { maxRounds: 5, answerSeconds: 60, categories: ["culture"] },
        content(),
        viewer,
        participants,
        identities,
      );
      const serialized = JSON.stringify(view);
      expect(serialized).not.toContain("Réponse");
      expect(serialized).not.toContain("schedule");
      expect(serialized).not.toContain("replacements");
      expect(serialized).not.toContain("canonical");
      expect(serialized).not.toContain("aliases");
      expect(serialized).not.toContain("logicalKey");
      expect(serialized).not.toContain("packId");
      expect(serialized).not.toContain("itemId");
      expect(serialized).not.toContain("themeLabel");
      expect(serialized).not.toContain("pendingVerdict");
      expect(serialized).not.toContain("Explication vérifiée");
      expect(view.question?.prompt).toContain("Question");
    }
  });

  it("expose la question adressée et l'actif sans la réponse", () => {
    const { state } = initializeTrouNoir(
      { maxRounds: 5, answerSeconds: 60, categories: ["culture"], firstSeat: 0 },
      {
        nowMs: Date.parse("2026-09-11T12:00:00.000Z"),
        actorId: "alice",
        matchId: "m1",
        participants,
        content: content(),
        entropy,
        phaseId: "p0",
        nextPhaseId: "p0",
      },
    );
    const viewAlice = projectTrouNoir(
      state,
      { maxRounds: 5, answerSeconds: 60, categories: ["culture"] },
      content(),
      "alice",
      participants,
      identities,
    );
    expect(viewAlice.activePlayerId).toBe("alice");
    expect(viewAlice.question?.addresseeIsMe).toBe(true);
    expect(viewAlice.allowedActions).toContain("SUBMIT_ANSWER");
    const viewBob = projectTrouNoir(
      state,
      { maxRounds: 5, answerSeconds: 60, categories: ["culture"] },
      content(),
      "bob",
      participants,
      identities,
    );
    expect(viewBob.question?.addresseeIsMe).toBe(false);
    expect(viewBob.allowedActions).not.toContain("SUBMIT_ANSWER");
  });

  it("masque NEXT après confirmation et expose RESOLVE_CONTEST à l'adversaire", () => {
    const config = { maxRounds: 5, answerSeconds: 60, categories: ["culture"] as ["culture"] };
    const pack = content();
    const baseCtx = {
      nowMs: Date.parse("2026-09-11T12:00:00.000Z"),
      actorId: "alice",
      matchId: "m1",
      participants,
      content: pack,
      entropy,
      phaseId: "p0",
      nextPhaseId: "att-1",
    };
    const started = initializeTrouNoir({ ...config, firstSeat: 0 }, { ...baseCtx, phaseId: "p0", nextPhaseId: "p0" });
    const submitted = reduceTrouNoir(
      started.state,
      { type: "SUBMIT_ANSWER", answer: "discutable" },
      config,
      { ...baseCtx, phaseId: "p-answer", nextPhaseId: "att-1" },
    );
    const judged = applyTrouNoirJudgment(
      submitted.state,
      { attemptId: "att-1", verdict: "reject", method: "exact" },
      config,
      { ...baseCtx, actorId: null, phaseId: "att-1", nextPhaseId: "rev-1" },
    );
    const attemptId = judged.state.currentAttempt!.id;
    const revealView = projectTrouNoir(judged.state, config, pack, "alice", participants, identities);
    // En révélation : réponse attendue et explication autorisées, sans aliases ni références privées.
    expect(JSON.stringify(revealView)).toContain("expectedAnswer");
    expect(JSON.stringify(revealView)).not.toContain("aliases");
    expect(JSON.stringify(revealView)).not.toContain("logicalKey");
    expect(JSON.stringify(revealView)).not.toContain("schedule");
    const contested = reduceTrouNoir(
      judged.state,
      { type: "CONTEST", attemptId },
      config,
      { ...baseCtx, nowMs: Date.parse("2026-09-11T12:00:20.000Z"), phaseId: "rev-1", nextPhaseId: "contest-1" },
    );
    const viewRequester = projectTrouNoir(contested.state, config, pack, "alice", participants, identities);
    const viewOpponent = projectTrouNoir(contested.state, config, pack, "bob", participants, identities);
    // Contestation en cours : NEXT masqué des deux côtés, résolution côté adversaire.
    expect(viewRequester.allowedActions).not.toContain("NEXT");
    expect(viewOpponent.allowedActions).not.toContain("NEXT");
    expect(viewOpponent.allowedActions).toContain("RESOLVE_CONTEST");
    const resolved = reduceTrouNoir(
      contested.state,
      { type: "RESOLVE_CONTEST", attemptId, accept: false },
      config,
      { ...baseCtx, actorId: "bob", nowMs: Date.parse("2026-09-11T12:00:25.000Z"), phaseId: "contest-1", nextPhaseId: "contest-1" },
    );
    const acked = reduceTrouNoir(
      resolved.state,
      { type: "NEXT" },
      config,
      { ...baseCtx, nowMs: Date.parse("2026-09-11T12:00:30.000Z"), phaseId: "contest-1", nextPhaseId: "contest-1", currentDeadlineAt: "2026-09-11T12:05:00.000Z", currentDeadlineKind: "contest_timeout" },
    );
    const viewAcked = projectTrouNoir(acked.state, config, pack, "alice", participants, identities);
    const viewWaiting = projectTrouNoir(acked.state, config, pack, "bob", participants, identities);
    expect(viewAcked.allowedActions).not.toContain("NEXT");
    expect(viewWaiting.allowedActions).toContain("NEXT");
  });
});
