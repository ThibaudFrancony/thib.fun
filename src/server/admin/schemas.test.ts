import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  adminConversationPayloadSchema,
  adminConversationSummarySchema,
  adminGameEntrySchema,
  adminMessagesQuerySchema,
  setGameVisibilityInputSchema,
} from "@/server/admin/schemas";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

describe("schémas d'administration", () => {
  it("valide une bascule de visibilité", () => {
    expect(setGameVisibilityInputSchema.safeParse({ requestId: UUID_A, visible: true }).success).toBe(true);
    expect(setGameVisibilityInputSchema.safeParse({ requestId: "nope", visible: true }).success).toBe(false);
    expect(setGameVisibilityInputSchema.safeParse({ requestId: UUID_A, visible: "oui" }).success).toBe(false);
  });

  it("coerce la pagination admin et la borne", () => {
    expect(adminMessagesQuerySchema.parse({ before: "12", limit: "30" })).toEqual({ before: 12, limit: 30 });
    expect(adminMessagesQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
    expect(adminMessagesQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
  });

  it("valide la liste des jeux", () => {
    expect(adminGameEntrySchema.array().parse([{ slug: "uno", visible: false, availability: "ready" }])).toHaveLength(1);
    expect(adminGameEntrySchema.safeParse({ slug: "", visible: true, availability: "ready" }).success).toBe(false);
  });

  it("valide un résumé de conversation générale et privée", () => {
    const general = {
      id: UUID_A,
      kind: "general",
      title: "Chat général",
      members: [],
      messageCount: 12,
      lastMessageAt: "2026-09-18T20:00:00.000Z",
      lastMessage: {
        id: UUID_B,
        seq: 12,
        authorId: UUID_A,
        body: "Salut",
        imagePath: null,
        createdAt: "2026-09-18T20:00:00.000Z",
      },
    };
    expect(adminConversationSummarySchema.parse(general).kind).toBe("general");
    const direct = {
      ...general,
      kind: "direct",
      title: "Léa & Max",
      members: [
        { userId: UUID_A, name: "Léa", avatarPath: null, avatarPreset: "avatar-1", isGuest: false },
        { userId: UUID_B, name: "Max", avatarPath: null, avatarPreset: "avatar-2", isGuest: false },
      ],
      lastMessage: null,
      lastMessageAt: null,
    };
    expect(adminConversationSummarySchema.parse(direct).members).toHaveLength(2);
    expect(adminConversationSummarySchema.safeParse({ ...general, kind: "groupe" }).success).toBe(false);
  });

  it("valide une conversation admin et ses messages", () => {
    const payload = {
      conversation: {
        id: UUID_A,
        kind: "direct",
        title: "Léa & Max",
        members: [{ userId: UUID_B, name: "Max", avatarPath: null, avatarPreset: "avatar-2", isGuest: false }],
      },
      messages: [
        {
          id: UUID_B,
          seq: 1,
          authorId: UUID_A,
          authorName: "Léa",
          authorAvatarPath: null,
          authorAvatarPreset: "avatar-1",
          authorIsGuest: false,
          body: null,
          imagePath: "path/photo.webp",
          imageWidth: 640,
          imageHeight: 480,
          createdAt: "2026-09-18T20:00:00.000Z",
        },
      ],
      hasMore: true,
    };
    expect(adminConversationPayloadSchema.parse(payload).messages[0].imagePath).toBe("path/photo.webp");
    expect(
      adminConversationPayloadSchema.safeParse({
        ...payload,
        conversation: { ...payload.conversation, members: [] },
      }).success,
    ).toBe(true);
  });
});
