"use client";

import type { AdminConversationPayload, AdminConversationSummary } from "@/lib/admin-types";

export async function fetchAdminConversations(): Promise<AdminConversationSummary[]> {
  const response = await fetch("/api/admin/conversations", { cache: "no-store" });
  if (!response.ok) throw new Error("ADMIN_UNAVAILABLE");
  const data = (await response.json()) as { conversations?: AdminConversationSummary[] };
  return data.conversations ?? [];
}

export async function fetchAdminConversationMessages(
  conversationId: string,
  options: { before?: number; limit?: number } = {},
): Promise<AdminConversationPayload> {
  const params = new URLSearchParams();
  if (options.before) params.set("before", String(options.before));
  if (options.limit) params.set("limit", String(options.limit));
  const query = params.toString();
  const response = await fetch(
    `/api/admin/conversations/${conversationId}/messages${query ? `?${query}` : ""}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error("CONVERSATION_NOT_FOUND");
  return (await response.json()) as AdminConversationPayload;
}
