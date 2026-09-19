import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  games: [{ slug: "uno" }],
}));

vi.mock("@/server/games/visibility", () => ({
  getVisibleGames: async () => mocks.games,
}));

import { GET } from "@/app/api/games/visible/route";

describe("route publique des jeux visibles", () => {
  beforeEach(() => {
    mocks.games = [{ slug: "uno" }];
  });

  it("renvoie la liste visible sans authentification", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ games: [{ slug: "uno" }] });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
