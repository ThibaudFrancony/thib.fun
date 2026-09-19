"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BombpartyAction, BombpartyView } from "@/games/bombparty/types";
import { parseMatchSnapshot, useResourceNetwork } from "@/lib/network-sync";
import { splitAroundSequence } from "@/games/bombparty/highlight";

type MatchResponse = {
  matchId: string;
  roomId: string;
  gameSlug: string;
  status: string;
  version: number;
  phaseId: string;
  deadlineAt: string | null;
  deadlineKind: string | null;
  serverNow: string;
  view: BombpartyView;
};

const ACCENT = "#6d28d9";

export function BombpartyMatch({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [word, setWord] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastTurnKey = useRef<string | null>(null);

  const {
    snapshot: match,
    error,
    busy,
    serverOffset,
    refresh,
    send: networkSend,
  } = useResourceNetwork<MatchResponse, BombpartyAction>({
    resourceId: matchId,
    snapshotUrl: `/api/matches/${matchId}`,
    heartbeatUrl: `/api/matches/${matchId}/heartbeat`,
    realtimeEvent: "match.updated",
    parseSnapshot: parseMatchSnapshot<MatchResponse>,
    getResourceId: (snapshot) => snapshot.matchId,
    getPhaseId: (snapshot) => snapshot.phaseId,
    isFinished: (snapshot) => snapshot.view.phase === "finished",
    buildCommand: ({ commandId, expectedVersion, action }) => ({
      url: `/api/matches/${matchId}/commands`,
      body: { commandId, expectedVersion, action },
    }),
  });

  useEffect(() => {
    const clockTimer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(clockTimer);
  }, []);

  async function send(action: BombpartyAction, submittedWord?: string): Promise<void> {
    const next = await networkSend(action);
    if (next && submittedWord !== undefined) {
      setWord("");
    }
  }

  const view = match?.view ?? null;
  const isMyTurn = view !== null && view.phase === "playing" && view.activePlayerId !== null && view.players[view.mySeat].id === view.activePlayerId;
  const turnKey = view ? `${view.turn}:${view.sequence}:${view.activeSeat}` : null;

  useEffect(() => {
    // Autofocus après changement de tour, uniquement si c'est à nous de jouer.
    if (turnKey !== null && turnKey !== lastTurnKey.current) {
      lastTurnKey.current = turnKey;
      if (isMyTurn) inputRef.current?.focus();
    }
  }, [turnKey, isMyTurn]);

  const remaining = match?.deadlineAt ? Math.max(0, Math.ceil((Date.parse(match.deadlineAt) - (now + serverOffset)) / 1000)) : null;

  if (error && !match) {
    return <main className="min-h-screen px-5 py-12"><div role="alert" className="mx-auto max-w-xl rounded-2xl bg-red-50 p-5 text-red-700">{error}</div></main>;
  }
  if (!match || !view) {
    return <main className="min-h-screen px-5 py-12"><div className="mx-auto max-w-xl rounded-3xl border border-[var(--line)] bg-white/70 p-8 text-center text-[var(--muted)]">Chargement de la partie…</div></main>;
  }
  const me = view.players[view.mySeat];
  const opponent = view.players[(1 - view.mySeat) as 0 | 1];

  return (
    <main className="min-h-screen pb-10">
      <div className="mx-auto max-w-3xl px-4 py-4 sm:px-8 sm:py-7">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => router.push(`/salons/${match.roomId}`)} className="rounded-full px-3 py-2 text-sm font-bold text-[var(--muted)] hover:bg-white">← Salon</button>
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6d28d9]">Syllabe Express</p>
            <p className="font-black">Tour {Math.min(view.turn, view.maxTurns)} · {view.validWordsTotal} mot{view.validWordsTotal > 1 ? "s" : ""} valide{view.validWordsTotal > 1 ? "s" : ""}</p>
          </div>
          <button type="button" onClick={() => void refresh()} className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-sm font-bold">Actualiser</button>
        </header>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <LifePanel pseudo={opponent.pseudo} lives={opponent.lives} score={opponent.score} active={opponent.active} isMe={false} />
          <LifePanel pseudo={`${me.pseudo} · toi`} lives={me.lives} score={me.score} active={me.active} isMe />
        </div>

        <div aria-live="polite" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--ink)] px-4 py-3 text-sm font-bold text-white">
          <span>{phaseLabel(view, isMyTurn, opponent.pseudo)}</span>
          {remaining !== null && view.phase === "playing" && (
            <strong className={remaining <= 5 ? "text-[var(--yellow)]" : "text-white"}>{remaining}s</strong>
          )}
        </div>

        <section aria-label="Séquence à jouer" className="mt-6 rounded-[2rem] border border-[var(--line)] bg-[var(--card)] p-6 text-center sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6d28d9]">Séquence ({view.turnSeconds}s ce tour)</p>
          <p aria-live="polite" className="mt-2 text-6xl font-black uppercase tracking-[-0.04em] text-[var(--ink)] sm:text-7xl">{view.sequence}</p>
          {view.phase === "playing" && (
            isMyTurn ? (
              <form
                className="mx-auto mt-5 max-w-md"
                onSubmit={(event) => {
                  event.preventDefault();
                  const submitted = word;
                  if (submitted.trim().length === 0) return;
                  void send({ type: "SUBMIT_WORD", word: submitted }, submitted);
                }}
              >
                <label htmlFor="bombparty-word" className="sr-only">Ton mot contenant {view.sequence}</label>
                <input
                  ref={inputRef}
                  id="bombparty-word"
                  type="text"
                  value={word}
                  onChange={(event) => setWord(event.target.value)}
                  placeholder={`Un mot avec « ${view.sequence} »…`}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={60}
                  disabled={busy}
                  className="w-full rounded-2xl border-2 px-4 py-3 text-lg font-bold"
                  style={{ borderColor: ACCENT }}
                />
                <button type="submit" disabled={busy || word.trim().length === 0} className="mt-3 w-full rounded-full bg-[#6d28d9] px-4 py-3 font-bold text-white hover:bg-[#5b21b6] disabled:opacity-50">
                  {busy ? "Envoi…" : "Valider (Entrée)"}
                </button>
              </form>
            ) : (
              <p className="mt-5 text-sm font-bold text-[var(--muted)]">{opponent.pseudo} cherche un mot…</p>
            )
          )}
          {error && <p role="alert" className="mx-auto mt-4 max-w-md rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </section>

        <section aria-label="Mots acceptés" className="mt-6 rounded-[2rem] border border-[var(--line)] bg-white/70 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-black">Mots acceptés</h2>
            <p className="text-sm font-bold text-[var(--muted)]">{view.validWordsTotal} au total</p>
          </div>
          {view.acceptedWords.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">Aucun mot pour l&apos;instant. À toi de lancer la série !</p>
          ) : (
            <ul className="mt-3 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
              {[...view.acceptedWords].reverse().map((item, index) => (
                <li key={`${item.turn}-${index}`} className="flex items-center justify-between gap-2 rounded-xl bg-[var(--paper)] px-3 py-2 text-sm">
                  <span className="font-bold">{highlightSequence(item.word, item.sequence)}</span>
                  <span className="shrink-0 text-xs font-bold text-[var(--muted)]">tour {item.turn}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {view.phase === "finished" && <FinishedPanel view={view} back={() => router.push("/jeux/bombparty")} />}

        {view.phase !== "finished" && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-[var(--line)] bg-white/50 p-4 text-sm">
            <span className="text-[var(--muted)]">Besoin d&apos;arrêter la partie ?</span>
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => { if (window.confirm("Abandonner cette partie ?")) void send({ type: "RESIGN" }); }} className="rounded-full px-3 py-2 font-bold text-[var(--muted)] hover:bg-red-50 hover:text-red-700">Abandonner</button>
              </div>
          </div>
        )}
      </div>
    </main>
  );
}

function phaseLabel(view: BombpartyView, isMyTurn: boolean, opponentPseudo: string): string {
  if (view.phase === "finished") return "Partie terminée";
  return isMyTurn ? "À toi : trouve un mot avant le chrono" : `${opponentPseudo} cherche un mot…`;
}

function LifePanel({ pseudo, lives, score, active, isMe }: { pseudo: string; lives: number; score: number; active: boolean; isMe: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${isMe ? "border-[#6d28d9]/50 bg-[#f1eafe]" : "border-[var(--line)] bg-white/70"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-black">{pseudo}</span>
        <span aria-label={`${lives} vies`} className="text-lg font-black tracking-tight">
          {"●".repeat(Math.max(0, lives))} <span className="text-sm text-[var(--muted)]">{lives}</span>
        </span>
      </div>
      <p className="mt-1 text-xs font-bold text-[var(--muted)]">{active ? "À son tour" : `${score} mot${score > 1 ? "s" : ""} valide${score > 1 ? "s" : ""}`}</p>
    </div>
  );
}

function highlightSequence(word: string, sequence: string): React.ReactNode {
  const split = splitAroundSequence(word, sequence);
  if (!split) return word;
  return (
    <>
      {split.before}
      <mark className="rounded bg-[#f1eafe] px-0.5 text-[#4c1d95]">{split.match}</mark>
      {split.after}
    </>
  );
}

function FinishedPanel({ view, back }: { view: BombpartyView; back: () => void }) {
  const result = view.result;
  const winner = result?.winnerId !== null && result?.winnerId === view.players[view.mySeat].id;
  const title = result?.outcome === "draw" ? "Égalité" : result?.outcome === "abandoned" ? "Partie interrompue" : winner ? "Victoire" : "Défaite";
  return (
    <section className="mt-7 rounded-[2rem] border border-[var(--line)] bg-[var(--card)] p-6 text-center">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6d28d9]">Résultats</p>
      <h1 className="mt-2 text-5xl font-black tracking-[-0.05em]">{title}</h1>
      <div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3">
        {view.players.map((player) => (
          <div key={player.id} className="rounded-2xl bg-[var(--paper)] p-4">
            <p className="text-sm font-bold">{player.pseudo}</p>
            <p className="mt-1 text-3xl font-black">{result?.players[player.seat]?.score ?? 0}</p>
            <p className="text-xs text-[var(--muted)]">mots valides · {player.lives} vies</p>
          </div>
        ))}
      </div>
      <button type="button" onClick={back} className="mt-7 rounded-full bg-[#6d28d9] px-5 py-3 font-bold text-white hover:bg-[#5b21b6]">
        Rejouer
      </button>
    </section>
  );
}
