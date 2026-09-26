"use client";

import { useEffect, useState } from "react";
import { MatchToolbar, MatchDetails } from "@/components/match-toolbar";
import { MotionConfetti } from "@/components/motion-confetti";
import { useRouter } from "next/navigation";
import type { LongueurOndeAction, LongueurOndeResultView, LongueurOndeView } from "@/games/longueur-onde/types";
import { dialArcPath, positionToDialPoint } from "@/games/longueur-onde/dial";
import { parseMatchSnapshot, useResourceNetwork } from "@/lib/network-sync";
import { useOptimisticMatch } from "@/lib/optimistic-match";

type MatchResponse = {
  matchId: string;
  roomId: string;
  status: string;
  version: number;
  phaseId: string;
  deadlineAt: string | null;
  serverNow: string;
  view: LongueurOndeView;
};

const ACCENT = "var(--table-accent)";

export function LongueurOndeMatch({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [clueDraft, setClueDraft] = useState({ round: 0, value: "" });
  const [guessDraft, setGuessDraft] = useState({ round: 0, value: 50 });

  const {
    snapshot: match,
    error,
    busy,
    serverOffset,
    refresh,
    send: networkSend,
  } = useResourceNetwork<MatchResponse, LongueurOndeAction>({
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
  const { view: optimisticView, send: sendVisual } = useOptimisticMatch<LongueurOndeView, LongueurOndeAction, MatchResponse>(match, networkSend);

  function send(action: LongueurOndeAction) {
    return sendVisual(action, (current) => {
      if (action.type === "SUBMIT_CLUE" && current.phase === "clue" && current.isClueGiver) {
        const clue = action.clue.trim();
        if (!clue || /[0-9\r\n]|https?:\/\//i.test(clue)) return null;
        return { ...current, phase: "guessing", clue, allowedActions: current.allowedActions.filter((allowed) => allowed !== "SUBMIT_CLUE") };
      }
      if (action.type === "SUBMIT_GUESS" && current.phase === "guessing" && !current.isClueGiver) {
        return { ...current, myGuess: action.position, allowedActions: current.allowedActions.filter((allowed) => allowed !== "SUBMIT_GUESS") };
      }
      if (action.type === "NEXT" && current.phase === "reveal") {
        return { ...current, allowedActions: current.allowedActions.filter((allowed) => allowed !== "NEXT") };
      }
      return null;
    });
  }

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, []);

  if (error && !match) return <main className="table-page table-longueur-onde min-h-screen px-5 py-12"><div role="alert" className="mx-auto max-w-xl rounded-2xl table-error p-5">{error}</div></main>;
  if (!match) return <main className="table-page table-longueur-onde min-h-screen px-5 py-12"><div className="mx-auto max-w-xl rounded-3xl border border-[var(--line)] table-surface p-8 text-center table-muted">Chargement de la partie…</div></main>;

  const view = optimisticView ?? match.view;
  const me = view.players[view.mySeat];
  const opponent = view.players[(1 - view.mySeat) as 0 | 1];
  const draftClue = clueDraft.round === view.round ? clueDraft.value : "";
  const draftGuess = guessDraft.round === view.round ? guessDraft.value : 50;
  const remaining = view.phase === match.view.phase && match.deadlineAt ? Math.max(0, Math.ceil((Date.parse(match.deadlineAt) - (now + serverOffset)) / 1000)) : null;
  const displayGuess = view.myGuess ?? (view.phase === "guessing" && !view.isClueGiver ? draftGuess : null);

  return (
    <main className="table-page table-longueur-onde min-h-screen pb-12 play-screen" data-phase={view.phase}>
      <div className="table-shell play-shell">
        <MatchToolbar title="À l’unisson" progress={`${view.round}/${view.rounds}`} busy={busy} onBack={() => router.push(`/salons/${match.roomId}`)} onRefresh={() => void refresh()} onResign={view.phase === "finished" ? undefined : () => void send({ type: "RESIGN" })}>
          <div className="table-scoreboard table-scoreboard--coop">
          <PlayerCard label={opponent.pseudo} isGiver={view.clueSeat === opponent.seat} />
          <div className="table-total"><p className="text-xs font-bold uppercase tracking-[0.14em] text-white/60">Score commun</p><p className="mt-1 text-3xl font-black">{view.total} <span className="text-base font-bold text-white/60">/ {view.rounds * 4}</span></p><p className="text-xs text-white/70">{view.missed} manche{view.missed === 1 ? "" : "s"} manquée{view.missed === 1 ? "" : "s"}</p></div>
          <PlayerCard label={`${me.pseudo} · toi`} isGiver={view.isClueGiver} />
        </div>
        </MatchToolbar>
        <div aria-live="polite" className="table-status" data-urgent={remaining !== null && remaining <= 5}><span>{phaseLabel(view, me.pseudo, opponent.pseudo)}</span>{remaining !== null && <strong className={remaining <= 5 ? "text-[var(--yellow)]" : "text-white"}>{remaining}s</strong>}</div>
        {error && <p role="alert" className="mt-3 rounded-2xl table-error px-4 py-3 text-sm">{error}</p>}

        {view.axis && view.phase !== "finished" && <section key={`lo-axis-${view.round}`} className="mt-6 rounded-[2rem] border border-[var(--line)] table-panel p-5 shadow-[0_16px_36px_rgba(20,33,29,0.06)] sm:p-8 motion-question" data-from={view.round % 2 === 0 ? "right" : "left"}>

          <Dial axis={view.axis} target={view.target} guess={view.phase === "reveal" ? view.myGuess : displayGuess} />
          {view.clue && (view.phase === "guessing" || view.phase === "reveal") && <p key={`lo-clue-${view.round}`} className="mt-5 rounded-2xl border table-border-accent table-tint px-4 py-4 text-center text-lg font-bold table-accent motion-clue">« {view.clue} »</p>}
          {view.phase === "clue" && view.isClueGiver && <div className="mt-5"><label htmlFor="longueur-onde-clue" className="text-sm font-bold">Ton indice</label><textarea id="longueur-onde-clue" value={draftClue} maxLength={120} onChange={(event) => setClueDraft({ round: view.round, value: event.target.value })} rows={2} placeholder="Un exemple concret, sans donner la position" className="mt-2 w-full resize-none rounded-2xl border border-[var(--line)] table-surface px-4 py-3 leading-6 outline-none focus:border-[var(--table-accent)] focus:ring-2 focus:ring-[var(--table-accent)]" /><div className="mt-2 flex items-center justify-between gap-3 text-xs table-muted"><span>{draftClue.length} / 120</span></div></div>}
          {view.phase === "clue" && !view.isClueGiver && <Waiting text={`Attends l'indice de ${opponent.pseudo}.`} />}
          {view.phase === "guessing" && view.isClueGiver && <Waiting text={`${opponent.pseudo} place l'aiguille. Ta cible reste privée.`} />}
          {view.phase === "guessing" && !view.isClueGiver && view.myGuess === null && <div className="mt-5"><label htmlFor="longueur-onde-position" className="text-sm font-bold">Place ton aiguille</label><input id="longueur-onde-position" type="range" min={0} max={100} step={1} value={displayGuess ?? 50} disabled={busy || view.myGuess !== null} onChange={(event) => setGuessDraft({ round: view.round, value: Number(event.target.value) })} className="mt-5 h-3 w-full cursor-pointer accent-[var(--table-accent)]" aria-valuetext={`${displayGuess ?? 50} sur 100`} /><div className="mt-2 flex justify-between text-xs font-bold table-muted"><span>{view.axis.leftLabel}</span><output htmlFor="longueur-onde-position" className="rounded-full table-tint px-3 py-1 table-accent">{displayGuess ?? 50}</output><span>{view.axis.rightLabel}</span></div></div>}
          {view.phase === "guessing" && !view.isClueGiver && view.myGuess !== null && <Waiting text="Position envoyée · en attente de la révélation…" />}
          {view.phase === "reveal" && <div key={`lo-r-${view.round}`} className="mt-5 rounded-2xl table-tint p-4 text-center table-accent motion-reveal" style={{ position: "relative" }}>{view.lastPoints !== null && view.lastPoints >= 2 ? <MotionConfetti /> : null}<p className="text-sm font-bold">Cible {view.target} · aiguille {view.myGuess ?? "—"}</p><p className="mt-1 text-2xl font-black">{view.lastPoints} point{view.lastPoints === 1 ? "" : "s"}{view.lastError === null ? "" : ` · ${view.lastError} d'écart`}</p></div>}
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">{view.phase === "clue" && view.isClueGiver && <button type="button" disabled={busy || draftClue.trim().length === 0} onClick={() => void send({ type: "SUBMIT_CLUE", clue: draftClue })} className="rounded-full px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40" data-primary="true">Envoyer</button>}{view.phase === "guessing" && !view.isClueGiver && view.myGuess === null && <button type="button" disabled={busy} onClick={() => void send({ type: "SUBMIT_GUESS", position: displayGuess ?? 50 })} className="rounded-full px-6 py-3 font-bold text-white" data-primary="true">Valider</button>}{view.phase === "reveal" && view.allowedActions.includes("NEXT") && <button type="button" disabled={busy} onClick={() => void send({ type: "NEXT" })} className="rounded-full px-6 py-3 font-bold text-white" data-primary="true">Continuer</button>}</div>
        </section>}

        {view.phase === "finished" && view.result && <ResultPanel result={view.result} />}
      </div>
    </main>
  );
}

function PlayerCard({ label, isGiver }: { label: string; isGiver: boolean }) {
  return <div className="table-player rounded-2xl border border-[var(--line)] table-surface p-4"><p className="font-black">{label}</p><p className="mt-1 text-xs table-muted">{isGiver ? "Donne l'indice" : "Place l'aiguille"}</p></div>;
}

function Waiting({ text }: { text: string }) {
  return <p className="mt-6 rounded-2xl table-tint px-4 py-4 text-center text-sm font-bold table-accent">{text}</p>;
}

function Dial({ axis, target, guess }: { axis: NonNullable<LongueurOndeView["axis"]>; target: number | null; guess: number | null }) {
  const width = 360;
  const height = 220;
  const padding = 28;
  const targetPoint = target === null ? null : positionToDialPoint(target, width, height, padding);
  const guessPoint = guess === null ? null : positionToDialPoint(guess, width, height, padding);
  const center = { x: width / 2, y: height - padding };
  return <div className="table-dial mt-5 rounded-3xl table-surface p-3 sm:p-5"><svg viewBox={`0 0 ${width} ${height}`} className="mx-auto block h-auto w-full max-w-xl" role="img" aria-label={`Axe de ${axis.leftLabel} à ${axis.rightLabel}`}><path d={dialArcPath(width, height, padding)} fill="none" stroke="#413354" strokeWidth="24" strokeLinecap="round" /><path d={dialArcPath(width, height, padding)} fill="none" stroke="#b5e6ff" strokeWidth="2" strokeLinecap="round" />{Array.from({ length: 11 }, (_, i) => { const outer = positionToDialPoint(i * 10, width, height, padding); const inner = positionToDialPoint(i * 10, width, height, padding + 12); return <line key={i} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y + 12} stroke="#cfc1e0" strokeWidth="2" />; })}{targetPoint && <DialNeedle point={targetPoint} center={center} color="#ffe49a" label="Cible" />}{guessPoint && <DialNeedle point={guessPoint} center={center} color="#b5e6ff" label="Aiguille" />}</svg><div className="flex justify-between gap-4 px-2 text-sm font-black"><span>{axis.leftLabel}</span><span className="text-right">{axis.rightLabel}</span></div></div>;
}

function DialNeedle({ point, center, color, label }: { point: { x: number; y: number }; center: { x: number; y: number }; color: string; label: string }) {
  return <g aria-label={label}><line x1={center.x} y1={center.y} x2={point.x} y2={point.y} stroke={color} strokeWidth="5" strokeLinecap="round" /><circle cx={point.x} cy={point.y} r="8" fill={color} stroke="white" strokeWidth="3" /><circle cx={center.x} cy={center.y} r="7" fill={color} /></g>;
}

function ResultPanel({ result }: { result: NonNullable<LongueurOndeResultView> }) {
  const router = useRouter();
  return <section className="mt-6 rounded-[2rem] border border-[var(--line)] table-panel p-6 sm:p-8 motion-finish"><p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: ACCENT }}>{result.outcome === "cooperative" ? "Résultat commun" : "Partie interrompue"}</p><h2 className="mt-3 text-4xl font-black tracking-[-0.05em]">{result.outcome === "cooperative" ? `${result.total} / ${result.maxTotal} points` : "Progression enregistrée"}</h2>{result.percentage !== null && <p className="mt-2 table-muted">{result.percentage} % · {result.missed} manche{result.missed === 1 ? "" : "s"} manquée{result.missed === 1 ? "" : "s"}{result.averageError === null ? "" : ` · ${result.averageError} d'écart moyen`}</p>}<MatchDetails label="Manches"><div className="mt-7 space-y-2">{result.rounds.map((round) => <div key={round.round} className="flex items-center justify-between gap-3 rounded-xl table-surface px-3 py-3 text-sm"><span className="min-w-0 truncate font-bold">{round.leftLabel} <span className="font-normal table-muted">·</span> {round.rightLabel}</span><span className="shrink-0 font-black table-accent">{round.points} pt{round.points === 1 ? "" : "s"}{round.error === null ? "" : ` · ${round.error}`}</span></div>)}</div></MatchDetails><button type="button" onClick={() => router.push("/jeux/longueur-onde")} className="mt-7 rounded-full px-6 py-3 font-bold text-white" data-primary="true">Rejouer</button></section>;
}

function phaseLabel(view: LongueurOndeView, me: string, opponent: string): string {
  if (view.phase === "finished") return "Partie terminée";
  if (view.phase === "reveal") return "La cible se révèle";
  if (view.phase === "clue") return view.isClueGiver ? `${me}, donne un indice` : `${opponent} prépare l'indice`;
  return view.isClueGiver ? `En attente de ${opponent}` : view.myGuess === null ? `${me}, place l'aiguille` : "Position confirmée";
}
