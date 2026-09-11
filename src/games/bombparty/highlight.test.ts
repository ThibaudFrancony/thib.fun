import { describe, expect, it } from "vitest";
import { findSequenceRange, splitAroundSequence } from "@/games/bombparty/highlight";

describe("surlignage insensible aux accents", () => {
  it("retrouve une séquence malgré une majuscule accentuée", () => {
    expect(findSequenceRange("École", "eco")).toEqual({ start: 0, end: 3 });
    expect(splitAroundSequence("École", "eco")).toEqual({ before: "", match: "Éco", after: "le" });
  });

  it("surligne la ligature d'origine quand le normalisé l'étend", () => {
    expect(findSequenceRange("cœur", "oe")).toEqual({ start: 1, end: 2 });
    expect(splitAroundSequence("cœur", "oe")?.match).toBe("œ");
  });

  it("reste insensible à la casse de la séquence", () => {
    expect(findSequenceRange("CHATEAU", "CHA")).toEqual({ start: 0, end: 3 });
  });

  it("retourne null quand la séquence est absente ou invalide", () => {
    expect(findSequenceRange("chat", "zz")).toBeNull();
    expect(findSequenceRange("chat", "château")).toBeNull();
    expect(splitAroundSequence("chat", "zz")).toBeNull();
  });
});
