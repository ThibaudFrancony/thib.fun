"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NAVAL_SHIP_CATALOG } from "@/games/bataille-navale/config";
import type { NavalAction, NavalShipView, NavalShotView, NavalView } from "@/games/bataille-navale/types";
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
  view: NavalView;
};

const ACCENT = "#6d28d9";
const ROW_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

function cellLabel(row: number, col: number): string {
  return `${ROW_LABELS[row]}${col + 1}`;
}

type ShipId = "carrier" | "battleship" | "cruiser" | "submarine" | "destroyer";

type DraftShip = { id: ShipId; row: number; col: number; orientation: "horizontal" | "vertical" };

function lengthOf(id: string): number {
  return NAVAL_SHIP_CATALOG.find((entry) => entry.id === id)?.length ?? 0;
}

function draftCells(ship: DraftShip): { row: number; col: number }[] {
  const cells: { row: number; col: number }[] = [];
  for (let offset = 0; offset < lengthOf(ship.id); offset += 1) {
    cells.push(
      ship.orientation === "horizontal" ? { row: ship.row, col: ship.col + offset } : { row: ship.row + offset, col: ship.col },
    );
  }
  return cells;
}

function draftValid(ships: DraftShip[]): boolean {
  if (ships.length !== 5) return false;
  const ids = ships.map((ship) => ship.id).sort();
  const expected = NAVAL_SHIP_CATALOG.map((entry) => entry.id).sort();
  if (JSON.stringify(ids) !== JSON.stringify(expected)) return false;
  const occupied = new Set<string>();
  for (const ship of ships) {
    for (const cell of draftCells(ship)) {
      if (cell.row < 0 || cell.row > 9 || cell.col < 0 || cell.col > 9) return false;
      const key = `${cell.row}:${cell.col}`;
      if (occupied.has(key)) return false;
      occupied.add(key);
    }
  }
  return true;
}

