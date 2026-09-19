import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/server/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc, from: mocks.from }),
}));

vi.mock("@/server/storage/signed-urls", () => ({
  signStoragePaths: async (_admin: unknown, _bucket: string, paths: readonly (string | null | undefined)[]) => {
    const urls = new Map<string, string>();
    for (const path of paths) if (path) urls.set(path, `signed:${path}`);
    return urls;
  },
}));

import { getPlayerGameStats, getPublicProfile } from "@/server/profiles/repository";

const USER_ID = "11111111-1111-4111-8111-111111111111";

describe("getPublicProfile", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.from.mockReset();
  });

  it("mappe le profil et signe l'avatar", async () => {
    mocks.rpc.mockResolvedValue({
      data: { id: USER_ID, effectiveName: "Ada", displayName: null, accountName: "Ada", avatarPreset: "avatar-3", avatarPath: "uid/photo.webp", isGuest: false },
      error: null,
    });
    const profile = await getPublicProfile(USER_ID);
    expect(mocks.rpc).toHaveBeenCalledWith("server_get_actor", { p_actor: USER_ID });
    expect(profile).toEqual({ id: USER_ID, name: "Ada", avatarPreset: "avatar-3", avatarUrl: "signed:uid/photo.webp" });
  });

  it("refuse un invité et un membre absent", async () => {
    mocks.rpc.mockResolvedValue({ data: { id: USER_ID, pseudo: "Invité", isGuest: true }, error: null });
    expect(await getPublicProfile(USER_ID)).toBeNull();

    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect(await getPublicProfile(USER_ID)).toBeNull();
  });

  it("remonte une erreur serveur stable", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(getPublicProfile(USER_ID)).rejects.toThrow("PROFILE_UNAVAILABLE");
  });
});

describe("getPlayerGameStats", () => {
  beforeEach(() => {
    mocks.from.mockReset();
  });

  it("mappe les agrégats et borne les compteurs invalides", async () => {
    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({
          data: [
            { game_slug: "uno", played: 3, wins: 2, losses: 1, draws: 0, cooperative: 0, abandoned: 0 },
            { game_slug: "ttmc", played: -1, wins: "x", losses: 0, draws: 0, cooperative: 0, abandoned: 0 },
            { game_slug: null, played: 1 },
          ],
          error: null,
        }),
      }),
    });
    const stats = await getPlayerGameStats(USER_ID);
    expect(stats).toEqual([
      { gameSlug: "uno", played: 3, wins: 2, losses: 1, draws: 0, cooperative: 0, abandoned: 0 },
      { gameSlug: "ttmc", played: 0, wins: 0, losses: 0, draws: 0, cooperative: 0, abandoned: 0 },
    ]);
  });

  it("remonte une erreur serveur stable", async () => {
    mocks.from.mockReturnValue({ select: () => ({ eq: () => Promise.resolve({ data: null, error: { message: "boom" } }) }) });
    await expect(getPlayerGameStats(USER_ID)).rejects.toThrow("PROFILE_STATS_UNAVAILABLE");
  });
});
