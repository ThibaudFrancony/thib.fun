import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  applyTrouNoirJudgment,
  initializeTrouNoir,
  reduceTrouNoir,
  trouNoirActiveSeat,
} from "@/games/trou-noir/engine";
import { projectTrouNoir } from "@/games/trou-noir/projection";
import { quizQuestionSchema, type TrouNoirContent } from "@/games/trou-noir/types";

const packSchema = z.object({
  packId: z.string(),
  packVersion: z.number().int().positive(),
  questions: z.array(quizQuestionSchema),
});

function loadPack(): TrouNoirContent {
  const text = readFileSync(resolve(process.cwd(), "content/quiz/dist/trou-noir.json"), "utf8");
  const parsed = packSchema.parse(JSON.parse(text));
  return { packId: parsed.packId, packVersion: parsed.packVersion, questions: parsed.questions };
}

const entropy = Array.from({ length: 1024 }, (_, index) => ((index * 53 + 7) % 997) / 997);
const participants = ["alice", "bob"] as const;
const identities = [
  { id: "alice", pseudo: "Alice" },
  { id: "bob", pseudo: "Bob" },
] as const;

describe("pack Trou Noir réel", () => {
  it("contient 120 questions, 6 par (catégorie, difficulté)", () => {
    const content = loadPack();
    expect(content.questions).toHaveLength(120);
    for (const category of ["culture", "histoire-geo", "cuisine", "sport", "sciences"]) {
      for (const difficulty of [3, 4, 5, 6]) {
        const count = content.questions.filter(
          (item) => item.category === category && item.difficulty === difficulty,
        ).length;
        expect(count).toBe(6);
      }
    }
    const keys = content.questions.map((item) => item.logicalKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("démarre une partie 10 manches en configuration complète", () => {
    const content = loadPack();
    const transition = initializeTrouNoir(
      {
        maxRounds: 10,
        answerSeconds: 60,
        categories: ["culture", "histoire-geo", "cuisine", "sport", "sciences"],
      },
      {
        nowMs: Date.parse("2026-09-11T12:00:00.000Z"),
        actorId: "alice",
        matchId: "match-pack",
        participants,
        content,
        entropy,
        phaseId: "p0",
        nextPhaseId: "p0",
      },
    );
    expect(transition.state.schedule).toHaveLength(10);
  });

  it("simule une partie courte complète jusqu'au résultat", () => {
    const content = loadPack();
    const config = {
      maxRounds: 5 as const,
      answerSeconds: 60 as const,
      categories: ["culture", "histoire-geo", "cuisine", "sport", "sciences"] as (
        | "culture"
        | "histoire-geo"
        | "cuisine"
        | "sport"
        | "sciences"
      )[],
    };
    let clock = Date.parse("2026-09-11T12:00:00.000Z");
    let turn = initializeTrouNoir(config, {
      nowMs: clock,
      actorId: "alice",
      matchId: "match-sim",
      participants,
      content,
      entropy,
      phaseId: "p-start",
      nextPhaseId: "p-start",
    });
    let phaseId = "p-start";
    for (let step = 0; step < 60 && turn.state.phase !== "finished"; step += 1) {
      clock += 10_000;
      const seat = trouNoirActiveSeat(turn.state);
      const actor = participants[seat];
      const attemptId = `att-${step}`;
      const submitted = reduceTrouNoir(
        turn.state,
        { type: "SUBMIT_ANSWER", answer: step % 2 === 0 ? "bonne réponse" : "mauvaise" },
        config,
        { nowMs: clock, actorId: actor, matchId: "match-sim", participants, content, entropy, phaseId, nextPhaseId: attemptId },
      );
      phaseId = attemptId;
      clock += 1_000;
      const revealId = `rev-${step}`;
      const judged = applyTrouNoirJudgment(
        submitted.state,
        { attemptId, verdict: step % 2 === 0 ? "accept" : "reject", method: "exact" },
        config,
        { nowMs: clock, actorId: null, matchId: "match-sim", participants, content, entropy, phaseId, nextPhaseId: revealId },
      );
      phaseId = revealId;
      clock += 5_000;
      const first = reduceTrouNoir(judged.state, { type: "NEXT" }, config, {
        nowMs: clock, actorId: "alice", matchId: "match-sim", participants, content, entropy,
        phaseId, nextPhaseId: `nx-${step}-a`, currentDeadlineAt: "2026-09-11T13:00:00.000Z", currentDeadlineKind: "advance_reveal",
      });
      if (first.state.phase === "reveal") {
        const second = reduceTrouNoir(first.state, { type: "NEXT" }, config, {
          nowMs: clock + 100, actorId: "bob", matchId: "match-sim", participants, content, entropy,
          phaseId, nextPhaseId: `nx-${step}-b`, currentDeadlineAt: "2026-09-11T13:00:00.000Z", currentDeadlineKind: "advance_reveal",
        });
        turn = { ...second, state: second.state };
        phaseId = second.phaseId;
      } else {
        turn = { ...first, state: first.state };
        phaseId = first.phaseId;
      }
    }
    expect(turn.state.phase).toBe("finished");
    expect(turn.result).not.toBeNull();
    expect(turn.result?.players[0].score).toBe(turn.state.reserves[0]);
    // Projections de fin sans secret et résultat cohérent des deux côtés.
    for (const viewer of participants) {
      const view = projectTrouNoir(turn.state, config, content, viewer, participants, identities, config, turn.state);
      expect(view.result?.players[0].score).toBe(turn.state.reserves[0]);
      expect(JSON.stringify(view)).not.toContain("schedule");
    }
  });
});
