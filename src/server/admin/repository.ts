import "server-only";

import { createAdminClient } from "@/server/supabase/admin";
import { signStoragePaths } from "@/server/storage/signed-urls";
import {
  adminConversationPayloadSchema,
  adminConversationSummarySchema,
  adminGameEntrySchema,
  adminVisibilityResultSchema,
} from "@/server/admin/schemas";
import type { AdminConversationPayload, AdminConversationSummary, AdminGameEntry } from "@/lib/admin-types";

const AVATARS_BUCKET = "avatars";
const CHAT_IMAGES_BUCKET = "chat-images";

const stableRpcErrorCodes = new Set([
  "ADMIN_REQUIRED",
  "GAME_NOT_FOUND",
  "CONVERSATION_NOT_FOUND",
  "INVALID_REQUEST",
  "COMMAND_ID_REUSED",
]);

function rpcErrorCode(message: string | undefined, fallback: string): string {
  const candidate = message?.trim();
  return candidate && stableRpcErrorCodes.has(candidate) ? candidate : fallback;
}

function rpcData<T>(response: { data: unknown; error: { message: string } | null }, parse: (value: unknown) => T | null): T {
  if (response.error) throw new Error(rpcErrorCode(response.error.message, "DATABASE_UNAVAILABLE"));
  const parsed = parse(response.data);
  if (parsed === null) throw new Error("DATABASE_UNAVAILABLE");
  return parsed;
}

/** Contrôle base : l'e-mail de l'acteur appartient à la liste blanche admin. */
export async function isAdminAccount(actorId: string): Promise<boolean> {
  try {
    const response = await createAdminClient().rpc("server_is_admin", { p_actor: actorId });
    if (response.error) return false;
    return response.data === true;
  } catch {
    // Migration non appliquée ou base indisponible : accès refusé.
    return false;
  }
}

export async function listAdminGames(actorId: string): Promise<AdminGameEntry[]> {
  const response = await createAdminClient().rpc("server_admin_list_games", { p_actor: actorId });
  return rpcData(response, (value) => {
    const parsed = adminGameEntrySchema.array().safeParse(value);
    return parsed.success ? parsed.data : null;
  });
}

export async function setAdminGameVisibility(
  actorId: string,
  requestId: string,
  slug: string,
  visible: boolean,
): Promise<{ slug: string; visible: boolean }> {
  const response = await createAdminClient().rpc("server_admin_set_game_visibility", {
    p_actor: actorId,
    p_request_id: requestId,
    p_slug: slug,
    p_visible: visible,
  });
  return rpcData(response, (value) => {
    const parsed = adminVisibilityResultSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  });
}

export async function listAdminConversations(actorId: string): Promise<AdminConversationSummary[]> {
  const admin = createAdminClient();
  const response = await admin.rpc("server_admin_list_conversations", { p_actor: actorId });
  const data = rpcData(response, (value) => {
    const parsed = adminConversationSummarySchema.array().safeParse(value);
    return parsed.success ? parsed.data : null;
  });

  const avatarUrls = await signStoragePaths(
    admin,
    AVATARS_BUCKET,
    data.flatMap((conversation) => conversation.members.map((member) => member.avatarPath)),
  );
  const imageUrls = await signStoragePaths(
    admin,
    CHAT_IMAGES_BUCKET,
    data.map((conversation) => conversation.lastMessage?.imagePath ?? null),
  );

  return data.map((conversation) => ({
    id: conversation.id,
    kind: conversation.kind,
    title: conversation.title,
    members: conversation.members.map((member) => ({
      userId: member.userId,
      name: member.name,
      avatarUrl: member.avatarPath ? avatarUrls.get(member.avatarPath) ?? null : null,
      avatarPreset: member.avatarPreset,
      isGuest: member.isGuest,
    })),
    messageCount: conversation.messageCount,
    lastMessageAt: conversation.lastMessageAt ?? null,
    lastMessage: conversation.lastMessage
      ? {
          id: conversation.lastMessage.id,
          seq: conversation.lastMessage.seq,
          authorId: conversation.lastMessage.authorId,
          body: conversation.lastMessage.body,
          imageUrl: conversation.lastMessage.imagePath
            ? imageUrls.get(conversation.lastMessage.imagePath) ?? null
            : null,
          createdAt: conversation.lastMessage.createdAt,
        }
      : null,
  }));
}

export async function getAdminConversation(
  actorId: string,
  conversationId: string,
  options: { before?: number; limit?: number } = {},
): Promise<AdminConversationPayload> {
  const admin = createAdminClient();
  const response = await admin.rpc("server_admin_get_conversation", {
    p_actor: actorId,
    p_conversation_id: conversationId,
    p_before_seq: options.before ?? null,
    p_limit: options.limit ?? 30,
  });
  const data = rpcData(response, (value) => {
    const parsed = adminConversationPayloadSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  });

  const avatarUrls = await signStoragePaths(admin, AVATARS_BUCKET, [
    ...data.conversation.members.map((member) => member.avatarPath),
    ...data.messages.map((message) => message.authorAvatarPath),
  ]);
  const imageUrls = await signStoragePaths(admin, CHAT_IMAGES_BUCKET, data.messages.map((message) => message.imagePath));

  return {
    conversation: {
      id: data.conversation.id,
      kind: data.conversation.kind,
      title: data.conversation.title,
      members: data.conversation.members.map((member) => ({
        userId: member.userId,
        name: member.name,
        avatarUrl: member.avatarPath ? avatarUrls.get(member.avatarPath) ?? null : null,
        avatarPreset: member.avatarPreset,
        isGuest: member.isGuest,
      })),
    },
    messages: data.messages.map((message) => ({
      id: message.id,
      seq: message.seq,
      authorId: message.authorId,
      authorName: message.authorName,
      authorAvatarUrl: message.authorAvatarPath ? avatarUrls.get(message.authorAvatarPath) ?? null : null,
      authorAvatarPreset: message.authorAvatarPreset,
      authorIsGuest: message.authorIsGuest,
      body: message.body,
      imageUrl: message.imagePath ? imageUrls.get(message.imagePath) ?? null : null,
      imageWidth: message.imageWidth,
      imageHeight: message.imageHeight,
      createdAt: message.createdAt,
    })),
    hasMore: data.hasMore,
  };
}
