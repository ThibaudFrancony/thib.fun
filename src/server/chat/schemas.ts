import "server-only";

import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const friendRequestInputSchema = z.object({
  requestId: z.string().uuid(),
  targetId: z.string().uuid(),
});

export const respondFriendRequestInputSchema = z.object({
  requestId: z.string().uuid(),
  accept: z.boolean(),
});

export const removeFriendInputSchema = z.object({
  requestId: z.string().uuid(),
});

export const markChatReadInputSchema = z.object({
  lastReadSeq: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
});

export const chatMessagesQuerySchema = z.object({
  before: z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const sendChatMessageInputSchema = z.object({
  requestId: z.string().uuid(),
  body: z.string().max(1000).optional(),
});

const nullablePath = z.string().min(1).nullable();

const previewSchema = z.object({
  id: z.string().uuid(),
  seq: z.coerce.number().int().min(1),
  authorId: z.string().uuid(),
  body: z.string().nullable(),
  imagePath: nullablePath,
  createdAt: z.string(),
});

const friendSchema = z.object({
  userId: z.string().uuid(),
  name: z.string(),
  avatarPath: nullablePath,
  avatarPreset: z.string(),
  online: z.boolean(),
  conversationId: z.string().uuid().nullable(),
  unread: z.coerce.number().int().min(0),
  lastMessage: previewSchema.nullable().optional(),
});

const requestSchema = z.object({
  friendshipId: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  avatarPath: nullablePath,
  avatarPreset: z.string(),
  createdAt: z.string(),
});

export const chatSummaryRpcSchema = z.object({
  general: z.object({
    conversationId: z.string().uuid(),
    unread: z.coerce.number().int().min(0),
    messageCount: z.coerce.number().int().min(0),
    lastMessage: previewSchema.nullable().optional(),
  }),
  friends: z.array(friendSchema),
  incomingRequests: z.array(requestSchema),
  outgoingRequests: z.array(requestSchema),
  onlineCount: z.coerce.number().int().min(0),
});

const messageSchema = z.object({
  id: z.string().uuid(),
  seq: z.coerce.number().int().min(1),
  authorId: z.string().uuid(),
  authorName: z.string(),
  authorAvatarPath: nullablePath,
  authorAvatarPreset: z.string(),
  authorIsGuest: z.boolean(),
  body: z.string().nullable(),
  imagePath: nullablePath,
  imageWidth: z.coerce.number().int().nullable(),
  imageHeight: z.coerce.number().int().nullable(),
  createdAt: z.string(),
});

export const chatMessagesRpcSchema = z.object({
  conversation: z.object({
    id: z.string().uuid(),
    kind: z.enum(["general", "direct"]),
    title: z.string(),
    member: z
      .object({
        userId: z.string().uuid(),
        name: z.string(),
        avatarPath: nullablePath,
        avatarPreset: z.string(),
        online: z.boolean(),
      })
      .nullable()
      .optional(),
  }),
  messages: z.array(messageSchema),
  hasMore: z.boolean(),
});

export const sendChatMessageRpcSchema = z.object({
  id: z.string().uuid(),
  seq: z.coerce.number().int().min(1),
  conversationId: z.string().uuid(),
  body: z.string().nullable(),
  imagePath: nullablePath,
  imageWidth: z.coerce.number().int().nullable(),
  imageHeight: z.coerce.number().int().nullable(),
  createdAt: z.string(),
});

export const friendRequestRpcSchema = z.object({
  friendshipId: z.string().uuid(),
  status: z.enum(["pending", "accepted", "refused"]),
  direction: z.enum(["outgoing", "incoming", "friends"]).optional(),
});

export const respondFriendRequestRpcSchema = z.object({
  friendshipId: z.string().uuid(),
  status: z.enum(["accepted", "refused"]),
  userId: z.string().uuid(),
});

export const openDirectConversationRpcSchema = z.object({
  conversationId: z.string().uuid(),
});

export const removeFriendRpcSchema = z.object({
  removed: z.literal(true),
  targetId: z.string().uuid(),
});

export const markChatReadRpcSchema = z.object({
  conversationId: z.string().uuid(),
  lastReadSeq: z.coerce.number().int().min(0),
});

export const recordActivityRpcSchema = z.object({
  lastSeenAt: z.string(),
});