export function BatailleNavaleMatch({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<"shots" | "fleet">("shots");
  const [zoom, setZoom] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const {
    snapshot: match,
    error,
    busy,
    serverOffset,
    refresh,
    send,
  } = useResourceNetwork<MatchResponse, NavalAction>({
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
  });

  useEffect(() => {
    const clockTimer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clockTimer);
  }, []);

  const view = match?.view ?? null;
  const remaining = match?.deadlineAt ? Math.max(0, Math.ceil((Date.parse(match.deadlineAt) - (now + serverOffset)) / 1000)) : null;

  if (error && !match) {
    return <main className="min-h-screen px-5 py-12"><div role="alert" className="mx-auto max-w-xl rounded-2xl bg-red-50 p-5 text-red-700">{error}</div></main>;
  }
  if (!match || !view) {
    return <main className="min-h-screen px-5 py-12"><div className="mx-auto max-w-xl rounded-3xl border border-[var(--line)] bg-white/70 p-8 text-center text-[var(--muted)]">Chargement de la partie…</div></main>;
  }

  const isMyTurn = view.phase === "playing" && view.activePlayerId !== null && view.players[view.mySeat].id === view.activePlayerId;
  const me = view.players[view.mySeat];
  const opponent = view.players[(1 - view.mySeat) as 0 | 1];

  return (
    <main className="min-h-screen pb-10">
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-8 sm:py-7">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => router.push(`/salons/${match.roomId}`)} className="rounded-full px-3 py-2 text-sm font-bold text-[var(--muted)] hover:bg-white">← Salon</button>
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6d28d9]">Flotte cachée</p>
            <p className="font-black">Tour {view.turn}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setZoom((current) => !current)}
              aria-pressed={zoom}
              className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-sm font-bold"
            >
              {zoom ? "Grille normale" : "Grille agrandie"}
            </button>
            <button type="button" onClick={() => void refresh()} className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-sm font-bold">Actualiser</button>
          </div>
        </header>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ScorePanel pseudo={opponent.pseudo} score={opponent.score} active={opponent.active} isMe={false} />
          <ScorePanel pseudo={`${me.pseudo} · toi`} score={me.score} active={me.active} isMe />
        </div>

        <div aria-live="polite" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--ink)] px-4 py-3 text-sm font-bold text-white">
          <span>{phaseLabel(view, isMyTurn)}</span>
          {remaining !== null && view.phase === "playing" && (
            <strong className={remaining <= 10 ? "text-[var(--yellow)]" : "text-white"}>{remaining}s</strong>
          )}
        </div>

        {view.phase === "setup" && (
          <SetupPanel view={view} busy={busy} send={send} />
        )}

        {view.phase !== "setup" && (
          <>
            <div className="mt-4 flex gap-2 sm:hidden" role="tablist" aria-label="Choix de la grille">
              <button type="button" role="tab" aria-selected={tab === "shots"} onClick={() => setTab("shots")} className={`flex-1 rounded-full px-4 py-3 text-sm font-black ${tab === "shots" ? "bg-[#6d28d9] text-white" : "bg-white text-[var(--muted)]"}`}>Mes tirs</button>
              <button type="button" role="tab" aria-selected={tab === "fleet"} onClick={() => setTab("fleet")} className={`flex-1 rounded-full px-4 py-3 text-sm font-black ${tab === "fleet" ? "bg-[#6d28d9] text-white" : "bg-white text-[var(--muted)]"}`}>Ma flotte</button>
            </div>
            <div className="mt-6 grid gap-6 md:grid-cols-2 md:items-start">
              <section aria-label="Grille de tirs" className={tab === "shots" ? "" : "hidden md:block"}>
                <p className="mb-2 text-center text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Tes tirs · {opponent.pseudo}</p>
                <FireGrid view={view} busy={busy} zoom={zoom} onFire={(row, col) => void send({ type: "FIRE", row, col })} />
              </section>
              <section aria-label="Ma flotte" className={tab === "fleet" ? "" : "hidden md:block"}>
                <p className="mb-2 text-center text-xs font-black uppercase tracking-[0.16em] text-[#6d28d9]">Ta flotte</p>
                <FleetGrid fleet={view.myFleet} incoming={view.incomingShots} zoom={zoom} />
                <SunkList title="Bateaux coulés chez l'adversaire" ids={view.sunkByMe} />
                <SunkList title="Tes bateaux coulés" ids={view.sunkOfMine} />
              </section>
            </div>
            <p className="mt-4 rounded-2xl bg-[#f1eafe] px-4 py-3 text-center text-sm font-bold text-[#4c1d95]">
              Toucher ou couler ne fait pas rejouer. Les bateaux peuvent se toucher.
            </p>
          </>
        )}

        {view.phase === "finished" && <FinishedPanel view={view} back={() => router.push(`/salons/${match.roomId}`)} />}

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

function phaseLabel(view: NavalView, isMyTurn: boolean): string {
  switch (view.phase) {
    case "setup":
      return view.myReady
        ? view.opponentReady ? "Les deux flottes sont prêtes…" : "Flotte verrouillée. Ton adversaire place la sienne…"
        : "Place ta flotte en secret";
    case "playing":
      if (view.lastShot?.shot.automatic) return `Tir automatique en ${cellLabel(view.lastShot.shot.row, view.lastShot.shot.col)}`;
      return isMyTurn ? "À toi de tirer" : "Au tour de ton adversaire";
    case "finished":
      return "Partie terminée";
  }
}

