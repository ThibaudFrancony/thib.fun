import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  configured: true,
  member: null as null | { id: string; effectiveName: string },
  sendFriendRequest: vi.fn(),
}));

vi.mock("@/server/config", () => ({
  getSupabaseServerConfig: () =>
    mocks.configured ? { url: "http://supabase", anonKey: "anon", serviceRoleKey: "service" } : null,
}));

vi.mock("@/server/auth", () => ({
  getAuthenticatedPermanentMember: async () => mocks.member,
}));

vi.mock("@/server/chat/repository", () => ({
  sendFriendRequest: mocks.sendFriendRequest,
}));

import { POST } from "@/app/api/friends/requests/route";

const TARGET = "22222222-2222-4222-8222-222222222222";

function request(body: unknown): Request {
  return new Request("http://localhost/api/friends/requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("route des demandes d'ami", () => {
  beforeEach(() => {
    mocks.configured = true;
    mocks.member = { id: "11111111-1111-4111-8111-111111111111", effectiveName: "Léo" };
    mocks.sendFriendRequest.mockReset();
  });

  it("exige un compte permanent", async () => {
    mocks.member = null;
    const response = await POST(request({ requestId: TARGET, targetId: TARGET }));
    expect(response.status).toBe(403);
    expect((await json(response)).error).toMatchObject({ code: "ACCOUNT_REQUIRED" });
    expect(mocks.sendFriendRequest).not.toHaveBeenCalled();
  });

  it("refuse un corps invalide avant d'appeler le serveur", async () => {
    const response = await POST(request({ targetId: "pas-un-uuid" }));
    expect(response.status).toBe(400);
    expect(mocks.sendFriendRequest).not.toHaveBeenCalled();
  });

  it("envoie la demande avec l'acteur authentifié", async () => {
    mocks.sendFriendRequest.mockResolvedValue({ friendshipId: TARGET, status: "pending", direction: "outgoing" });
    const response = await POST(
      request({ requestId: "33333333-3333-4333-8333-333333333333", targetId: TARGET }),
    );
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ friendshipId: TARGET, status: "pending", direction: "outgoing" });
    expect(mocks.sendFriendRequest).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "33333333-3333-4333-8333-333333333333",
      TARGET,
    );
  });

  it("mappe un refus métier stable", async () => {
    mocks.sendFriendRequest.mockRejectedValue(new Error("CANNOT_FRIEND_SELF"));
    const response = await POST(
      request({ requestId: "33333333-3333-4333-8333-333333333333", targetId: TARGET }),
    );
    expect(response.status).toBe(422);
    expect((await json(response)).error).toMatchObject({ code: "CANNOT_FRIEND_SELF" });
  });
});
