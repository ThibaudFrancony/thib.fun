import { describe, expect, it } from "vitest";
import { normalizeBombpartyWord } from "@/games/bombparty/normalize";

describe("normalisation serveur stricte", () => {
  it("accepte les accents, la casse et les espaces", () => {
    expect(normalizeBombpartyWord("  Château ")).toBe("chateau");
    expect(normalizeBombpartyWord("ÉCOLE")).toBe("ecole");
    expect(normalizeBombpartyWord("année")).toBe("annee");
  });

  it("développe les ligatures œ et æ", () => {
    expect(normalizeBombpartyWord("cœur")).toBe("coeur");
    expect(normalizeBombpartyWord("Æsopet")).toBe("aesopet");
  });

  it("rejette les tirets, apostrophes, chiffres et espaces internes", () => {
    expect(normalizeBombpartyWord("porte-monnaie")).toBeNull();
    expect(normalizeBombpartyWord("aujourd'hui")).toBeNull();
    expect(normalizeBombpartyWord("abc123")).toBeNull();
    expect(normalizeBombpartyWord("mot avec espace")).toBeNull();
  });

  it("rejette les longueurs hors 2..30 et les non-chaînes", () => {
    expect(normalizeBombpartyWord("a")).toBeNull();
    expect(normalizeBombpartyWord("x".repeat(31))).toBeNull();
    expect(normalizeBombpartyWord("")).toBeNull();
    expect(normalizeBombpartyWord(42)).toBeNull();
    expect(normalizeBombpartyWord("ab")).toBe("ab");
  });
});
