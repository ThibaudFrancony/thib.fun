import { mergeMessages } from "@/lib/chat-format";
import type { ChatConversationPayload, ChatMessage } from "@/lib/chat-types";

export const CHAT_PAGE_SIZE = 30;
export const CHAT_STALE_MS = 20_000;

export type ConversationCache = {
  conversation: ChatConversationPayload["conversation"];
  messages: ChatMessage[];
  hasMore: boolean;
  fetchedAt: number;
  stale: boolean;
};

/**
 * Fusionne une page serveur dans le cache d'une conversation.
 * - page récente (`before` absent) : les nouveaux messages s'ajoutent à
 *   l'historique déjà chargé ; `hasMore` reste celui de l'historique complet
 *   s'il a déjà été atteint ;
 * - page plus ancienne (`before`) : `hasMore` suit la réponse serveur.
 */
export function mergeConversationPage(
  existing: ConversationCache | undefined,
  payload: ChatConversationPayload,
  options: { before?: number } = {},
  now = Date.now(),
): ConversationCache {
  return {
    conversation: payload.conversation,
    messages: mergeMessages(existing?.messages ?? [], payload.messages),
    hasMore: options.before ? payload.hasMore : existing?.hasMore ?? payload.hasMore,
    fetchedAt: now,
    stale: false,
  };
}

export function isConversationStale(
  entry: ConversationCache | undefined,
  now = Date.now(),
  ttl = CHAT_STALE_MS,
): boolean {
  if (!entry) return true;
  return entry.stale || now - entry.fetchedAt > ttl;
}
