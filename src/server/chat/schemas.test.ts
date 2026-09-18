import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  chatMessagesQuerySchema,
  chatMessagesRpcSchema,
  chatSummaryRpcSchema,
  friendRequestInputSchema,
  respondFriendRequestInputSchema,
  sendChatMessageInputSchema,
} from "@/server/chat/schemas";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

describe("schémas du chat et des amis", () => {
  it("accepte un résumé complet et signe les chemins", () => {
    const parsed = chatSummaryRpcSchema.parse({
      general: {
        conversationId: UUID_A,
        unread: 2,
        messageCount: 12,
        lastMessage: {
          id: UUID_B,
          seq: 12,
          authorId: UUID_A,
          body: null,
          imagePath: `${UUID_A}/photo.webp`,
          createdAt: "2026-09-18T20:00:00.000Z",
        },
      },
      friends: [
        {
          userId: UUID_B,
          name: "Léa",
          avatarPath: null,
          avatarPreset: "avatar-2",
          online: true,
          conversationId: null,
          unread: 0,
          lastMessage: null,
        },
      ],
      incomingRequests: [],
      outgoingRequests: [],
      onlineCount: 1,
    });
    expect(parsed.general.unread).toBe(2);
    expect(parsed.friends[0].avatarPath).toBeNull();
  });

  it("refuse un résumé sans conversation générale", () => {
    const result = chatSummaryRpcSchema.safeParse({
      general: { conversationId: "pas-un-uuid", unread: 0, messageCount: 0 },
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
      onlineCount: 0,
    });
    expect(result.success).toBe(false);
  });

  it("accepte une page de messages et rejette un auteur manquant", () => {
    const page = {
      conversation: { id: UUID_A, kind: "general", title: "Général", member: null },
      messages: [
        {
          id: UUID_B,
          seq: 1,
          authorId: UUID_A,
          authorName: "Léo",
          authorAvatarPath: null,
          authorAvatarPreset: "avatar-1",
          authorIsGuest: false,
          body: "Salut",
          imagePath: null,
          imageWidth: null,
          imageHeight: null,
          createdAt: "2026-09-18T20:00:00.000Z",
        },
      ],
      hasMore: false,
    };
    expect(chatMessagesRpcSchema.parse(page).messages).toHaveLength(1);
    const broken = chatMessagesRpcSchema.safeParse({
      ...page,
      messages: [{ ...page.messages[0], authorName: undefined }],
    });
    expect(broken.success).toBe(false);
  });

  it("exige un membre objet ou null, jamais un tableau", () => {
    const base = {
      conversation: { id: UUID_A, kind: "general", title: "Général", member: null },
      messages: [],
      hasMore: false,
    };
    expect(chatMessagesRpcSchema.safeParse(base).success).toBe(true);
    expect(
      chatMessagesRpcSchema.safeParse({ ...base, conversation: { ...base.conversation, member: [] } }).success,
    ).toBe(false);
    expect(
      chatMessagesRpcSchema.safeParse({
        ...base,
        conversation: {
          id: UUID_A,
          kind: "direct",
          title: "Léa",
          member: { userId: UUID_B, name: "Léa", avatarPath: null, avatarPreset: "avatar-2", online: false },
        },
      }).success,
    ).toBe(true);
  });

  it("coerce la pagination et borne la limite", () => {
    const parsed = chatMessagesQuerySchema.parse({ before: "42", limit: "100" });
    expect(parsed).toEqual({ before: 42, limit: 100 });
    expect(chatMessagesQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
    expect(chatMessagesQuerySchema.parse({})).toEqual({});
  });

  it("valide les entrées d'amis et de message", () => {
    expect(friendRequestInputSchema.safeParse({ requestId: UUID_A, targetId: UUID_B }).success).toBe(true);
    expect(friendRequestInputSchema.safeParse({ requestId: "nope", targetId: UUID_B }).success).toBe(false);
    expect(respondFriendRequestInputSchema.safeParse({ requestId: UUID_A, accept: "oui" }).success).toBe(false);
    expect(sendChatMessageInputSchema.safeParse({ requestId: UUID_A, body: "a".repeat(1000) }).success).toBe(true);
    expect(sendChatMessageInputSchema.safeParse({ requestId: UUID_A, body: "a".repeat(1001) }).success).toBe(false);
  });
});
