"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LongueurOndeAction, LongueurOndeResultView, LongueurOndeView } from "@/games/longueur-onde/types";
import { dialArcPath, positionToDialPoint } from "@/games/longueur-onde/dial";
import { parseMatchSnapshot, useResourceNetwork } from "@/lib/network-sync";

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

const ACCENT = "#6d28d9";

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
    send,
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

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, []);

  if (error && !match) return <main className="min-h-screen px-5 py-12"><div role="alert" className="mx-auto max-w-xl rounded-2xl bg-red-50 p-5 text-red-700">{error}</div></main>;
  if (!match) return <main className="min-h-screen px-5 py-12"><div className="mx-auto max-w-xl rounded-3xl border border-[var(--line)] bg-white/70 p-8 text-center text-[var(--muted)]">Chargement de la partie…</div></main>;

  const view = match.view;
  const me = view.players[view.mySeat];
  const opponent = view.players[(1 - view.mySeat) as 0 | 1];
  const draftClue = clueDraft.round === view.round ? clueDraft.value : "";
  const draftGuess = guessDraft.round === view.round ? guessDraft.value : 50;
  const remaining = match.deadlineAt ? Math.max(0, Math.ceil((Date.parse(match.deadlineAt) - (now + serverOffset)) / 1000)) : null;
  const displayGuess = view.myGuess ?? (view.phase === "guessing" && !view.isClueGiver ? draftGuess : null);

  return (
    <main className="min-h-screen pb-12">
      <div className="mx-auto max-w-4xl px-4 py-4 sm:px-8 sm:py-7">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => router.push(`/salons/${match.roomId}`)} className="rounded-full px-3 py-2 text-sm font-bold text-[var(--muted)] hover:bg-white">← Salon</button>
          <div className="text-center"><p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: ACCENT }}>À l&apos;unisson</p><p className="font-black">Manche {view.round} / {view.rounds}</p></div>
          <button type="button" onClick={() => void refresh()} className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-sm font-bold">Actualiser</button>
        </header>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <PlayerCard label={opponent.pseudo} isGiver={view.clueSeat === opponent.seat} />
          <div className="rounded-2xl bg-[var(--ink)] p-4 text-center text-white"><p className="text-xs font-bold uppercase tracking-[0.14em] text-white/60">Score commun</p><p className="mt-1 text-3xl font-black">{view.total} <span className="text-base font-bold text-white/60">/ {view.rounds * 4}</span></p><p className="text-xs text-white/70">{view.missed} manche{view.missed === 1 ? "" : "s"} manquée{view.missed === 1 ? "" : "s"}</p></div>
          <PlayerCard label={`${me.pseudo} · toi`} isGiver={view.isClueGiver} />
        </div>

        <div aria-live="polite" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--ink)] px-4 py-3 text-sm font-bold text-white"><span>{phaseLabel(view, me.pseudo, opponent.pseudo)}</span>{remaining !== null && <strong className={remaining <= 5 ? "text-[var(--yellow)]" : "text-white"}>{remaining}s</strong>}</div>
        {error && <p role="alert" className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {view.axis && view.phase !== "finished" && <section className="mt-6 rounded-[2rem] border border-[var(--line)] bg-[var(--card)] p-5 shadow-[0_16px_36px_rgba(20,33,29,0.06)] sm:p-8">
          <div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: ACCENT }}>Axe {view.round}</p></div>
          <Dial axis={view.axis} target={view.target} guess={view.phase === "reveal" ? view.myGuess : displayGuess} />
          {view.clue && (view.phase === "guessing" || view.phase === "reveal") && <p className="mt-5 rounded-2xl border border-[#ddd6fe] bg-[#faf8ff] px-4 py-4 text-center text-lg font-bold text-[#4c1d95]">« {view.clue} »</p>}
          {view.phase === "clue" && view.isClueGiver && <div className="mt-5"><label htmlFor="longueur-onde-clue" className="text-sm font-bold">Ton indice</label><textarea id="longueur-onde-clue" value={draftClue} maxLength={120} onChange={(event) => setClueDraft({ round: view.round, value: event.target.value })} rows={3} placeholder="Un exemple concret, sans donner la position" className="mt-2 w-full resize-none rounded-2xl border border-[var(--line)] bg-white px-4 py-3 leading-6 outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#ddd6fe]" /><div className="mt-2 flex items-center justify-between gap-3 text-xs text-[var(--muted)]"><span>Évite chiffres, liens et codes convenus.</span><span>{draftClue.length} / 120</span></div></div>}
          {view.phase === "clue" && !view.isClueGiver && <Waiting text={`Attends l'indice de ${opponent.pseudo}.`} />}
          {view.phase === "guessing" && view.isClueGiver && <Waiting text={`${opponent.pseudo} place l'aiguille. Ta cible reste privée.`} />}
          {view.phase === "guessing" && !view.isClueGiver && <div className="mt-5"><label htmlFor="longueur-onde-position" className="text-sm font-bold">Place ton aiguille</label><input id="longueur-onde-position" type="range" min={0} max={100} step={1} value={displayGuess ?? 50} disabled={busy || view.myGuess !== null} onChange={(event) => setGuessDraft({ round: view.round, value: Number(event.target.value) })} className="mt-5 h-3 w-full cursor-pointer accent-[#6d28d9]" aria-valuetext={`${displayGuess ?? 50} sur 100`} /><div className="mt-2 flex justify-between text-xs font-bold text-[var(--muted)]"><span>{view.axis.leftLabel}</span><output htmlFor="longueur-onde-position" className="rounded-full bg-[#f1eafe] px-3 py-1 text-[#4c1d95]">{displayGuess ?? 50}</output><span>{view.axis.rightLabel}</span></div></div>}
          {view.phase === "reveal" && <div className="mt-5 rounded-2xl bg-[#f1eafe] p-4 text-center text-[#4c1d95]"><p className="text-sm font-bold">Cible {view.target} · aiguille {view.myGuess ?? "—"}</p><p className="mt-1 text-2xl font-black">{view.lastPoints} point{view.lastPoints === 1 ? "" : "s"}{view.lastError === null ? "" : ` · ${view.lastError} d'écart`}</p></div>}
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">{view.phase === "clue" && view.isClueGiver && <button type="button" disabled={busy || draftClue.trim().length === 0} onClick={() => void send({ type: "SUBMIT_CLUE", clue: draftClue })} className="rounded-full px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40" style={{ backgroundColor: ACCENT }}>Envoyer l&apos;indice</button>}{view.phase === "guessing" && !view.isClueGiver && view.myGuess === null && <button type="button" disabled={busy} onClick={() => void send({ type: "SUBMIT_GUESS", position: displayGuess ?? 50 })} className="rounded-full px-6 py-3 font-bold text-white" style={{ backgroundColor: ACCENT }}>Valider ma position</button>}{view.phase === "reveal" && view.allowedActions.includes("NEXT") && <button type="button" disabled={busy} onClick={() => void send({ type: "NEXT" })} className="rounded-full px-6 py-3 font-bold text-white" style={{ backgroundColor: ACCENT }}>Continuer</button>}</div>
        </section>}

        {view.phase === "finished" && view.result && <ResultPanel result={view.result} />}
        {view.phase !== "finished" && <div className="mt-6 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => void send({ type: "CLAIM_FORFEIT" })} className="rounded-full px-3 py-2 text-xs font-bold text-[var(--muted)]">Signaler une absence</button><button type="button" disabled={busy} onClick={() => void send({ type: "RESIGN" })} className="rounded-full px-3 py-2 text-xs font-bold text-[var(--muted)]">Quitter la partie</button></div>}
      </div>
    </main>
  );
}

