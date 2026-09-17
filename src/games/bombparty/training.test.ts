import { describe, expect, it } from "vitest";
import {
  checkTrainingWord,
  boundTrainingUsedWords,
  hintForTrainingSequence,
  isCurrentTrainingResponse,
  paginateTrainingCandidates,
  trainingCandidatesFor,
  TRAINING_SUGGESTION_LIMIT,
  TRAINING_USED_WORD_LIMIT,
} from "@/games/bombparty/training";
import type { BombpartyContent } from "@/games/bombparty/types";

const CONTENT: BombpartyContent = {
  packId: "bombparty-test",
  packChecksum: "checksum-test",
  words: [
    { id: "a", displayForm: "chat", normalizedForm: "chat" },
    { id: "b", displayForm: "château", normalizedForm: "chateau" },
    { id: "c", displayForm: "chien", normalizedForm: "chien" },
    { id: "d", displayForm: "niche", normalizedForm: "niche" },
    { id: "e", displayForm: "arche", normalizedForm: "arche" },
    { id: "f", displayForm: "marcher", normalizedForm: "marcher" },
    { id: "g", displayForm: "brave", normalizedForm: "brave" },
  ],
  bySequence: {},
};

describe("candidats d'entraînement", () => {
  it("trie par longueur croissante puis ordre alphabétique", () => {
    const candidates = trainingCandidatesFor(CONTENT, "ch");
    expect(candidates.map((item) => item.normalized)).toEqual(["chat", "chien", "arche", "marcher", "chateau", "niche"].filter((word) => word.includes("ch")).sort((a, b) => a.length - b.length || (a < b ? -1 : 1)));
    expect(candidates[0]).toMatchObject({ display: "chat" });
  });

  it("affiche la forme accentuée d'origine", () => {
    const candidates = trainingCandidatesFor(CONTENT, "tea");
    expect(candidates.map((item) => item.display)).toContain("château");
  });
});

describe("pagination des suggestions", () => {
  it("plafonne les suggestions à 20 par page (fiche §5)", () => {
    expect(TRAINING_SUGGESTION_LIMIT).toBe(20);
    const candidates = trainingCandidatesFor(CONTENT, "ch");
    const page = paginateTrainingCandidates(candidates, null);
    expect(page.items.length).toBeLessThanOrEqual(20);
  });
  it("parcourt toutes les pages sans doublons ni pertes", () => {
    const candidates = trainingCandidatesFor(CONTENT, "ch");
    const seen: string[] = [];
    let cursor: string | null | undefined;
    let pages = 0;
    do {
      const page = paginateTrainingCandidates(candidates, cursor, 2);
      for (const item of page.items) {
        expect(seen).not.toContain(item.normalized);
        seen.push(item.normalized);
      }
      cursor = page.nextCursor;
      pages += 1;
      if (pages > 10) throw new Error("pagination sans fin");
    } while (cursor !== null);
    expect(seen.sort()).toEqual(candidates.map((item) => item.normalized).sort());
    expect(pages).toBeGreaterThan(1);
  });

  it("un curseur invalide repart du début", () => {
    const candidates = trainingCandidatesFor(CONTENT, "ch");
    const page = paginateTrainingCandidates(candidates, "curseur-invalide", 2);
    expect(page.items.map((item) => item.normalized)).toEqual(candidates.slice(0, 2).map((item) => item.normalized));
  });
});

describe("vérification d'entraînement", () => {
  it("ignore une réponse tardive d'une ancienne requête ou séquence", () => {
    expect(isCurrentTrainingResponse(4, 4, "ch", "ch")).toBe(true);
    expect(isCurrentTrainingResponse(3, 4, "ch", "ch")).toBe(false);
    expect(isCurrentTrainingResponse(4, 4, "ch", "te")).toBe(false);
    expect(isCurrentTrainingResponse(4, 4, null, null)).toBe(true);
    expect(isCurrentTrainingResponse(4, 4, null, "ch")).toBe(false);
  });

  it("borne les mots utilisés après normalisation et déduplication", () => {
    const letters = "abcdefghijklmnopqrstuvwxyz";
    const values = Array.from({ length: 250 }, (_, index) => `mot${String(index).split("").map((digit) => letters[Number(digit)]).join("")}`);
    values.push("MOTA", "motb");
    const bounded = boundTrainingUsedWords(values);
    expect(TRAINING_USED_WORD_LIMIT).toBe(200);
    expect(bounded).toHaveLength(200);
    expect(new Set(bounded).size).toBe(200);
    expect(bounded.slice(0, 2)).toEqual(["mota", "motb"]);
  });

  it("accepte un mot valide et signale les doublons de session", () => {
    expect(checkTrainingWord(CONTENT, "ch", "chat", new Set())).toEqual({ valid: true, normalized: "chat" });
    expect(checkTrainingWord(CONTENT, "ch", "CHÂTEAU", new Set())).toEqual({ valid: true, normalized: "chateau" });
    expect(checkTrainingWord(CONTENT, "ch", "chat", new Set(["chat"]))).toEqual({ valid: false, reason: "ALREADY_USED" });
  });

  it("distingue séquence manquante, inconnu et invalide", () => {
    expect(checkTrainingWord(CONTENT, "ch", "brave", new Set())).toEqual({ valid: false, reason: "MISSING_SEQUENCE" });
    expect(checkTrainingWord(CONTENT, "ch", "chameauzz", new Set())).toEqual({ valid: false, reason: "UNKNOWN" });
    expect(checkTrainingWord(CONTENT, "ch", "porte-plume", new Set())).toEqual({ valid: false, reason: "INVALID" });
  });

  it("l'indice donne longueur et première lettre du mot le plus court", () => {
    expect(hintForTrainingSequence(CONTENT, "ch")).toEqual({ length: 4, firstLetter: "c" });
    expect(hintForTrainingSequence(CONTENT, "zz")).toBeNull();
  });
});
