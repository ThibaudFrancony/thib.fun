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
      <main className="table-page table-ttmc table-state-page">
        <div role="alert" className="table-error table-state-message">{error}</div>
      </main>
    );
  }
  if (!match) {
    return (
      <main className="table-page table-ttmc table-state-page">
        <div className="table-panel table-loading-panel">Chargement de la partie…</div>
      </main>
    );
  }
  const view = match.view;
  const me = view.players[view.mySeat];
  const opponent = view.players[(1 - view.mySeat) as 0 | 1];
  const isMyTurn = view.activePlayerId === me.id && (view.phase === "choose_level" || view.phase === "answering");

  return (
    <main className="table-page table-ttmc table-match-page">
      <div className="table-content table-match-content">
        <header className="table-match-header">
          <button type="button" onClick={() => router.push(`/salons/${match.roomId}`)} className="table-back-link">
            ← Salon
          </button>
          <div className="table-match-heading">
            <p className="table-kicker table-kicker-accent">À ton niveau</p>
            <p>Manche {Math.min(view.round, view.maxRounds)} / {view.maxRounds} · cible {view.targetScore}</p>
          </div>
          <button type="button" onClick={() => void refresh()} className="table-secondary-button table-refresh-button">
            Actualiser
          </button>
        </header>

        <div className="table-scoreboard">
          {[me, opponent].map((player) => (
            <div key={player.id} className="table-score-card" data-self={player.seat === view.mySeat} data-active={player.active}>
              <div className="table-score-topline">
                <span className="table-player-name">
                  {player.pseudo}
                  {player.seat === view.mySeat ? " · toi" : ""}
                </span>
                <span className="table-player-score">{player.score}</span>
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
              <p className="table-score-status">
                Score · {player.correct} bonne{player.correct > 1 ? "s" : ""} · {player.incorrect} manquée{player.incorrect > 1 ? "s" : ""}
                {player.averageLevel !== null ? ` · niveau moyen ${player.averageLevel.toFixed(1)}` : ""}
              </p>
            </div>
          ))}
        </div>

        <div aria-live="polite" aria-atomic="true" className="table-status-bar" data-urgent={remaining !== null && remaining <= 10}>
          <span>{phaseLabel(view, isMyTurn, expired)}</span>
          {remaining !== null && view.phase !== "finished" && <span className="table-timer">{remaining}s</span>}
        </div>
        {view.lastChanceOfRound && view.phase !== "finished" && (
          <p className="table-panel-note" style={{ marginTop: "0.6rem" }}>Dernier tour de la manche : la cible est atteinte, la manche va à son terme.</p>
        )}
        {error && <p role="alert" className="table-error" style={{ marginTop: "0.8rem" }}>{error}</p>}

        {view.theme && view.phase === "choose_level" && (
          <section className="table-panel table-side-panel">
            <p className="table-kicker table-kicker-warm">Thème de la manche</p>
            <h2 className="table-panel-title">{view.theme.label}</h2>
            <p className="table-panel-note">{view.theme.description}</p>
            {view.activePlayerId === me.id ? (
              <>
                <p className="table-panel-note table-instruction">Choisis ton niveau avant de voir la question. Difficulté = points possibles.</p>
                <div role="group" aria-label="Niveaux de 1 à 10" className="table-levels">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setLevelDraft(level)}
                      aria-pressed={levelDraft === level}
                      className="table-level"
                    >
                      <strong>{level}</strong><small>{level} pt{level > 1 ? "s" : ""}</small>
                    </button>
                  ))}
                </div>
                <p className="table-panel-note" style={{ marginTop: "0.5rem" }}>
                  <span>1 · accessible</span> · <span>10 · très difficile</span>
                </p>
                <button
                  disabled={busy}
                  onClick={() => void send({ type: "CHOOSE_LEVEL", level: levelDraft })}
                  className="table-primary-button"
                >
                  {busy ? "Envoi…" : `Confirmer le niveau ${levelDraft}`}
                </button>
              </>
            ) : (
              <p className="table-panel-note">{opponent.pseudo} choisit son niveau…</p>
            )}
          </section>
        )}

        {(view.phase === "answering" || view.phase === "judging") && (
          <section className="table-panel table-side-panel">
            {view.question ? (
              <>
                <p className="table-kicker table-kicker-warm">Niveau {view.question.level} · {view.question.level} point{view.question.level > 1 ? "s" : ""} possible{view.question.level > 1 ? "s" : ""}</p>
                {view.technicalReplacement && (
                  <p className="table-panel-note">Question de remplacement : incident technique, même niveau, sans pénalité.</p>
                )}
                <h2 className="table-target-title">{view.question.prompt}</h2>
                <p className="table-panel-note table-instruction">
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
                    <label className="table-label" htmlFor="ttmc-answer">Ta réponse</label>
                    <input
                      id="ttmc-answer"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      maxLength={240}
                      autoComplete="off"
                      placeholder="Écris ta réponse…"
                      className="table-input"
                    />
                    <button disabled={busy || !draft.trim()} type="submit" className="table-primary-button">
                      {busy ? "Envoi…" : "Valider ma réponse"}
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
            <h2 className="table-panel-title">{view.reveal.timeout ? "Temps écoulé" : view.reveal.verdict === "accept" ? `Bonne réponse · +${view.reveal.points}` : "Réponse refusée · +0"}</h2>
            {!view.reveal.timeout && (
              <p className="table-panel-note">Réponse saisie : « {view.reveal.submittedAnswer} »</p>
            )}
            <p className="table-panel-note">Réponse attendue : {view.reveal.expectedAnswer}</p>
            <p className="table-panel-note">{view.reveal.explanation}</p>
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
                  <strong>{player.score}</strong>
                  <span>points</span>
                </div>
              ))}
            </div>
            <button onClick={() => router.push("/jeux/ttmc")} className="table-primary-button table-finish-button">
              Rejouer
            </button>
          </section>
        )}

        {view.phase !== "finished" && (
          <div style={{ display: "grid", gap: "0.55rem", marginTop: "1rem" }}>
            <button disabled={busy} onClick={() => void send({ type: "RESIGN" })} className="table-danger-button">
              Abandonner
            </button>
            <div className="table-forfeit-panel">
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
