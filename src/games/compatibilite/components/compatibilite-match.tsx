"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CompatibiliteAction, CompatibiliteView, CompatibilityRound } from "@/games/compatibilite/types";
import { useUserRealtime } from "@/lib/realtime";

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

const ACCENT = "#6d28d9";
const CATEGORY_LABELS: Record<CompatibiliteView["category"], string> = {
  quotidien: "Quotidien",
  absurde: "Absurde",
  amitie: "Amitié",
  couple: "Couple",
};

export function CompatibiliteMatch({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [match, setMatch] = useState<MatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<{ questionId: string; optionId: string } | null>(null);
  const [serverOffset, setServerOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async (): Promise<MatchResponse | null> => {
    const response = await fetch(`/api/matches/${matchId}`, { cache: "no-store" });
    const data = await response.json().catch(() => null) as MatchResponse | { error?: { message?: string } } | null;
    if (!response.ok || !data || !("view" in data)) {
      setError((data as { error?: { message?: string } } | null)?.error?.message ?? "Partie introuvable.");
      return null;
    }
    const next = data as MatchResponse;
    setMatch(next);
    setServerOffset(Date.parse(next.serverNow) - Date.now());
    setSelected((current) => next.view.question && next.view.question.itemId === current?.questionId && !next.view.mySubmitted ? current : null);
    return next;
  }, [matchId]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const poll = window.setInterval(() => void refresh(), 2500);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(poll);
      window.clearInterval(clock);
    };
  }, [refresh]);
  useUserRealtime([{ event: "match.updated", id: matchId, onInvalidate: () => void refresh() }]);

  async function send(action: CompatibiliteAction) {
    if (!match || busy) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/matches/${matchId}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ commandId: crypto.randomUUID(), expectedVersion: match.version, action }),
    });
    const data = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    if (!response.ok) setError(data?.error?.message ?? "La commande n'a pas été acceptée.");
    else setSelected(null);
    await refresh();
    setBusy(false);
  }

  if (error && !match) return <main className="min-h-screen px-5 py-12"><div role="alert" className="mx-auto max-w-xl rounded-2xl bg-red-50 p-5 text-red-700">{error}</div></main>;
  if (!match) return <main className="min-h-screen px-5 py-12"><div className="mx-auto max-w-xl rounded-3xl border border-[var(--line)] bg-white/70 p-8 text-center text-[var(--muted)]">Chargement de la partie…</div></main>;

  const view = match.view;
  const me = view.players[view.mySeat];
  const opponent = view.players[(1 - view.mySeat) as 0 | 1];
  const remaining = match.deadlineAt ? Math.max(0, Math.ceil((Date.parse(match.deadlineAt) - (now + serverOffset)) / 1000)) : null;
  const selectedId = selected && selected.questionId === view.question?.itemId ? selected.optionId : null;

  return (
    <main className="min-h-screen pb-12">
      <div className="mx-auto max-w-4xl px-4 py-4 sm:px-8 sm:py-7">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => router.push(`/salons/${match.roomId}`)} className="rounded-full px-3 py-2 text-sm font-bold text-[var(--muted)] hover:bg-white">← Salon</button>
          <div className="text-center"><p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: ACCENT }}>Même réponse ?</p><p className="font-black">{CATEGORY_LABELS[view.category]}</p></div>
          <button type="button" onClick={() => void refresh()} className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-sm font-bold">Actualiser</button>
        </header>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ScoreCard label={opponent.pseudo} submitted={opponent.submitted} />
          <div className="rounded-2xl bg-[var(--ink)] p-4 text-center text-white"><p className="text-xs font-bold uppercase tracking-[0.14em] text-white/60">Progression</p><p className="mt-1 text-3xl font-black">{view.compared} <span className="text-base font-bold text-white/60">/ {view.questionCount}</span></p><p className="text-xs text-white/70">{view.matches} accord{view.matches === 1 ? "" : "s"}</p></div>
          <ScoreCard label={`${me.pseudo} · toi`} submitted={me.submitted} />
        </div>

        <div aria-live="polite" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--ink)] px-4 py-3 text-sm font-bold text-white">
          <span>{phaseLabel(view, me.pseudo, opponent.pseudo)}</span>
          {remaining !== null && view.phase === "reveal" && <strong className={remaining <= 3 ? "text-[var(--yellow)]" : "text-white"}>{remaining}s</strong>}
        </div>
        {error && <p role="alert" className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {view.question && view.phase !== "finished" && (
          <section className="mt-6 rounded-[2rem] border border-[var(--line)] bg-[var(--card)] p-5 shadow-[0_16px_36px_rgba(20,33,29,0.06)] sm:p-8">
            <div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: ACCENT }}>Question {view.questionIndex + 1} / {view.questionCount}</p><span className="text-xs font-bold text-[var(--muted)]">{view.skipsRemaining} passe{view.skipsRemaining === 1 ? "" : "s"} restante{view.skipsRemaining === 1 ? "" : "s"}</span></div>
            <h1 className="mt-5 text-3xl font-black leading-tight tracking-[-0.04em] sm:text-4xl">{view.question.prompt}</h1>
            {view.phase === "answering" && !view.mySubmitted && <div role="radiogroup" aria-label="Tes choix" className="mt-7 grid gap-3 sm:grid-cols-2">{view.question.options.map((option) => <button key={option.id} type="button" role="radio" aria-checked={selectedId === option.id} disabled={busy} onClick={() => setSelected({ questionId: view.question!.itemId, optionId: option.id })} className={`rounded-2xl border px-4 py-4 text-left font-bold transition ${selectedId === option.id ? "border-[#6d28d9] bg-[#f1eafe] text-[#4c1d95] ring-2 ring-[#c4b5fd]" : "border-[var(--line)] bg-white hover:border-[#a78bfa]"}`}>{option.label}</button>)}</div>}
            {view.phase === "answering" && view.mySubmitted && <p className="mt-7 rounded-2xl bg-[#f1eafe] px-4 py-4 text-center text-sm font-bold text-[#4c1d95]">Ton choix est enregistré. En attente de {opponent.pseudo}…</p>}
            {view.phase === "reveal" && <div className="mt-7 grid gap-3 sm:grid-cols-2"><RevealChoice label={me.pseudo} optionId={view.myChoice} options={view.question.options} /><RevealChoice label={opponent.pseudo} optionId={view.opponentChoice} options={view.question.options} /></div>}
            <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
              {view.phase === "answering" && view.allowedActions.includes("SKIP_QUESTION") && <button type="button" disabled={busy} onClick={() => void send({ type: "SKIP_QUESTION" })} className="rounded-full border border-[var(--line)] bg-white px-5 py-3 text-sm font-bold text-[var(--muted)] hover:text-[var(--ink)]">Passer cette question</button>}
              {view.phase === "answering" && view.allowedActions.includes("SUBMIT_CHOICE") && <button type="button" disabled={busy || selectedId === null} onClick={() => { if (selectedId) void send({ type: "SUBMIT_CHOICE", optionId: selectedId }); }} className="rounded-full px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40" style={{ backgroundColor: ACCENT }}>Confirmer mon choix</button>}
              {view.phase === "reveal" && view.allowedActions.includes("NEXT") && <button type="button" disabled={busy} onClick={() => void send({ type: "NEXT" })} className="ml-auto rounded-full px-6 py-3 font-bold text-white" style={{ backgroundColor: ACCENT }}>Continuer</button>}
            </div>
            {view.phase === "answering" && view.skipsRemaining === 0 && <p className="mt-3 text-xs text-[var(--muted)]">Les trois passes ont été utilisées. Cette question compte dès que vous avez répondu tous les deux.</p>}
          </section>
        )}

        {view.phase === "finished" && view.result && <ResultPanel result={view.result} />}
        {view.phase !== "finished" && <div className="mt-6 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => void send({ type: "CLAIM_FORFEIT" })} className="rounded-full px-3 py-2 text-xs font-bold text-[var(--muted)]">Signaler une absence</button><button type="button" disabled={busy} onClick={() => void send({ type: "RESIGN" })} className="rounded-full px-3 py-2 text-xs font-bold text-[var(--muted)]">Quitter la partie</button></div>}
      </div>
    </main>
  );
}