function PlayerCard({ label, isGiver }: { label: string; isGiver: boolean }) {
  return <div className="rounded-2xl border border-[var(--line)] bg-white/70 p-4"><p className="font-black">{label}</p><p className="mt-1 text-xs text-[var(--muted)]">{isGiver ? "Donne l'indice" : "Place l'aiguille"}</p></div>;
}

function Waiting({ text }: { text: string }) {
  return <p className="mt-6 rounded-2xl bg-[#f1eafe] px-4 py-4 text-center text-sm font-bold text-[#4c1d95]">{text}</p>;
}

function Dial({ axis, target, guess }: { axis: NonNullable<LongueurOndeView["axis"]>; target: number | null; guess: number | null }) {
  const width = 360;
  const height = 220;
  const padding = 28;
  const targetPoint = target === null ? null : positionToDialPoint(target, width, height, padding);
  const guessPoint = guess === null ? null : positionToDialPoint(guess, width, height, padding);
  const center = { x: width / 2, y: height - padding };
  return <div className="mt-5 rounded-3xl bg-white/75 p-3 sm:p-5"><svg viewBox={`0 0 ${width} ${height}`} className="mx-auto block h-auto w-full max-w-xl" role="img" aria-label={`Axe de ${axis.leftLabel} à ${axis.rightLabel}`}><path d={dialArcPath(width, height, padding)} fill="none" stroke="#e9d5ff" strokeWidth="24" strokeLinecap="round" /><path d={dialArcPath(width, height, padding)} fill="none" stroke="#6d28d9" strokeWidth="2" strokeLinecap="round" />{targetPoint && <DialNeedle point={targetPoint} center={center} color="#111827" label="Cible" />}{guessPoint && <DialNeedle point={guessPoint} center={center} color="#a855f7" label="Aiguille" />}</svg><div className="flex justify-between gap-4 px-2 text-sm font-black"><span>{axis.leftLabel}</span><span className="text-right">{axis.rightLabel}</span></div></div>;
}

