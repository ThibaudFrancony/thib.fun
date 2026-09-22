"use client";

import { useCallback, useEffect, useState } from "react";
import { MatchToolbar, MatchDetails } from "@/components/match-toolbar";
import { useRouter } from "next/navigation";
import type { CompatibiliteAction, CompatibiliteView, CompatibilityRound } from "@/games/compatibilite/types";
import { parseMatchSnapshot, useResourceNetwork } from "@/lib/network-sync";

type MatchResponse = {
  matchId: string;
  roomId: string;
  status: string;
  version: number;
  phaseId: string;
  deadlineAt: string | null;
  serverNow: string;
  view: CompatibiliteView;
};

const ACCENT = "var(--table-accent)";
const CATEGORY_LABELS: Record<CompatibiliteView["category"], string> = {
  quotidien: "Quotidien",
  absurde: "Absurde",
  amitie: "Amitié",
  couple: "Couple",
};

export function CompatibiliteMatch({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<{ questionId: string; optionId: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const onSnapshotApplied = useCallback((next: MatchResponse) => {
    setSelected((current) => next.view.question && next.view.question.itemId === current?.questionId && !next.view.mySubmitted ? current : null);
  }, []);

  const {
    snapshot: match,
    error,
    busy,
    serverOffset,
    refresh,
    send: networkSend,
  } = useResourceNetwork<MatchResponse, CompatibiliteAction>({
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
    onSnapshotApplied,
  });

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, []);

  async function send(action: CompatibiliteAction) {
    const next = await networkSend(action);
    if (next) setSelected(null);
  }

  if (error && !match) return <main className="table-page table-compatibilite min-h-screen px-5 py-12"><div role="alert" className="mx-auto max-w-xl rounded-2xl table-error p-5">{error}</div></main>;
  if (!match) return <main className="table-page table-compatibilite min-h-screen px-5 py-12"><div className="mx-auto max-w-xl rounded-3xl border border-[var(--line)] table-surface p-8 text-center table-muted">Chargement de la partie…</div></main>;

  const view = match.view;
  const me = view.players[view.mySeat];
  const opponent = view.players[(1 - view.mySeat) as 0 | 1];
  const remaining = match.deadlineAt ? Math.max(0, Math.ceil((Date.parse(match.deadlineAt) - (now + serverOffset)) / 1000)) : null;
  const selectedId = selected && selected.questionId === view.question?.itemId ? selected.optionId : null;

  return (
    <main className="table-page table-compatibilite min-h-screen pb-12 play-screen" data-phase={view.phase}>
      <div className="table-shell play-shell">
        <MatchToolbar title="Même réponse ?" progress={`${view.questionIndex + 1}/${view.questionCount}`} busy={busy} onBack={() => router.push(`/salons/${match.roomId}`)} onRefresh={() => void refresh()} onResign={view.phase === "finished" ? undefined : () => void send({ type: "RESIGN" })}>
          <div className="table-scoreboard table-scoreboard--coop">
          <ScoreCard label={opponent.pseudo} submitted={opponent.submitted} />
          <div className="table-total"><p className="text-xs font-bold uppercase tracking-[0.14em] text-white/60">Progression</p><p className="mt-1 text-3xl font-black">{view.compared} <span className="text-base font-bold text-white/60">/ {view.questionCount}</span></p><p className="text-xs text-white/70">{view.matches} accord{view.matches === 1 ? "" : "s"}</p></div>
          <ScoreCard label={`${me.pseudo} · toi`} submitted={me.submitted} />
        </div>
        <p>{CATEGORY_LABELS[view.category]}</p></MatchToolbar>
        <div aria-live="polite" className="table-status" data-urgent={remaining !== null && remaining <= 3}>
          <span>{phaseLabel(view, me.pseudo, opponent.pseudo)}</span>
          {remaining !== null && view.phase === "reveal" && <strong className={remaining <= 3 ? "text-[var(--yellow)]" : "text-white"}>{remaining}s</strong>}
        </div>
        {error && <p role="alert" className="mt-3 rounded-2xl table-error px-4 py-3 text-sm">{error}</p>}

        {view.question && view.phase !== "finished" && (
          <section className="mt-6 rounded-[2rem] border border-[var(--line)] table-panel p-5 shadow-[0_16px_36px_rgba(20,33,29,0.06)] sm:p-8">

            <h1 className="mt-5 text-3xl font-black leading-tight tracking-[-0.04em] sm:text-4xl">{view.question.prompt}</h1>
            {view.phase === "answering" && !view.mySubmitted && <div role="radiogroup" aria-label="Tes choix" className="mt-7 grid gap-3 sm:grid-cols-2">{view.question.options.map((option) => <button key={option.id} type="button" role="radio" aria-checked={selectedId === option.id} disabled={busy} onClick={() => setSelected({ questionId: view.question!.itemId, optionId: option.id })} className={`rounded-2xl border px-4 py-4 text-left font-bold transition ${selectedId === option.id ? "table-border-accent table-tint table-accent ring-2 ring-[var(--table-accent)]" : "border-[var(--line)] table-surface hover:border-[var(--table-accent)]"}`}>{option.label}</button>)}</div>}
            {view.phase === "answering" && view.mySubmitted && <p className="mt-7 rounded-2xl table-tint px-4 py-4 text-center text-sm font-bold table-accent">Ton choix est enregistré. En attente de {opponent.pseudo}…</p>}
            {view.phase === "reveal" && <div className="mt-7 grid gap-3 sm:grid-cols-2"><RevealChoice label={me.pseudo} optionId={view.myChoice} options={view.question.options} /><RevealChoice label={opponent.pseudo} optionId={view.opponentChoice} options={view.question.options} /></div>}
            <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
              {view.phase === "answering" && view.allowedActions.includes("SKIP_QUESTION") && <button type="button" disabled={busy} onClick={() => void send({ type: "SKIP_QUESTION" })} className="rounded-full border border-[var(--line)] table-surface px-5 py-3 text-sm font-bold table-muted hover:text-[var(--ink)]">Passer ({view.skipsRemaining})</button>}
              {view.phase === "answering" && view.allowedActions.includes("SUBMIT_CHOICE") && <button type="button" disabled={busy || selectedId === null} onClick={() => { if (selectedId) void send({ type: "SUBMIT_CHOICE", optionId: selectedId }); }} className="rounded-full px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40" data-primary="true">Valider</button>}
              {view.phase === "reveal" && view.allowedActions.includes("NEXT") && <button type="button" disabled={busy} onClick={() => void send({ type: "NEXT" })} className="ml-auto rounded-full px-6 py-3 font-bold text-white" data-primary="true">Continuer</button>}
            </div>

          </section>
        )}

        {view.phase === "finished" && view.result && <ResultPanel result={view.result} />}
      </div>
    </main>
  );
}

function ScoreCard({ label, submitted }: { label: string; submitted: boolean }) {
  return <div className="table-player rounded-2xl border border-[var(--line)] table-surface p-4"><p className="font-black">{label}</p><p className="mt-1 text-xs table-muted">{submitted ? "Choix confirmé" : "Choix en attente"}</p></div>;
}

function RevealChoice({ label, optionId, options }: { label: string; optionId: string | null; options: NonNullable<CompatibiliteView["question"]>["options"] }) {
  const option = options.find((item) => item.id === optionId);
  return <div className={`rounded-2xl border p-4 ${optionId ? "table-border-accent table-tint" : "border-[var(--line)] table-surface"}`}><p className="text-xs font-black uppercase tracking-[0.12em] table-muted">{label}</p><p className="mt-2 font-black">{option?.label ?? "Pas de choix"}</p></div>;
}

function ResultPanel({ result }: { result: NonNullable<CompatibiliteView["result"]> }) {
  const router = useRouter();
  return <section className="mt-6 rounded-[2rem] border border-[var(--line)] table-panel p-6 sm:p-8"><p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: ACCENT }}>{result.outcome === "cooperative" ? "Résultat commun" : "Partie interrompue"}</p><h2 className="mt-3 text-4xl font-black tracking-[-0.05em]">{result.sharedScore === null ? "Progression enregistrée" : `${result.sharedScore} % en commun`}</h2><p className="mt-2 table-muted">{result.matches} choix en commun sur {result.compared} comparés{result.skipped ? ` · ${result.skipped} passé${result.skipped === 1 ? "" : "s"}` : ""}</p><MatchDetails label="Manches"><div className="mt-7 space-y-2">{result.rounds.map((round) => <RoundLine key={round.questionId} round={round} />)}</div></MatchDetails><button type="button" onClick={() => router.push("/jeux/compatibilite")} className="mt-7 rounded-full px-6 py-3 font-bold text-white" data-primary="true">Rejouer</button></section>;
}

function RoundLine({ round }: { round: CompatibilityRound }) {
  const first = round.options.find((option) => option.id === round.choices[0])?.label;
  const second = round.options.find((option) => option.id === round.choices[1])?.label;
  return <div className="flex items-start gap-3 rounded-xl table-surface px-3 py-3 text-sm"><span aria-label={round.isMatch ? "Accord" : "Différence"} className="mt-0.5 font-black" style={{ color: round.isMatch ? "#b9f9df" : "#ffe49a" }}>{round.isMatch ? "✓" : "·"}</span><div><p className="font-bold">{round.prompt}</p><p className="mt-1 text-xs table-muted">{first} · {second}</p></div></div>;
}

function phaseLabel(view: CompatibiliteView, me: string, opponent: string): string {
  if (view.phase === "reveal") return view.opponentChoice && view.myChoice && view.opponentChoice === view.myChoice ? "Vous avez choisi pareil" : "Vos choix se dévoilent";
  if (view.phase === "finished") return "Partie terminée";
  if (view.mySubmitted) return `En attente de ${opponent}`;
  if (view.opponentSubmitted) return `${opponent} a répondu`;
  return `${me}, choisis une option`;
}
