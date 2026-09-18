import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  configured: true,
  account: null as null | { isGuest: boolean; member: { id: string; effectiveName: string } },
  getChatSummary: vi.fn(),
}));

vi.mock("@/server/config", () => ({
  getSupabaseServerConfig: () =>
    mocks.configured ? { url: "http://supabase", anonKey: "anon", serviceRoleKey: "service" } : null,
}));

vi.mock("@/server/auth", () => ({
  getAuthenticatedAccount: async () => mocks.account,
}));

vi.mock("@/server/chat/repository", () => ({
  getChatSummary: mocks.getChatSummary,
}));

import { GET } from "@/app/api/chat/summary/route";

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("route du résumé de chat", () => {
  beforeEach(() => {
    mocks.configured = true;
    mocks.account = {
      isGuest: false,
      member: { id: "11111111-1111-4111-8111-111111111111", effectiveName: "Léo" },
    };
    mocks.getChatSummary.mockReset();
  });

  it("refuse un visiteur sans session", async () => {
    mocks.account = null;
    const response = await GET();
    expect(response.status).toBe(401);
    expect((await json(response)).error).toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.getChatSummary).not.toHaveBeenCalled();
  });

  it("retourne 503 sans configuration Supabase", async () => {
    mocks.configured = false;
    const response = await GET();
    expect(response.status).toBe(503);
    expect((await json(response)).error).toMatchObject({ code: "CONFIGURATION_REQUIRED" });
  });

  it("transmet l'identité serveur et le droit d'écriture", async () => {
    const summary = { general: { conversationId: "c", unread: 0 } };
    mocks.getChatSummary.mockResolvedValue(summary);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual(summary);
    expect(mocks.getChatSummary).toHaveBeenCalledWith({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Léo",
      isGuest: false,
      canWrite: true,
    });
  });

  it("marque un invité comme lecteur sans écriture", async () => {
    mocks.account = {
      isGuest: true,
      member: { id: "11111111-1111-4111-8111-111111111111", effectiveName: "Invité-1234" },
    };
    mocks.getChatSummary.mockResolvedValue({});
    await GET();
    expect(mocks.getChatSummary).toHaveBeenCalledWith(
      expect.objectContaining({ isGuest: true, canWrite: false }),
    );
  });

  it("mappe un code RPC stable sans fuite SQL", async () => {
    mocks.getChatSummary.mockRejectedValue(new Error("MEMBER_REQUIRED"));
    const response = await GET();
    expect(response.status).toBe(403);
    expect((await json(response)).error).toMatchObject({ code: "MEMBER_REQUIRED" });
  });
});
