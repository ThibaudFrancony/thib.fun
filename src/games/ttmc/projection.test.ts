import { describe, expect, it } from "vitest";
import { applyTtmcJudgment, initializeTtmc, reduceTtmc, ttmcActiveSeat } from "@/games/ttmc/engine";
import { projectTtmc } from "@/games/ttmc/projection";
import type { TtmcContent } from "@/games/ttmc/types";

const participants = ["alice", "bob"] as const;
const identities = [{ id: "alice", pseudo: "Alice" }, { id: "bob", pseudo: "Bob" }] as const;
const entropy = Array.from({ length: 2048 }, (_, index) => ((index * 37 + 11) % 997) / 997);

function makeContent(): TtmcContent {
  const themes = Array.from({ length: 22 }, (_, t) => ({
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
        canonical: `Réponse ${theme.themeId} ${level + 1}`,
        aliases: ["Alias secret"] as string[],
        explanation: "Explication vérifiée.",
      })),
    ).flat(),
  );
  return { packId: "pack-test", packVersion: 1, themes, questions };
}

const content = makeContent();
const config = { targetScore: 30 as const, maxRounds: 20 as const, answerSeconds: 60 as const, themeSelectionSeconds: 20 as const };

function baseCtx(actorId: string | null, extra: Record<string, unknown> = {}) {
  return {
    nowMs: Date.parse("2026-09-11T12:00:00.000Z"),
    actorId,
    matchId: "match-proj",
    participants,
    content,
    entropy,
    phaseId: "p0",
    nextPhaseId: "p0",
    ...extra,
  } as Parameters<typeof initializeTtmc>[1];
}

