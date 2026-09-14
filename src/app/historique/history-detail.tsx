import Link from "next/link";
import { historyOutcomeLabel, historyReasonLabel } from "./history-helpers";
import type { HistoryDetail, HistoryRoundResult } from "./_data";

function scoreLabel(detail: HistoryDetail): string {
  const { entry } = detail;
  if (entry.outcome === "cooperative") return `Score commun : ${entry.sharedScore ?? "—"}`;
  if (entry.outcome === "abandoned" && entry.score === null && entry.opponentScore === null) return "Aucun gagnant";
  return `${entry.score ?? "—"} – ${entry.opponentScore ?? "—"}`;
}

function CompatibilityRound({ round }: { round: Extract<HistoryRoundResult, { kind: "compatibilite" }> }) {
  const label = (id: string) => round.options.find((option) => option.id === id)?.label ?? "Choix inconnu";
  return <li className="rounded-2xl bg-white/70 p-4"><div className="flex items-start justify-between gap-3"><p className="font-bold">{round.prompt}</p><span className="shrink-0 font-black text-[var(--green)]">{round.isMatch ? "Accord" : "Différence"}</span></div><p className="mt-2 text-sm text-[var(--muted)]">{label(round.choices[0])} · {label(round.choices[1])}</p></li>;
}

function LongueurOndeRound({ round }: { round: Extract<HistoryRoundResult, { kind: "longueur-onde" }> }) {
  return <li className="rounded-2xl bg-white/70 p-4"><div className="flex items-start justify-between gap-3"><p className="font-bold">{round.leftLabel} · {round.rightLabel}</p><span className="shrink-0 font-black text-[#4c1d95]">{round.points} pt{round.points === 1 ? "" : "s"}</span></div><p className="mt-2 text-sm text-[var(--muted)]">{round.clue ? `Indice : « ${round.clue} » · ` : ""}Cible {round.target} · aiguille {round.guess ?? "—"}{round.error === null ? "" : ` · écart ${round.error}`}</p>{round.missedReason && <p className="mt-2 text-xs font-bold text-amber-800">Manche manquée : {round.missedReason === "clue_timeout" ? "indice non fourni à temps" : "position non fournie à temps"}.</p>}</li>;
}

function SkyjoRound({ round }: { round: Extract<HistoryRoundResult, { kind: "skyjo" }> }) {
  return <li className="rounded-2xl bg-white/70 p-4"><div className="flex items-start justify-between gap-3"><p className="font-bold">Manche {round.round}</p><span className="text-sm font-black text-[var(--green)]">{round.clears} colonne{round.clears === 1 ? "" : "s"} effacée{round.clears === 1 ? "" : "s"}</span></div><p className="mt-2 text-sm text-[var(--muted)]">Scores bruts {round.raw[0]} – {round.raw[1]} · scores finaux {round.final[0]} – {round.final[1]} · cumul {round.cumulativeAfter[0]} – {round.cumulativeAfter[1]}</p>{round.penalizedSeat !== null && <p className="mt-2 text-xs font-bold text-amber-800">Pénalité appliquée à la place {round.penalizedSeat + 1}.</p>}</li>;
}

function RoundResult({ round }: { round: HistoryRoundResult }) {
  if (round.kind === "compatibilite") return <CompatibilityRound round={round} />;
  if (round.kind === "longueur-onde") return <LongueurOndeRound round={round} />;
  return <SkyjoRound round={round} />;
}

export function HistoryDetailView({ detail }: { detail: HistoryDetail }) {
  const { entry } = detail;
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-4xl px-5 pb-16 pt-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/historique" className="text-sm font-bold text-[var(--muted)]">← Historique</Link><Link href={`/historique/duo/${entry.opponentId}`} className="text-sm font-bold text-[var(--green)]">Notre historique</Link></div>
        <p className="mt-8 text-sm font-bold uppercase tracking-[0.16em] text-[var(--orange)]">{entry.gameSlug}</p>
        <h1 className="mt-3 text-5xl font-black tracking-[-0.06em]">{historyOutcomeLabel(entry.outcome)}</h1>
        <p className="mt-3 text-lg text-[var(--muted)]">Contre {entry.opponentPseudo} · <time dateTime={entry.endedAt}>{new Date(entry.endedAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</time></p>

        <section className="mt-8 rounded-[1.75rem] border border-[var(--line)] bg-[var(--card)] p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold text-[var(--muted)]">Résultat enregistré pour toi</p><p className="mt-2 text-4xl font-black">{scoreLabel(detail)}</p></div><span className="rounded-full bg-[var(--green)]/10 px-3 py-1 text-sm font-bold text-[var(--green-dark)]">{entry.outcome === "abandoned" ? "Sans gagnant" : historyOutcomeLabel(entry.outcome)}</span></div>
          <p className="mt-5 rounded-2xl bg-[var(--paper-deep)] px-4 py-3 text-sm font-bold text-[var(--muted)]">{historyReasonLabel(detail.reason, entry.outcome)}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-[var(--paper)] p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">Ton résultat</p><p className="mt-1 font-black">{entry.score ?? (entry.outcome === "cooperative" ? entry.sharedScore ?? "—" : "—")}</p></div><div className="rounded-2xl bg-[var(--paper)] p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">{entry.opponentPseudo}</p><p className="mt-1 font-black">{entry.opponentScore ?? (entry.outcome === "cooperative" ? entry.sharedScore ?? "—" : "—")}</p></div></div>
        </section>

        <section className="mt-6 rounded-[1.75rem] border border-[var(--line)] bg-white/70 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3"><h2 className="text-2xl font-black">Détail des manches</h2><span className="text-sm font-bold text-[var(--muted)]">{detail.roundResults.length} enregistrée{detail.roundResults.length === 1 ? "" : "s"}</span></div>
          {detail.roundResultsAvailable ? <ul className="mt-5 space-y-3">{detail.roundResults.map((round, index) => <RoundResult key={`${round.kind}-${"round" in round ? round.round : "questionId" in round ? round.questionId : index}`} round={round} />)}</ul> : <p className="mt-4 text-sm leading-6 text-[var(--muted)]">Le détail de manche n&apos;est pas disponible pour cette partie sans exposer l&apos;état privé ou les réponses secrètes.</p>}
        </section>

        {(detail.rulesVersion || detail.engineVersion) && <p className="mt-5 text-xs text-[var(--muted)]">Règles {detail.rulesVersion ?? "—"} · moteur {detail.engineVersion ?? "—"}{detail.stateSchemaVersion ? ` · schéma ${detail.stateSchemaVersion}` : ""}</p>}
      </div>
    </main>
  );
}
