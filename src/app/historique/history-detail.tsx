import Link from "next/link";
import { PUBLIC_GAMES } from "@/games/registry";
import { historyOutcomeLabel, historyReasonLabel } from "./history-helpers";
import type { HistoryDetail, HistoryRoundResult } from "./_data";

const GAME_LABELS = new Map(PUBLIC_GAMES.map(({ slug, displayName }) => [slug, displayName]));

function scoreLabel(detail: HistoryDetail): string {
  const { entry } = detail;
  if (entry.outcome === "cooperative") return `Score commun : ${entry.sharedScore ?? "—"}`;
  if (entry.outcome === "abandoned" && entry.score === null && entry.opponentScore === null) return "Aucun gagnant";
  return `${entry.score ?? "—"} – ${entry.opponentScore ?? "—"}`;
}

function CompatibilityRound({ round }: { round: Extract<HistoryRoundResult, { kind: "compatibilite" }> }) {
  const label = (id: string) => round.options.find((option) => option.id === id)?.label ?? "Choix inconnu";
  return <li className="pf-detail-round"><span className="pf-detail-round-top"><span className="pf-detail-round-prompt">{round.prompt}</span><span className="pf-detail-round-tag" data-tone={round.isMatch ? "win" : "draw"}>{round.isMatch ? "Accord" : "Différence"}</span></span><span className="pf-detail-round-meta">{label(round.choices[0])} · {label(round.choices[1])}</span></li>;
}

function LongueurOndeRound({ round }: { round: Extract<HistoryRoundResult, { kind: "longueur-onde" }> }) {
  return <li className="pf-detail-round"><span className="pf-detail-round-top"><span className="pf-detail-round-prompt">{round.leftLabel} · {round.rightLabel}</span><span className="pf-detail-round-tag" data-tone="coop">{round.points} pt{round.points === 1 ? "" : "s"}</span></span><span className="pf-detail-round-meta">{round.clue ? `Indice : « ${round.clue} » · ` : ""}Cible {round.target} · aiguille {round.guess ?? "—"}{round.error === null ? "" : ` · écart ${round.error}`}</span>{round.missedReason && <span className="pf-detail-round-warn">Manche manquée : {round.missedReason === "clue_timeout" ? "indice non fourni à temps" : "position non fournie à temps"}.</span>}</li>;
}

function SkyjoRound({ round }: { round: Extract<HistoryRoundResult, { kind: "skyjo" }> }) {
  return <li className="pf-detail-round"><span className="pf-detail-round-top"><span className="pf-detail-round-prompt">Manche {round.round}</span><span className="pf-detail-round-tag" data-tone="win">{round.clears} colonne{round.clears === 1 ? "" : "s"} effacée{round.clears === 1 ? "" : "s"}</span></span><span className="pf-detail-round-meta">Scores bruts {round.raw[0]} – {round.raw[1]} · scores finaux {round.final[0]} – {round.final[1]} · cumul {round.cumulativeAfter[0]} – {round.cumulativeAfter[1]}</span>{round.penalizedSeat !== null && <span className="pf-detail-round-warn">Pénalité appliquée à la place {round.penalizedSeat + 1}.</span>}</li>;
}

function RoundResult({ round }: { round: HistoryRoundResult }) {
  if (round.kind === "compatibilite") return <CompatibilityRound round={round} />;
  if (round.kind === "longueur-onde") return <LongueurOndeRound round={round} />;
  return <SkyjoRound round={round} />;
}

export function HistoryDetailView({ detail }: { detail: HistoryDetail }) {
  const { entry } = detail;
  const gameLabel = GAME_LABELS.get(entry.gameSlug) ?? entry.gameSlug;
  return (
    <main className="pf-detail">
      <div className="pf-detail-inner">
        <Link href="/profil" className="pf-detail-back">← Mon profil</Link>
        <p className="pf-detail-kicker">{gameLabel}</p>
        <h1 className="pf-detail-title">{historyOutcomeLabel(entry.outcome)}</h1>
        <p className="pf-detail-sub">Contre {entry.opponentPseudo} · <time dateTime={entry.endedAt}>{new Date(entry.endedAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</time></p>

        <section className="pf-detail-card">
          <div className="pf-detail-score-row">
            <div>
              <p className="pf-detail-label">Résultat enregistré pour toi</p>
              <p className="pf-detail-score">{scoreLabel(detail)}</p>
            </div>
            <span className="pf-detail-badge">{entry.outcome === "abandoned" ? "Sans gagnant" : historyOutcomeLabel(entry.outcome)}</span>
          </div>
          <p className="pf-detail-reason">{historyReasonLabel(detail.reason, entry.outcome)}</p>
          <div className="pf-detail-grid">
            <div className="pf-detail-cell"><p className="pf-detail-label">Ton résultat</p><p className="pf-detail-value">{entry.score ?? (entry.outcome === "cooperative" ? entry.sharedScore ?? "—" : "—")}</p></div>
            <div className="pf-detail-cell"><p className="pf-detail-label">{entry.opponentPseudo}</p><p className="pf-detail-value">{entry.opponentScore ?? (entry.outcome === "cooperative" ? entry.sharedScore ?? "—" : "—")}</p></div>
          </div>
        </section>

        <section className="pf-detail-card">
          <div className="pf-detail-rounds-head">
            <h2 className="pf-detail-rounds-title">Détail des manches</h2>
            <span className="pf-detail-rounds-count">{detail.roundResults.length} enregistrée{detail.roundResults.length === 1 ? "" : "s"}</span>
          </div>
          {detail.roundResultsAvailable
            ? <ul className="pf-detail-rounds">{detail.roundResults.map((round, index) => <RoundResult key={`${round.kind}-${"round" in round ? round.round : "questionId" in round ? round.questionId : index}`} round={round} />)}</ul>
            : <p className="pf-detail-rounds-empty">Le détail de manche n&apos;est pas disponible pour cette partie sans exposer l&apos;état privé ou les réponses secrètes.</p>}
        </section>

        {(detail.rulesVersion || detail.engineVersion) && <p className="pf-detail-versions">Règles {detail.rulesVersion ?? "—"} · moteur {detail.engineVersion ?? "—"}{detail.stateSchemaVersion ? ` · schéma ${detail.stateSchemaVersion}` : ""}</p>}
      </div>
    </main>
  );
}
