import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { leaderboardRpcSchema } from "@/server/leaderboard/schemas";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

describe("leaderboardRpcSchema", () => {
  it("accepte un classement complet et coerce les compteurs", () => {
    const parsed = leaderboardRpcSchema.safeParse({
      entries: [
        {
          rank: "1",
          userId: UUID_A,
          name: "Léo",
          avatarPath: "user/avatar.webp",
          avatarPreset: "avatar-3",
          points: "42",
          wins: "3",
          losses: "2",
          draws: "1",
        },
      ],
      me: { rank: "5", points: 18, wins: 1, losses: 1, draws: 1 },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.entries[0]).toMatchObject({ rank: 1, points: 42, wins: 3, draws: 1 });
      expect(parsed.data.me).toMatchObject({ rank: 5, points: 18 });
    }
  });

  it("accepte me absent ou null (joueur sans point)", () => {
    expect(leaderboardRpcSchema.safeParse({ entries: [], me: null }).success).toBe(true);
    expect(leaderboardRpcSchema.safeParse({ entries: [] }).success).toBe(true);
  });

  it("refuse un rang nul, un identifiant invalide ou un chemin vide", () => {
    const base = {
      userId: UUID_A,
      name: "Léo",
      avatarPath: null,
      avatarPreset: "avatar-1",
      points: 10,
      wins: 1,
      losses: 0,
      draws: 0,
    };
    expect(leaderboardRpcSchema.safeParse({ entries: [{ ...base, rank: 0 }] }).success).toBe(false);
    expect(leaderboardRpcSchema.safeParse({ entries: [{ ...base, rank: 1, userId: "nope" }] }).success).toBe(false);
    expect(leaderboardRpcSchema.safeParse({ entries: [{ ...base, rank: 1, avatarPath: "" }] }).success).toBe(false);
    expect(leaderboardRpcSchema.safeParse({ entries: [{ ...base, rank: 1, userId: UUID_B, points: -1 }] }).success).toBe(false);
  });
});
