import { describe, expect, it } from "vitest";
import { CHAT_STALE_MS, isConversationStale, mergeConversationPage, type ConversationCache } from "@/lib/chat-cache";
import type { ChatConversationPayload, ChatMessage } from "@/lib/chat-types";

function message(id: string, seq: number): ChatMessage {
  return {
    id,
    seq,
    authorId: "author",
    authorName: "Léo",
    authorAvatarUrl: null,
    authorAvatarPreset: "avatar-1",
    authorIsGuest: false,
    body: `message ${seq}`,
    imageUrl: null,
    imageWidth: null,
    imageHeight: null,
    createdAt: "2026-09-18T20:00:00.000Z",
  };
}

function payload(ids: Array<[string, number]>, hasMore: boolean): ChatConversationPayload {
  return {
    conversation: { id: "conversation", kind: "general", title: "Général", member: null },
    messages: ids.map(([id, seq]) => message(id, seq)),
    hasMore,
  };
}

describe("cache des conversations", () => {
  it("crée une entrée à partir de la première page", () => {
    const entry = mergeConversationPage(undefined, payload([["a", 1], ["b", 2]], true), {}, 1000);
    expect(entry.messages.map((item) => item.id)).toEqual(["a", "b"]);
    expect(entry.hasMore).toBe(true);
    expect(entry.fetchedAt).toBe(1000);
    expect(entry.stale).toBe(false);
  });

  it("fusionne la page récente sans perdre l'historique déjà chargé", () => {
    const first = mergeConversationPage(undefined, payload([["a", 1], ["b", 2]], true), {}, 1000);
    const refreshed = mergeConversationPage(first, payload([["b", 2], ["c", 3]], false), {}, 2000);
    expect(refreshed.messages.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(refreshed.hasMore).toBe(true);
  });

  it("conserve l'historique complet quand toutes les pages anciennes sont chargées", () => {
    const complete: ConversationCache = {
      conversation: payload([], false).conversation,
      messages: [message("a", 1), message("b", 2)],
      hasMore: false,
      fetchedAt: 1000,
      stale: false,
    };
    const refreshed = mergeConversationPage(complete, payload([["b", 2], ["c", 3]], true), {}, 3000);
    expect(refreshed.messages.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(refreshed.hasMore).toBe(false);
  });

  it("ajoute les pages plus anciennes au début et suit hasMore du serveur", () => {
    const first = mergeConversationPage(undefined, payload([["c", 3], ["d", 4]], true), {}, 1000);
    const older = mergeConversationPage(first, payload([["a", 1], ["b", 2]], false), { before: 3 }, 2000);
    expect(older.messages.map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
    expect(older.hasMore).toBe(false);
  });

  it("ne duplique jamais un message reçu deux fois", () => {
    const first = mergeConversationPage(undefined, payload([["a", 1], ["b", 2]], true), {}, 1000);
    const refreshed = mergeConversationPage(first, payload([["a", 1], ["b", 2]], true), {}, 2000);
    expect(refreshed.messages).toHaveLength(2);
  });

  it("considère une entrée absente, marquée ou trop vieille comme périmée", () => {
    const entry: ConversationCache = {
      conversation: payload([], false).conversation,
      messages: [],
      hasMore: false,
      fetchedAt: 10_000,
      stale: false,
    };
    expect(isConversationStale(undefined)).toBe(true);
    expect(isConversationStale(entry, 10_000 + CHAT_STALE_MS - 1)).toBe(false);
    expect(isConversationStale(entry, 10_000 + CHAT_STALE_MS + 1)).toBe(true);
    expect(isConversationStale({ ...entry, stale: true }, 10_000)).toBe(true);
  });
});
