import { afterEach, describe, expect, it, vi } from "vitest";
import { CLIENT_INVALID_RESPONSE_ERROR, CLIENT_NETWORK_ERROR, postJson } from "@/lib/client-request";

function mockFetch(implementation: (...args: unknown[]) => Promise<unknown>) {
  vi.stubGlobal("fetch", vi.fn(implementation));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("postJson", () => {
  it("libère l'appelant avec un message lisible quand le réseau rejette", async () => {
    mockFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    const result = await postJson("/api/rooms", {});
    expect(result).toEqual({ ok: false, status: 0, message: CLIENT_NETWORK_ERROR });
  });

  it("remonte le message public du serveur en erreur", async () => {
    mockFetch(async () => ({
      ok: false,
      status: 409,
      json: async () => ({ error: { code: "VERSION_CONFLICT", message: "L'état a changé." } }),
    }));
    const result = await postJson("/api/rooms", {});
    expect(result).toEqual({ ok: false, status: 409, message: "L'état a changé." });
  });

  it("refuse une réponse 2xx qui n'est pas un objet", async () => {
    mockFetch(async () => ({ ok: true, status: 200, json: async () => "oops" }));
    const result = await postJson("/api/rooms", {});
    expect(result).toEqual({ ok: false, status: 200, message: CLIENT_INVALID_RESPONSE_ERROR });
  });

  it("retourne les données sur succès", async () => {
    mockFetch(async () => ({ ok: true, status: 201, json: async () => ({ roomId: "abc" }) }));
    const result = await postJson<{ roomId: string }>("/api/rooms", {});
    expect(result).toEqual({ ok: true, status: 201, data: { roomId: "abc" } });
  });
});