function ScoreCard({ label, submitted }: { label: string; submitted: boolean }) {
  return <div className="rounded-2xl border border-[var(--line)] bg-white/70 p-4"><p className="font-black">{label}</p><p className="mt-1 text-xs text-[var(--muted)]">{submitted ? "Choix confirmé" : "Choix en attente"}</p></div>;
}

function RevealChoice({ label, optionId, options }: { label: string; optionId: string | null; options: NonNullable<CompatibiliteView["question"]>["options"] }) {
  const option = options.find((item) => item.id === optionId);
  return <div className={`rounded-2xl border p-4 ${optionId ? "border-[#c4b5fd] bg-[#f1eafe]" : "border-[var(--line)] bg-white"}`}><p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p><p className="mt-2 font-black">{option?.label ?? "Pas de choix"}</p></div>;
}

function ResultPanel({ result }: { result: NonNullable<CompatibiliteView["result"]> }) {
  return <section className="mt-6 rounded-[2rem] border border-[var(--line)] bg-[var(--card)] p-6 sm:p-8"><p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: ACCENT }}>{result.outcome === "cooperative" ? "Résultat commun" : "Partie interrompue"}</p><h2 className="mt-3 text-4xl font-black tracking-[-0.05em]">{result.sharedScore === null ? "Progression enregistrée" : `${result.sharedScore} % en commun`}</h2><p className="mt-2 text-[var(--muted)]">{result.matches} choix en commun sur {result.compared} comparés{result.skipped ? ` · ${result.skipped} passé${result.skipped === 1 ? "" : "s"}` : ""}</p><div className="mt-7 space-y-2">{result.rounds.map((round) => <RoundLine key={round.questionId} round={round} />)}</div></section>;
}

function RoundLine({ round }: { round: CompatibilityRound }) {
  const first = round.options.find((option) => option.id === round.choices[0])?.label;
  const second = round.options.find((option) => option.id === round.choices[1])?.label;
  return <div className="flex items-start gap-3 rounded-xl bg-white/70 px-3 py-3 text-sm"><span aria-label={round.isMatch ? "Accord" : "Différence"} className="mt-0.5 font-black" style={{ color: round.isMatch ? "#16745d" : "#8b5e3c" }}>{round.isMatch ? "✓" : "·"}</span><div><p className="font-bold">{round.prompt}</p><p className="mt-1 text-xs text-[var(--muted)]">{first} · {second}</p></div></div>;
}

function phaseLabel(view: CompatibiliteView, me: string, opponent: string): string {
  if (view.phase === "reveal") return view.opponentChoice && view.myChoice && view.opponentChoice === view.myChoice ? "Vous avez choisi pareil" : "Vos choix se dévoilent";
  if (view.phase === "finished") return "Partie terminée";
  if (view.mySubmitted) return `En attente de ${opponent}`;
  if (view.opponentSubmitted) return `${opponent} a répondu`;
  return `${me}, choisis une option`;
}