function DialNeedle({ point, center, color, label }: { point: { x: number; y: number }; center: { x: number; y: number }; color: string; label: string }) {
  return <g aria-label={label}><line x1={center.x} y1={center.y} x2={point.x} y2={point.y} stroke={color} strokeWidth="5" strokeLinecap="round" /><circle cx={point.x} cy={point.y} r="8" fill={color} stroke="white" strokeWidth="3" /><circle cx={center.x} cy={center.y} r="7" fill={color} /></g>;
}

function ResultPanel({ result }: { result: NonNullable<LongueurOndeResultView> }) {
  return <section className="mt-6 rounded-[2rem] border border-[var(--line)] bg-[var(--card)] p-6 sm:p-8"><p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: ACCENT }}>{result.outcome === "cooperative" ? "Résultat commun" : "Partie interrompue"}</p><h2 className="mt-3 text-4xl font-black tracking-[-0.05em]">{result.outcome === "cooperative" ? `${result.total} / ${result.maxTotal} points` : "Progression enregistrée"}</h2>{result.percentage !== null && <p className="mt-2 text-[var(--muted)]">{result.percentage} % · {result.missed} manche{result.missed === 1 ? "" : "s"} manquée{result.missed === 1 ? "" : "s"}{result.averageError === null ? "" : ` · ${result.averageError} d'écart moyen`}</p>}<div className="mt-7 space-y-2">{result.rounds.map((round) => <div key={round.round} className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-3 text-sm"><span className="min-w-0 truncate font-bold">{round.leftLabel} <span className="font-normal text-[var(--muted)]">·</span> {round.rightLabel}</span><span className="shrink-0 font-black text-[#4c1d95]">{round.points} pt{round.points === 1 ? "" : "s"}{round.error === null ? "" : ` · ${round.error}`}</span></div>)}</div></section>;
}

function phaseLabel(view: LongueurOndeView, me: string, opponent: string): string {
  if (view.phase === "finished") return "Partie terminée";
  if (view.phase === "reveal") return "La cible se révèle";
  if (view.phase === "clue") return view.isClueGiver ? `${me}, donne un indice` : `${opponent} prépare l'indice`;
  return view.isClueGiver ? `En attente de ${opponent}` : view.myGuess === null ? `${me}, place l'aiguille` : "Position confirmée";
}
