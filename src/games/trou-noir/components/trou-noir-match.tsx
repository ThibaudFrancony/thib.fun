"use client";

import { useCallback, useEffect, useState } from "react";
import { MatchToolbar, MatchDetails } from "@/components/match-toolbar";
import { useRouter } from "next/navigation";
import type { TrouNoirAction, TrouNoirView } from "@/games/trou-noir/types";
import { parseMatchSnapshot, useResourceNetwork } from "@/lib/network-sync";

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
  view: TrouNoirView;
};

const CATEGORY_LABELS: Record<string, string> = {
  culture: "Culture",
  "histoire-geo": "Histoire-Géo",
  cuisine: "Cuisine",
  sport: "Sport",
  sciences: "Sciences",
};

export function TrouNoirMatch({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [now, setNow] = useState(0);

  const onSnapshotApplied = useCallback((next: MatchResponse) => {
    if (next.view.phase !== "answering") setDraft("");
  }, []);

  const {
    snapshot: match,
    error,
    busy,
    serverOffset,
    refresh,
    send,
  } = useResourceNetwork<MatchResponse, TrouNoirAction>({
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
    const clockTimer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clockTimer);
  }, []);

  const remaining = match?.deadlineAt
    ? Math.max(0, Math.ceil((Date.parse(match.deadlineAt) - (now + serverOffset)) / 1000))
    : null;
  const expired = match?.deadlineAt ? Date.parse(match.deadlineAt) - (now + serverOffset) <= 0 : false;

  if (error && !match) {
    return (
      <main className="table-page table-trou-noir table-state-page">
        <div role="alert" className="table-error table-state-message">{error}</div>
      </main>
    );
  }
  if (!match) {
    return (
      <main className="table-page table-trou-noir table-state-page">
        <div className="table-panel table-loading-panel">Chargement de la partie…</div>
      </main>
    );
  }
  const view = match.view;
  const me = view.players[view.mySeat];
  const opponent = view.players[(1 - view.mySeat) as 0 | 1];
  const isMyTurn = view.phase === "answering" && view.question?.addresseeIsMe === true;

  return (
    <main className="table-page table-trou-noir table-match-page play-screen" data-phase={view.phase}>
      <div className="table-content table-match-content play-shell">
        <MatchToolbar title="Chute libre" progress={`${Math.min(view.round, view.maxRounds)}/${view.maxRounds}`} busy={busy} onBack={() => router.push(`/salons/${match.roomId}`)} onRefresh={() => void refresh()} onResign={view.phase === "finished" ? undefined : () => void send({ type: "RESIGN" })}>
          <div className="table-scoreboard">
          {[me, opponent].map((player) => (
            <div key={player.id} className="table-score-card" data-self={player.seat === view.mySeat} data-active={player.active}>
              <div className="table-score-topline">
                <span className="table-player-name">
                  {player.pseudo}
                  {player.seat === view.mySeat ? " · toi" : ""}
                </span>
                <span className="table-player-score">{player.reserve}</span>
              </div>
              <div aria-hidden="true" style={{ marginTop: "0.6rem", height: "8px", borderRadius: "999px", background: "#ffffff1f" }}>
                <div
                  style={{
                    width: `${player.reserve}%`,
                    height: "100%",
                    borderRadius: "999px",
                    background: player.reserve > 30 ? "#b9f9df" : "#ffe49a",
                    transition: "width 300ms ease",
                  }}
                />
              </div>
              <p className="table-score-status">
                Réserve · {player.correct} bonne{player.correct > 1 ? "s" : ""} · {player.incorrect} manquée{player.incorrect > 1 ? "s" : ""}
              </p>
            </div>
          ))}
        </div>
        </MatchToolbar>
        <div className="play-resources" aria-label="Réserves">{view.players.map((player) => <span key={player.id}>{player.pseudo} <strong>{player.reserve}</strong></span>)}</div><div aria-live="polite" aria-atomic="true" className="table-status-bar" data-urgent={remaining !== null && remaining <= 10}>
          <span>{phaseLabel(view, isMyTurn, expired)}</span>
          {remaining !== null && view.phase !== "finished" && <span className="table-timer">{remaining}s</span>}
        </div>
        {error && <p role="alert" className="table-error" style={{ marginTop: "0.8rem" }}>{error}</p>}

        {(view.phase === "answering" || view.phase === "judging") && (
          <section className="table-panel table-side-panel">
            {view.question ? (
              <>
                <p className="table-kicker table-kicker-warm">
                  {CATEGORY_LABELS[view.question.category] ?? view.question.category} · niveau {view.question.difficulty}
                </p>
                <h2 className="table-target-title">{view.question.prompt}</h2>
                {view.phase === "answering" && isMyTurn && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (draft.trim()) void send({ type: "SUBMIT_ANSWER", answer: draft.slice(0, 240) });
                    }}
                  >
                    <label className="sr-only" htmlFor="tn-answer">Ta réponse</label>
                    <input
                      id="tn-answer"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      maxLength={240}
                      autoComplete="off"
                      placeholder="Écris ta réponse…"
                      className="table-input"
                    />
                    <button disabled={busy || !draft.trim()} type="submit" className="table-primary-button">
                      {busy ? "Envoi…" : "Valider"}
                    </button>
                  </form>
                )}
              </>
            ) : (
              <p className="table-panel-note">Préparation de la question…</p>
            )}
          </section>
        )}

        {view.phase === "reveal" && view.reveal && (
          <section className="table-panel table-side-panel">
            <p className="table-kicker table-kicker-warm">Révélation</p>
            <h2 className="table-panel-title">{view.reveal.timeout ? "Temps écoulé" : view.reveal.verdict === "accept" ? "Bonne réponse" : "Réponse refusée"}</h2>
            <p className="table-panel-note">Réponse attendue : {view.reveal.expectedAnswer}</p>
            <MatchDetails label="Explication">{!view.reveal.timeout && (
              <p className="table-panel-note">Réponse saisie : « {view.reveal.submittedAnswer} »</p>
            )}<p>{view.reveal.explanation}</p></MatchDetails>

            {view.reveal.contest?.status === "pending" && (
              <p className="table-panel-note">
                {view.reveal.contest.requesterIsMe
                  ? "Contestation envoyée. Ton adversaire tranche."
                  : "Ton adversaire conteste. À toi de trancher."}
              </p>
            )}
            <div className="table-form-actions">
              {view.reveal.contestable && (
                <button
                  disabled={busy}
                  onClick={() => void send({ type: "CONTEST", attemptId: view.reveal?.attemptId ?? "" })}
                  className="table-secondary-button"
                >
                  Contester
                </button>
              )}
              {view.allowedActions.includes("RESOLVE_CONTEST") && (
                <>
                  <button
                    disabled={busy}
                    onClick={() => void send({ type: "RESOLVE_CONTEST", attemptId: view.reveal?.attemptId ?? "", accept: true })}
                    className="table-primary-button"
                    style={{ width: "auto", marginTop: 0 }}
                  >
                    Accepter
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => void send({ type: "RESOLVE_CONTEST", attemptId: view.reveal?.attemptId ?? "", accept: false })}
                    className="table-secondary-button"
                  >
                    Maintenir
                  </button>
                </>
              )}
              {view.allowedActions.includes("NEXT") && (
                <button disabled={busy} onClick={() => void send({ type: "NEXT" })} className="table-primary-button" style={{ width: "auto", marginTop: 0 }}>
                  {busy ? "Actualisation…" : view.acknowledged ? "En attente de l'autre…" : "Continuer"}
                </button>
              )}
            </div>
          </section>
        )}

        {view.phase === "finished" && (
          <section className="table-panel table-finish-panel">
            <p className="table-kicker table-kicker-accent">Résultats</p>
            <h1 className="table-finish-title">{finishLabel(view)}</h1>
            <div className="table-final-scores">
              {view.players.map((player) => (
                <div key={player.id} className="table-final-score">
                  <p>{player.pseudo}</p>
                  <strong>{player.reserve}</strong>
                  <span>points de réserve</span>
                </div>
              ))}
            </div>
            <button onClick={() => router.push("/jeux/trou-noir")} className="table-primary-button table-finish-button">
              Rejouer
            </button>
          </section>
        )}

      </div>
    </main>
  );
}

function phaseLabel(view: TrouNoirView, isMyTurn: boolean, expired: boolean): string {
  if (view.phase === "answering") {
    if (expired) return "Temps écoulé, validation…";
    return isMyTurn ? "À toi de répondre" : "Au tour de ton partenaire";
  }
  if (view.phase === "judging") return "Vérification de la réponse…";
  if (view.phase === "reveal") {
    if (view.reveal?.contest?.status === "pending") return "Contestation en cours";
    return "Révélation : vérifie puis continue";
  }
  return "Partie terminée";
}

function finishLabel(view: TrouNoirView): string {
  const result = view.result;
  if (!result) return "Terminé";
  if (result.outcome === "draw") return "Égalité";
  if (result.outcome === "abandoned") return "Interrompu";
  return result.winnerId === view.players[view.mySeat].id ? "Victoire" : "Défaite";
}
