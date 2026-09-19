import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/server/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));

vi.mock("@/server/storage/signed-urls", () => ({
  signStoragePaths: async (_admin: unknown, _bucket: string, paths: readonly (string | null | undefined)[]) => {
    const urls = new Map<string, string>();
    for (const path of paths) if (path) urls.set(path, `signed:${path}`);
    return urls;
  },
}));

import { getLeaderboard } from "@/server/leaderboard/repository";

const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const RIVAL_ID = "22222222-2222-4222-8222-222222222222";

const rpcPayload = {
  entries: [
    {
      rank: 1,
      userId: RIVAL_ID,
      name: "Rival",
      avatarPath: "rival/avatar.webp",
      avatarPreset: "avatar-2",
      points: 42,
      wins: 4,
      losses: 0,
      draws: 1,
    },
    {
      rank: 2,
      userId: ACTOR_ID,
      name: "Léo",
      avatarPath: null,
      avatarPreset: "avatar-1",
      points: 25,
      wins: 2,
      losses: 1,
      draws: 0,
    },
  ],
  me: { rank: 2, points: 25, wins: 2, losses: 1, draws: 0 },
};

describe("getLeaderboard", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
  });

  it("mappe le classement et signe les avatars", async () => {
    mocks.rpc.mockResolvedValue({ data: rpcPayload, error: null });
    const result = await getLeaderboard(ACTOR_ID);
    expect(mocks.rpc).toHaveBeenCalledWith("server_get_leaderboard", { p_actor: ACTOR_ID, p_limit: 100 });
    expect(result.entries).toEqual([
      {
        rank: 1,
        userId: RIVAL_ID,
        name: "Rival",
        avatarUrl: "signed:rival/avatar.webp",
        avatarPreset: "avatar-2",
        points: 42,
        wins: 4,
        losses: 0,
        draws: 1,
      },
      {
        rank: 2,
        userId: ACTOR_ID,
        name: "Léo",
        avatarUrl: null,
        avatarPreset: "avatar-1",
        points: 25,
        wins: 2,
        losses: 1,
        draws: 0,
      },
    ]);
    expect(result.me).toEqual(rpcPayload.me);
  });

  it("retourne me null quand le joueur n'a pas de point", async () => {
    mocks.rpc.mockResolvedValue({ data: { entries: [], me: null }, error: null });
    const result = await getLeaderboard(ACTOR_ID);
    expect(result).toEqual({ entries: [], me: null });
  });

  it("remonte un code stable et refuse une charge utile invalide", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "ACCOUNT_REQUIRED" } });
    await expect(getLeaderboard(ACTOR_ID)).rejects.toThrow("ACCOUNT_REQUIRED");

    mocks.rpc.mockResolvedValue({ data: { entries: "nope" }, error: null });
    await expect(getLeaderboard(ACTOR_ID)).rejects.toThrow("DATABASE_UNAVAILABLE");

    mocks.rpc.mockResolvedValue({ data: null, error: { message: "some sql error" } });
    await expect(getLeaderboard(ACTOR_ID)).rejects.toThrow("DATABASE_UNAVAILABLE");
  });
});
