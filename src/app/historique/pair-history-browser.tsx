"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { historyOutcomeLabel, type HistoryListItem } from "./history-helpers";
import type { PairAggregate } from "./_data";

type GameOption = { slug: string; displayName: string };
type PairResponse = { opponentPseudo?: string; stats?: PairAggregate[]; entries?: HistoryListItem[]; nextCursor?: string | null; error?: { message?: string } };

function entryScore(entry: HistoryListItem): string {
  if (entry.outcome === "cooperative") return `Score commun : ${entry.sharedScore ?? "—"}`;
  if (entry.outcome === "abandoned" && entry.score === null && entry.opponentScore === null) return "Aucun gagnant";
  return `${entry.score ?? "—"} – ${entry.opponentScore ?? "—"}`;
}

export function PairHistoryBrowser({ playerId, initialOpponentPseudo, initialStats, initialEntries, initialNextCursor, games }: { playerId: string; initialOpponentPseudo: string; initialStats: PairAggregate[]; initialEntries: HistoryListItem[]; initialNextCursor: string | null; games: readonly GameOption[] }) {
  const [opponentPseudo, setOpponentPseudo] = useState(initialOpponentPseudo);
  const [stats, setStats] = useState(initialStats);
  const [entries, setEntries] = useState(initialEntries);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [game, setGame] = useState("");
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
    if (cursor) params.set("cursor", cursor);
    try {
      const response = await fetch(`/api/history/pair/${playerId}?${params.toString()}`, { cache: "no-store", headers: { "cache-control": "no-cache" }, signal: controller.signal });
      const data = await response.json().catch(() => null) as PairResponse | null;
      if (!response.ok || !data?.entries || !data.stats) {
        setError(data?.error?.message ?? "L'historique du duo n'a pas pu être chargé.");
        return;
      }
      setOpponentPseudo(data.opponentPseudo ?? "Partenaire");
      setStats(data.stats);
      setEntries((current) => replace ? data.entries! : [...current, ...data.entries!].filter((entry, index, all) => all.findIndex((candidate) => candidate.matchId === entry.matchId) === index));
      setNextCursor(data.nextCursor ?? null);
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setError("L'historique du duo n'a pas pu être chargé. Réessaie.");
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setLoading(false);
      }
    }
  }

  return (
    <>
      <form onSubmit={(event) => { event.preventDefault(); void loadPage(null, true); }} className="mt-8 flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--line)] bg-white/70 p-4">
        <div className="min-w-56 flex-1"><label htmlFor="duo-game" className="block text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">Jeu</label><select id="duo-game" value={game} onChange={(event) => setGame(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 font-bold"><option value="">Tous les jeux</option>{games.map((item) => <option key={item.slug} value={item.slug}>{item.displayName}</option>)}</select></div>
        <button type="submit" disabled={loading} className="min-h-11 rounded-full bg-[var(--green)] px-5 py-3 font-bold text-white disabled:opacity-50">{loading ? "Chargement…" : "Filtrer"}</button>
      </form>
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.length === 0 ? <p className="rounded-2xl bg-white/70 p-4 text-sm text-[var(--muted)]">Aucun agrégat disponible pour ce filtre.</p> : stats.map((stat) => <article key={stat.gameSlug} className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--orange)]">{games.find((item) => item.slug === stat.gameSlug)?.displayName ?? stat.gameSlug}</p><p className="mt-2 text-2xl font-black">{stat.played} duel{stat.played === 1 ? "" : "s"}</p><p className="mt-2 text-sm text-[var(--muted)]">{stat.myWins} victoire{stat.myWins === 1 ? "" : "s"} · {stat.opponentWins} pour {opponentPseudo} · {stat.draws} égalité{stat.draws === 1 ? "" : "s"}</p><p className="mt-1 text-sm text-[var(--muted)]">{stat.cooperative} coopérative{stat.cooperative === 1 ? "" : "s"} · {stat.abandoned} interrompue{stat.abandoned === 1 ? "" : "s"}</p></article>)}
      </section>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {entries.length === 0 ? <div className="mt-8 rounded-3xl border border-dashed border-[var(--line)] bg-white/60 p-8 text-center text-[var(--muted)]">Aucune confrontation enregistrée avec ce filtre.</div> : <div className="mt-8 grid gap-3">{entries.map((entry) => <Link key={entry.matchId} href={`/historique/${entry.matchId}`} className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(20,33,29,0.07)]"><div className="flex flex-wrap items-center justify-between gap-3"><span className="font-black">{new Date(entry.endedAt).toLocaleDateString("fr-FR", { dateStyle: "medium" })}</span><span className="rounded-full bg-[var(--green)]/10 px-3 py-1 text-sm font-bold text-[var(--green-dark)]">{historyOutcomeLabel(entry.outcome)}</span></div><div className="mt-3 flex flex-wrap justify-between gap-3 text-sm"><span className="text-[var(--muted)]">{entry.gameSlug} · contre {entry.opponentPseudo}</span><span className="font-black">{entryScore(entry)}</span></div></Link>)}</div>}
      {nextCursor && <button type="button" disabled={loading} onClick={() => void loadPage(nextCursor, false)} className="mt-7 min-h-11 rounded-full border border-[var(--line)] bg-white px-5 py-3 font-bold">{loading ? "Chargement…" : "Voir les confrontations suivantes"}</button>}
    </>
  );
}
