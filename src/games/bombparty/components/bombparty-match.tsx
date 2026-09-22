"use client";

import { useEffect, useRef, useState } from "react";
import { MatchToolbar } from "@/components/match-toolbar";
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

const ACCENT = "var(--table-accent)";

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
    return <main className="table-page table-bombparty min-h-screen px-5 py-12"><div role="alert" className="mx-auto max-w-xl rounded-2xl table-error p-5">{error}</div></main>;
  }
  if (!match || !view) {
    return <main className="table-page table-bombparty min-h-screen px-5 py-12"><div className="mx-auto max-w-xl rounded-3xl border border-[var(--line)] table-surface p-8 text-center table-muted">Chargement de la partie…</div></main>;
  }
  const me = view.players[view.mySeat];
  const opponent = view.players[(1 - view.mySeat) as 0 | 1];

  return (
    <main className="table-page table-bombparty min-h-screen pb-10 play-screen" data-phase={view.phase}>
      <div className="table-shell play-shell">
        <MatchToolbar title="Syllabe Express" busy={busy} onBack={() => router.push(`/salons/${match.roomId}`)} onRefresh={() => void refresh()} onResign={view.phase === "finished" ? undefined : () => void send({ type: "RESIGN" })}>
          <div className="table-scoreboard">
          <LifePanel pseudo={opponent.pseudo} lives={opponent.lives} score={opponent.score} active={opponent.active} isMe={false} />
          <LifePanel pseudo={`${me.pseudo} · toi`} lives={me.lives} score={me.score} active={me.active} isMe />
        </div>
                <section aria-label="Mots acceptés" className="mt-6 rounded-[2rem] border border-[var(--line)] table-surface p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-black">Mots acceptés</h2>
            <p className="text-sm font-bold table-muted">{view.validWordsTotal} au total</p>
          </div>
          {view.acceptedWords.length === 0 ? (
            <p className="mt-3 text-sm table-muted">Aucun mot pour l&apos;instant. À toi de lancer la série !</p>
          ) : (
            <ul className="mt-3 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
              {[...view.acceptedWords].reverse().map((item, index) => (
                <li key={`${item.turn}-${index}`} className="flex items-center justify-between gap-2 rounded-xl table-inset px-3 py-2 text-sm">
                  <span className="font-bold">{highlightSequence(item.word, item.sequence)}</span>
                  <span className="shrink-0 text-xs font-bold table-muted">tour {item.turn}</span>
                </li>
              ))}
            </ul>
          )}
        </section></MatchToolbar>
        <div className="play-resources" aria-label="Vies">{view.players.map((player) => <span key={player.id}>{player.pseudo} <strong aria-label={`${player.lives} vies`}>{"♥".repeat(Math.max(0, player.lives)) || "0"}</strong></span>)}</div><div aria-live="polite" className="table-status" data-urgent={remaining !== null && remaining <= 5}>
          <span>{phaseLabel(view, isMyTurn, opponent.pseudo)}</span>
          {remaining !== null && view.phase === "playing" && (
            <strong className={remaining <= 5 ? "text-[var(--yellow)]" : "text-white"}>{remaining}s</strong>
          )}
        </div>

        {view.phase === "playing" && <section aria-label="Séquence à jouer" className="mt-6 rounded-[2rem] border border-[var(--line)] table-panel p-6 text-center sm:p-8">

          <p aria-live="polite" className="table-bomb-sequence">{view.sequence}</p>
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
                <button type="submit" disabled={busy || word.trim().length === 0} className="mt-3 w-full rounded-full table-primary px-4 py-3 font-bold text-white  disabled:opacity-50">
                  {busy ? "Envoi…" : "Valider"}
                </button>
              </form>
            ) : (
              <p className="mt-5 text-sm font-bold table-muted">{opponent.pseudo} cherche un mot…</p>
            )
          )}
          {error && <p role="alert" className="mx-auto mt-4 max-w-md rounded-xl table-error px-3 py-2 text-sm">{error}</p>}
        </section>}

        {view.phase === "finished" && <FinishedPanel view={view} back={() => router.push("/jeux/bombparty")} />}

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
    <div data-self={isMe} data-active={active} className={`table-player rounded-2xl border p-4 ${isMe ? "table-border-accent table-tint" : "border-[var(--line)] table-surface"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-black">{pseudo}</span>
        <span aria-label={`${lives} vies`} className="text-lg font-black tracking-tight">
          {"●".repeat(Math.max(0, lives))} <span className="text-sm table-muted">{lives}</span>
        </span>
      </div>
      <p className="mt-1 text-xs font-bold table-muted">{active ? "À son tour" : `${score} mot${score > 1 ? "s" : ""} valide${score > 1 ? "s" : ""}`}</p>
    </div>
  );
}

function highlightSequence(word: string, sequence: string): React.ReactNode {
  const split = splitAroundSequence(word, sequence);
  if (!split) return word;
  return (
    <>
      {split.before}
      <mark className="rounded table-tint px-0.5 table-accent">{split.match}</mark>
      {split.after}
    </>
  );
}

function FinishedPanel({ view, back }: { view: BombpartyView; back: () => void }) {
  const result = view.result;
  const winner = result?.winnerId !== null && result?.winnerId === view.players[view.mySeat].id;
  const title = result?.outcome === "draw" ? "Égalité" : result?.outcome === "abandoned" ? "Partie interrompue" : winner ? "Victoire" : "Défaite";
  return (
    <section className="mt-7 rounded-[2rem] border border-[var(--line)] table-panel p-6 text-center">
      <p className="text-xs font-black uppercase tracking-[0.16em] table-accent">Résultats</p>
      <h1 className="mt-2 text-5xl font-black tracking-[-0.05em]">{title}</h1>
      <div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3">
        {view.players.map((player) => (
          <div key={player.id} className="rounded-2xl table-inset p-4">
            <p className="text-sm font-bold">{player.pseudo}</p>
            <p className="mt-1 text-3xl font-black">{result?.players[player.seat]?.score ?? 0}</p>
            <p className="text-xs table-muted">mots valides · {player.lives} vies</p>
          </div>
        ))}
      </div>
      <button type="button" onClick={back} className="mt-7 rounded-full table-primary px-5 py-3 font-bold text-white">
        Rejouer
      </button>
    </section>
  );
}
