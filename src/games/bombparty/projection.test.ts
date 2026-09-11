import { describe, expect, it } from "vitest";
import { initializeBombparty, reduceBombparty, type BombpartyEngineContext } from "@/games/bombparty/engine";
import { normalizeBombpartyWord } from "@/games/bombparty/normalize";
import { projectBombparty } from "@/games/bombparty/projection";
import type { BombpartyContent } from "@/games/bombparty/types";

const PARTICIPANTS = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"] as const;
const IDENTITIES = [
  { id: PARTICIPANTS[0], pseudo: "Alice" },
  { id: PARTICIPANTS[1], pseudo: "Bob" },
] as const;

const CONTENT: BombpartyContent = {
  packId: "bombparty-test",
  packChecksum: "checksum-test",
  words: [
    { id: "a", displayForm: "chat", normalizedForm: "chat" },
    { id: "b", displayForm: "château", normalizedForm: "chateau" },
    { id: "c", displayForm: "chien", normalizedForm: "chien" },
    { id: "d", displayForm: "niche", normalizedForm: "niche" },
  ],
  bySequence: {
    ch: ["a", "b", "c"],
    ha: ["a", "b"],
    hi: ["c", "d"],
  },
};

const CONFIG = { lives: 3 as const, initialSeconds: 15 as const, sequenceDifficulty: "normal" as const };

function contextFor(actorId: string | null = PARTICIPANTS[0]): BombpartyEngineContext {
  return {
    nowMs: Date.parse("2026-09-11T12:00:00.000Z"),
    actorId,
    matchId: "33333333-3333-4333-8333-333333333333",
    participants: [PARTICIPANTS[0], PARTICIPANTS[1]],
    content: CONTENT,
    entropy: [0.1, 0.3],
    phaseId: "phase-1",
    nextPhaseId: "phase-2",
    currentDeadlineAt: null,
    currentDeadlineKind: null,
  };
}

describe("projection sans fuite", () => {
  it("n'expose ni index, ni lexique, ni horodatage interne", () => {
    const started = initializeBombparty(CONFIG, contextFor());
    for (const viewer of PARTICIPANTS) {
      const view = projectBombparty(started.state, CONFIG, viewer, [PARTICIPANTS[0], PARTICIPANTS[1]], [IDENTITIES[0], IDENTITIES[1]]);
      const serialized = JSON.stringify(view);
      expect(serialized).not.toContain("bySequence");
      expect(serialized).not.toContain("normalizedForm");
      expect(serialized).not.toContain("usedWords");
      expect(serialized).not.toContain("turnStartedAt");
      expect(serialized).not.toContain("packChecksum");
      expect(serialized).not.toContain("packId");
      expect(serialized).not.toContain("suggestion");
      expect(view.sequence).toMatch(/^[a-z]{2,3}$/);
      expect(view.lives).toEqual([3, 3]);
    }
  });

  it("le joueur actif peut soumettre, l'adversaire ne voit que la séquence", () => {
    const started = initializeBombparty(CONFIG, contextFor());
    const active = started.state.activeSeat;
    const viewerActive = projectBombparty(started.state, CONFIG, PARTICIPANTS[active], [PARTICIPANTS[0], PARTICIPANTS[1]], [IDENTITIES[0], IDENTITIES[1]]);
    const viewerWaiting = projectBombparty(
      started.state,
      CONFIG,
      PARTICIPANTS[(1 - active) as 0 | 1],
      [PARTICIPANTS[0], PARTICIPANTS[1]],
      [IDENTITIES[0], IDENTITIES[1]],
    );
    expect(viewerActive.allowedActions).toContain("SUBMIT_WORD");
    expect(viewerWaiting.allowedActions).not.toContain("SUBMIT_WORD");
    expect(viewerActive.sequence).toBe(viewerWaiting.sequence);
  });

  it("révèle les mots acceptés aux deux joueurs, avec les 10 derniers", () => {
    const started = initializeBombparty(CONFIG, contextFor());
    const word = CONTENT.words.find((entry) => entry.normalizedForm.includes(started.state.sequence))?.displayForm ?? "chat";
    const after = reduceBombparty(started.state, { type: "SUBMIT_WORD", word }, CONFIG, contextFor());
    for (const viewer of PARTICIPANTS) {
      const view = projectBombparty(after.state, CONFIG, viewer, [PARTICIPANTS[0], PARTICIPANTS[1]], [IDENTITIES[0], IDENTITIES[1]]);
      expect(view.acceptedWords).toHaveLength(1);
      expect(view.acceptedWords[0]?.word).toBe(normalizeBombpartyWord(word) === "chateau" ? "château" : word);
      expect(view.recentWords).toHaveLength(1);
      expect(view.validWordsTotal).toBe(1);
      expect(view.scores).toEqual([1, 0]);
    }
  });

  it("masque l'actif et expose le résultat en fin de partie", () => {
    const started = initializeBombparty(CONFIG, contextFor());
    const resigned = reduceBombparty(started.state, { type: "RESIGN" }, { lives: 5, initialSeconds: 20, sequenceDifficulty: "hard" }, contextFor());
    const view = projectBombparty(resigned.state, { lives: 5, initialSeconds: 20, sequenceDifficulty: "hard" }, PARTICIPANTS[0], [PARTICIPANTS[0], PARTICIPANTS[1]], [IDENTITIES[0], IDENTITIES[1]]);
    expect(view.activePlayerId).toBeNull();
    expect(view.allowedActions).toEqual([]);
    expect(view.result).toMatchObject({ outcome: "abandoned", reason: "resign" });
  });
});
