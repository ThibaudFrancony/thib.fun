import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  configured: true,
  admin: true,
  account: null as null | { isGuest: boolean; member: { id: string; effectiveName: string } },
  listConversations: vi.fn(),
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
  listAdminConversations: mocks.listConversations,
}));

import { GET } from "@/app/api/admin/conversations/route";

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("route admin des conversations", () => {
  beforeEach(() => {
    mocks.configured = true;
    mocks.admin = true;
    mocks.account = { isGuest: false, member: { id: "11111111-1111-4111-8111-111111111111", effectiveName: "Admin" } };
    mocks.listConversations.mockReset();
    mocks.listConversations.mockResolvedValue([]);
  });

  it("refuse un visiteur sans session", async () => {
    mocks.account = null;
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mocks.listConversations).not.toHaveBeenCalled();
  });

  it("refuse un membre non administrateur", async () => {
    mocks.admin = false;
    const response = await GET();
    expect(response.status).toBe(403);
    expect((await json(response)).error).toMatchObject({ code: "ADMIN_REQUIRED" });
    expect(mocks.listConversations).not.toHaveBeenCalled();
  });

  it("renvoie les conversations pour l'administrateur", async () => {
    mocks.listConversations.mockResolvedValue([{ id: "conversation", kind: "general" }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ conversations: [{ id: "conversation", kind: "general" }] });
    expect(mocks.listConversations).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
  });
});
