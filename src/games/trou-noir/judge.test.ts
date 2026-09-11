import { describe, expect, it } from "vitest";
import { deterministicJudge, normalizeAnswer } from "@/games/trou-noir/judge";

function question(overrides: Record<string, unknown> = {}) {
  return {
    itemId: "q-1",
    packId: "pack-1",
    logicalKey: "k-1",
    category: "culture",
    themeLabel: "Thème",
    difficulty: 3,
    prompt: "Question ?",
    canonical: "Victor Hugo",
    aliases: [],
    answerType: "person",
    requiredPrecision: "Nom exact ou équivalent non ambigu.",
    allowSurnameOnly: true,
    allowDescription: false,
    numericTolerance: 0,
    explanation: "Explication vérifiée.",
    ...overrides,
  } as Parameters<typeof deterministicJudge>[0];
}

describe("normalisation des réponses", () => {
  it("supprime casse, accents et apostrophes typographiques", () => {
    expect(normalizeAnswer("  L’Hôtel-Dieu ")).toBe("l'hotel-dieu");
    expect(normalizeAnswer("Éléonore")).toBe("eleonore");
  });
});

describe("correction déterministe", () => {
  it("accepte le canonique et les alias", () => {
    expect(deterministicJudge(question(), "Victor Hugo")).toBe("accept");
    expect(deterministicJudge(question({ aliases: ["V. Hugo"] }), "v. hugo")).toBe("accept");
  });

  it("accepte le nom seul quand la politique le permet", () => {
    expect(deterministicJudge(question(), "hugo")).toBe("accept");
  });

  it("refuse un chiffre hors tolérance sans rattrapage sémantique", () => {
    const numeric = question({
      answerType: "number",
      canonical: "1789",
      numericValue: 1789,
      numericTolerance: 0,
      allowSurnameOnly: false,
    });
    expect(deterministicJudge(numeric, "1789")).toBe("accept");
    expect(deterministicJudge(numeric, "1790")).toBe("reject");
  });

  it("rejette les listes de candidats", () => {
    expect(deterministicJudge(question(), "Hugo, Zola")).toBe("reject");
  });

  it("laisse les cas douteux au correcteur sémantique", () => {
    expect(deterministicJudge(question(), "un écrivain français célèbre")).toBe("undecided");
  });
});