function ScorePanel({ pseudo, score, active, isMe }: { pseudo: string; score: number; active: boolean; isMe: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${isMe ? "border-[#6d28d9]/50 bg-[#f1eafe]" : "border-[var(--line)] bg-white/70"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-black">{pseudo}</span>
        <span className="text-2xl font-black tabular-nums">{score}<span className="text-sm font-bold text-[var(--muted)]">/17</span></span>
      </div>
      <p className="mt-1 text-xs font-bold text-[var(--muted)]">{active ? "À son tour" : "17 cases à toucher"}</p>
    </div>
  );
}

function shotSymbol(shot: NavalShotView): { text: string; background: string; color: string } {
  if (shot.result === "miss") return { text: "○", background: "#eef2f1", color: "#536157" };
  if (shot.result === "hit") return { text: "✕", background: "#f4c95d", color: "#5b3b00" };
  return { text: "■", background: "#b42318", color: "#ffffff" };
}

function FireGrid({ view, busy, zoom, onFire }: { view: NavalView; busy: boolean; zoom: boolean; onFire: (row: number, col: number) => void }) {
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [focus, setFocus] = useState({ row: 0, col: 0 });
  const gridRef = useRef<HTMLDivElement | null>(null);
  const shotMap = useMemo(() => {
    const map = new Map<string, NavalShotView>();
    for (const shot of view.myShots) map.set(`${shot.row}:${shot.col}`, shot);
    return map;
  }, [view.myShots]);
  const canFire = view.allowedActions.includes("FIRE") && !busy && view.phase === "playing";

  function moveFocus(row: number, col: number) {
    const next = { row: Math.max(0, Math.min(9, row)), col: Math.max(0, Math.min(9, col)) };
    setFocus(next);
    window.setTimeout(() => {
      gridRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${next.row}-${next.col}"]`)?.focus();
    }, 0);
  }

  const size = zoom ? "h-11 w-11 text-lg sm:h-12 sm:w-12" : "h-8 w-8 text-sm sm:h-9 sm:w-9";
  return (
    <div>
      <div ref={gridRef} role="grid" aria-label="Grille de tirs, 10 par 10" className="mx-auto grid w-fit grid-cols-10 gap-1">
        {Array.from({ length: 100 }, (_, index) => {
          const row = Math.floor(index / 10);
          const col = index % 10;
          const shot = shotMap.get(`${row}:${col}`);
          const isSelected = selected?.row === row && selected?.col === col;
          const isMyLast = view.lastShot && view.lastShot.shot.row === row && view.lastShot.shot.col === col;
          if (shot) {
            const symbol = shotSymbol(shot);
            return (
              <div
                key={index}
                role="gridcell"
                aria-label={`${cellLabel(row, col)}, ${shot.result === "miss" ? "manqué" : shot.result === "hit" ? "touché" : "coulé"}${isMyLast ? ", dernier tir" : ""}`}
                className={`${size} grid place-items-center rounded-lg font-black${isMyLast ? " ring-2 ring-[#6d28d9] ring-offset-1" : ""}`}
                style={{ backgroundColor: symbol.background, color: symbol.color }}
              >
                {symbol.text}
              </div>
            );
          }
          return (
            <button
              key={index}
              type="button"
              role="gridcell"
              data-cell={`${row}-${col}`}
              disabled={!canFire}
              tabIndex={focus.row === row && focus.col === col ? 0 : -1}
              onClick={() => { setFocus({ row, col }); setSelected({ row, col }); }}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp") { event.preventDefault(); moveFocus(row - 1, col); }
                else if (event.key === "ArrowDown") { event.preventDefault(); moveFocus(row + 1, col); }
                else if (event.key === "ArrowLeft") { event.preventDefault(); moveFocus(row, col - 1); }
                else if (event.key === "ArrowRight") { event.preventDefault(); moveFocus(row, col + 1); }
                else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected({ row, col }); }
              }}
              aria-label={`${cellLabel(row, col)}, case inconnue${isSelected ? ", sélectionnée" : ""}`}
              className={`${size} grid place-items-center rounded-lg bg-[#2b3a55] font-bold text-[#b9c8e4] transition-transform hover:bg-[#35486a]${isSelected ? " -translate-y-0.5" : ""}`}
              style={isSelected ? { outline: `3px solid ${ACCENT}`, outlineOffset: 1 } : undefined}
            >
              ·
            </button>
          );
        })}
      </div>
      <div className="mt-4 text-center">
        {selected && canFire ? (
          <button
            type="button"
            onClick={() => { onFire(selected.row, selected.col); setSelected(null); }}
            className="rounded-full bg-[#6d28d9] px-6 py-3 font-bold text-white hover:bg-[#5b21b6]"
          >
            Tirer en {cellLabel(selected.row, selected.col)}
          </button>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            {view.phase !== "playing" ? "La partie n'a pas commencé." : canFire ? "Choisis une case, puis confirme ton tir." : "En attente du tir adverse…"}
          </p>
        )}
        {view.lastShot && (
          <p className="mt-2 text-xs font-bold text-[var(--muted)]">
            Dernier tir{view.lastShot.shot.automatic ? " (automatique)" : ""} : {cellLabel(view.lastShot.shot.row, view.lastShot.shot.col)} ·{" "}
            {view.lastShot.shot.result === "miss" ? "manqué" : view.lastShot.shot.result === "hit" ? "touché" : "coulé"}
          </p>
        )}
      </div>
    </div>
  );
}

