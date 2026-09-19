import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  configured: true,
  rows: [] as unknown,
  error: null as unknown,
}));

vi.mock("@/server/config", () => ({
  getSupabaseServerConfig: () =>
    mocks.configured ? { url: "http://supabase", anonKey: "anon", serviceRoleKey: "service" } : null,
}));

vi.mock("@/server/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ select: async () => ({ data: mocks.rows, error: mocks.error }) }),
  }),
}));

import { getVisibleGames } from "@/server/games/visibility";
import { PUBLIC_GAMES } from "@/games/registry";

describe("visibilité des jeux sur l'accueil", () => {
  beforeEach(() => {
    mocks.configured = true;
    mocks.rows = PUBLIC_GAMES.map((game) => ({ slug: game.slug, visible: true }));
    mocks.error = null;
  });

  it("masque uniquement les jeux désactivés", async () => {
    mocks.rows = [
      { slug: "uno", visible: false },
      { slug: "ttmc", visible: false },
    ];
    const games = await getVisibleGames();
    expect(games.map((game) => game.slug)).not.toContain("uno");
    expect(games.map((game) => game.slug)).not.toContain("ttmc");
    expect(games.map((game) => game.slug)).toContain("geographie");
    expect(games).toHaveLength(PUBLIC_GAMES.length - 2);
  });

  it("conserve l'ordre du registre", async () => {
    const games = await getVisibleGames();
    expect(games.map((game) => game.slug)).toEqual(PUBLIC_GAMES.map((game) => game.slug));
  });

  it("retombe sur le registre complet si la lecture échoue", async () => {
    mocks.error = { message: "boom" };
    expect(await getVisibleGames()).toEqual(PUBLIC_GAMES);
  });

  it("retombe sur le registre complet sans configuration Supabase", async () => {
    mocks.configured = false;
    expect(await getVisibleGames()).toEqual(PUBLIC_GAMES);
  });

  it("peut renvoyer une liste vide si tout est masqué", async () => {
    mocks.rows = PUBLIC_GAMES.map((game) => ({ slug: game.slug, visible: false }));
    expect(await getVisibleGames()).toEqual([]);
  });
});
