import { afterEach, describe, expect, it, vi } from "vitest";
import { sendChatMessageRequest } from "@/lib/chat-client";

const CONVERSATION_ID = "22222222-2222-2222-2222-222222222222";
const REQUEST_ID = "33333333-3333-3333-3333-333333333333";

function mockFetch(status: number, body: unknown, headers = new Headers()) {
  const implementation = vi.fn(async () => ({ ok: status >= 200 && status < 300, status, headers, json: async () => body }));
  vi.stubGlobal("fetch", implementation);
  return implementation;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendChatMessageRequest", () => {
  it("remonte le message public du serveur en erreur", async () => {
    mockFetch(503, {
      error: { code: "DATABASE_UNAVAILABLE", message: "Le service de données est temporairement indisponible." },
    });
    await expect(
      sendChatMessageRequest(CONVERSATION_ID, { requestId: REQUEST_ID, body: "salut", file: null }),
    ).rejects.toThrow("Le service de données est temporairement indisponible.");
  });

  it("retombe sur un message générique si la réponse d'erreur est illisible", async () => {
    mockFetch(500, "boom");
    await expect(
      sendChatMessageRequest(CONVERSATION_ID, { requestId: REQUEST_ID, body: "salut", file: null }),
    ).rejects.toThrow("Le message n'a pas pu être envoyé.");
  });

  it("journalise le diagnostic d'un 500 inattendu", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockFetch(
      500,
      { error: { code: "INTERNAL_ERROR", message: "Une erreur serveur est survenue." } },
      new Headers({ "x-diagnostic-id": "diag-123" }),
    );
    await expect(
      sendChatMessageRequest(CONVERSATION_ID, { requestId: REQUEST_ID, body: "salut", file: null }),
    ).rejects.toThrow("Une erreur serveur est survenue.");
    expect(spy).toHaveBeenCalledWith(
      "Envoi de message refusé",
      expect.objectContaining({ code: "INTERNAL_ERROR", diagnosticId: "diag-123" }),
    );
    spy.mockRestore();
  });

  it("retourne le message envoyé sur succès", async () => {
    const message = {
      id: "44444444-4444-4444-4444-444444444444",
      seq: 1,
      conversationId: CONVERSATION_ID,
      body: "salut",
      imageUrl: null,
      imageWidth: null,
      imageHeight: null,
      createdAt: "2026-09-19T10:00:00.000Z",
    };
    mockFetch(200, { message });
    await expect(
      sendChatMessageRequest(CONVERSATION_ID, { requestId: REQUEST_ID, body: "salut", file: null }),
    ).resolves.toEqual(message);
  });
});
