import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { DEFAULT_ENTROPY_LENGTH, entropyValues } from "@/server/hash";

describe("entropie serveur", () => {
  it("fournit par défaut un budget suffisant pour les pools et préparations", () => {
    const values = entropyValues();
    expect(DEFAULT_ENTROPY_LENGTH).toBe(4096);
    expect(values).toHaveLength(DEFAULT_ENTROPY_LENGTH);
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it("refuse une longueur épuisée ou invalide", () => {
    expect(() => entropyValues(0)).toThrow(RangeError);
    expect(() => entropyValues(-1)).toThrow(RangeError);
    expect(() => entropyValues(1.5)).toThrow(RangeError);
  });
});
