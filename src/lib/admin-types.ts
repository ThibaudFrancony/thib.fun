import type { ChatMessage } from "@/lib/chat-types";

export type AdminGameView = {
  slug: string;
  cardName: string;
  displayName: string;
  description: string;
  kind: "competitive" | "cooperative";
  availability: string;
  visible: boolean;
};

export type AdminGameEntry = {
  slug: string;
  visible: boolean;
  availability: string;
};

export type AdminConversationMember = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  avatarPreset: string;
  isGuest: boolean;
};

export type AdminConversationPreview = {
  id: string;
  seq: number;
  authorId: string;
  body: string | null;
  imageUrl: string | null;
  createdAt: string;
};

export type AdminConversationSummary = {
  id: string;
  kind: "general" | "direct";
  title: string;
  members: AdminConversationMember[];
  messageCount: number;
  lastMessageAt: string | null;
  lastMessage: AdminConversationPreview | null;
};

export type AdminConversationPayload = {
  conversation: {
    id: string;
    kind: "general" | "direct";
    title: string;
    members: AdminConversationMember[];
  };
  messages: ChatMessage[];
  hasMore: boolean;
};
