"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { historyOutcomeLabel, type ProfileHistoryListItem } from "@/app/historique/history-helpers";

type GameOption = { slug: string; displayName: string };
type Outcome = "" | "win" | "loss" | "draw" | "cooperative" | "abandoned";
type HistoryResponse = { entries?: ProfileHistoryListItem[]; nextCursor?: string | null; error?: { message?: string } };

function scoreLabel(entry: ProfileHistoryListItem): string {
  if (entry.outcome === "cooperative") return `Score commun : ${entry.sharedScore ?? "—"}`;
  if (entry.outcome === "abandoned") return entry.score === null && entry.opponentScore === null ? "Aucun gagnant" : `${entry.score ?? "—"} – ${entry.opponentScore ?? "—"}`;
  return `${entry.score ?? "—"} – ${entry.opponentScore ?? "—"}`;
}

function outcomeTone(outcome: ProfileHistoryListItem["outcome"]): string {
  if (outcome === "loss") return "loss";
  if (outcome === "abandoned") return "abandoned";
  if (outcome === "draw") return "draw";
  if (outcome === "cooperative") return "coop";
  return "win";
}

export function ProfileHistory({
  endpoint,
  initialEntries,
  initialNextCursor,
  games,
  title,
  subtitle,
  emptyLabel,
}: {
  endpoint: string;
  initialEntries: ProfileHistoryListItem[];
  initialNextCursor: string | null;
  games: readonly GameOption[];
  title: string;
  subtitle: string;
  emptyLabel: string;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [game, setGame] = useState("");
  const [outcome, setOutcome] = useState<Outcome>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function loadPage(cursor: string | null, replace: boolean) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (game) params.set("game", game);
    if (outcome) params.set("outcome", outcome);
    if (cursor) params.set("cursor", cursor);
    try {
      const response = await fetch(`${endpoint}?${params.toString()}`, { cache: "no-store", headers: { "cache-control": "no-cache" }, signal: controller.signal });
      const data = (await response.json().catch(() => null)) as HistoryResponse | null;
      if (!response.ok || !data?.entries) {
        setError(data?.error?.message ?? "L'historique n'a pas pu être chargé.");
        return;
      }
      setEntries((current) => (replace ? data.entries! : [...current, ...data.entries!].filter((entry, index, all) => all.findIndex((candidate) => candidate.matchId === entry.matchId) === index)));
      setNextCursor(data.nextCursor ?? null);
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setError("L'historique n'a pas pu être chargé. Vérifie ta connexion puis réessaie.");
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setLoading(false);
      }
    }
  }

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadPage(null, true);
  }

  return (
    <section className="pf-history" aria-label={title}>
      <header className="pf-history-head">
        <div>
          <p className="pf-history-kicker">Vos confrontations</p>
          <h2 className="pf-history-title">{title}</h2>
          <p className="pf-history-subtitle">{subtitle}</p>
        </div>
      </header>

      <form onSubmit={applyFilters} className="pf-history-filters">
        <label className="pf-history-field">
          <span className="pf-history-label">Jeu</span>
          <select value={game} onChange={(event) => setGame(event.target.value)} className="pf-history-select">
            <option value="">Tous les jeux</option>
            {games.map((item) => <option key={item.slug} value={item.slug}>{item.displayName}</option>)}
          </select>
        </label>
        <label className="pf-history-field">
          <span className="pf-history-label">Issue</span>
          <select value={outcome} onChange={(event) => setOutcome(event.target.value as Outcome)} className="pf-history-select">
            <option value="">Toutes les issues</option>
            <option value="win">Victoire</option>
            <option value="loss">Défaite</option>
            <option value="draw">Égalité</option>
            <option value="cooperative">Résultat commun</option>
            <option value="abandoned">Interrompue</option>
          </select>
        </label>
        <button type="submit" disabled={loading} className="pf-history-submit">{loading ? "Chargement…" : "Filtrer"}</button>
      </form>

      {error && <p role="alert" className="pf-history-error">{error}</p>}
      {entries.length === 0 ? (
        <p className="pf-history-empty">{emptyLabel}</p>
      ) : (
        <ul className="pf-history-list">
          {entries.map((entry) => {
            const gameLabel = games.find((item) => item.slug === entry.gameSlug)?.displayName ?? entry.gameSlug;
            const body = (
              <>
                <span className="pf-history-card-top">
                  <span>
                    <span className="pf-history-game">{gameLabel}</span>
                    <span className="pf-history-vs">Face à {entry.opponentPseudo}</span>
                  </span>
                  <span className="pf-history-badge" data-tone={outcomeTone(entry.outcome)}>{historyOutcomeLabel(entry.outcome)}</span>
                </span>
                <span className="pf-history-meta">
                  <time dateTime={entry.endedAt}>{new Date(entry.endedAt).toLocaleDateString("fr-FR", { dateStyle: "medium" })}</time>
                  <span className="pf-history-score">{scoreLabel(entry)}</span>
                </span>
              </>
            );
            return (
              <li key={entry.matchId}>
                {entry.viewerIsParticipant ? (
                  <Link href={`/historique/${entry.matchId}`} className="pf-history-card">{body}</Link>
                ) : (
                  <span className="pf-history-card" data-static="true">{body}<span className="pf-history-locked">Tu n&apos;as pas joué cette partie</span></span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {nextCursor && (
        <button type="button" disabled={loading} onClick={() => void loadPage(nextCursor, false)} className="pf-history-more">
          {loading ? "Chargement…" : "Voir les parties suivantes"}
        </button>
      )}
    </section>
  );
}
