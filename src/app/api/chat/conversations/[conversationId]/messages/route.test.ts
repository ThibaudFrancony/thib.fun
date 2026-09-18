import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  configured: true,
  member: null as null | { id: string; effectiveName: string },
  optimizeChatImage: vi.fn(),
  sendChatMessage: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/server/config", () => ({
  getSupabaseServerConfig: () =>
    mocks.configured ? { url: "http://supabase", anonKey: "anon", serviceRoleKey: "service" } : null,
}));

vi.mock("@/server/auth", () => ({
  getAuthenticatedPermanentMember: async () => mocks.member,
  getAuthenticatedMember: async () => mocks.member,
}));

vi.mock("@/server/chat/image", () => ({
  CHAT_IMAGE_MAX_INPUT_BYTES: 4 * 1024 * 1024,
  optimizeChatImage: mocks.optimizeChatImage,
}));

vi.mock("@/server/chat/repository", () => ({
  sendChatMessage: mocks.sendChatMessage,
  getChatMessages: vi.fn(),
}));

vi.mock("@/server/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({ upload: mocks.upload, remove: mocks.remove }),
    },
  }),
}));

import { POST } from "@/app/api/chat/conversations/[conversationId]/messages/route";

const MEMBER_ID = "11111111-1111-4111-8111-111111111111";
const CONVERSATION_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";

function formRequest(fields: Record<string, string>, file?: File): Request {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  if (file) form.set("file", file);
  return new Request(`http://localhost/api/chat/conversations/${CONVERSATION_ID}/messages`, {
    method: "POST",
    body: form,
  });
}

function params() {
  return { params: Promise.resolve({ conversationId: CONVERSATION_ID }) };
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

const sentMessage = {
  id: "44444444-4444-4444-8444-444444444444",
  seq: 7,
  conversationId: CONVERSATION_ID,
  body: "Salut",
  imageUrl: null,
  imageWidth: null,
  imageHeight: null,
  createdAt: "2026-09-18T20:00:00.000Z",
};

describe("route d'envoi de message", () => {
  beforeEach(() => {
    mocks.configured = true;
    mocks.member = { id: MEMBER_ID, effectiveName: "Léo" };
    mocks.optimizeChatImage.mockReset();
    mocks.sendChatMessage.mockReset();
    mocks.upload.mockReset();
    mocks.remove.mockReset();
    mocks.upload.mockResolvedValue({ error: null });
    mocks.remove.mockResolvedValue({ data: [], error: null });
    mocks.sendChatMessage.mockResolvedValue(sentMessage);
  });

  it("envoie un message texte sans image", async () => {
    const response = await POST(formRequest({ requestId: REQUEST_ID, body: "  Salut  " }), params());
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ message: sentMessage });
    expect(mocks.sendChatMessage).toHaveBeenCalledWith(MEMBER_ID, {
      requestId: REQUEST_ID,
      conversationId: CONVERSATION_ID,
      body: "Salut",
      imagePath: null,
      imageWidth: null,
      imageHeight: null,
    });
  });

  it("optimise et téléverse une photo avant l'insertion", async () => {
    mocks.optimizeChatImage.mockResolvedValue({ data: Buffer.from("webp"), width: 640, height: 480, bytes: 4 });
    mocks.upload.mockResolvedValue({ error: null });
    const file = new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" });
    const response = await POST(formRequest({ requestId: REQUEST_ID }, file), params());
    expect(response.status).toBe(200);
    expect(mocks.optimizeChatImage).toHaveBeenCalledTimes(1);
    const call = mocks.sendChatMessage.mock.calls[0][1] as { imagePath: string; imageWidth: number; imageHeight: number };
    expect(call.imagePath).toMatch(new RegExp(`^${MEMBER_ID}/[0-9a-f-]{36}\\.webp$`, "u"));
    expect(call.imageWidth).toBe(640);
    expect(call.imageHeight).toBe(480);
  });

  it("refuse un fichier non pris en charge sans téléverser", async () => {
    const file = new File([new Uint8Array([1])], "notes.pdf", { type: "application/pdf" });
    const response = await POST(formRequest({ requestId: REQUEST_ID }, file), params());
    expect(response.status).toBe(400);
    expect((await json(response)).error).toMatchObject({ code: "IMAGE_INVALID" });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.sendChatMessage).not.toHaveBeenCalled();
  });

  it("refuse un message vide", async () => {
    const response = await POST(formRequest({ requestId: REQUEST_ID }), params());
    expect(response.status).toBe(422);
    expect((await json(response)).error).toMatchObject({ code: "MESSAGE_EMPTY" });
  });

  it("supprime la photo téléversée quand le serveur refuse le message", async () => {
    mocks.optimizeChatImage.mockResolvedValue({ data: Buffer.from("webp"), width: 10, height: 10, bytes: 4 });
    mocks.upload.mockResolvedValue({ error: null });
    mocks.sendChatMessage.mockRejectedValue(new Error("RATE_LIMITED"));
    const file = new File([new Uint8Array([1, 2, 3])], "photo.webp", { type: "image/webp" });
    const response = await POST(formRequest({ requestId: REQUEST_ID }, file), params());
    expect(response.status).toBe(429);
    expect(mocks.remove).toHaveBeenCalledTimes(1);
    const removed = mocks.remove.mock.calls[0][0] as string[];
    expect(removed[0]).toMatch(new RegExp(`^${MEMBER_ID}/`, "u"));
  });
});
