import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { jsonError, jsonOk, mapServerError } from "@/server/http";

describe("contrat HTTP public", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("ne met jamais un code arbitraire ou SQL dans error.code", async () => {
    const response = jsonError("permission denied for table private_matches", 500, "message SQL à ne pas exposer");
    const payload = await response.json() as { error: { code: string; message: string; retryable: boolean } };

    expect(response.status).toBe(500);
    expect(payload.error.code).toBe("INTERNAL_ERROR");
    expect(payload.error.message).toBe("Une erreur serveur est survenue.");
    expect(payload.error.code).not.toContain("permission");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("vary")).toContain("Cookie");
    expect(response.headers.get("x-diagnostic-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("mappe un code métier stable sans réexposer le message interne", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = mapServerError(new Error("permission denied for table private.matches"));
    const payload = await response.json() as { error: { code: string; message: string; retryable: boolean } };

    expect(payload.error.code).toBe("INTERNAL_ERROR");
    expect(payload.error.message).not.toContain("permission");
    expect(payload.error.retryable).toBe(true);
    expect(response.headers.get("x-diagnostic-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(log).toHaveBeenCalledWith("Unexpected server error", expect.objectContaining({ errorType: "Error" }));
  });

  it("conserve les codes publics déclarés et ne met pas les snapshots en cache", async () => {
    const errorResponse = jsonError("VERSION_CONFLICT", 409, "L'état a changé. Recharge la partie.");
    const errorPayload = await errorResponse.json() as { error: { code: string; retryable: boolean } };
    const okResponse = jsonOk({ version: 4 });

    expect(errorPayload.error.code).toBe("VERSION_CONFLICT");
    expect(errorPayload.error.retryable).toBe(false);
    expect(okResponse.headers.get("cache-control")).toBe("private, no-store");
    expect(okResponse.headers.get("vary")).toContain("Cookie");
  });
});
