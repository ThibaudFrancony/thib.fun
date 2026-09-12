import { describe, expect, it } from "vitest";
import { isAnonymousUser } from "@/lib/auth-identity";

describe("identité invitée", () => {
  it("reconnaît uniquement le claim Auth is_anonymous", () => {
    expect(isAnonymousUser({ is_anonymous: true })).toBe(true);
    expect(isAnonymousUser({ is_anonymous: false })).toBe(false);
    expect(isAnonymousUser({})).toBe(false);
    expect(isAnonymousUser(null)).toBe(false);
  });
});
