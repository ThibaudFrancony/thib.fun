import { describe, expect, it } from "vitest";
import { roomViewSchema } from "@/server/rooms/schemas";

const base = {
  roomId: "00000000-0000-4000-8000-000000000001",
  code: "ABC123",
  hostId: "00000000-0000-4000-8000-000000000002",
  config: {},
  status: "waiting" as const,
  version: 1,
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  currentMatchId: null,
  members: [],
  viewerId: "00000000-0000-4000-8000-000000000002",
};

describe("contrat de projection de salon", () => {
  it("accepte un salon générique sans jeu (gameSlug null)", () => {
    const parsed = roomViewSchema.safeParse({ ...base, gameSlug: null });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.gameSlug).toBeNull();
  });

  it("accepte un salon lié à un jeu", () => {
    const parsed = roomViewSchema.safeParse({ ...base, gameSlug: "uno" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.gameSlug).toBe("uno");
  });

  it("refuse une projection sans gameSlug", () => {
    expect(roomViewSchema.safeParse(base).success).toBe(false);
  });
});
