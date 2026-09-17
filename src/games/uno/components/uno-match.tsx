"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { UnoAction, UnoCard, UnoColor, UnoView } from "@/games/uno/types";
import { cardLabel } from "@/games/uno/deck";
import { parseMatchSnapshot, useResourceNetwork } from "@/lib/network-sync";

type MatchResponse = { matchId: string; roomId: string; gameSlug: string; status: string; version: number; phaseId: string; deadlineAt: string | null; deadlineKind: string | null; serverNow: string; view: UnoView };
export type PendingPlay = { type: "PLAY_CARD"; cardId: string } | { type: "PLAY_DRAWN" };

const colorNames: Record<UnoColor, string> = { red: "Rouge", yellow: "Jaune", green: "Vert", blue: "Bleu" };
const cardColors: Record<UnoColor, string> = { red: "#c93651", yellow: "#d49c19", green: "#218267", blue: "#2f6ec4" };

export function isPendingPlayValid(pending: PendingPlay, view: UnoView): boolean {
  if (view.phase === "finished" || view.activeSeat !== view.mySeat) return false;
  if (pending.type === "PLAY_CARD") {
    const card = view.hand.find((candidate) => candidate.id === pending.cardId);
    return view.phase === "playing"
      && view.actions.canPlay
      && card?.color === null
      && view.playableCardIds.includes(pending.cardId);
  }
  const drawnCard = view.drawnCard;
  return view.phase === "after_draw"
    && view.actions.canPlayDrawn
    && drawnCard !== null
    && drawnCard.color === null
    && view.hand.some((card) => card.id === drawnCard.id)
    && view.playableCardIds.includes(drawnCard.id);
}