function FleetGrid({ fleet, incoming, zoom }: { fleet: NavalShipView[]; incoming: NavalShotView[]; zoom: boolean }) {
  const shipMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const ship of fleet) {
      for (let offset = 0; offset < ship.length; offset += 1) {
        const key = ship.orientation === "horizontal" ? `${ship.row}:${ship.col + offset}` : `${ship.row + offset}:${ship.col}`;
        map.set(key, ship.id);
      }
    }
    return map;
  }, [fleet]);
  const incomingMap = useMemo(() => {
    const map = new Map<string, NavalShotView>();
    for (const shot of incoming) map.set(`${shot.row}:${shot.col}`, shot);
    return map;
  }, [incoming]);
  const size = zoom ? "h-11 w-11 text-lg sm:h-12 sm:w-12" : "h-8 w-8 text-sm sm:h-9 sm:w-9";
  return (
    <div aria-label="Ma flotte" className="mx-auto grid w-fit grid-cols-10 gap-1">
      {Array.from({ length: 100 }, (_, index) => {
        const row = Math.floor(index / 10);
        const col = index % 10;
        const shipId = shipMap.get(`${row}:${col}`);
        const hit = incomingMap.get(`${row}:${col}`);
        const label = `${cellLabel(row, col)}${shipId ? `, ${shipId}` : ", eau"}${hit ? (hit.result === "miss" ? ", tir adverse manqué" : ", touché par l'adversaire") : ""}`;
        if (hit && hit.result !== "miss") {
          return <div key={index} aria-label={label} className={`${size} grid place-items-center rounded-lg bg-[#f4c95d] font-black text-[#5b3b00]`}>✕</div>;
        }
        if (hit) {
          return <div key={index} aria-label={label} className={`${size} grid place-items-center rounded-lg bg-[#eef2f1] font-black text-[#536157]`}>○</div>;
        }
        if (shipId) {
          return <div key={index} aria-label={label} className={`${size} grid place-items-center rounded-lg bg-[#6d28d9] font-black text-white`}>●</div>;
        }
        return <div key={index} aria-label={label} className={`${size} grid place-items-center rounded-lg bg-[#dfe7ea] text-[#8aa0a8]`}>·</div>;
      })}
    </div>
  );
}

function SunkList({ title, ids }: { title: string; ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <p className="mt-3 text-center text-sm font-bold text-[#4c1d95]">
      {title} : {ids.join(", ")} ({ids.length})
    </p>
  );
}

