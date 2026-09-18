import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/server/supabase/admin";
import {
  chatMessagesRpcSchema,
  chatSummaryRpcSchema,
  friendRequestRpcSchema,
  markChatReadRpcSchema,
  openDirectConversationRpcSchema,
  recordActivityRpcSchema,
  removeFriendRpcSchema,
  respondFriendRequestRpcSchema,
  sendChatMessageRpcSchema,
} from "@/server/chat/schemas";
import type {
  ChatConversationPayload,
  ChatFriend,
  ChatFriendRequest,
  ChatPreview,
  ChatSentMessage,
  ChatSummary,
  ChatViewer,
} from "@/lib/chat-types";

export const CHAT_SIGNED_URL_SECONDS = 5 * 60;

const AVATARS_BUCKET = "avatars";
const CHAT_IMAGES_BUCKET = "chat-images";

const stableRpcErrorCodes = new Set([
  "ACCOUNT_REQUIRED",
  "MEMBER_REQUIRED",
  "COMMAND_ID_REUSED",
  "CANNOT_FRIEND_SELF",
  "FRIEND_TARGET_UNAVAILABLE",
  "FRIEND_REQUEST_NOT_FOUND",
  "NOT_FRIENDS",
  "CONVERSATION_NOT_FOUND",
  "MESSAGE_EMPTY",
  "MESSAGE_TOO_LONG",
  "RATE_LIMITED",
  "INVALID_REQUEST",
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

async function signPaths(
  admin: SupabaseClient,
  bucket: string,
  paths: readonly (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  const urls = new Map<string, string>();
  if (unique.length === 0) return urls;
  const { data, error } = await admin.storage.from(bucket).createSignedUrls(unique, CHAT_SIGNED_URL_SECONDS);
  if (error || !data) return urls;
  for (const entry of data) {
    if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
  }
  return urls;
}

function mapPreview(
  preview: { id: string; seq: number; authorId: string; body: string | null; imagePath: string | null; createdAt: string } | null | undefined,
  imageUrls: Map<string, string>,
): ChatPreview | null {
  if (!preview) return null;
  return {
    id: preview.id,
    seq: preview.seq,
    authorId: preview.authorId,
    body: preview.body,
    imageUrl: preview.imagePath ? imageUrls.get(preview.imagePath) ?? null : null,
    createdAt: preview.createdAt,
  };
}

export async function getChatSummary(viewer: ChatViewer): Promise<ChatSummary> {
  const admin = createAdminClient();
  const response = await admin.rpc("server_get_chat_summary", { p_actor: viewer.id });
  const data = rpcData(response, (value) => {
    const parsed = chatSummaryRpcSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  });

  const avatarUrls = await signPaths(admin, AVATARS_BUCKET, [
    ...data.friends.map((friend) => friend.avatarPath),
    ...data.incomingRequests.map((request) => request.avatarPath),
    ...data.outgoingRequests.map((request) => request.avatarPath),
  ]);
  const imageUrls = await signPaths(admin, CHAT_IMAGES_BUCKET, [
    ...data.friends.map((friend) => friend.lastMessage?.imagePath ?? null),
    data.general.lastMessage?.imagePath ?? null,
  ]);

  const friends: ChatFriend[] = data.friends.map((friend) => ({
    userId: friend.userId,
    name: friend.name,
    avatarUrl: friend.avatarPath ? avatarUrls.get(friend.avatarPath) ?? null : null,
    avatarPreset: friend.avatarPreset,
    online: friend.online,
    conversationId: friend.conversationId,
    unread: friend.unread,
    lastMessage: mapPreview(friend.lastMessage, imageUrls),
  }));

  const mapRequest = (request: (typeof data.incomingRequests)[number]): ChatFriendRequest => ({
    friendshipId: request.friendshipId,
    userId: request.userId,
    name: request.name,
    avatarUrl: request.avatarPath ? avatarUrls.get(request.avatarPath) ?? null : null,
    avatarPreset: request.avatarPreset,
    createdAt: request.createdAt,
  });

  return {
    viewer,
    onlineCount: data.onlineCount,
    general: {
      conversationId: data.general.conversationId,
      unread: data.general.unread,
      messageCount: data.general.messageCount,
      lastMessage: mapPreview(data.general.lastMessage, imageUrls),
    },
    friends,
    incomingRequests: data.incomingRequests.map(mapRequest),
    outgoingRequests: data.outgoingRequests.map(mapRequest),
  };
}

export async function getChatMessages(
  actorId: string,
  conversationId: string,
  options: { before?: number; limit?: number } = {},
): Promise<ChatConversationPayload> {
  const admin = createAdminClient();
  const response = await admin.rpc("server_get_chat_messages", {
    p_actor: actorId,
    p_conversation_id: conversationId,
    p_before_seq: options.before ?? null,
    p_limit: options.limit ?? 30,
  });
  const data = rpcData(response, (value) => {
    const parsed = chatMessagesRpcSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  });

  const avatarUrls = await signPaths(admin, AVATARS_BUCKET, [
    ...data.messages.map((message) => message.authorAvatarPath),
    data.conversation.member?.avatarPath ?? null,
  ]);
  const imageUrls = await signPaths(admin, CHAT_IMAGES_BUCKET, data.messages.map((message) => message.imagePath));

  return {
    conversation: {
      id: data.conversation.id,
      kind: data.conversation.kind,
      title: data.conversation.title,
      member: data.conversation.member
        ? {
            userId: data.conversation.member.userId,
            name: data.conversation.member.name,
            avatarUrl: data.conversation.member.avatarPath
              ? avatarUrls.get(data.conversation.member.avatarPath) ?? null
              : null,
            avatarPreset: data.conversation.member.avatarPreset,
            online: data.conversation.member.online,
          }
        : null,
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

export async function sendChatMessage(
  actorId: string,
  args: {
    requestId: string;
    conversationId: string;
    body: string | null;
    imagePath: string | null;
    imageWidth: number | null;
    imageHeight: number | null;
  },
): Promise<ChatSentMessage> {
  const admin = createAdminClient();
  const response = await admin.rpc("server_send_chat_message", {
    p_actor: actorId,
    p_request_id: args.requestId,
    p_conversation_id: args.conversationId,
    p_body: args.body,
    p_image_path: args.imagePath,
    p_image_width: args.imageWidth,
    p_image_height: args.imageHeight,
  });
  const data = rpcData(response, (value) => {
    const parsed = sendChatMessageRpcSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  });
  if (args.imagePath && data.imagePath !== args.imagePath) {
    // Requête rejouée : l'image fraîchement téléversée est orpheline.
    await admin.storage.from(CHAT_IMAGES_BUCKET).remove([args.imagePath]).catch(() => undefined);
  }
  const imageUrls = await signPaths(admin, CHAT_IMAGES_BUCKET, [data.imagePath]);
  return {
    id: data.id,
    seq: data.seq,
    conversationId: data.conversationId,
    body: data.body,
    imageUrl: data.imagePath ? imageUrls.get(data.imagePath) ?? null : null,
    imageWidth: data.imageWidth,
    imageHeight: data.imageHeight,
    createdAt: data.createdAt,
  };
}

export async function markChatRead(actorId: string, conversationId: string, lastReadSeq: number): Promise<void> {
  const response = await createAdminClient().rpc("server_mark_chat_read", {
    p_actor: actorId,
    p_conversation_id: conversationId,
    p_last_read_seq: lastReadSeq,
  });
  rpcData(response, (value) => {
    const parsed = markChatReadRpcSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  });
}

export async function recordActivity(actorId: string): Promise<void> {
  const response = await createAdminClient().rpc("server_record_activity", { p_actor: actorId });
  rpcData(response, (value) => {
    const parsed = recordActivityRpcSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  });
}

export async function sendFriendRequest(actorId: string, requestId: string, targetId: string): Promise<{ friendshipId: string; status: string; direction: string }> {
  const response = await createAdminClient().rpc("server_send_friend_request", {
    p_actor: actorId,
    p_request_id: requestId,
    p_target_id: targetId,
  });
  return rpcData(response, (value) => {
    const parsed = friendRequestRpcSchema.safeParse(value);
    return parsed.success ? { ...parsed.data, direction: parsed.data.direction ?? "outgoing" } : null;
  });
}

export async function respondFriendRequest(
  actorId: string,
  requestId: string,
  friendshipId: string,
  accept: boolean,
): Promise<{ friendshipId: string; status: string; userId: string }> {
  const response = await createAdminClient().rpc("server_respond_friend_request", {
    p_actor: actorId,
    p_request_id: requestId,
    p_friendship_id: friendshipId,
    p_accept: accept,
  });
  return rpcData(response, (value) => {
    const parsed = respondFriendRequestRpcSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  });
}

export async function removeFriend(actorId: string, requestId: string, targetId: string): Promise<void> {
  const response = await createAdminClient().rpc("server_remove_friend", {
    p_actor: actorId,
    p_request_id: requestId,
    p_target_id: targetId,
  });
  rpcData(response, (value) => {
    const parsed = removeFriendRpcSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  });
}

export async function openDirectConversation(actorId: string, requestId: string, targetId: string): Promise<string> {
  const response = await createAdminClient().rpc("server_open_direct_conversation", {
    p_actor: actorId,
    p_request_id: requestId,
    p_target_id: targetId,
  });
  const data = rpcData(response, (value) => {
    const parsed = openDirectConversationRpcSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  });
  return data.conversationId;
}