export function UnoMatch({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [announceNext, setAnnounceNext] = useState(false);
  const [pendingPlay, setPendingPlay] = useState<PendingPlay | null>(null);
  const [now, setNow] = useState(0);
  const focusReturnRef = useRef<HTMLElement | null>(null);

  const restoreDialogFocus = useCallback(() => {
    const target = focusReturnRef.current;
    focusReturnRef.current = null;
    if (!target) return;
    window.requestAnimationFrame(() => {
      if (target.isConnected) target.focus();
    });
  }, []);

  const closeColorDialog = useCallback(() => {
    setPendingPlay(null);
    restoreDialogFocus();
  }, [restoreDialogFocus]);

  const onSnapshotApplied = useCallback((next: MatchResponse) => {
    setSelectedCardId((current) => next.view.hand.some((card) => card.id === current) ? current : null);
    if (pendingPlay && !isPendingPlayValid(pendingPlay, next.view)) closeColorDialog();
  }, [closeColorDialog, pendingPlay]);

  const {
    snapshot: match,
    error,
    busy,
    serverOffset,
    refresh,
    send: networkSend,
  } = useResourceNetwork<MatchResponse, UnoAction>({
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

  async function send(action: UnoAction): Promise<MatchResponse | null> {
    const next = await networkSend(action);
    if (next) {
      setSelectedCardId(null);
      setAnnounceNext(false);
    }
    return next;
  }

  function selectedCard(): UnoCard | null {
    return match?.view.hand.find((card) => card.id === selectedCardId) ?? null;
  }

  function requestSelectedPlay() {
    const card = selectedCard();
    if (!card || !match?.view.actions.canPlay || !match.view.playableCardIds.includes(card.id)) return;
    if (card.color === null) openColorDialog({ type: "PLAY_CARD", cardId: card.id });
    else void send({ type: "PLAY_CARD", cardId: card.id, announceLastCard: announceNext });
  }

  function requestDrawnPlay() {
    const card = match?.view.drawnCard;
    if (!card || !match?.view.actions.canPlayDrawn) return;
    if (card.color === null) openColorDialog({ type: "PLAY_DRAWN" });
    else void send({ type: "PLAY_DRAWN", announceLastCard: announceNext });
  }

  function openColorDialog(next: PendingPlay) {
    const activeElement = document.activeElement;
    focusReturnRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    setPendingPlay(next);
  }

  async function chooseColor(color: UnoColor) {
    if (!pendingPlay) return;
    const action = pendingPlay.type === "PLAY_CARD"
      ? { type: "PLAY_CARD" as const, cardId: pendingPlay.cardId, chosenColor: color, announceLastCard: announceNext }
      : { type: "PLAY_DRAWN" as const, chosenColor: color, announceLastCard: announceNext };
    const next = await send(action);
    if (next) closeColorDialog();
  }

  const remaining = match?.deadlineAt ? Math.max(0, Math.ceil((Date.parse(match.deadlineAt) - (now + serverOffset)) / 1000)) : null;
  if (error && !match) return <main className="min-h-screen px-5 py-12"><div role="alert" className="mx-auto max-w-xl rounded-2xl bg-red-50 p-5 text-red-700">{error}</div></main>;
  if (!match) return <main className="min-h-screen px-5 py-12"><div className="mx-auto max-w-xl rounded-3xl border border-[var(--line)] bg-white/70 p-8 text-center text-[var(--muted)]">Chargement de la partie…</div></main>;
  const view = match.view;
  const me = view.players[view.mySeat];
  const opponent = view.players[(1 - view.mySeat) as 0 | 1];
  const isMyTurn = view.activeSeat === view.mySeat && view.phase !== "finished";
  const selectedIsPlayable = selectedCardId !== null && view.playableCardIds.includes(selectedCardId);
  const needsAnnouncement = view.hand.length === 2;
  return (
    <main className="min-h-screen pb-10">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-8 sm:py-7">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => router.push(`/salons/${match.roomId}`)} className="rounded-full px-3 py-2 text-sm font-bold text-[var(--muted)] hover:bg-white">← Salon</button>
          <div className="text-center"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#b23853]">Dernière carte</p><p className="font-black">Manche unique · tour {view.turns + 1}</p></div>
          <button type="button" onClick={() => void refresh()} className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-sm font-bold">Actualiser</button>
        </header>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <PlayerPanel player={opponent} isMe={false} />
          <PlayerPanel player={me} isMe />
        </div>
        <div aria-live="polite" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--ink)] px-4 py-3 text-sm font-bold text-white">
          <span>{phaseLabel(view, isMyTurn)}</span>
          <span className="flex items-center gap-2">Couleur active <span className="size-3 rounded-full" style={{ backgroundColor: cardColors[view.activeColor] }} aria-hidden="true" />{colorNames[view.activeColor]} {remaining !== null && <strong className={remaining <= 10 ? "text-[var(--yellow)]" : "text-white"}>{remaining}s</strong>}</span>
        </div>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px_1fr] lg:items-center" aria-label="Table de jeu UNO">
          <div className="order-2 flex justify-center lg:order-1"><button type="button" disabled={!view.actions.canDraw || busy} onClick={() => void send({ type: "DRAW" })} className="group flex flex-col items-center gap-2 rounded-3xl p-2 text-xs font-bold text-[var(--muted)] hover:bg-white disabled:hover:bg-transparent"><CardBack /><span>{view.drawPileCount} cartes dans la pioche</span><span className="text-[10px] font-normal">Piocher une carte</span></button></div>
          <div className="order-1 flex flex-col items-center gap-3 lg:order-2"><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Défausse</p><UnoCard card={view.topCard} /><p className="text-sm font-bold text-[var(--muted)]">{colorNames[view.activeColor]} active</p></div>
          <div className="order-3 rounded-3xl border border-[var(--line)] bg-white/60 p-4 text-sm leading-6 text-[var(--muted)]"><p className="font-black text-[var(--ink)]">À retenir</p><p className="mt-1">Même couleur ou même symbole. Les jokers sont toujours jouables ; le +4 exige une main sans carte de la couleur active.</p></div>
        </section>

        {view.phase === "after_draw" && view.drawnCard && <section className="mx-auto mt-5 max-w-xl rounded-3xl border-2 border-[#b23853]/30 bg-[#fff0f3] p-5 text-center"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#b23853]">Carte piochée</p><div className="mt-3 flex justify-center"><UnoCard card={view.drawnCard} /></div><p className="mt-3 text-sm text-[#672538]">Tu ne peux jouer que cette carte, ou la garder.</p><div className="mt-4 flex flex-wrap justify-center gap-2"><button type="button" disabled={!view.actions.canPlayDrawn || busy} onClick={requestDrawnPlay} className="rounded-full bg-[#b23853] px-4 py-3 text-sm font-bold text-white">Jouer cette carte</button><button type="button" disabled={!view.actions.canKeepDrawn || busy} onClick={() => void send({ type: "KEEP_DRAWN" })} className="rounded-full border border-[#b23853]/30 bg-white px-4 py-3 text-sm font-bold text-[#8f2942]">Garder et passer</button></div></section>}

        <section className="mt-6 rounded-[2rem] border border-[var(--line)] bg-[var(--card)] p-4 sm:p-6" aria-label="Ta main">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#b23853]">Ta main</p><h2 className="mt-1 text-2xl font-black">{view.hand.length} carte{view.hand.length > 1 ? "s" : ""}</h2></div>{isMyTurn && view.phase === "playing" && <p className="text-sm font-bold text-[var(--muted)]">{view.playableCardIds.length ? "Sélectionne une carte jouable" : "Aucune carte jouable"}</p>}</div>
          <div className="mt-5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-3 pt-2 sm:flex-wrap sm:justify-center sm:overflow-visible">{view.hand.map((card) => <UnoCardButton key={card.id} card={card} playable={view.playableCardIds.includes(card.id)} selected={selectedCardId === card.id} disabled={view.phase !== "playing" || !isMyTurn || !view.playableCardIds.includes(card.id) || busy} onClick={() => setSelectedCardId(card.id)} />)}</div>
          {needsAnnouncement && view.phase === "playing" && isMyTurn && <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 text-sm font-bold text-[#8f2942]"><input type="checkbox" checked={announceNext} onChange={(event) => setAnnounceNext(event.target.checked)} /> Dernière carte ! <span className="font-normal text-[var(--muted)]">(pour la prochaine carte seulement)</span></label>}
          {view.phase === "playing" && isMyTurn && <div className="mt-5 flex flex-wrap justify-center gap-2"><button type="button" disabled={!selectedIsPlayable || busy} onClick={requestSelectedPlay} className="rounded-full bg-[#b23853] px-5 py-3 font-bold text-white">Jouer la carte sélectionnée</button><button type="button" disabled={!view.actions.canDraw || busy} onClick={() => void send({ type: "DRAW" })} className="rounded-full border border-[var(--line)] bg-white px-5 py-3 font-bold">Piocher</button></div>}
          {view.phase === "playing" && !isMyTurn && <p className="mt-5 text-center text-sm font-bold text-[var(--muted)]">Ton adversaire joue. Ta main reste privée.</p>}
        </section>

        {view.phase === "finished" && <FinishedPanel view={view} back={() => router.push(`/salons/${match.roomId}`)} />}
        {view.phase !== "finished" && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-[var(--line)] bg-white/50 p-4 text-sm"><span className="text-[var(--muted)]">Besoin d&apos;arrêter la partie ?</span><div className="flex gap-2"><button type="button" disabled={busy} onClick={() => { if (window.confirm("Abandonner cette partie ?")) void send({ type: "RESIGN" }); }} className="rounded-full px-3 py-2 font-bold text-[var(--muted)] hover:bg-red-50 hover:text-red-700">Abandonner</button></div></div>}
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
      {pendingPlay && <ColorDialog onCancel={closeColorDialog} onChoose={(color) => { void chooseColor(color); }} />}
    </main>
  );
}

function phaseLabel(view: UnoView, isMyTurn: boolean): string {
  if (view.phase === "finished") return "Partie terminée";
  if (view.phase === "after_draw") return isMyTurn ? "Choisis : jouer la carte piochée ou la garder" : "Ton adversaire choisit sa carte piochée";
  return isMyTurn ? "À toi de jouer" : "Au tour de ton adversaire";
}

function PlayerPanel({ player, isMe }: { player: UnoView["players"][number]; isMe: boolean }) {
  return <div className={`rounded-2xl border p-4 ${isMe ? "border-[#b23853]/50 bg-[#fff0f3]" : "border-[var(--line)] bg-white/70"}`}><div className="flex items-center justify-between gap-3"><span className="font-black">{player.pseudo}{isMe ? " · toi" : ""}</span><span className="text-2xl font-black">{player.cardCount}</span></div><p className="mt-1 text-xs font-bold text-[var(--muted)]">{player.active ? "À son tour" : `${player.cardCount} carte${player.cardCount > 1 ? "s" : ""}`}</p></div>;
}

function UnoCardButton({ card, playable, selected, disabled, onClick }: { card: UnoCard; playable: boolean; selected: boolean; disabled: boolean; onClick: () => void }) {
  return <button type="button" aria-label={`${cardLabel(card)}${playable ? " · jouable" : ""}`} aria-pressed={selected} disabled={disabled} onClick={onClick} className={`snap-start transition-transform sm:hover:-translate-y-2 ${selected ? "-translate-y-3" : ""} ${!playable ? "opacity-60 grayscale-[0.2]" : ""}`}><UnoCard card={card} /></button>;
}

function UnoCard({ card }: { card: UnoCard }) {
  const wild = card.color === null;
  const backgroundColor = card.color === null ? undefined : cardColors[card.color];
  return <div className={`relative grid h-36 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-white text-white shadow-[0_8px_16px_rgba(20,33,29,0.2)] sm:h-40 sm:w-28 ${wild ? "bg-[#292638]" : ""}`} style={{ backgroundColor }}><span className="absolute inset-2 rounded-[45%] border-2 border-white/40" aria-hidden="true" /><span className="relative z-10 text-3xl font-black drop-shadow sm:text-4xl">{cardLabel(card)}</span>{wild && <span className="absolute bottom-2 text-[9px] font-black uppercase tracking-[0.2em] text-white/70">Joker</span>}</div>;
}

function CardBack() {
  return <div className="grid h-36 w-24 place-items-center rounded-2xl border-4 border-white bg-[#292638] shadow-[0_8px_16px_rgba(20,33,29,0.2)] sm:h-40 sm:w-28"><div className="grid size-16 rotate-[-12deg] place-items-center rounded-[45%] border-2 border-[#f3b7c4] text-xs font-black text-[#f3b7c4]">UNO</div></div>;
}

export function ColorDialog({ onCancel, onChoose }: { onCancel: () => void; onChoose: (color: UnoColor) => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstColorRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstColorRef.current?.focus();
  }, []);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []);
    if (buttons.length === 0) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return <div className="fixed inset-0 z-20 grid place-items-center bg-[var(--ink)]/50 p-5" role="dialog" aria-modal="true" aria-labelledby="uno-color-title" onKeyDown={onKeyDown}><div ref={dialogRef} className="w-full max-w-md rounded-3xl bg-[var(--card)] p-6 shadow-2xl"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#b23853]">Joker</p><h2 id="uno-color-title" className="mt-2 text-2xl font-black">Choisis la couleur</h2><div className="mt-5 grid grid-cols-2 gap-3">{(Object.keys(colorNames) as UnoColor[]).map((color, index) => <button ref={index === 0 ? firstColorRef : undefined} type="button" key={color} onClick={() => onChoose(color)} className="rounded-2xl px-4 py-5 text-lg font-black text-white" style={{ backgroundColor: cardColors[color] }}>{colorNames[color]}</button>)}</div><button type="button" onClick={onCancel} className="mt-4 w-full rounded-full border border-[var(--line)] bg-white px-4 py-3 font-bold">Annuler</button></div></div>;
}

function FinishedPanel({ view, back }: { view: UnoView; back: () => void }) {
  const result = view.result;
  const winner = result?.winnerId === view.players[view.mySeat].id;
  const title = result?.outcome === "draw" ? "Égalité" : result?.outcome === "abandoned" ? "Partie interrompue" : winner ? "Victoire" : "Défaite";
  const remaining = view.opponentHand ?? [];
  return <section className="mt-7 rounded-[2rem] border border-[var(--line)] bg-[var(--card)] p-6 text-center"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#b23853]">Résultats</p><h1 className="mt-2 text-5xl font-black tracking-[-0.05em]">{title}</h1><div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3">{view.players.map((player) => <div key={player.id} className="rounded-2xl bg-[var(--paper)] p-4"><p className="text-sm font-bold">{player.pseudo}</p><p className="mt-1 text-3xl font-black">{result?.players[player.seat]?.score ?? 0}</p><p className="text-xs text-[var(--muted)]">points</p></div>)}</div>{remaining.length > 0 && <div className="mt-6"><p className="text-sm font-bold">Main adverse révélée</p><div className="mt-3 flex flex-wrap justify-center gap-2">{remaining.map((card) => <div key={card.id} className="scale-75"><UnoCard card={card} /></div>)}</div></div>}<button type="button" onClick={back} className="mt-7 rounded-full bg-[#b23853] px-5 py-3 font-bold text-white">Retour au salon</button></section>;
}
