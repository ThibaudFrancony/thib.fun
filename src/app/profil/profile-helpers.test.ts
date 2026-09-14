import { describe, expect, it } from "vitest";
import { AVATAR_PRESETS, isAvatarPreset, normalizeProfilePseudo, profilePseudoKey } from "@/app/profil/profile-helpers";

describe("profil", () => {
  it("normalise les espaces sans élargir l'alphabet autorisé", () => {
    expect(normalizeProfilePseudo("  Zoé   42 ")).toBe("Zoé 42");
    expect(normalizeProfilePseudo("a")).toBeNull();
    expect(normalizeProfilePseudo("pseudo/incorrect")).toBeNull();
    expect(normalizeProfilePseudo("pseudo\nincorrect")).toBeNull();
  });

  it("produit une clé insensible à la casse et valide les huit presets", () => {
    expect(profilePseudoKey("  Zoé   42 ")).toBe("zoé 42");
    expect(AVATAR_PRESETS).toHaveLength(8);
    expect(isAvatarPreset("orbit-4")).toBe(true);
    expect(isAvatarPreset("orbit-9")).toBe(false);
    expect(isAvatarPreset(null)).toBe(false);
  });
});
