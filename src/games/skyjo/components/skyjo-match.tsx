"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SkyjoAction, SkyjoCellView, SkyjoView } from "@/games/skyjo/types";
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
  view: SkyjoView;
};

const ACCENT = "#6d28d9";

function valueStyle(value: number): { background: string; color: string } {
  if (value <= -2) return { background: "#dcefe4", color: "#12463d" };
  if (value === -1) return { background: "#e6f2ec", color: "#1f6657" };
  if (value === 0) return { background: "#e9f4f0", color: "#1f6657" };
  if (value <= 4) return { background: "#efe9fb", color: "#4c1d95" };
  if (value <= 8) return { background: "#f4efe4", color: "#6b5a2e" };
  return { background: "#f9e8ea", color: "#8f2942" };
}

export function SkyjoMatch({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [targetSlot, setTargetSlot] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  const onSnapshotApplied = useCallback((next: MatchResponse) => {
    setSelected((current) => current.filter((slot) => {
      const cell = next.view.myGrid[slot];
      return cell && !cell.revealed && !("empty" in cell && cell.empty);
    }));
    if (next.view.phase !== "resolve_draw" && next.view.phase !== "replace_discard") setTargetSlot(null);
  }, []);

  const {
    snapshot: match,
    error,
    busy,
    serverOffset,
    refresh,
    send: networkSend,
  } = useResourceNetwork<MatchResponse, SkyjoAction>({
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

  async function send(action: SkyjoAction): Promise<void> {
    const next = await networkSend(action);
    if (next) {
      setSelected([]);
      setTargetSlot(null);
    }
  }

  const remaining = match?.deadlineAt ? Math.max(0, Math.ceil((Date.parse(match.deadlineAt) - (now + serverOffset)) / 1000)) : null;
  if (error && !match) {
    return <main className="min-h-screen px-5 py-12"><div role="alert" className="mx-auto max-w-xl rounded-2xl bg-red-50 p-5 text-red-700">{error}</div></main>;
  }
  if (!match) {
    return <main className="min-h-screen px-5 py-12"><div className="mx-auto max-w-xl rounded-3xl border border-[var(--line)] bg-white/70 p-8 text-center text-[var(--muted)]">Chargement de la partie…</div></main>;
  }
  const view = match.view;
  const isMyTurn = view.activePlayerId !== null && view.players[view.mySeat].id !== null && view.activeSeat === view.mySeat && view.phase !== "finished" && view.phase !== "round_reveal";
  const me = view.players[view.mySeat];
  const opponent = view.players[(1 - view.mySeat) as 0 | 1];

  return (
    <main className="min-h-screen pb-10">
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-8 sm:py-7">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => router.push(`/salons/${match.roomId}`)} className="rounded-full px-3 py-2 text-sm font-bold text-[var(--muted)] hover:bg-white">← Salon</button>
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6d28d9]">Douze cases</p>
            <p className="font-black">Manche {view.round} / {view.maxRounds}</p>
          </div>
          <button type="button" onClick={() => void refresh()} className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-sm font-bold">Actualiser</button>
        </header>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ScorePanel pseudo={opponent.pseudo} score={opponent.score} active={opponent.active} isMe={false} />
          <ScorePanel pseudo={`${me.pseudo} · toi`} score={me.score} active={me.active} isMe />
        </div>

        <div aria-live="polite" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--ink)] px-4 py-3 text-sm font-bold text-white">
          <span>{phaseLabel(view, isMyTurn)}</span>
          {remaining !== null && view.phase !== "finished" && view.phase !== "round_reveal" && (
            <strong className={remaining <= 10 ? "text-[var(--yellow)]" : "text-white"}>{remaining}s</strong>
          )}
        </div>
        {view.lastTurn && view.phase !== "finished" && view.phase !== "round_reveal" && (
          <p className="mt-3 rounded-2xl bg-[#f1eafe] px-4 py-3 text-center text-sm font-bold text-[#4c1d95]">Dernier tour : la manche se termine après ce coup.</p>
        )}

        <section aria-label="Table de jeu" className="mt-6 grid gap-6 lg:grid-cols-[1fr_240px_1fr] lg:items-start">
          <div>
            <p className="mb-2 text-center text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">{opponent.pseudo}</p>
            <Grid cells={view.opponentGrid} compact onPick={undefined} picked={[]} target={null} disabled />
          </div>
          <div className="flex flex-row items-center justify-center gap-4 lg:flex-col">
            <Pile label="Pioche" count={view.drawCount} covered onClick={view.allowedActions.includes("TAKE_DRAW") && !busy ? () => void send({ type: "TAKE_DRAW" }) : undefined} hint="Piocher" />
            <Pile label="Défausse" count={view.discardCount} value={view.discardTop} onClick={view.allowedActions.includes("TAKE_DISCARD") && !busy ? () => void send({ type: "TAKE_DISCARD" }) : undefined} hint={view.discardTop === null ? "Vide" : `Prendre (${view.discardTop})`} />
          </div>
          <div>
            <p className="mb-2 text-center text-xs font-black uppercase tracking-[0.16em] text-[#6d28d9]">Ta grille</p>
            <Grid
              cells={view.myGrid}
              onPick={(slot) => {
                if (view.phase === "setup") {
                  setSelected((current) => current.includes(slot) ? current.filter((item) => item !== slot) : current.length < 2 ? [...current, slot] : [current[1], slot]);
                } else if (view.phase === "resolve_draw" || view.phase === "replace_discard") {
                  setTargetSlot(slot);
                }
              }}
              picked={view.phase === "setup" ? selected : targetSlot === null ? [] : [targetSlot]}
              target={targetSlot}
              disabled={busy || (!view.allowedActions.includes("REVEAL_INITIAL") && view.phase === "setup") || (view.phase !== "setup" && view.phase !== "resolve_draw" && view.phase !== "replace_discard") || (view.phase !== "setup" && !isMyTurn)}
            />
          </div>
        </section>

        {view.phase === "setup" && view.allowedActions.includes("REVEAL_INITIAL") && (
          <div className="mt-5 text-center">
            <p className="text-sm text-[var(--muted)]">Choisis deux cartes à révéler ({selected.length}/2).</p>
            <button type="button" disabled={selected.length !== 2 || busy} onClick={() => void send({ type: "REVEAL_INITIAL", slots: [selected[0], selected[1]] })} className="mt-3 rounded-full bg-[#6d28d9] px-6 py-3 font-bold text-white hover:bg-[#5b21b6]">
              Révéler ces deux cartes
            </button>
          </div>
        )}
        {view.phase === "setup" && !view.allowedActions.includes("REVEAL_INITIAL") && (
          <p className="mt-5 text-center text-sm font-bold text-[var(--muted)]">Choix envoyé. En attente de ton adversaire…</p>
        )}

        {(view.phase === "resolve_draw" || view.phase === "replace_discard") && isMyTurn && (
          <HeldPanel view={view} busy={busy} targetSlot={targetSlot} onReplace={() => { if (targetSlot !== null) void send({ type: "REPLACE", slot: targetSlot }); }} onReveal={() => { if (targetSlot !== null) void send({ type: "DISCARD_AND_REVEAL", slot: targetSlot }); }} />
        )}

        {view.phase === "round_reveal" && view.roundSummary && (
          <section className="mt-6 rounded-[2rem] border border-[var(--line)] bg-[var(--card)] p-6 text-center">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6d28d9]">Manche {view.roundSummary.round} terminée</p>
            <div className="mx-auto mt-4 grid max-w-md grid-cols-2 gap-3">
              {view.players.map((player, index) => (
                <div key={player.id} className="rounded-2xl bg-[var(--paper)] p-4">
                  <p className="text-sm font-bold">{player.pseudo}</p>
                  <p className="mt-1 text-3xl font-black">{view.roundSummary?.final[index]}</p>
                  <p className="text-xs text-[var(--muted)]">brut {view.roundSummary?.raw[index]} · total {view.roundSummary?.cumulativeAfter[index]}</p>
                </div>
              ))}
            </div>
            {view.roundSummary.penalizedSeat !== null && (
              <p className="mt-3 text-sm font-bold text-[#8f2942]">Score doublé pour {view.players[view.roundSummary.penalizedSeat].pseudo}.</p>
            )}
            <button type="button" disabled={busy || !view.allowedActions.includes("NEXT")} onClick={() => void send({ type: "NEXT" })} className="mt-5 rounded-full bg-[#6d28d9] px-6 py-3 font-bold text-white hover:bg-[#5b21b6]">
              {view.acknowledged ? "En attente de l'adversaire…" : "Manche suivante"}
            </button>
          </section>
        )}

        {view.phase === "finished" && <FinishedPanel view={view} back={() => router.push("/jeux/skyjo")} />}

        {view.phase !== "finished" && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-[var(--line)] bg-white/50 p-4 text-sm">
            <span className="text-[var(--muted)]">Besoin d&apos;arrêter la partie ?</span>
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => { if (window.confirm("Abandonner cette partie ?")) void send({ type: "RESIGN" }); }} className="rounded-full px-3 py-2 font-bold text-[var(--muted)] hover:bg-red-50 hover:text-red-700">Abandonner</button>
              </div>
          </div>
        )}
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
    </main>
  );
}