function SetupPanel({ view, busy, send }: { view: NavalView; busy: boolean; send: (action: NavalAction) => Promise<MatchResponse | null> }) {
  const [draft, setDraft] = useState<DraftShip[]>(() =>
    view.myFleet.map((ship) => ({ id: ship.id as ShipId, row: ship.row, col: ship.col, orientation: ship.orientation })),
  );
  const [selectedId, setSelectedId] = useState<ShipId>(NAVAL_SHIP_CATALOG[0].id as ShipId);
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [focus, setFocus] = useState({ row: 0, col: 0 });
  const gridRef = useRef<HTMLDivElement | null>(null);
  const saveTimer = useRef<number | null>(null);

  const occupied = useMemo(() => {
    const map = new Map<string, string>();
    for (const ship of draft) {
      for (const cell of draftCells(ship)) map.set(`${cell.row}:${cell.col}`, ship.id);
    }
    return map;
  }, [draft]);

  function persist(next: DraftShip[]) {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void send({ type: "SET_FLEET", ships: next.map((ship) => ({ id: ship.id, row: ship.row, col: ship.col, orientation: ship.orientation })) });
    }, 600);
  }

  useEffect(() => () => { if (saveTimer.current !== null) window.clearTimeout(saveTimer.current); }, []);

  function placeAt(row: number, col: number) {
    if (view.myReady || busy) return;
    const next = draft.filter((ship) => ship.id !== selectedId);
    next.push({ id: selectedId, row, col, orientation });
    setDraft(next);
    persist(next);
  }

  function removeShip(id: string) {
    if (view.myReady || busy) return;
    const next = draft.filter((ship) => ship.id !== id);
    setDraft(next);
    persist(next);
  }

  const valid = draftValid(draft);
  const size = "h-8 w-8 text-sm sm:h-9 sm:w-9";
  const selectedLength = lengthOf(selectedId);

  return (
    <section aria-label="Préparation de la flotte" className="mt-6 grid gap-6 md:grid-cols-[1fr_280px] md:items-start">
      <div>
        <div ref={gridRef} role="grid" aria-label="Grille de placement, 10 par 10" className="mx-auto grid w-fit grid-cols-10 gap-1">
          {Array.from({ length: 100 }, (_, index) => {
            const row = Math.floor(index / 10);
            const col = index % 10;
            const occupant = occupied.get(`${row}:${col}`);
            return (
              <button
                key={index}
                type="button"
                role="gridcell"
                disabled={view.myReady || busy}
                tabIndex={focus.row === row && focus.col === col ? 0 : -1}
                onClick={() => { setFocus({ row, col }); placeAt(row, col); }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp") { event.preventDefault(); setFocus((f) => ({ row: Math.max(0, f.row - 1), col: f.col })); gridRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${Math.max(0, row - 1)}-${col}"]`)?.focus(); }
                  else if (event.key === "ArrowDown") { event.preventDefault(); gridRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${Math.min(9, row + 1)}-${col}"]`)?.focus(); setFocus((f) => ({ row: Math.min(9, f.row + 1), col: f.col })); }
                  else if (event.key === "ArrowLeft") { event.preventDefault(); gridRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${row}-${Math.max(0, col - 1)}"]`)?.focus(); setFocus((f) => ({ row: f.row, col: Math.max(0, f.col - 1) })); }
                  else if (event.key === "ArrowRight") { event.preventDefault(); gridRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${row}-${Math.min(9, col + 1)}"]`)?.focus(); setFocus((f) => ({ row: f.row, col: Math.min(9, f.col + 1) })); }
                  else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); placeAt(row, col); }
                }}
                data-cell={`${row}-${col}`}
                aria-label={`${cellLabel(row, col)}${occupant ? `, occupée par ${occupant}` : ", libre"}`}
                className={`${size} grid place-items-center rounded-lg font-black ${occupant ? "bg-[#6d28d9] text-white" : "bg-[#dfe7ea] text-[#536157] hover:bg-[#cdd9dd]"}`}
              >
                {occupant ? "●" : "·"}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-center text-sm text-[var(--muted)]">
          Bateau choisi : <strong>{selectedId}</strong> ({selectedLength} cases, {orientation === "horizontal" ? "horizontal" : "vertical"}).
          Touche une case pour le poser.
        </p>
      </div>
      <div className="space-y-2">
        {NAVAL_SHIP_CATALOG.map((entry) => {
          const placed = draft.find((ship) => ship.id === entry.id);
          return (
            <div key={entry.id} className={`flex items-center justify-between gap-2 rounded-2xl border p-3 ${selectedId === entry.id ? "border-[#6d28d9] bg-[#f1eafe]" : "border-[var(--line)] bg-white/70"}`}>
              <button type="button" disabled={view.myReady} onClick={() => setSelectedId(entry.id)} className="text-left font-black" aria-pressed={selectedId === entry.id}>
                {entry.id} <span className="font-bold text-[var(--muted)]">· {entry.length}</span>
                <span className="block text-xs font-bold text-[var(--muted)]">{placed ? `posé en ${cellLabel(placed.row, placed.col)}` : "à placer"}</span>
              </button>
              {placed && !view.myReady && (
                <button type="button" onClick={() => removeShip(entry.id)} aria-label={`Retirer ${entry.id}`} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-bold">Retirer</button>
              )}
            </div>
          );
        })}
        <div className="flex gap-2">
          <button type="button" disabled={view.myReady || busy} onClick={() => setOrientation((o) => (o === "horizontal" ? "vertical" : "horizontal"))} className="flex-1 rounded-full border border-[var(--line)] bg-white px-3 py-3 text-sm font-bold">
            Pivoter ({orientation === "horizontal" ? "→" : "↓"})
          </button>
          <button type="button" disabled={view.myReady || busy} onClick={() => { void (async () => {
            // Le serveur remplace toute la flotte : adopter la flotte
            // renvoyée pour ne pas réécraser le tirage au prochain dépôt.
            const next = await send({ type: "RANDOMIZE_FLEET" });
            if (next) {
              setDraft(next.view.myFleet.map((ship) => ({ id: ship.id as ShipId, row: ship.row, col: ship.col, orientation: ship.orientation })));
            }
          })(); }} className="flex-1 rounded-full border border-[var(--line)] bg-white px-3 py-3 text-sm font-bold">
            Aléatoire
          </button>
        </div>
        {!view.myReady ? (
          <button
            type="button"
            disabled={!valid || busy || !view.allowedActions.includes("READY_FLEET")}
            onClick={() => void send({ type: "READY_FLEET" })}
            className="w-full rounded-full bg-[#6d28d9] px-4 py-3 font-bold text-white hover:bg-[#5b21b6]"
          >
            Valider ma flotte ({draft.length}/5)
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || !view.allowedActions.includes("UNREADY_FLEET")}
            onClick={() => void send({ type: "UNREADY_FLEET" })}
            className="w-full rounded-full border border-[#6d28d9]/40 bg-white px-4 py-3 font-bold text-[#5b21b6]"
          >
            Modifier ma flotte
          </button>
        )}
        <p className="text-center text-sm font-bold text-[var(--muted)]">
          {view.opponentReady ? "Ton adversaire est prêt." : "Ton adversaire place sa flotte…"}
        </p>
      </div>
    </section>
  );
}