describe("projection TTMC anti-fuite", () => {
  it("ne révèle ni byLevel ni réponses avant reveal", () => {
    const started = initializeTtmc({ ...config, firstSeat: 0 }, baseCtx("alice"));
    for (const viewer of participants) {
      const view = projectTtmc(started.state, config, content, viewer, participants, identities, config, started.state);
      const raw = JSON.stringify(view);
      expect(raw).not.toContain("byLevel");
      expect(raw).not.toContain("spareByLevel");
      expect(raw).not.toContain("Alias secret");
      expect(raw).not.toContain("logicalKey");
      expect(raw).not.toContain("packId");
      expect(raw).not.toContain("itemId");
      expect(raw).not.toContain("pendingVerdict");
      expect(raw).not.toContain("pendingMethod");
      expect(raw).not.toContain("normalizedAnswer");
      expect(raw).not.toContain("rawAnswer");
      expect(raw).not.toContain("canonical");
      expect(raw).not.toContain("themeLabel");
      expect(raw).not.toContain("Explication vérifiée");
      expect(view.question).toBeNull();
      expect(view.reveal).toBeNull();
      expect(view.chosenLevel).toBeNull();
      expect(view.technicalReplacement).toBe(false);
    }
  });

  it("l'adversaire voit le niveau confirmé mais pas le prompt de l'autre avant reveal", () => {
    const started = initializeTtmc({ ...config, firstSeat: 0 }, baseCtx("alice"));
    const active = ttmcActiveSeat(started.state);
    const actor = participants[active];
    const other = participants[(1 - active) as 0 | 1];
    const chosen = reduceTtmc(started.state, { type: "CHOOSE_LEVEL", level: 8 }, config,
      { ...baseCtx(actor), phaseId: "p0", nextPhaseId: "p1" });
    for (const viewer of [actor, other]) {
      const view = projectTtmc(chosen.state, config, content, viewer, participants, identities, config, chosen.state);
      expect(view.chosenLevel).toBe(8);
      expect(view.question?.prompt).toBeTruthy();
      const raw = JSON.stringify(view);
      expect(raw).not.toContain("byLevel");
      expect(raw).not.toContain("Réponse");
    }
  });

  it("reveal expose solution et explication mais jamais les alias", () => {
    const started = initializeTtmc({ ...config, firstSeat: 0 }, baseCtx("alice"));
    const active = ttmcActiveSeat(started.state);
    const actor = participants[active];
    const chosen = reduceTtmc(started.state, { type: "CHOOSE_LEVEL", level: 4 }, config,
      { ...baseCtx(actor), phaseId: "p0", nextPhaseId: "p1" });
    const submitted = reduceTtmc(chosen.state, { type: "SUBMIT_ANSWER", answer: "test" }, config,
      { ...baseCtx(actor), phaseId: "p1", nextPhaseId: "att-1" });
    const judged = applyTtmcJudgment(submitted.state, { attemptId: "att-1", verdict: "reject", method: "llm" }, config,
      { ...baseCtx(null), phaseId: "p1", nextPhaseId: "r1" });
    for (const viewer of participants) {
      const view = projectTtmc(judged.state, config, content, viewer, participants, identities, config, judged.state);
      expect(view.reveal?.expectedAnswer).toBeTruthy();
      expect(view.reveal?.explanation).toBe("Explication vérifiée.");
      const raw = JSON.stringify(view);
      expect(raw).not.toContain("Alias secret");
      expect(raw).not.toContain("byLevel");
      expect(raw).not.toContain("spareByLevel");
      expect(raw).not.toContain("logicalKey");
      expect(raw).not.toContain("pendingVerdict");
      expect(raw).not.toContain("normalizedAnswer");
    }
  });

  it("NEXT masqué après sa propre confirmation et pendant contestation pending", () => {
    const started = initializeTtmc({ ...config, firstSeat: 0 }, baseCtx("alice"));
    const active = ttmcActiveSeat(started.state);
    const actor = participants[active];
    const other = participants[(1 - active) as 0 | 1];
    const chosen = reduceTtmc(started.state, { type: "CHOOSE_LEVEL", level: 4 }, config,
      { ...baseCtx(actor), phaseId: "p0", nextPhaseId: "p1" });
    const submitted = reduceTtmc(chosen.state, { type: "SUBMIT_ANSWER", answer: "test" }, config,
      { ...baseCtx(actor), phaseId: "p1", nextPhaseId: "att-2" });
    const judged = applyTtmcJudgment(submitted.state, { attemptId: "att-2", verdict: "reject", method: "llm" }, config,
      { ...baseCtx(null), phaseId: "p1", nextPhaseId: "r2" });
    const contested = reduceTtmc(judged.state, { type: "CONTEST", attemptId: "att-2" }, config,
      { ...baseCtx(actor), phaseId: "r2", nextPhaseId: "c2" });
    const pendingView = projectTtmc(contested.state, config, content, actor, participants, identities, config, contested.state);
    expect(pendingView.allowedActions).not.toContain("NEXT");
    expect(pendingView.allowedActions).not.toContain("CONTEST");
    const otherView = projectTtmc(contested.state, config, content, other, participants, identities, config, contested.state);
    expect(otherView.allowedActions).toContain("RESOLVE_CONTEST");
    expect(otherView.allowedActions).not.toContain("NEXT");
  });

  it("signale un remplacement technique sans exposer la file privée", () => {
    const started = initializeTtmc({ ...config, firstSeat: 0 }, baseCtx("alice"));
    const active = ttmcActiveSeat(started.state);
    const actor = participants[active];
    const chosen = reduceTtmc(started.state, { type: "CHOOSE_LEVEL", level: 7 }, config,
      { ...baseCtx(actor), phaseId: "p0", nextPhaseId: "p1" });
    const submitted = reduceTtmc(chosen.state, { type: "SUBMIT_ANSWER", answer: "flou" }, config,
      { ...baseCtx(actor), phaseId: "p1", nextPhaseId: "att-r" });
    const replaced = applyTtmcJudgment(submitted.state, { attemptId: "att-r", verdict: "ambiguous", method: "llm" }, config,
      { ...baseCtx(null), phaseId: "p1", nextPhaseId: "r-r" });
    expect(replaced.state.phase).toBe("answering");
    for (const viewer of participants) {
      const view = projectTtmc(replaced.state, config, content, viewer, participants, identities, config, replaced.state);
      expect(view.technicalReplacement).toBe(true);
      expect(view.question?.prompt).toBeTruthy();
      const raw = JSON.stringify(view);
      expect(raw).not.toContain("spareByLevel");
      expect(raw).not.toContain("byLevel");
      expect(raw).not.toContain("Alias secret");
    }
  });

  it("whitelist exhaustive par clés : aucun secret dans aucune phase pour aucun spectateur", () => {
    const forbiddenPreReveal = [
      "byLevel", "spareByLevel", "logicalKey", "packId", "itemId",
      "canonical", "aliases", "normalizedAnswer", "rawAnswer",
      "pendingVerdict", "pendingMethod", "themeLabel", "explanation",
      "schedule", "queue", "reserve",
    ];
    const started = initializeTtmc({ ...config, firstSeat: 0 }, baseCtx("alice"));
    const active = ttmcActiveSeat(started.state);
    const actor = participants[active];
    const other = participants[(1 - active) as 0 | 1];
    const collectKeys = (value: unknown, out = new Set<string>()): Set<string> => {
      if (Array.isArray(value)) value.forEach((entry) => collectKeys(entry, out));
      else if (value && typeof value === "object") {
        for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
          out.add(key);
          collectKeys(entry, out);
        }
      }
      return out;
    };
    const checkView = (state: unknown, viewer: string, extraForbidden: string[], mustHavePrompt: boolean) => {
      const view = projectTtmc(state, config, content, viewer, participants, identities, config, state as never);
      const keys = collectKeys(view);
      for (const key of [...forbiddenPreReveal, ...extraForbidden]) expect(keys.has(key)).toBe(false);
      if (mustHavePrompt) expect(view.question?.prompt).toBeTruthy();
      return view;
    };
    // choose_level : aucun prompt, aucun niveau confirmé.
    for (const viewer of participants) checkView(started.state, viewer, [], false);
    // answering / judging : prompt autorisé, réponses et verdicts interdits.
    const chosen = reduceTtmc(started.state, { type: "CHOOSE_LEVEL", level: 6 }, config,
      { ...baseCtx(actor), phaseId: "p0", nextPhaseId: "p1" });
    for (const viewer of participants) checkView(chosen.state, viewer, [], true);
    const submitted = reduceTtmc(chosen.state, { type: "SUBMIT_ANSWER", answer: "test" }, config,
      { ...baseCtx(actor), phaseId: "p1", nextPhaseId: "att-w" });
    for (const viewer of participants) {
      const view = checkView(submitted.state, viewer, [], true);
      expect(view.judging).not.toBeNull();
      expect(view.reveal).toBeNull();
    }
    // reveal : solution + explication autorisées, alias et files toujours interdits.
    const judged = applyTtmcJudgment(submitted.state, { attemptId: "att-w", verdict: "reject", method: "llm" }, config,
      { ...baseCtx(null), phaseId: "p1", nextPhaseId: "r-w" });
    for (const viewer of participants) {
      const view = projectTtmc(judged.state, config, content, viewer, participants, identities, config, judged.state);
      const keys = collectKeys(view);
      for (const key of ["byLevel", "spareByLevel", "logicalKey", "packId", "itemId", "aliases", "normalizedAnswer", "rawAnswer", "pendingVerdict", "pendingMethod", "themeLabel"]) {
        expect(keys.has(key)).toBe(false);
      }
      expect(view.reveal?.expectedAnswer).toBeTruthy();
      expect(view.reveal?.explanation).toBeTruthy();
    }
    // judging : la réponse adverse reste cachée (aucune clé de réponse).
    void other;
  });
});
