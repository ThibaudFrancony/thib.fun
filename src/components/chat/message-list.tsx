"use client";

import { useEffect, useRef, useState } from "react";
import { MessageItem } from "@/components/chat/message-item";
import { groupMessagesByDay } from "@/lib/chat-format";
import type { ChatMessage, ChatRelation } from "@/lib/chat-types";

export function MessageList({
  messages,
  viewerId,
  relationFor,
  friendBusy,
  readOnly = false,
  onAddFriend,
  hasMore,
  loadingOlder,
  onLoadOlder,
  loading,
  emptyLabel,
}: {
  messages: readonly ChatMessage[];
  viewerId: string;
  relationFor: (userId: string) => ChatRelation;
  friendBusy: boolean;
  readOnly?: boolean;
  onAddFriend: (userId: string) => void;
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => Promise<void>;
  loading: boolean;
  emptyLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const countRef = useRef(0);
  const maxSeqRef = useRef(0);
  const firstRenderRef = useRef(true);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const groups = groupMessagesByDay(messages);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const grew = messages.length > countRef.current;
    const firstRender = countRef.current === 0;
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 160;
    if (grew && (firstRender || nearBottom)) container.scrollTop = container.scrollHeight;
    countRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    const max = messages.reduce((peak, message) => Math.max(peak, message.seq), 0);
    if (max > maxSeqRef.current) maxSeqRef.current = max;
    firstRenderRef.current = false;
  }, [messages]);

  useEffect(() => {
    if (!lightbox) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setLightbox(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [lightbox]);

  async function handleLoadOlder() {
    const container = containerRef.current;
    if (!container) {
      await onLoadOlder();
      return;
    }
    const previousHeight = container.scrollHeight;
    const previousTop = container.scrollTop;
    await onLoadOlder();
    requestAnimationFrame(() => {
      const next = containerRef.current;
      if (!next) return;
      next.scrollTop = next.scrollHeight - previousHeight + previousTop;
    });
  }

  return (
    <div
      className="chat-messages"
      ref={containerRef}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      onScroll={() => {
        const container = containerRef.current;
        if (!container || !hasMore || loadingOlder) return;
        if (container.scrollTop < 80) void handleLoadOlder();
      }}
    >
      {hasMore ? (
        <button
          type="button"
          className="chat-load-older"
          onClick={() => void handleLoadOlder()}
          disabled={loadingOlder}
        >
          {loadingOlder ? "Chargement…" : "Charger les messages précédents"}
        </button>
      ) : null}
      {loading && messages.length === 0 ? <p className="chat-messages-note">Chargement des messages…</p> : null}
      {!loading && messages.length === 0 ? <p className="chat-messages-note">{emptyLabel}</p> : null}
      {groups.map((group) => (
        <section className="chat-day" key={group.key}>
          <p className="chat-day-separator">
            <span>{group.label}</span>
          </p>
          {group.items.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              viewerId={viewerId}
              relation={relationFor(message.authorId)}
              friendBusy={friendBusy}
              readOnly={readOnly}
              onAddFriend={onAddFriend}
              onOpenImage={setLightbox}
              fresh={!firstRenderRef.current && message.seq > maxSeqRef.current}
            />
          ))}
        </section>
      ))}
      {lightbox ? (
        <div className="chat-lightbox" role="dialog" aria-label="Photo" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" />
        </div>
      ) : null}
    </div>
  );
}
