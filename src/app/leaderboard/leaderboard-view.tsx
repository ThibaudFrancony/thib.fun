"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { postJson } from "@/lib/client-request";
import type { LeaderboardEntry, LeaderboardMe } from "@/lib/leaderboard-types";

type Relation = "none" | "outgoing" | "incoming" | "friends";

const RELATION_LABEL: Record<Relation, string> = {
  none: "Demander en ami",
  outgoing: "Demande envoyée",
  incoming: "Demande reçue",
  friends: "Déjà ami",
};

function formatPoints(points: number): string {
  return `${points} pt${points > 1 ? "s" : ""}`;
}

function formatRecord(entry: { wins: number; losses: number; draws: number }): string {
  return `${entry.wins} V · ${entry.losses} D · ${entry.draws} N`;
}

const PODIUM_ASSETS: Record<1 | 2 | 3, { src: string; className: string }> = {
  1: { src: "/leaderboard/crown.png", className: "lb-crown" },
  2: { src: "/leaderboard/badge-2.png", className: "lb-badge" },
  3: { src: "/leaderboard/badge-3.png", className: "lb-badge" },
};

function PodiumCard({
  entry,
  place,
  onSelect,
  isSelf,
}: {
  entry: LeaderboardEntry | null;
  place: 1 | 2 | 3;
  onSelect: (entry: LeaderboardEntry) => void;
  isSelf: boolean;
}) {
  const asset = PODIUM_ASSETS[place];
  const interactive = Boolean(entry) && !isSelf;

  return (
    <article className="lb-card" data-place={place} data-empty={entry ? undefined : "true"}>
      {interactive && entry ? (
        <button
          type="button"
          className="lb-card-hit"
          aria-haspopup="dialog"
          aria-label={`Actions pour ${entry.name}`}
          onClick={() => onSelect(entry)}
        />
      ) : null}
      {entry ? (
        <Image
          className={asset.className}
          src={asset.src}
          alt=""
          aria-hidden="true"
          width={1254}
          height={1254}
          priority={place === 1}
        />
      ) : null}
      <div className="lb-card-avatar">
        {entry ? (
          <Avatar name={entry.name} preset={entry.avatarPreset} imageUrl={entry.avatarUrl} size={place === 1 ? 96 : 72} />
        ) : (
          <span className="lb-card-avatar-empty" aria-hidden="true">—</span>
        )}
      </div>
      <p className="lb-card-place">{place === 1 ? "1ER" : `${place}E`}</p>
      <p className="lb-card-name">{entry?.name ?? "En attente"}</p>
      <p className="lb-card-points">{entry ? formatPoints(entry.points) : "—"}</p>
      {entry ? <p className="lb-card-record">{formatRecord(entry)}</p> : null}
    </article>
  );
}

type SummaryRelations = {
  friends?: { userId: string }[];
  incomingRequests?: { userId: string }[];
  outgoingRequests?: { userId: string }[];
};

