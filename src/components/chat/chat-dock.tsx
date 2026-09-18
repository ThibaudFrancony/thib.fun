"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatAvatar } from "@/components/chat/chat-avatar";
import { FriendsPanel } from "@/components/chat/friends-panel";
import { MessageComposer } from "@/components/chat/message-composer";
import { MessageList } from "@/components/chat/message-list";
import {
  fetchChatMessages,
  fetchChatSummary,
  markConversationRead,
  playChatSound,
  recordChatActivity,
  sendChatMessageRequest,
  useChatAudioUnlock,
  useChatRealtime,
  usePersistentChatOpen,
  usePersistentChatSound,
} from "@/lib/chat-client";
import { formatMessageCount, mergeMessages } from "@/lib/chat-format";
import type {
  ChatConversationMember,
  ChatFriend,
  ChatMessage,
  ChatRelation,
  ChatSummary,
} from "@/lib/chat-types";
import { postJson } from "@/lib/client-request";

type ChatView = { type: "general" } | { type: "friends" } | { type: "direct"; friendId: string };

export function ChatDock() {
  const [open, setOpen] = usePersistentChatOpen();
  const [soundEnabled, setSoundEnabled] = usePersistentChatSound();
  const [summary, setSummary] = useState<ChatSummary | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [view, setView] = useState<ChatView>({ type: "general" });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState<string | null>(null);
  const [conversationMember, setConversationMember] = useState<ChatConversationMember | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const summaryRef = useRef<ChatSummary | null>(null);
  const viewRef = useRef<ChatView>(view);
  const openRef = useRef(open);
  const soundRef = useRef(soundEnabled);
  const conversationIdRef = useRef<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const messagesConversationRef = useRef<string | null>(null);
  const refreshingRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const refreshTimerRef = useRef<number | null>(null);
  const seenRef = useRef<{ general: number; friends: Map<string, number>; requests: number } | null>(null);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    soundRef.current = soundEnabled;
  }, [soundEnabled]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const applySummary = useCallback((next: ChatSummary) => {
    const previous = seenRef.current;
    const friendsSeen = new Map(next.friends.map((friend) => [friend.userId, friend.lastMessage?.seq ?? 0]));
    if (previous) {
      let trigger = false;
      const generalSeq = next.general.lastMessage?.seq ?? 0;
      const viewingGeneral = openRef.current && !document.hidden && viewRef.current.type === "general";
      if (generalSeq > previous.general && next.general.lastMessage?.authorId !== next.viewer.id && !viewingGeneral) {
        trigger = true;
      }
      for (const friend of next.friends) {
        const seq = friend.lastMessage?.seq ?? 0;
        const before = previous.friends.get(friend.userId) ?? 0;
        const viewingThis =
          openRef.current
          && !document.hidden
          && viewRef.current.type === "direct"
          && viewRef.current.friendId === friend.userId;
        if (seq > before && friend.lastMessage?.authorId !== next.viewer.id && !viewingThis) trigger = true;
      }
      if (next.incomingRequests.length > previous.requests) trigger = true;
      if (trigger && soundRef.current) playChatSound();
    }
    seenRef.current = {
      general: next.general.lastMessage?.seq ?? 0,
      friends: friendsSeen,
      requests: next.incomingRequests.length,
    };
    summaryRef.current = next;
    setSummary(next);
  }, []);

  const refreshSummary = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const next = await fetchChatSummary();
      if (next) applySummary(next);
    } catch {
      // Le polling de secours retentera.
    } finally {
      refreshingRef.current = false;
    }
  }, [applySummary]);

  const loadConversation = useCallback(async (conversationId: string, options: { before?: number } = {}) => {
    const payload = await fetchChatMessages(conversationId, { before: options.before });
    conversationIdRef.current = payload.conversation.id;
    setActiveConversationId(payload.conversation.id);
    setConversationTitle(payload.conversation.title);
    setConversationMember(payload.conversation.member ?? null);
    if (messagesConversationRef.current === payload.conversation.id) {
      setMessages((current) => mergeMessages(current, payload.messages));
    } else {
      messagesConversationRef.current = payload.conversation.id;
      setMessages(payload.messages);
    }
    setHasMore(payload.hasMore);
    return payload;
  }, []);

  const markActiveRead = useCallback((lastSeq: number) => {
    const conversationId = conversationIdRef.current;
    if (!conversationId || lastSeq <= 0) return;
    void markConversationRead(conversationId, lastSeq).catch(() => undefined);
    setSummary((current) => {
      if (!current) return current;
      const activeView = viewRef.current;
      if (activeView.type === "general") {
        if (current.general.unread === 0) return current;
        return { ...current, general: { ...current.general, unread: 0 } };
      }
      if (activeView.type === "direct") {
        return {
          ...current,
          friends: current.friends.map((friend) =>
            friend.userId === activeView.friendId && friend.unread > 0 ? { ...friend, unread: 0 } : friend,
          ),
        };
      }
      return current;
    });
  }, []);

  const resetConversation = useCallback(() => {
    conversationIdRef.current = null;
    messagesConversationRef.current = null;
    setActiveConversationId(null);
    setMessages([]);
    setHasMore(false);
    setConversationTitle(null);
    setConversationMember(null);
  }, []);

  const openGeneral = useCallback(async () => {
    const current = summaryRef.current;
    if (!current) return;
    setView({ type: "general" });
    setNotice(null);
    setError(null);
    setLoadingMessages(true);
    resetConversation();
    try {
      const payload = await loadConversation(current.general.conversationId);
      const lastSeq = payload.messages.at(-1)?.seq ?? 0;
      markActiveRead(lastSeq);
    } catch {
      setError("La conversation n'a pas pu être chargée.");
    } finally {
      setLoadingMessages(false);
    }
  }, [loadConversation, markActiveRead, resetConversation]);

  const openDirect = useCallback(
    async (friend: ChatFriend) => {
      setView({ type: "direct", friendId: friend.userId });
      setNotice(null);
      setError(null);
      setLoadingMessages(true);
      resetConversation();
      try {
        let conversationId = friend.conversationId;
        if (!conversationId) {
          const result = await postJson<{ conversationId: string }>("/api/chat/direct", {
            requestId: crypto.randomUUID(),
            targetId: friend.userId,
          });
          if (!result.ok) {
            setError(result.message);
            return;
          }
          conversationId = result.data.conversationId;
        }
        const payload = await loadConversation(conversationId);
        const lastSeq = payload.messages.at(-1)?.seq ?? 0;
        markActiveRead(lastSeq);
      } catch {
        setError("La conversation n'a pas pu être chargée.");
      } finally {
        setLoadingMessages(false);
      }
    },
    [loadConversation, markActiveRead, resetConversation],
  );

  const loadOlder = useCallback(async () => {
    const conversationId = conversationIdRef.current;
    const minSeq = messagesRef.current[0]?.seq;
    if (!conversationId || !minSeq || loadingOlderRef.current) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      await loadConversation(conversationId, { before: minSeq });
    } catch {
      setError("Les messages précédents n'ont pas pu être chargés.");
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [loadConversation]);

  const handleSend = useCallback(
    async (body: string | null, file: File | null): Promise<{ ok: true } | { ok: false; message: string }> => {
      const conversationId = conversationIdRef.current;
      const current = summaryRef.current;
      if (!conversationId || !current) return { ok: false, message: "La conversation n'est pas prête." };
      const requestId = crypto.randomUUID();
      const optimistic: ChatMessage = {
        id: `local-${requestId}`,
        seq: (messagesRef.current.at(-1)?.seq ?? 0) + 1,
        authorId: current.viewer.id,
        authorName: current.viewer.name,
        authorAvatarUrl: null,
        authorAvatarPreset: "avatar-1",
        authorIsGuest: current.viewer.isGuest,
        body,
        imageUrl: file ? URL.createObjectURL(file) : null,
        imageWidth: null,
        imageHeight: null,
        createdAt: new Date().toISOString(),
      };
      setMessages((previous) => [...previous, optimistic]);
      try {
        await sendChatMessageRequest(conversationId, { requestId, body, file });
        const payload = await fetchChatMessages(conversationId);
        messagesConversationRef.current = payload.conversation.id;
        setMessages((previous) => mergeMessages(previous.filter((message) => message.id !== optimistic.id), payload.messages));
        setHasMore(payload.hasMore);
        if (optimistic.imageUrl) URL.revokeObjectURL(optimistic.imageUrl);
        void refreshSummary();
        return { ok: true };
      } catch (sendError) {
        setMessages((previous) => previous.filter((message) => message.id !== optimistic.id));
        if (optimistic.imageUrl) URL.revokeObjectURL(optimistic.imageUrl);
        return {
          ok: false,
          message: sendError instanceof Error ? sendError.message : "Le message n'a pas pu être envoyé.",
        };
      }
    },
    [refreshSummary],
  );

  const addFriend = useCallback(
    async (userId: string) => {
      setBusyId(userId);
      setError(null);
      setNotice(null);
      const result = await postJson<{ direction?: string }>("/api/friends/requests", {
        requestId: crypto.randomUUID(),
        targetId: userId,
      });
      if (result.ok) {
        setNotice(
          result.data.direction === "incoming"
            ? "Cette personne t'a déjà envoyé une demande : accepte-la dans l'onglet Amis."
            : "Demande d'ami envoyée.",
        );
      } else {
        setError(result.message);
      }
      setBusyId(null);
      await refreshSummary();
    },
    [refreshSummary],
  );

  const respond = useCallback(
    async (friendshipId: string, accept: boolean) => {
      setBusyId(friendshipId);
      setError(null);
      setNotice(null);
      const result = await postJson(`/api/friends/requests/${friendshipId}/respond`, {
        requestId: crypto.randomUUID(),
        accept,
      });
      if (result.ok) setNotice(accept ? "Ami ajouté !" : "Demande refusée.");
      else setError(result.message);
      setBusyId(null);
      await refreshSummary();
    },
    [refreshSummary],
  );

  const removeFriend = useCallback(
    async (friend: ChatFriend) => {
      setBusyId(friend.userId);
      setError(null);
      setNotice(null);
      const result = await postJson(`/api/friends/${friend.userId}/remove`, { requestId: crypto.randomUUID() });
      if (result.ok) {
        setNotice(`${friend.name} a été retiré de tes amis.`);
        if (viewRef.current.type === "direct" && viewRef.current.friendId === friend.userId) {
          resetConversation();
          setView({ type: "friends" });
        }
      } else {
        setError(result.message);
      }
      setBusyId(null);
      await refreshSummary();
    },
    [refreshSummary, resetConversation],
  );

  const relationFor = useCallback((userId: string): ChatRelation => {
    const current = summaryRef.current;
    if (!current) return "none";
    if (current.friends.some((friend) => friend.userId === userId)) return "friends";
    if (current.outgoingRequests.some((request) => request.userId === userId)) return "outgoing";
    if (current.incomingRequests.some((request) => request.userId === userId)) return "incoming";
    return "none";
  }, []);

  useChatAudioUnlock();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchChatSummary();
      if (cancelled) return;
      if (!next) {
        setAvailable(false);
        return;
      }
      applySummary(next);
      setAvailable(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [applySummary]);

  useChatRealtime(summary?.viewer.id ?? null, (event) => {
    if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void refreshSummary();
      if (event.type === "chat" && event.conversationId === conversationIdRef.current) {
        void fetchChatMessages(event.conversationId)
          .then((payload) => {
            setMessages((current) => mergeMessages(current, payload.messages));
            setHasMore(payload.hasMore);
            markActiveRead(payload.messages.at(-1)?.seq ?? 0);
          })
          .catch(() => undefined);
      }
    }, 250);
  });

  useEffect(() => {
    if (!available) return;
    const ping = () => {
      if (document.visibilityState === "visible") void recordChatActivity().catch(() => undefined);
    };
    ping();
    const presenceTimer = window.setInterval(ping, 60_000);
    const pollTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshSummary();
    }, 30_000);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      ping();
      void refreshSummary();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      window.clearInterval(presenceTimer);
      window.clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [available, refreshSummary]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const target = event.target;
      if (target instanceof Element && target.closest(".chat-author-popover, .chat-friend-menu")) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
    };
  }, []);

  const generalBadge = summary?.general.unread ?? 0;
  const friendsBadge =
    (summary?.incomingRequests.length ?? 0) + (summary?.friends.reduce((sum, friend) => sum + friend.unread, 0) ?? 0);
  const totalBadge = generalBadge + friendsBadge;
  const activeFriend =
    view.type === "direct" && summary ? summary.friends.find((friend) => friend.userId === view.friendId) ?? null : null;

  if (available !== true || !summary) return null;

  function toggleOpen() {
    const next = !openRef.current;
    setOpen(next);
    if (!next || conversationIdRef.current !== null) return;
    const activeView = viewRef.current;
    if (activeView.type === "direct") {
      const friend = summaryRef.current?.friends.find((entry) => entry.userId === activeView.friendId);
      if (friend) {
        void openDirect(friend);
        return;
      }
    }
    void openGeneral();
  }

  return (
    <div className="chat-dock" data-open={open}>
      {open ? <button type="button" className="chat-backdrop" aria-label="Fermer le chat" onClick={() => setOpen(false)} /> : null}
      <button
        type="button"
        className="chat-handle"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-controls="chat-panel"
        aria-label={open ? "Fermer le chat et les amis" : "Ouvrir le chat et les amis"}
      >
        {!open && totalBadge > 0 ? (
          <span className="chat-handle-badge" aria-hidden="true">
            {totalBadge > 99 ? "99+" : totalBadge}
          </span>
        ) : null}
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m14 6-6 6 6 6" />
        </svg>
      </button>
      <aside id="chat-panel" className="chat-panel" aria-label="Chat et amis" aria-hidden={!open}>
        <header className="chat-header">
          <div className="chat-tabs" role="tablist" aria-label="Sections du chat">
            <button
              type="button"
              role="tab"
              aria-selected={view.type !== "friends"}
              data-active={view.type !== "friends"}
              onClick={() => {
                if (viewRef.current.type === "general" && conversationIdRef.current === summary.general.conversationId) return;
                void openGeneral();
              }}
            >
              Général
              {generalBadge > 0 ? <span className="chat-badge">{generalBadge > 99 ? "99+" : generalBadge}</span> : null}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view.type === "friends"}
              data-active={view.type === "friends"}
              onClick={() => {
                setView({ type: "friends" });
                setNotice(null);
                setError(null);
              }}
            >
              Amis
              {friendsBadge > 0 ? <span className="chat-badge">{friendsBadge > 99 ? "99+" : friendsBadge}</span> : null}
            </button>
          </div>
          <div className="chat-header-actions">
            <button
              type="button"
              className="chat-icon-button"
              aria-label={soundEnabled ? "Couper le son du chat" : "Activer le son du chat"}
              title={soundEnabled ? "Couper le son" : "Activer le son"}
              data-muted={!soundEnabled}
              onClick={() => setSoundEnabled(!soundEnabled)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 10v4h3l4 3V7l-4 3H5Z" />
                {soundEnabled ? <path d="M15 9.5a4 4 0 0 1 0 5M17.5 7a7 7 0 0 1 0 10" /> : <path d="m15 9.5 4 5m0-5-4 5" />}
              </svg>
            </button>
            <button type="button" className="chat-icon-button" aria-label="Fermer le chat" onClick={() => setOpen(false)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </div>
        </header>

        {notice ? <p className="chat-notice" role="status">{notice}</p> : null}
        {error ? <p className="chat-error" role="alert">{error}</p> : null}

        {view.type === "friends" ? (
          <div className="chat-body">
            <FriendsPanel
              summary={summary}
              busyId={busyId}
              onRespond={(friendshipId, accept) => void respond(friendshipId, accept)}
              onOpenDirect={(friend) => void openDirect(friend)}
              onRemove={(friend) => void removeFriend(friend)}
            />
          </div>
        ) : (
          <div className="chat-body">
            {view.type === "general" ? (
              <div className="chat-conversation-head">
                <span className="chat-conversation-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg>
                </span>
                <div className="chat-conversation-copy">
                  <p className="chat-conversation-title">Chat général</p>
                  <p className="chat-conversation-sub">
                    <span className="chat-online-dot" data-online="true" aria-hidden="true" />
                    {summary.onlineCount} en ligne · {formatMessageCount(summary.general.messageCount)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="chat-conversation-head">
                <button
                  type="button"
                  className="chat-icon-button chat-back"
                  aria-label="Retour aux amis"
                  onClick={() => setView({ type: "friends" })}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
                </button>
                <ChatAvatar
                  name={conversationMember?.name ?? activeFriend?.name ?? conversationTitle ?? "Conversation"}
                  preset={conversationMember?.avatarPreset ?? activeFriend?.avatarPreset ?? "avatar-1"}
                  imageUrl={conversationMember?.avatarUrl ?? activeFriend?.avatarUrl ?? null}
                  size={36}
                  online={activeFriend?.online ?? conversationMember?.online}
                />
                <div className="chat-conversation-copy">
                  <p className="chat-conversation-title">{conversationTitle ?? activeFriend?.name ?? "Conversation"}</p>
                  <p className="chat-conversation-sub">
                    {(activeFriend?.online ?? conversationMember?.online) ? "En ligne" : "Hors ligne"}
                  </p>
                </div>
              </div>
            )}

            <MessageList
              key={activeConversationId ?? "chat"}
              messages={messages}
              viewerId={summary.viewer.id}
              relationFor={relationFor}
              friendBusy={busyId !== null}
              onAddFriend={(userId) => void addFriend(userId)}
              hasMore={hasMore}
              loadingOlder={loadingOlder}
              onLoadOlder={loadOlder}
              loading={loadingMessages}
              emptyLabel={view.type === "general" ? "Aucun message pour le moment. Lance la conversation !" : "Aucun message privé pour le moment."}
            />
            {activeConversationId === null ? (
              <div className="chat-composer chat-composer-locked">
                {loadingMessages ? (
                  <p className="chat-loading-note">
                    <span className="chat-spinner" aria-hidden="true" />
                    Connexion à la conversation…
                  </p>
                ) : (
                  <button
                    type="button"
                    className="chat-retry"
                    onClick={() => {
                      if (view.type === "direct" && activeFriend) void openDirect(activeFriend);
                      else void openGeneral();
                    }}
                  >
                    Réessayer
                  </button>
                )}
              </div>
            ) : (
              <MessageComposer
                canWrite={summary.viewer.canWrite}
                active={open}
                notice={summary.viewer.canWrite ? undefined : "Les invités peuvent lire le chat. Crée un compte pour écrire et ajouter des amis."}
                onSend={handleSend}
              />
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
