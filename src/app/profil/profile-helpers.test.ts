import { describe, expect, it } from "vitest";
import { AVATAR_PRESETS, displayNameKey, effectiveDisplayName, isAvatarPreset, normalizeDisplayName, normalizeProfilePseudo, profilePseudoKey } from "@/app/profil/profile-helpers";

describe("profil", () => {
  it("normalise les espaces sans élargir l'alphabet autorisé", () => {
    expect(normalizeProfilePseudo("  Zoé   42 ")).toBe("Zoé 42");
    expect(normalizeProfilePseudo("a")).toBeNull();
    expect(normalizeProfilePseudo("pseudo/incorrect")).toBeNull();
    expect(normalizeProfilePseudo("pseudo\nincorrect")).toBeNull();
  });

  it("produit une clé insensible à la casse et valide les dix presets PNG", () => {
    expect(profilePseudoKey("  Zoé   42 ")).toBe("zoé 42");
    expect(AVATAR_PRESETS).toHaveLength(10);
    expect(isAvatarPreset("avatar-4")).toBe(true);
    expect(isAvatarPreset("orbit-4")).toBe(false);
    expect(isAvatarPreset("avatar-11")).toBe(false);
    expect(isAvatarPreset(null)).toBe(false);
  });

  it("traite le nom affiché comme optionnel : vide = null, sinon règles du pseudo", () => {
    expect(normalizeDisplayName("")).toBeNull();
    expect(normalizeDisplayName("   ")).toBeNull();
    expect(normalizeDisplayName("  Jo  ")).toBe("Jo");
    expect(normalizeDisplayName("x")).toBeNull();
    expect(normalizeDisplayName("nom/interdit")).toBeNull();
    expect(displayNameKey("  Jo Jo  ")).toBe("jo jo");
    expect(displayNameKey("")).toBeNull();
    expect(displayNameKey(null)).toBeNull();
  });

  it("calcule le nom effectif : affiché puis création puis repli", () => {
    expect(effectiveDisplayName("Base", "Second", "Repli")).toBe("Second");
    expect(effectiveDisplayName("Base", null, "Repli")).toBe("Base");
    expect(effectiveDisplayName(null, null, "Repli")).toBe("Repli");
  });
});