export function LeaderboardView({
  entries,
  me,
  viewerId,
}: {
  entries: LeaderboardEntry[];
  me: LeaderboardMe | null;
  viewerId: string;
}) {
  const [relations, setRelations] = useState<Record<string, Relation>>({});
  const [selected, setSelected] = useState<LeaderboardEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/chat/summary", { cache: "no-store", signal: controller.signal })
      .then(async (response) => (response.ok ? ((await response.json()) as SummaryRelations) : null))
      .then((data) => {
        if (!data) return;
        const next: Record<string, Relation> = {};
        for (const friend of data.friends ?? []) next[friend.userId] = "friends";
        for (const request of data.outgoingRequests ?? []) next[request.userId] = "outgoing";
        for (const request of data.incomingRequests ?? []) next[request.userId] = next[request.userId] ?? "incoming";
        setRelations(next);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const openMenu = useCallback(
    (entry: LeaderboardEntry) => {
      if (entry.userId === viewerId) return;
      setSelected(entry);
      setFeedback(null);
    },
    [viewerId],
  );

  const closeMenu = useCallback(() => {
    setSelected(null);
    setFeedback(null);
  }, []);

  useEffect(() => {
    if (!selected) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selected, closeMenu]);

  async function requestFriend() {
    if (!selected || busy) return;
    setBusy(true);
    const result = await postJson<{ direction?: string }>("/api/friends/requests", {
      requestId: crypto.randomUUID(),
      targetId: selected.userId,
    });
    setBusy(false);
    if (result.ok) {
      const direction = result.data.direction;
      const mapped: Relation = direction === "incoming" ? "incoming" : direction === "friends" ? "friends" : "outgoing";
      setRelations((current) => ({ ...current, [selected.userId]: mapped }));
      setFeedback(
        direction === "incoming"
          ? "Cette personne t'a déjà envoyé une demande : accepte-la dans le chat, onglet Amis."
          : direction === "friends"
            ? "Vous êtes déjà amis."
            : "Demande d'ami envoyée.",
      );
    } else {
      setFeedback(result.message);
    }
  }

  const podium = [2, 1, 3] as const;
  const meVisible = me ? entries.some((entry) => entry.userId === viewerId) : false;
  const relation: Relation = selected ? relations[selected.userId] ?? "none" : "none";

  return (
    <div className="lb-root">
      <section className="lb-podium" aria-label="Podium des trois premiers">
        {podium.map((place) => (
          <PodiumCard
            key={place}
            place={place}
            entry={entries[place - 1] ?? null}
            onSelect={openMenu}
            isSelf={entries[place - 1]?.userId === viewerId}
          />
        ))}
      </section>

      <section className="lb-panel" aria-label="Classement des cent premiers joueurs">
        <header className="lb-panel-head">
          <h2 className="lb-panel-title">Top 100</h2>
          <p className="lb-panel-sub">10 points par victoire, 5 par défaite, 7 par match nul, 10 par réussite coopérative.</p>
        </header>
        {entries.length === 0 ? (
          <p className="lb-empty">Aucun point marqué pour le moment. Joue une partie pour ouvrir le classement !</p>
        ) : (
          <div className="lb-table-wrap">
            <table className="lb-table">
              <thead>
                <tr>
                  <th scope="col" className="lb-cell-rank">#</th>
                  <th scope="col">Joueur</th>
                  <th scope="col" className="lb-col-record">Bilan</th>
                  <th scope="col" className="lb-cell-points">Points</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const isSelf = entry.userId === viewerId;
                  return (
                    <tr
                      key={entry.userId}
                      className="lb-row"
                      data-me={isSelf}
                      data-rank={entry.rank <= 3 ? entry.rank : undefined}
                      data-interactive={!isSelf}
                      onClick={isSelf ? undefined : () => openMenu(entry)}
                    >
                      <td className="lb-cell-rank">{entry.rank}</td>
                      <td>
                        <span className="lb-cell-player">
                          <Avatar name={entry.name} preset={entry.avatarPreset} imageUrl={entry.avatarUrl} size={34} />
                          {isSelf ? (
                            <span className="lb-cell-name">{entry.name}</span>
                          ) : (
                            <button
                              type="button"
                              className="lb-cell-name lb-cell-name-button"
                              aria-haspopup="dialog"
                              aria-label={`Actions pour ${entry.name}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                openMenu(entry);
                              }}
                            >
                              {entry.name}
                            </button>
                          )}
                        </span>
                      </td>
                      <td className="lb-cell-record lb-col-record">{formatRecord(entry)}</td>
                      <td className="lb-cell-points">{entry.points} pts</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {me && !meVisible ? (
        <section className="lb-me" aria-label="Ton rang">
          <span className="lb-me-label">Ton rang</span>
          <strong className="lb-me-rank">#{me.rank}</strong>
          <span className="lb-me-points">{formatPoints(me.points)}</span>
          <span className="lb-me-record">{formatRecord(me)}</span>
        </section>
      ) : null}
      {!me && entries.length > 0 ? (
        <p className="lb-me-empty">Tu n&apos;as pas encore de point : termine une partie classée pour entrer au classement.</p>
      ) : null}

      {selected ? (
        <div className="lb-menu-backdrop" onClick={closeMenu}>
          <div
            className="lb-menu"
            role="dialog"
            aria-modal="true"
            aria-label={`Actions pour ${selected.name}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="lb-menu-head">
              <Avatar name={selected.name} preset={selected.avatarPreset} imageUrl={selected.avatarUrl} size={52} />
              <div className="lb-menu-copy">
                <p className="lb-menu-name">{selected.name}</p>
                <p className="lb-menu-sub">
                  {formatPoints(selected.points)} · {formatRecord(selected)}
                </p>
              </div>
            </div>
            <Link className="lb-menu-action" href={`/profil/${selected.userId}`} onClick={closeMenu}>
              Profil
            </Link>
            <button
              type="button"
              className="lb-menu-action"
              disabled={busy || relation !== "none"}
              onClick={() => void requestFriend()}
            >
              {busy ? "Envoi…" : RELATION_LABEL[relation]}
            </button>
            {feedback ? (
              <p className="lb-menu-feedback" role="status">
                {feedback}
              </p>
            ) : null}
            <button type="button" className="lb-menu-close" onClick={closeMenu}>
              Fermer
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
