"use client";

import { useState } from "react";
import { ChatAvatar } from "@/components/chat/chat-avatar";
import { describePreview } from "@/lib/chat-format";
import type { ChatFriend, ChatSummary } from "@/lib/chat-types";

export function FriendsPanel({
  summary,
  busyId,
  onRespond,
  onOpenDirect,
  onRemove,
}: {
  summary: ChatSummary;
  busyId: string | null;
  onRespond: (friendshipId: string, accept: boolean) => void;
  onOpenDirect: (friend: ChatFriend) => void;
  onRemove: (friend: ChatFriend) => void;
}) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const viewerId = summary.viewer.id;

  return (
    <div className="chat-friends">
      {summary.incomingRequests.length > 0 ? (
        <section className="chat-friends-section">
          <header className="chat-section-head">
            <h3>Demandes d&apos;amis ({summary.incomingRequests.length})</h3>
          </header>
          <ul className="chat-request-list">
            {summary.incomingRequests.map((request) => (
              <li key={request.friendshipId} className="chat-request">
                <ChatAvatar name={request.name} preset={request.avatarPreset} imageUrl={request.avatarUrl} size={36} />
                <div className="chat-request-copy">
                  <p className="chat-request-name">{request.name}</p>
                  <p className="chat-request-note">Veut devenir ton ami(e)</p>
                </div>
                <div className="chat-request-actions">
                  <button
                    type="button"
                    className="chat-action chat-action-primary"
                    disabled={busyId === request.friendshipId}
                    onClick={() => onRespond(request.friendshipId, true)}
                  >
                    Accepter
                  </button>
                  <button
                    type="button"
                    className="chat-action chat-action-ghost"
                    disabled={busyId === request.friendshipId}
                    onClick={() => onRespond(request.friendshipId, false)}
                  >
                    Refuser
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {summary.outgoingRequests.length > 0 ? (
        <section className="chat-friends-section">
          <header className="chat-section-head">
            <h3>Demandes envoyées ({summary.outgoingRequests.length})</h3>
          </header>
          <ul className="chat-request-list">
            {summary.outgoingRequests.map((request) => (
              <li key={request.friendshipId} className="chat-request chat-request-pending">
                <ChatAvatar name={request.name} preset={request.avatarPreset} imageUrl={request.avatarUrl} size={36} />
                <div className="chat-request-copy">
                  <p className="chat-request-name">{request.name}</p>
                  <p className="chat-request-note">En attente de réponse</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="chat-friends-section">
        <header className="chat-section-head">
          <h3>Mes amis ({summary.friends.length})</h3>
        </header>
        {summary.friends.length === 0 ? (
          <p className="chat-empty">
            Aucun ami pour le moment. Clique sur un pseudo dans le chat général pour envoyer une demande.
          </p>
        ) : (
          <ul className="chat-friend-list">
            {summary.friends.map((friend) => {
              const preview = describePreview(friend.lastMessage, viewerId, friend.userId, friend.name);
              return (
                <li key={friend.userId} className="chat-friend">
                  <button type="button" className="chat-friend-open" onClick={() => onOpenDirect(friend)}>
                    <ChatAvatar
                      name={friend.name}
                      preset={friend.avatarPreset}
                      imageUrl={friend.avatarUrl}
                      size={38}
                      online={friend.online}
                    />
                    <span className="chat-friend-copy">
                      <span className="chat-friend-name">{friend.name}</span>
                      <span className="chat-friend-preview">
                        {friend.online && !preview ? "En ligne" : preview ? `${preview.prefix}${preview.text}` : "Démarrer la conversation"}
                      </span>
                    </span>
                    {friend.unread > 0 ? <span className="chat-badge">{friend.unread > 99 ? "99+" : friend.unread}</span> : null}
                    <svg className="chat-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
                  </button>
                  <button
                    type="button"
                    className="chat-friend-menu-button"
                    aria-label={`Options pour ${friend.name}`}
                    aria-expanded={menuFor === friend.userId}
                    onClick={() => setMenuFor((current) => (current === friend.userId ? null : friend.userId))}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
                  </button>
                  {menuFor === friend.userId ? (
                    <div className="chat-friend-menu" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        className="chat-popover-action chat-popover-danger"
                        disabled={busyId === friend.userId}
                        onClick={() => {
                          setMenuFor(null);
                          onRemove(friend);
                        }}
                      >
                        Retirer de mes amis
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
