"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatAvatar } from "@/components/chat/chat-avatar";
import { MessageList } from "@/components/chat/message-list";
import { fetchAdminConversationMessages } from "@/lib/admin-client";
import type {
  AdminConversationPayload,
  AdminConversationSummary,
  AdminGameView,
} from "@/lib/admin-types";
import { formatMessageCount, formatMessageMeta, mergeMessages } from "@/lib/chat-format";
import type { ChatMessage } from "@/lib/chat-types";
import { postJson } from "@/lib/client-request";

type ConversationEntry = {
  conversation: AdminConversationPayload["conversation"];
  messages: ChatMessage[];
  hasMore: boolean;
};

const PAGE_SIZE = 30;

export function AdminConsole({
  adminId,
  adminName,
  initialGames,
  initialConversations,
  loadError,
}: {
  adminId: string;
  adminName: string;
  initialGames: AdminGameView[];
  initialConversations: AdminConversationSummary[];
  loadError: boolean;
}) {
  const [tab, setTab] = useState<"games" | "discussions">("games");
  const [games, setGames] = useState(initialGames);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [gameNotice, setGameNotice] = useState<string | null>(null);
  const [gameError, setGameError] = useState<string | null>(null);
  const [conversations] = useState(initialConversations);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialConversations.find((conversation) => conversation.kind === "general")?.id
      ?? initialConversations[0]?.id
      ?? null,
  );
  const [entries, setEntries] = useState<Record<string, ConversationEntry>>({});
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const loadMessages = useCallback(async (conversationId: string, options: { before?: number } = {}) => {
    const payload = await fetchAdminConversationMessages(conversationId, {
      before: options.before,
      limit: PAGE_SIZE,
    });
    setEntries((previous) => {
      const entry = previous[conversationId];
      const messages = mergeMessages(entry?.messages ?? [], payload.messages);
      const hasMore = options.before ? payload.hasMore : entry?.hasMore ?? payload.hasMore;
      return {
        ...previous,
        [conversationId]: { conversation: payload.conversation, messages, hasMore },
      };
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    if (entriesRef.current[selectedId]) return;
    void loadMessages(selectedId).catch(() => setChatError("Cette conversation n'a pas pu être chargée."));
  }, [selectedId, loadMessages]);

  async function toggleGame(game: AdminGameView) {
    if (busySlug) return;
    setBusySlug(game.slug);
    setGameError(null);
    setGameNotice(null);
    const result = await postJson<{ slug: string; visible: boolean }>(
      `/api/admin/games/${game.slug}/visibility`,
      { requestId: crypto.randomUUID(), visible: !game.visible },
    );
    if (result.ok) {
      setGames((previous) =>
        previous.map((entry) => (entry.slug === game.slug ? { ...entry, visible: result.data.visible } : entry)),
      );
      setGameNotice(
        result.data.visible
          ? `${game.cardName} est de nouveau visible sur l'accueil.`
          : `${game.cardName} est masqué de l'accueil.`,
      );
    } else {
      setGameError(result.message);
    }
    setBusySlug(null);
  }

  const selectedEntry = selectedId ? entries[selectedId] : null;
  const selectedSummary = conversations.find((conversation) => conversation.id === selectedId) ?? null;
  const selectedConversation = selectedEntry?.conversation ?? null;
  const query = search.trim().toLocaleLowerCase("fr-FR");
  const filteredConversations = query
    ? conversations.filter(
        (conversation) =>
          conversation.title.toLocaleLowerCase("fr-FR").includes(query)
          || conversation.members.some((member) => member.name.toLocaleLowerCase("fr-FR").includes(query)),
      )
    : conversations;
  const generalConversations = filteredConversations.filter((conversation) => conversation.kind === "general");
  const directConversations = filteredConversations.filter((conversation) => conversation.kind === "direct");

  async function loadOlder() {
    if (!selectedId || loadingOlder) return;
    const entry = entriesRef.current[selectedId];
    const minSeq = entry?.messages[0]?.seq;
    if (!minSeq) return;
    setLoadingOlder(true);
    try {
      await loadMessages(selectedId, { before: minSeq });
    } catch {
      setChatError("Les messages précédents n'ont pas pu être chargés.");
    } finally {
      setLoadingOlder(false);
    }
  }

  function renderConversationButton(conversation: AdminConversationSummary) {
    const preview = conversation.lastMessage
      ? conversation.lastMessage.body?.trim() || "Photo"
      : "Aucun message";
    return (
      <li key={conversation.id}>
        <button
          type="button"
          className="admin-conv"
          data-active={conversation.id === selectedId}
          onClick={() => {
            setSelectedId(conversation.id);
            setChatError(null);
          }}
        >
          {conversation.kind === "general" ? (
            <span className="admin-conv-globe" aria-hidden="true">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg>
            </span>
          ) : (
            <span className="admin-conv-avatars" aria-hidden="true">
              {conversation.members.slice(0, 2).map((member) => (
                <ChatAvatar
                  key={member.userId}
                  name={member.name}
                  preset={member.avatarPreset}
                  imageUrl={member.avatarUrl}
                  size={26}
                />
              ))}
            </span>
          )}
          <span className="admin-conv-copy">
            <span className="admin-conv-title">
              {conversation.title}
              {conversation.kind === "general" ? <em>Public</em> : <em>Privé</em>}
            </span>
            <span className="admin-conv-preview">{preview}</span>
          </span>
          <span className="admin-conv-meta">
            {conversation.lastMessage ? formatMessageMeta(conversation.lastMessage.createdAt) : ""}
          </span>
        </button>
      </li>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <Link href="/" className="admin-back">← Retour au site</Link>
        <div className="admin-brand">
          <span className="admin-brand-mark">t</span>
          <div>
            <h1>Administration</h1>
            <p>Connecté en tant que {adminName}</p>
          </div>
        </div>
        <nav className="admin-tabs" role="tablist" aria-label="Sections d'administration">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "games"}
            data-active={tab === "games"}
            onClick={() => setTab("games")}
          >
            Jeux
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "discussions"}
            data-active={tab === "discussions"}
            onClick={() => setTab("discussions")}
          >
            Discussions
          </button>
        </nav>
      </header>

      {loadError ? (
        <p className="admin-banner admin-banner-error">
          Les données d&apos;administration sont indisponibles. Vérifie que la migration admin est appliquée.
        </p>
      ) : null}

      {tab === "games" ? (
        <main className="admin-main">
          <section className="admin-panel">
            <header className="admin-panel-head">
              <h2>Visibilité des jeux</h2>
              <p>Un jeu masqué disparaît de l&apos;accueil ; sa route reste accessible par URL directe.</p>
            </header>
            {gameNotice ? <p className="admin-banner admin-banner-ok" role="status">{gameNotice}</p> : null}
            {gameError ? <p className="admin-banner admin-banner-error" role="alert">{gameError}</p> : null}
            <ul className="admin-game-list">
              {games.map((game) => (
                <li key={game.slug} className="admin-game">
                  <div className="admin-game-copy">
                    <p className="admin-game-name">
                      {game.cardName}
                      <span className="admin-game-display">{game.displayName}</span>
                    </p>
                    <p className="admin-game-slug">/{game.slug} · {game.availability}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={game.visible}
                    aria-label={`${game.visible ? "Désactiver" : "Activer"} ${game.cardName}`}
                    className="admin-switch"
                    data-on={game.visible}
                    disabled={busySlug === game.slug}
                    onClick={() => void toggleGame(game)}
                  >
                    <span className="admin-switch-track" aria-hidden="true"><span className="admin-switch-knob" /></span>
                    <span className="admin-switch-label">{game.visible ? "Actif" : "Désactivé"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </main>
      ) : (
        <main className="admin-main admin-main-chat">
          <aside className="admin-conv-list" aria-label="Conversations">
            <label className="admin-search">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m20 20-3.5-3.5" /></svg>
              <input
                type="search"
                value={search}
                placeholder="Rechercher un utilisateur…"
                aria-label="Rechercher une conversation"
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            {generalConversations.length > 0 ? (
              <section className="admin-conv-group">
                <h3>Chat général</h3>
                <ul>{generalConversations.map(renderConversationButton)}</ul>
              </section>
            ) : null}
            <section className="admin-conv-group">
              <h3>Messages privés ({directConversations.length})</h3>
              {directConversations.length === 0 ? (
                <p className="admin-empty">Aucune conversation privée pour le moment.</p>
              ) : (
                <ul>{directConversations.map(renderConversationButton)}</ul>
              )}
            </section>
          </aside>

          <section className="admin-conv-view" aria-label="Conversation sélectionnée">
            {chatError ? <p className="admin-banner admin-banner-error" role="alert">{chatError}</p> : null}
            {!selectedId ? (
              <p className="admin-empty">Choisis une conversation.</p>
            ) : (
              <>
                <header className="admin-conv-head">
                  {selectedConversation?.kind === "direct" ? (
                    <span className="admin-conv-avatars" aria-hidden="true">
                      {(selectedConversation.members ?? []).slice(0, 2).map((member) => (
                        <ChatAvatar
                          key={member.userId}
                          name={member.name}
                          preset={member.avatarPreset}
                          imageUrl={member.avatarUrl}
                          size={34}
                        />
                      ))}
                    </span>
                  ) : (
                    <span className="admin-conv-globe" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg>
                    </span>
                  )}
                  <div className="admin-conv-head-copy">
                    <p className="admin-conv-head-title">
                      {selectedConversation?.title ?? selectedSummary?.title ?? "Conversation"}
                    </p>
                    <p className="admin-conv-head-sub">
                      {selectedConversation?.kind === "direct"
                        ? `${(selectedConversation.members ?? []).map((member) => member.name).join(" et ")} · lecture seule`
                        : `Lecture seule · ${formatMessageCount(selectedSummary?.messageCount ?? 0)}`}
                    </p>
                  </div>
                </header>
                <MessageList
                  key={selectedId}
                  messages={selectedEntry?.messages ?? []}
                  viewerId={adminId}
                  relationFor={() => "none"}
                  friendBusy={false}
                  readOnly
                  onAddFriend={() => undefined}
                  hasMore={selectedEntry?.hasMore ?? false}
                  loadingOlder={loadingOlder}
                  onLoadOlder={loadOlder}
                  loading={!selectedEntry}
                  emptyLabel="Aucun message dans cette conversation."
                />
              </>
            )}
          </section>
        </main>
      )}
    </div>
  );
}