function phaseLabel(view: SkyjoView, isMyTurn: boolean): string {
  switch (view.phase) {
    case "setup": return "Révèle deux cartes pour commencer";
    case "choose_source": return isMyTurn ? "Pioche ou prends la défausse" : "Ton adversaire choisit sa carte";
    case "resolve_draw": return isMyTurn ? "Remplace une case, ou jette et révèle" : "Ton adversaire joue sa carte piochée";
    case "replace_discard": return isMyTurn ? "Remplace une case de ta grille" : "Ton adversaire remplace une carte";
    case "round_reveal": return "Manche terminée";
    case "finished": return "Partie terminée";
  }
}

function ScorePanel({ pseudo, score, active, isMe }: { pseudo: string; score: number; active: boolean; isMe: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${isMe ? "border-[#6d28d9]/50 bg-[#f1eafe]" : "border-[var(--line)] bg-white/70"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-black">{pseudo}</span>
        <span className="text-2xl font-black">{score}</span>
      </div>
      <p className="mt-1 text-xs font-bold text-[var(--muted)]">{active ? "À son tour" : "Plus petit total gagne"}</p>
    </div>
  );
}

function Grid({ cells, compact, onPick, picked, target, disabled }: {
  cells: SkyjoCellView[];
  compact?: boolean;
  onPick?: (slot: number) => void;
  picked: number[];
  target: number | null;
  disabled: boolean;
}) {
  const size = compact ? "h-14 w-11 text-base sm:h-16 sm:w-12" : "h-20 w-14 text-2xl sm:h-24 sm:w-[4.25rem] sm:text-3xl";
  return (
    <div className="mx-auto grid w-fit grid-cols-4 gap-1.5 sm:gap-2" role="group" aria-label="Grille de douze cases">
      {cells.map((cell) => {
        if ("empty" in cell && cell.empty) {
          return <div key={cell.slot} className={`${size} rounded-xl border border-dashed border-[var(--line)]`} aria-hidden="true" />;
        }
        if (!cell.revealed) {
          const isPicked = picked.includes(cell.slot);
          return (
            <button
              key={cell.slot}
              type="button"
              disabled={disabled || !onPick}
              onClick={() => onPick?.(cell.slot)}
              aria-label={`Case ${cell.slot + 1}, carte cachée${isPicked ? ", sélectionnée" : ""}`}
              aria-pressed={isPicked}
              className={`${size} rounded-xl bg-[#2b2140] font-black text-[#cdbcf2] shadow-[0_8px_16px_rgba(20,33,29,0.2)] transition-transform sm:hover:-translate-y-1 ${isPicked ? "-translate-y-1" : ""}`}
              style={isPicked ? { outline: `3px solid ${ACCENT}`, outlineOffset: 2 } : undefined}
            >
              ?
            </button>
          );
        }
        const style = valueStyle(cell.value);
        const isTarget = target === cell.slot;
        return (
          <button
            key={cell.slot}
            type="button"
            disabled={disabled || !onPick}
            onClick={() => onPick?.(cell.slot)}
            aria-label={`Case ${cell.slot + 1}, ${cell.value}`}
            className={`${size} rounded-xl font-black shadow-[0_8px_16px_rgba(20,33,29,0.12)] transition-transform sm:hover:-translate-y-1 ${isTarget ? "-translate-y-1" : ""}`}
            style={{ backgroundColor: style.background, color: style.color, outline: isTarget ? `3px solid ${ACCENT}` : undefined, outlineOffset: 2 }}
          >
            {cell.value}
          </button>
        );
      })}
    </div>
  );
}

function Pile({ label, count, value, covered, onClick, hint }: {
  label: string;
  count: number;
  value?: number | null;
  covered?: boolean;
  onClick?: () => void;
  hint: string;
}) {
  const inner = value === undefined || covered
    ? <div className="grid h-20 w-14 place-items-center rounded-xl bg-[#2b2140] text-lg font-black text-[#cdbcf2] sm:h-24 sm:w-16">?</div>
    : (() => { const style = valueStyle(value ?? 0); return <div className="grid h-20 w-14 place-items-center rounded-xl text-2xl font-black sm:h-24 sm:w-16" style={{ backgroundColor: style.background, color: style.color }}>{value}</div>; })();
  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      {onClick ? (
        <button type="button" onClick={onClick} aria-label={`${label} : ${hint}`} className="rounded-2xl p-1 transition-transform hover:-translate-y-1">
          {inner}
        </button>
      ) : inner}
      <p className="text-xs font-bold text-[var(--muted)]">{count} carte{count > 1 ? "s" : ""} · {hint}</p>
    </div>
  );
}

