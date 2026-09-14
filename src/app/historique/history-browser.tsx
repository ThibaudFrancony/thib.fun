"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { historyOutcomeLabel, type HistoryListItem } from "./history-helpers";

type GameOption = { slug: string; displayName: string };
type Outcome = "" | "win" | "loss" | "draw" | "cooperative" | "abandoned";
type HistoryResponse = { entries?: HistoryListItem[]; nextCursor?: string | null; error?: { message?: string } };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function scoreLabel(entry: HistoryListItem): string {
  if (entry.outcome === "cooperative") return `Score commun : ${entry.sharedScore ?? "—"}`;
  if (entry.outcome === "abandoned") return entry.score === null && entry.opponentScore === null ? "Aucun gagnant" : `${entry.score ?? "—"} – ${entry.opponentScore ?? "—"}`;
  return `${entry.score ?? "—"} – ${entry.opponentScore ?? "—"}`;
}

function outcomeClass(outcome: HistoryListItem["outcome"]): string {
  return outcome === "loss" ? "bg-red-50 text-red-700" : outcome === "abandoned" ? "bg-amber-50 text-amber-800" : "bg-[var(--green)]/10 text-[var(--green-dark)]";
}

export function HistoryBrowser({ initialEntries, initialNextCursor, games }: { initialEntries: HistoryListItem[]; initialNextCursor: string | null; games: readonly GameOption[] }) {
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
      const response = await fetch(`/api/history?${params.toString()}`, { cache: "no-store", headers: { "cache-control": "no-cache" }, signal: controller.signal });
      const data = await response.json().catch(() => null) as HistoryResponse | null;
      if (!response.ok || !data?.entries) {
        setError(data?.error?.message ?? "L'historique n'a pas pu être chargé.");
        return;
      }
      setEntries((current) => replace ? data.entries! : [...current, ...data.entries!].filter((entry, index, all) => all.findIndex((candidate) => candidate.matchId === entry.matchId) === index));
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
    <>
      <form onSubmit={applyFilters} className="mt-8 grid gap-3 rounded-2xl border border-[var(--line)] bg-white/70 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="history-game" className="block text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">Jeu</label>
          <select id="history-game" value={game} onChange={(event) => setGame(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 font-bold">
            <option value="">Tous les jeux</option>
            {games.map((item) => <option key={item.slug} value={item.slug}>{item.displayName}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="history-outcome" className="block text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">Issue</label>
          <select id="history-outcome" value={outcome} onChange={(event) => setOutcome(event.target.value as Outcome)} className="mt-2 min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 font-bold">
            <option value="">Toutes les issues</option>
            <option value="win">Victoire</option>
            <option value="loss">Défaite</option>
            <option value="draw">Égalité</option>
            <option value="cooperative">Résultat commun</option>
            <option value="abandoned">Interrompue</option>
          </select>
        </div>
        <button type="submit" disabled={loading} className="min-h-11 rounded-full bg-[var(--green)] px-5 py-3 font-bold text-white disabled:opacity-50">{loading ? "Chargement…" : "Filtrer"}</button>
      </form>

      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {entries.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-[var(--line)] bg-white/60 p-8 text-center text-[var(--muted)]">Aucune partie ne correspond à ces filtres.</div>
      ) : (
        <div className="mt-8 grid gap-3">
          {entries.map((entry) => {
            const gameLabel = games.find((item) => item.slug === entry.gameSlug)?.displayName ?? entry.gameSlug;
            return (
              <article key={entry.matchId} className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(20,33,29,0.07)]">
                <Link href={`/historique/${entry.matchId}`} className="block focus:outline-none focus:ring-2 focus:ring-[var(--green)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--orange)]">{gameLabel}</p><p className="mt-1 font-black">Face à {entry.opponentPseudo}</p></div>
                    <span className={`rounded-full px-3 py-1 text-sm font-bold ${outcomeClass(entry.outcome)}`}>{historyOutcomeLabel(entry.outcome)}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]"><time dateTime={entry.endedAt}>{new Date(entry.endedAt).toLocaleDateString("fr-FR", { dateStyle: "medium" })}</time><span className="font-black text-[var(--ink)]">{scoreLabel(entry)}</span></div>
                </Link>
                {UUID_PATTERN.test(entry.opponentId) && <Link href={`/historique/duo/${entry.opponentId}`} className="mt-3 inline-flex min-h-11 items-center rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold text-[var(--green)]">Notre historique</Link>}
              </article>
            );
          })}
        </div>
      )}
      {nextCursor && <button type="button" disabled={loading} onClick={() => void loadPage(nextCursor, false)} className="mt-7 min-h-11 rounded-full border border-[var(--line)] bg-white px-5 py-3 font-bold">{loading ? "Chargement…" : "Voir les parties suivantes"}</button>}
    </>
  );
}
