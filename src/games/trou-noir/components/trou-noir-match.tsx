"use client";

import { useCallback, useEffect, useState } from "react";
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
      <main className="geo-page geo-state-page">
        <div role="alert" className="geo-error geo-state-message">{error}</div>
      </main>
    );
  }
  if (!match) {
    return (
      <main className="geo-page geo-state-page">
        <div className="geo-panel geo-loading-panel">Chargement de la partie…</div>
      </main>
    );
  }
  const view = match.view;
  const me = view.players[view.mySeat];
  const opponent = view.players[(1 - view.mySeat) as 0 | 1];
  const isMyTurn = view.phase === "answering" && view.question?.addresseeIsMe === true;

  return (
    <main className="geo-page geo-match-page">
      <div className="geo-content geo-match-content">
        <header className="geo-match-header">
          <button type="button" onClick={() => router.push(`/salons/${match.roomId}`)} className="geo-back-link">
            ← Salon
          </button>
          <div className="geo-match-heading">
            <p className="geo-kicker geo-kicker-accent">Chute libre</p>
            <p>Manche {Math.min(view.round, view.maxRounds)} / {view.maxRounds}</p>
          </div>
          <button type="button" onClick={() => void refresh()} className="geo-secondary-button geo-refresh-button">
            Actualiser
          </button>
        </header>

        <div className="geo-scoreboard">
          {[me, opponent].map((player) => (
            <div key={player.id} className="geo-score-card" data-self={player.seat === view.mySeat} data-active={player.active}>
              <div className="geo-score-topline">
                <span className="geo-player-name">
                  {player.pseudo}
                  {player.seat === view.mySeat ? " · toi" : ""}
                </span>
                <span className="geo-player-score">{player.reserve}</span>
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
              <p className="geo-score-status">
                Réserve · {player.correct} bonne{player.correct > 1 ? "s" : ""} · {player.incorrect} manquée{player.incorrect > 1 ? "s" : ""}
              </p>
            </div>
          ))}
        </div>

        <div aria-live="polite" aria-atomic="true" className="geo-status-bar" data-urgent={remaining !== null && remaining <= 10}>
          <span>{phaseLabel(view, isMyTurn, expired)}</span>
          {remaining !== null && view.phase !== "finished" && <span className="geo-timer">{remaining}s</span>}
        </div>
        {error && <p role="alert" className="geo-error" style={{ marginTop: "0.8rem" }}>{error}</p>}

        {(view.phase === "answering" || view.phase === "judging") && (
          <section className="geo-panel geo-side-panel" style={{ marginTop: "1rem", padding: "clamp(1.2rem, 3vw, 1.7rem)" }}>
            {view.question ? (
              <>
                <p className="geo-kicker geo-kicker-warm">
                  {CATEGORY_LABELS[view.question.category] ?? view.question.category} · niveau {view.question.difficulty}
                </p>
                <h2 className="geo-target-title" style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)" }}>{view.question.prompt}</h2>
                <p className="geo-panel-note geo-instruction">
                  {view.phase === "judging"
                    ? "Réponse envoyée. Vérification en cours…"
                    : isMyTurn
                      ? "C'est à toi. Ton brouillon n'est pas transmis avant l'envoi."
                      : `Au tour de ${opponent.pseudo}. Sa réponse restera cachée jusqu'à la révélation.`}
                </p>
                {view.phase === "answering" && isMyTurn && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (draft.trim()) void send({ type: "SUBMIT_ANSWER", answer: draft.slice(0, 240) });
                    }}
                  >
                    <label className="geo-label" htmlFor="tn-answer">Ta réponse</label>
                    <input
                      id="tn-answer"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      maxLength={240}
                      autoComplete="off"
                      placeholder="Écris ta réponse…"
                      className="geo-input"
                    />
                    <button disabled={busy || !draft.trim()} type="submit" className="geo-primary-button">
                      {busy ? "Envoi…" : "Valider ma réponse"}
                    </button>
                  </form>
                )}
                {view.phase === "answering" && !isMyTurn && (
                  <p className="geo-panel-note">Question adressée à {opponent.pseudo}.</p>
                )}
              </>
            ) : (
              <p className="geo-panel-note">Préparation de la question…</p>
            )}
          </section>
        )}

        {view.phase === "reveal" && view.reveal && (
          <section className="geo-panel geo-side-panel" style={{ marginTop: "1rem", padding: "clamp(1.2rem, 3vw, 1.7rem)" }}>
            <p className="geo-kicker geo-kicker-warm">Révélation</p>
            <h2 className="geo-panel-title">{view.reveal.timeout ? "Temps écoulé" : view.reveal.verdict === "accept" ? "Bonne réponse" : "Réponse refusée"}</h2>
            {!view.reveal.timeout && (
              <p className="geo-panel-note">Réponse saisie : « {view.reveal.submittedAnswer} »</p>
            )}
            <p className="geo-panel-note">Réponse attendue : {view.reveal.expectedAnswer}</p>
            <p className="geo-panel-note">{view.reveal.explanation}</p>
            <p className="geo-panel-note">
              Effet proposé : {view.reveal.impact === 0 ? "±0 point" : "−10 points de réserve"} (appliqué à la clôture).
            </p>
            {view.reveal.contest?.status === "pending" && (
              <p className="geo-panel-note">
                {view.reveal.contest.requesterIsMe
                  ? "Contestation envoyée. Ton adversaire tranche."
                  : "Ton adversaire conteste. À toi de trancher."}
              </p>
            )}
            <div className="geo-form-actions">
              {view.reveal.contestable && (
                <button
                  disabled={busy}
                  onClick={() => void send({ type: "CONTEST", attemptId: view.reveal?.attemptId ?? "" })}
                  className="geo-secondary-button"
                >
                  Contester
                </button>
              )}
              {view.allowedActions.includes("RESOLVE_CONTEST") && (
                <>
                  <button
                    disabled={busy}
                    onClick={() => void send({ type: "RESOLVE_CONTEST", attemptId: view.reveal?.attemptId ?? "", accept: true })}
                    className="geo-primary-button"
                    style={{ width: "auto", marginTop: 0 }}
                  >
                    Accepter
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => void send({ type: "RESOLVE_CONTEST", attemptId: view.reveal?.attemptId ?? "", accept: false })}
                    className="geo-secondary-button"
                  >
                    Maintenir
                  </button>
                </>
              )}
              {view.allowedActions.includes("NEXT") && (
                <button disabled={busy} onClick={() => void send({ type: "NEXT" })} className="geo-primary-button" style={{ width: "auto", marginTop: 0 }}>
                  {busy ? "Actualisation…" : view.acknowledged ? "En attente de l'autre…" : "Continuer"}
                </button>
              )}
            </div>
          </section>
        )}

        {view.phase === "finished" && (
          <section className="geo-panel geo-finish-panel">
            <p className="geo-kicker geo-kicker-accent">Résultats</p>
            <h1 className="geo-finish-title">{finishLabel(view)}</h1>
            <div className="geo-final-scores">
              {view.players.map((player) => (
                <div key={player.id} className="geo-final-score">
                  <p>{player.pseudo}</p>
                  <strong>{player.reserve}</strong>
                  <span>points de réserve</span>
                </div>
              ))}
            </div>
            <button onClick={() => router.push(`/salons/${match.roomId}`)} className="geo-primary-button geo-finish-button">
              Retour au salon
            </button>
          </section>
        )}

        {view.phase !== "finished" && (
          <div style={{ display: "grid", gap: "0.55rem", marginTop: "1rem" }}>
            <button disabled={busy} onClick={() => void send({ type: "RESIGN" })} className="geo-danger-button">
              Abandonner
            </button>
            <div className="geo-forfeit-panel">
              <p>Partenaire absent ?</p>
              <span>Le forfait devient disponible après 90 secondes sans signal.</span>
              </div>
          </div>
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