function HeldPanel({ view, busy, targetSlot, onReplace, onReveal }: {
  view: SkyjoView;
  busy: boolean;
  targetSlot: number | null;
  onReplace: () => void;
  onReveal: () => void;
}) {
  const heldValue = view.held && "value" in view.held ? view.held.value : null;
  const target = targetSlot === null ? null : view.myGrid[targetSlot];
  const targetHidden = target !== null && target !== undefined && !target.revealed && !("empty" in target && target.empty);
  const canReveal = view.phase === "resolve_draw" && targetHidden;
  const style = heldValue === null ? null : valueStyle(heldValue);
  return (
    <section className="mx-auto mt-5 max-w-xl rounded-3xl border-2 border-[#6d28d9]/30 bg-[#f6f2ff] p-5 text-center">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6d28d9]">Carte en main · {heldValue}</p>
      {style && <div className="mx-auto mt-3 grid h-24 w-16 place-items-center rounded-xl text-3xl font-black" style={{ backgroundColor: style.background, color: style.color }}>{heldValue}</div>}
      <p className="mt-3 text-sm text-[#4c1d95]">{targetSlot === null ? "Touche une case de ta grille." : `Case ${targetSlot + 1} visée.`}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button type="button" disabled={targetSlot === null || busy} onClick={onReplace} className="rounded-full bg-[#6d28d9] px-4 py-3 text-sm font-bold text-white hover:bg-[#5b21b6]">
          Remplacer cette case
        </button>
        {view.phase === "resolve_draw" && (
          <button type="button" disabled={!canReveal || busy} onClick={onReveal} className="rounded-full border border-[#6d28d9]/30 bg-white px-4 py-3 text-sm font-bold text-[#5b21b6]">
            Jeter et révéler
          </button>
        )}
      </div>
    </section>
  );
}

