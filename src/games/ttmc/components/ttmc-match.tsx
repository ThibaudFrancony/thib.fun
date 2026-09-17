"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { TtmcAction, TtmcView } from "@/games/ttmc/types";
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
  view: TtmcView;
};

export function TtmcMatch({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [levelDraft, setLevelDraft] = useState(5);
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
  } = useResourceNetwork<MatchResponse, TtmcAction>({
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
  const isMyTurn = view.activePlayerId === me.id && (view.phase === "choose_level" || view.phase === "answering");

  return (
    <main className="geo-page geo-match-page">
      <div className="geo-content geo-match-content">
        <header className="geo-match-header">
          <button type="button" onClick={() => router.push(`/salons/${match.roomId}`)} className="geo-back-link">
            ← Salon
          </button>
          <div className="geo-match-heading">
            <p className="geo-kicker geo-kicker-accent">À ton niveau</p>
            <p>Manche {Math.min(view.round, view.maxRounds)} / {view.maxRounds} · cible {view.targetScore}</p>
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
                <span className="geo-player-score">{player.score}</span>
              </div>
              <div aria-hidden="true" style={{ marginTop: "0.6rem", height: "8px", borderRadius: "999px", background: "#ffffff1f" }}>
                <div
                  style={{
                    width: `${Math.min(100, (player.score / Math.max(1, view.targetScore)) * 100)}%`,
                    height: "100%",
                    borderRadius: "999px",
                    background: player.score >= view.targetScore ? "#b9f9df" : "#c9b8ff",
                    transition: "width 300ms ease",
                  }}
                />
              </div>
              <p className="geo-score-status">
                Score · {player.correct} bonne{player.correct > 1 ? "s" : ""} · {player.incorrect} manquée{player.incorrect > 1 ? "s" : ""}
                {player.averageLevel !== null ? ` · niveau moyen ${player.averageLevel.toFixed(1)}` : ""}
              </p>
            </div>
          ))}
        </div>

        <div aria-live="polite" aria-atomic="true" className="geo-status-bar" data-urgent={remaining !== null && remaining <= 10}>
          <span>{phaseLabel(view, isMyTurn, expired)}</span>
          {remaining !== null && view.phase !== "finished" && <span className="geo-timer">{remaining}s</span>}
        </div>
        {view.lastChanceOfRound && view.phase !== "finished" && (
          <p className="geo-panel-note" style={{ marginTop: "0.6rem" }}>Dernier tour de la manche : la cible est atteinte, la manche va à son terme.</p>
        )}
        {error && <p role="alert" className="geo-error" style={{ marginTop: "0.8rem" }}>{error}</p>}

        {view.theme && view.phase === "choose_level" && (
          <section className="geo-panel geo-side-panel" style={{ marginTop: "1rem", padding: "clamp(1.2rem, 3vw, 1.7rem)" }}>
            <p className="geo-kicker geo-kicker-warm">Thème de la manche</p>
            <h2 className="geo-panel-title">{view.theme.label}</h2>
            <p className="geo-panel-note">{view.theme.description}</p>
            {view.activePlayerId === me.id ? (
              <>
                <p className="geo-panel-note geo-instruction">Choisis ton niveau avant de voir la question. Difficulté = points possibles.</p>
                <div role="group" aria-label="Niveaux de 1 à 10" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "0.5rem", marginTop: "0.8rem" }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setLevelDraft(level)}
                      aria-pressed={levelDraft === level}
                      className="geo-secondary-button"
                      style={{ minHeight: "44px", borderColor: levelDraft === level ? "#b9f9df" : undefined }}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <p className="geo-panel-note" style={{ marginTop: "0.5rem" }}>
                  <span>1 · accessible</span> · <span>10 · très difficile</span>
                </p>
                <button
                  disabled={busy}
                  onClick={() => void send({ type: "CHOOSE_LEVEL", level: levelDraft })}
                  className="geo-primary-button"
                >
                  {busy ? "Envoi…" : `Confirmer le niveau ${levelDraft}`}
                </button>
              </>
            ) : (
              <p className="geo-panel-note">{opponent.pseudo} choisit son niveau…</p>
            )}
          </section>
        )}

        {(view.phase === "answering" || view.phase === "judging") && (
          <section className="geo-panel geo-side-panel" style={{ marginTop: "1rem", padding: "clamp(1.2rem, 3vw, 1.7rem)" }}>
            {view.question ? (
              <>
                <p className="geo-kicker geo-kicker-warm">Niveau {view.question.level} · {view.question.level} point{view.question.level > 1 ? "s" : ""} possible{view.question.level > 1 ? "s" : ""}</p>
                {view.technicalReplacement && (
                  <p className="geo-panel-note">Question de remplacement : incident technique, même niveau, sans pénalité.</p>
                )}
                <h2 className="geo-target-title" style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)" }}>{view.question.prompt}</h2>
                <p className="geo-panel-note geo-instruction">
                  {view.phase === "judging"
                    ? "Réponse envoyée. Vérification en cours…"
                    : view.question.addresseeIsMe
                      ? "C'est à toi. Faux = 0, réponse libre tolérante."
                      : `Au tour de ${opponent.pseudo}. Sa réponse restera cachée jusqu'à la révélation.`}
                </p>
                {view.phase === "answering" && view.question.addresseeIsMe && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (draft.trim()) void send({ type: "SUBMIT_ANSWER", answer: draft.slice(0, 240) });
                    }}
                  >
                    <label className="geo-label" htmlFor="ttmc-answer">Ta réponse</label>
                    <input
                      id="ttmc-answer"
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
              </>
            ) : (
              <p className="geo-panel-note">Préparation de la question…</p>
            )}
          </section>
        )}

        {view.phase === "reveal" && view.reveal && (
          <section className="geo-panel geo-side-panel" style={{ marginTop: "1rem", padding: "clamp(1.2rem, 3vw, 1.7rem)" }}>
            <p className="geo-kicker geo-kicker-warm">Révélation</p>
            <h2 className="geo-panel-title">{view.reveal.timeout ? "Temps écoulé" : view.reveal.verdict === "accept" ? `Bonne réponse · +${view.reveal.points}` : "Réponse refusée · +0"}</h2>
            {!view.reveal.timeout && (
              <p className="geo-panel-note">Réponse saisie : « {view.reveal.submittedAnswer} »</p>
            )}
            <p className="geo-panel-note">Réponse attendue : {view.reveal.expectedAnswer}</p>
            <p className="geo-panel-note">{view.reveal.explanation}</p>
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
                  <strong>{player.score}</strong>
                  <span>points</span>
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

function phaseLabel(view: TtmcView, isMyTurn: boolean, expired: boolean): string {
  if (view.phase === "choose_level") {
    if (expired) return "Temps écoulé, niveau 1 attribué…";
    return isMyTurn ? "À toi de choisir ton niveau" : "Ton partenaire choisit son niveau";
  }
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

function finishLabel(view: TtmcView): string {
  const result = view.result;
  if (!result) return "Terminé";
  if (result.outcome === "draw") return "Égalité";
  if (result.outcome === "abandoned") return "Interrompu";
  return result.winnerId === view.players[view.mySeat].id ? "Victoire" : "Défaite";
}