function FinishedPanel({ view, back }: { view: NavalView; back: () => void }) {
  const result = view.result;
  const won = result?.winnerId !== null && result?.winnerId === view.players[view.mySeat].id;
  const title = result?.outcome === "abandoned" ? "Partie interrompue" : won ? "Victoire" : "Défaite";
  const accuracy = view.hitsByMe + view.missesByMe === 0 ? null : view.hitsByMe / (view.hitsByMe + view.missesByMe);
  return (
    <section className="mt-7 rounded-[2rem] border border-[var(--line)] bg-[var(--card)] p-6 text-center">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6d28d9]">Résultats</p>
      <h1 className="mt-2 text-5xl font-black tracking-[-0.05em]">{title}</h1>
      <div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3">
        {view.players.map((player) => (
          <div key={player.id} className="rounded-2xl bg-[var(--paper)] p-4">
            <p className="text-sm font-bold">{player.pseudo}</p>
            <p className="mt-1 text-3xl font-black tabular-nums">{result?.players[player.seat]?.score ?? 0}<span className="text-base">/17</span></p>
            <p className="text-xs text-[var(--muted)]">cases touchées</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-[var(--muted)]">
        {view.sunkByMe.length} bateau{view.sunkByMe.length > 1 ? "x" : ""} coulé{view.sunkByMe.length > 1 ? "s" : ""}
        {accuracy === null ? " · aucun tir" : ` · précision ${Math.round(accuracy * 100)} %`} · tour {view.turn}.
      </p>
      {view.opponentFleet && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Flotte adverse révélée</p>
          <FleetGrid fleet={view.opponentFleet} incoming={view.myShots} zoom={false} />
        </div>
      )}
      <button type="button" onClick={back} className="mt-7 rounded-full bg-[#6d28d9] px-5 py-3 font-bold text-white hover:bg-[#5b21b6]">
        Retour au salon
      </button>
    </section>
  );
}