function FinishedPanel({ view, back }: { view: SkyjoView; back: () => void }) {
  const result = view.result;
  const winner = result?.winnerId !== null && result?.winnerId === view.players[view.mySeat].id;
  const title = result?.outcome === "draw" ? "Égalité" : result?.outcome === "abandoned" ? "Partie interrompue" : winner ? "Victoire" : "Défaite";
  return (
    <section className="mt-7 rounded-[2rem] border border-[var(--line)] bg-[var(--card)] p-6 text-center">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6d28d9]">Résultats</p>
      <h1 className="mt-2 text-5xl font-black tracking-[-0.05em]">{title}</h1>
      <div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3">
        {view.players.map((player) => (
          <div key={player.id} className="rounded-2xl bg-[var(--paper)] p-4">
            <p className="text-sm font-bold">{player.pseudo}</p>
            <p className="mt-1 text-3xl font-black">{result?.players[player.seat]?.score ?? 0}</p>
            <p className="text-xs text-[var(--muted)]">points au total</p>
          </div>
        ))}
      </div>
      {view.roundSummary && (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Dernière manche : {view.roundSummary.final[0]} – {view.roundSummary.final[1]}
          {view.roundSummary.penalizedSeat !== null ? " (score doublé pour le déclencheur)" : ""}.
        </p>
      )}
      <button type="button" onClick={back} className="mt-7 rounded-full bg-[#6d28d9] px-5 py-3 font-bold text-white hover:bg-[#5b21b6]">
        Rejouer
      </button>
    </section>
  );
}
