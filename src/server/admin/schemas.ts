import "server-only";

import { z } from "zod";

export const setGameVisibilityInputSchema = z.object({
  requestId: z.string().uuid(),
  visible: z.boolean(),
});

export const adminMessagesQuerySchema = z.object({
  before: z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const adminGameEntrySchema = z.object({
  slug: z.string().min(1),
  visible: z.boolean(),
  availability: z.string(),
});

const nullablePath = z.string().min(1).nullable();

const adminMemberSchema = z.object({
  userId: z.string().uuid(),
  name: z.string(),
  avatarPath: nullablePath,
  avatarPreset: z.string(),
  isGuest: z.boolean(),
});

const adminPreviewSchema = z.object({
  id: z.string().uuid(),
  seq: z.coerce.number().int().min(1),
  authorId: z.string().uuid(),
  body: z.string().nullable(),
  imagePath: nullablePath,
  createdAt: z.string(),
});

export const adminConversationSummarySchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["general", "direct"]),
  title: z.string(),
  members: z.array(adminMemberSchema),
  messageCount: z.coerce.number().int().min(0),
  lastMessageAt: z.string().nullable(),
  lastMessage: adminPreviewSchema.nullable().optional(),
});

const adminMessageSchema = z.object({
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

export const adminConversationPayloadSchema = z.object({
  conversation: z.object({
    id: z.string().uuid(),
    kind: z.enum(["general", "direct"]),
    title: z.string(),
    members: z.array(adminMemberSchema),
  }),
  messages: z.array(adminMessageSchema),
  hasMore: z.boolean(),
});

export const adminVisibilityResultSchema = z.object({
  slug: z.string().min(1),
  visible: z.boolean(),
});
