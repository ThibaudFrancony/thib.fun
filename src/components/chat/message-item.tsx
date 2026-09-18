"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChatAvatar } from "@/components/chat/chat-avatar";
import { formatMessageMeta } from "@/lib/chat-format";
import type { ChatMessage, ChatRelation } from "@/lib/chat-types";

const RELATION_LABEL: Record<ChatRelation, string | null> = {
  none: "Ajouter en ami",
  outgoing: "Demande envoyée",
  incoming: "Demande reçue",
  friends: "Déjà ami",
};

export function MessageItem({
  message,
  viewerId,
  relation,
  friendBusy,
  onAddFriend,
  onOpenImage,
}: {
  message: ChatMessage;
  viewerId: string;
  relation: ChatRelation;
  friendBusy: boolean;
  onAddFriend: (userId: string) => void;
  onOpenImage: (url: string) => void;
}) {
  const own = message.authorId === viewerId;
  const [popoverOpen, setPopoverOpen] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const interactive = !own && !message.authorIsGuest;

  useEffect(() => {
    if (!popoverOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setPopoverOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPopoverOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [popoverOpen]);

  const relationLabel = RELATION_LABEL[relation];

  return (
    <article ref={rootRef} className="chat-message" data-own={own}>
      <ChatAvatar
        name={message.authorName}
        preset={message.authorAvatarPreset}
        imageUrl={message.authorAvatarUrl}
        size={34}
      />
      <div className="chat-message-body">
        <div className="chat-message-meta">
          {interactive ? (
            <button
              type="button"
              className="chat-message-author"
              aria-haspopup="menu"
              aria-expanded={popoverOpen}
              onClick={() => setPopoverOpen((value) => !value)}
            >
              {message.authorName}
            </button>
          ) : (
            <span className="chat-message-author chat-message-author-static">
              {own ? "Moi" : message.authorIsGuest ? `${message.authorName} · invité` : message.authorName}
            </span>
          )}
          <time className="chat-message-time" dateTime={message.createdAt}>
            {formatMessageMeta(message.createdAt)}
          </time>
        </div>
        {message.body ? <p className="chat-message-text">{message.body}</p> : null}
        {message.imageUrl ? (
          <button
            type="button"
            className="chat-message-image"
            onClick={() => onOpenImage(message.imageUrl as string)}
            aria-label="Agrandir la photo"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.imageUrl}
              alt={`Photo envoyée par ${message.authorName}`}
              loading="lazy"
              width={message.imageWidth ?? undefined}
              height={message.imageHeight ?? undefined}
            />
          </button>
        ) : null}
      </div>
      {popoverOpen && interactive ? (
        <div className="chat-author-popover" role="menu" aria-label={`Actions pour ${message.authorName}`}>
          <Link className="chat-popover-action" href={`/historique/duo/${message.authorId}`} role="menuitem">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" /></svg>
            Profil
          </Link>
          <button
            type="button"
            className="chat-popover-action"
            role="menuitem"
            disabled={relation !== "none" || friendBusy}
            onClick={() => {
              setPopoverOpen(false);
              onAddFriend(message.authorId);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            {relation === "none" ? "Ajouter en ami" : relationLabel}
          </button>
        </div>
      ) : null}
    </article>
  );
}
