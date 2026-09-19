import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  configured: true,
  admin: true,
  account: null as null | { isGuest: boolean; member: { id: string; effectiveName: string } },
  setVisibility: vi.fn(),
}));

vi.mock("@/server/config", () => ({
  getSupabaseServerConfig: () =>
    mocks.configured ? { url: "http://supabase", anonKey: "anon", serviceRoleKey: "service" } : null,
}));

vi.mock("@/server/auth", () => ({
  getAuthenticatedAccount: async () => mocks.account,
}));

vi.mock("@/server/admin/repository", () => ({
  isAdminAccount: async () => mocks.admin,
  setAdminGameVisibility: mocks.setVisibility,
}));

import { POST } from "@/app/api/admin/games/[slug]/visibility/route";

const REQUEST_ID = "33333333-3333-4333-8333-333333333333";

function request(body: unknown): Request {
  return new Request("http://localhost/api/admin/games/uno/visibility", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function params(slug = "uno") {
  return { params: Promise.resolve({ slug }) };
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("route admin de visibilité des jeux", () => {
  beforeEach(() => {
    mocks.configured = true;
    mocks.admin = true;
    mocks.account = { isGuest: false, member: { id: "11111111-1111-4111-8111-111111111111", effectiveName: "Admin" } };
    mocks.setVisibility.mockReset();
    mocks.setVisibility.mockResolvedValue({ slug: "uno", visible: false });
  });

  it("refuse un membre non administrateur", async () => {
    mocks.admin = false;
    const response = await POST(request({ requestId: REQUEST_ID, visible: false }), params());
    expect(response.status).toBe(403);
    expect((await json(response)).error).toMatchObject({ code: "ADMIN_REQUIRED" });
    expect(mocks.setVisibility).not.toHaveBeenCalled();
  });

  it("refuse un corps invalide avant d'écrire", async () => {
    const response = await POST(request({ visible: "non" }), params());
    expect(response.status).toBe(400);
    expect(mocks.setVisibility).not.toHaveBeenCalled();
  });

  it("bascule la visibilité pour l'administrateur", async () => {
    const response = await POST(request({ requestId: REQUEST_ID, visible: false }), params());
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ slug: "uno", visible: false });
    expect(mocks.setVisibility).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      REQUEST_ID,
      "uno",
      false,
    );
  });

  it("mappe un jeu inconnu", async () => {
    mocks.setVisibility.mockRejectedValue(new Error("GAME_NOT_FOUND"));
    const response = await POST(request({ requestId: REQUEST_ID, visible: true }), params("inconnu"));
    expect(response.status).toBe(404);
    expect((await json(response)).error).toMatchObject({ code: "GAME_NOT_FOUND" });
  });
});
