export type ChatViewer = {
  id: string;
  name: string;
  isGuest: boolean;
  canWrite: boolean;
};

export type ChatPreview = {
  id: string;
  seq: number;
  authorId: string;
  body: string | null;
  imageUrl: string | null;
  createdAt: string;
};

export type ChatFriend = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  avatarPreset: string;
  online: boolean;
  conversationId: string | null;
  unread: number;
  lastMessage: ChatPreview | null;
};

export type ChatFriendRequest = {
  friendshipId: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  avatarPreset: string;
  createdAt: string;
};

export type ChatSummary = {
  viewer: ChatViewer;
  onlineCount: number;
  general: {
    conversationId: string;
    unread: number;
    messageCount: number;
    lastMessage: ChatPreview | null;
  };
  friends: ChatFriend[];
  incomingRequests: ChatFriendRequest[];
  outgoingRequests: ChatFriendRequest[];
};

export type ChatMessage = {
  id: string;
  seq: number;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  authorAvatarPreset: string;
  authorIsGuest: boolean;
  body: string | null;
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  createdAt: string;
};

export type ChatConversationMember = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  avatarPreset: string;
  online: boolean;
};

export type ChatConversationPayload = {
  conversation: {
    id: string;
    kind: "general" | "direct";
    title: string;
    member: ChatConversationMember | null;
  };
  messages: ChatMessage[];
  hasMore: boolean;
};

export type ChatSentMessage = {
  id: string;
  seq: number;
  conversationId: string;
  body: string | null;
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  createdAt: string;
};

export type ChatRelation = "none" | "friends" | "outgoing" | "incoming";
