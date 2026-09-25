"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MatchToolbar, MatchDetails } from "@/components/match-toolbar";
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

const ROW_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

const SHIP_NAMES: Record<string, string> = {
  carrier: "Porte-avions",
  battleship: "Cuirassé",
  cruiser: "Croiseur",
  submarine: "Sous-marin",
  destroyer: "Destroyer",
};

function shipName(id: string): string {
  return SHIP_NAMES[id] ?? id;
}

function cellLabel(row: number, col: number): string {
  return `${ROW_LABELS[row]}${col + 1}`;
}

type ShipId = "carrier" | "battleship" | "cruiser" | "submarine" | "destroyer";

type DraftShip = { id: ShipId; row: number; col: number; orientation: "horizontal" | "vertical" };

type Cell = { row: number; col: number };

function lengthOf(id: string): number {
  return NAVAL_SHIP_CATALOG.find((entry) => entry.id === id)?.length ?? 0;
}

function draftCells(ship: DraftShip): Cell[] {
  const cells: Cell[] = [];
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

/** La prévisualisation de placement est purement locale : jamais envoyée au serveur. */
function previewPlacement(selectedId: ShipId, orientation: "horizontal" | "vertical", origin: Cell, others: DraftShip[]): { cells: Cell[]; valid: boolean } {
  const candidate: DraftShip = { id: selectedId, row: origin.row, col: origin.col, orientation };
  const cells = draftCells(candidate);
  const occupied = new Set<string>();
  for (const ship of others) {
    if (ship.id === selectedId) continue;
    for (const cell of draftCells(ship)) occupied.add(`${cell.row}:${cell.col}`);
  }
  const valid = cells.every(
    (cell) => cell.row >= 0 && cell.row <= 9 && cell.col >= 0 && cell.col <= 9 && !occupied.has(`${cell.row}:${cell.col}`),
  );
  return { cells, valid };
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
    return <main className="naval-page table-page table-naval naval-shell--state"><div role="alert" className="naval-state-card">{error}</div></main>;
  }
  if (!match || !view) {
    return <main className="naval-page table-page table-naval naval-shell--state"><div className="naval-state-card">Chargement de la partie…</div></main>;
  }

  const isMyTurn = view.phase === "playing" && view.activePlayerId !== null && view.players[view.mySeat].id === view.activePlayerId;
  const me = view.players[view.mySeat];
  const opponent = view.players[(1 - view.mySeat) as 0 | 1];

  return (
    <main className="naval-page table-page table-naval play-screen" data-phase={view.phase}>
      <div className="naval-shell play-shell">
        <MatchToolbar title="Flotte cachée" busy={busy} onBack={() => router.push(`/salons/${match.roomId}`)} onRefresh={() => void refresh()} onResign={view.phase === "finished" ? undefined : () => void send({ type: "RESIGN" })}>
          <div className="naval-scoreboard">
          <ScorePanel pseudo={opponent.pseudo} score={opponent.score} active={opponent.active} isMe={false} />
          <ScorePanel pseudo={`${me.pseudo} · toi`} score={me.score} active={me.active} isMe />
        </div>
        <button type="button" aria-pressed={zoom} onClick={() => setZoom((current) => !current)}>{zoom ? "Grille normale" : "Grille agrandie"}</button></MatchToolbar>
        <div key={`naval-status-${view.phase}`} aria-live="polite" className="naval-status-bar motion-word-in" data-urgent={remaining !== null && remaining <= 10 && view.phase === "playing"}>
          <span>{phaseLabel(view, isMyTurn)}</span>
          {remaining !== null && view.phase === "playing" && (
            <strong className="naval-timer">{remaining}s</strong>
          )}
        </div>

        {view.phase === "setup" && (
          <SetupPanel view={view} busy={busy} send={send} />
        )}

        {view.phase === "playing" && (
          <>
            <div className="naval-tabs" role="tablist" aria-label="Choix de la grille">
              <button type="button" role="tab" aria-selected={tab === "shots"} data-active={tab === "shots"} onClick={() => setTab("shots")}>Mes tirs</button>
              <button type="button" role="tab" aria-selected={tab === "fleet"} data-active={tab === "fleet"} onClick={() => setTab("fleet")}>Ma flotte</button>
            </div>
            <div key={`naval-tab-${tab}`} className="naval-game-layout motion-word-in">
              <section aria-label="Grille de tirs" className={`naval-panel naval-board-panel ${tab === "shots" ? "" : "hidden md:block"}`}>
                <p className="naval-board-title">Tes tirs · <strong>{opponent.pseudo}</strong></p>
                <FireGrid view={view} busy={busy} zoom={zoom} onFire={(row, col) => void send({ type: "FIRE", row, col })} />
              </section>
              <section aria-label="Ma flotte" className={`naval-panel naval-board-panel ${tab === "fleet" ? "" : "hidden md:block"}`}>
                <p className="naval-board-title"><strong>Ta flotte</strong></p>
                <FleetGrid fleet={view.myFleet} incoming={view.incomingShots} lastShot={view.lastShot} mySeat={view.mySeat} zoom={zoom} />

              </section>
            </div>
          </>
        )}

        {view.phase === "finished" && <FinishedPanel view={view} back={() => router.push("/jeux/bataille-navale")} />}

        {error && <p role="alert" className="naval-error" style={{ marginTop: "1rem" }}>{error}</p>}
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
    <div className="naval-score-card" data-self={isMe} data-active={active}>
      <div className="naval-score-topline">
        <span className="naval-player-name">{pseudo}</span>
        <span className="naval-player-score">{score}<small>/17</small></span>
      </div>
      <p className="naval-score-status">{active ? "À son tour" : "17 cases à toucher"}</p>
    </div>
  );
}

function shotState(shot: NavalShotView): "miss" | "hit" | "sunk" {
  return shot.result;
}

function FireGrid({ view, busy, zoom, onFire }: { view: NavalView; busy: boolean; zoom: boolean; onFire: (row: number, col: number) => void }) {
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [focus, setFocus] = useState({ row: 0, col: 0 });
  const [hoverCell, setHoverCell] = useState<Cell | null>(null);
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

  return (
    <div>
      <div ref={gridRef} role="grid" aria-label="Grille de tirs, 10 par 10" className="naval-board" data-zoom={zoom}>
        {Array.from({ length: 100 }, (_, index) => {
          const row = Math.floor(index / 10);
          const col = index % 10;
          const shot = shotMap.get(`${row}:${col}`);
          const isSelected = selected?.row === row && selected?.col === col;
          const isMyLast = view.lastShot?.by === view.mySeat && view.lastShot.shot.row === row && view.lastShot.shot.col === col;
          if (shot) {
            const state = shotState(shot);
            const symbol = state === "miss" ? "○" : state === "hit" ? "✕" : "■";
            return (
              <div
                key={index}
                role="gridcell"
                aria-label={`${cellLabel(row, col)}, ${state === "miss" ? "manqué" : state === "hit" ? "touché" : "coulé"}${isMyLast ? ", dernier tir" : ""}`}
                className="naval-cell"
                data-state={state}
                data-last={isMyLast || undefined}
              >
                {symbol}
              </div>
            );
          }
          const isAim = canFire && hoverCell?.row === row && hoverCell?.col === col && !isSelected;
          return (
            <button
              key={index}
              type="button"
              role="gridcell"
              data-cell={`${row}-${col}`}
              disabled={!canFire}
              tabIndex={focus.row === row && focus.col === col ? 0 : -1}
              onClick={() => { setFocus({ row, col }); setSelected({ row, col }); }}
              onMouseEnter={() => setHoverCell({ row, col })}
              onMouseLeave={() => setHoverCell(null)}
              onFocus={() => { setFocus({ row, col }); setHoverCell({ row, col }); }}
              onBlur={() => setHoverCell(null)}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp") { event.preventDefault(); moveFocus(row - 1, col); }
                else if (event.key === "ArrowDown") { event.preventDefault(); moveFocus(row + 1, col); }
                else if (event.key === "ArrowLeft") { event.preventDefault(); moveFocus(row, col - 1); }
                else if (event.key === "ArrowRight") { event.preventDefault(); moveFocus(row, col + 1); }
                else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected({ row, col }); }
              }}
              aria-label={`${cellLabel(row, col)}, case inconnue${isSelected ? ", sélectionnée" : ""}`}
              className="naval-cell"
              data-state="unknown"
              data-aim={isAim || undefined}
              data-selected={isSelected || undefined}
            >
              ·
            </button>
          );
        })}
      </div>
      <div className="naval-fire-confirm">
        {selected && canFire ? (
          <button
            type="button"
            onClick={() => { onFire(selected.row, selected.col); setSelected(null); }}
            className="naval-primary-button"
          >
            Tirer en {cellLabel(selected.row, selected.col)}
          </button>
        ) : (
          <p className="naval-fire-idle">
            {view.phase !== "playing" ? "La partie n'a pas commencé." : canFire ? "Choisis une case" : ""}
          </p>
        )}
        {view.lastShot && (
          <p className="naval-last-shot">
            Dernier tir{view.lastShot.shot.automatic ? " (automatique)" : ""} : {cellLabel(view.lastShot.shot.row, view.lastShot.shot.col)} ·{" "}
            {view.lastShot.shot.result === "miss" ? "manqué" : view.lastShot.shot.result === "hit" ? "touché" : "coulé"}
          </p>
        )}
      </div>
    </div>
  );
}

function FleetGrid({ fleet, incoming, lastShot, mySeat, zoom }: { fleet: NavalShipView[]; incoming: NavalShotView[]; lastShot: NavalView["lastShot"]; mySeat: 0 | 1; zoom: boolean }) {
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
  return (
    <div aria-label="Ma flotte" className="naval-board" data-zoom={zoom}>
      {Array.from({ length: 100 }, (_, index) => {
        const row = Math.floor(index / 10);
        const col = index % 10;
        const shipId = shipMap.get(`${row}:${col}`);
        const hit = incomingMap.get(`${row}:${col}`);
        const isOppLast = lastShot !== null && lastShot.by !== mySeat && lastShot.shot.row === row && lastShot.shot.col === col;
        const label = `${cellLabel(row, col)}${shipId ? `, ${shipName(shipId)}` : ", eau"}${hit ? (hit.result === "miss" ? ", tir adverse manqué" : ", touché par l'adversaire") : ""}${isOppLast ? ", dernier tir adverse" : ""}`;
        if (hit && hit.result !== "miss") {
          return <div key={index} aria-label={label} className="naval-cell" data-state={hit.result === "sunk" ? "sunk" : "hit"} data-last={isOppLast || undefined}>✕</div>;
        }
        if (hit) {
          return <div key={index} aria-label={label} className="naval-cell" data-state="miss" data-last={isOppLast || undefined}>○</div>;
        }
        if (shipId) {
          return <div key={index} aria-label={label} className="naval-cell" data-state="ship">●</div>;
        }
        return <div key={index} aria-label={label} className="naval-cell" data-state="water">·</div>;
      })}
    </div>
  );
}

function SetupPanel({ view, busy, send }: { view: NavalView; busy: boolean; send: (action: NavalAction) => Promise<MatchResponse | null> }) {
  const [draft, setDraft] = useState<DraftShip[]>(() =>
    view.myFleet.map((ship) => ({ id: ship.id as ShipId, row: ship.row, col: ship.col, orientation: ship.orientation })),
  );
  const [selectedId, setSelectedId] = useState<ShipId>(NAVAL_SHIP_CATALOG[0].id as ShipId);
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [focus, setFocus] = useState({ row: 0, col: 0 });
  const [hoverCell, setHoverCell] = useState<Cell | null>(null);
  const [pendingTap, setPendingTap] = useState<Cell | null>(null);
  const [shake, setShake] = useState<Cell | null>(null);
  // Pose optimiste : le brouillon local s'affiche aussitôt, la persistance
  // SET_FLEET part en arrière-plan sans jamais bloquer la grille.
  const [dirty, setDirty] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [randomizing, setRandomizing] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const saveTimer = useRef<number | null>(null);
  const shakeTimer = useRef<number | null>(null);
  const draftRef = useRef(draft);
  const dirtyRef = useRef(false);
  const sendingRef = useRef(false);
  const sendRef = useRef(send);
  useEffect(() => {
    draftRef.current = draft;
    sendRef.current = send;
  });

  const occupied = useMemo(() => {
    const map = new Map<string, string>();
    for (const ship of draft) {
      for (const cell of draftCells(ship)) map.set(`${cell.row}:${cell.col}`, ship.id);
    }
    return map;
  }, [draft]);

  function shipsPayload(ships: DraftShip[]) {
    return ships.map((ship) => ({ id: ship.id, row: ship.row, col: ship.col, orientation: ship.orientation }));
  }

  async function persistNow(): Promise<void> {
    if (sendingRef.current) {
      // Un envoi est en cours : réessaie juste après au lieu de le doublonner.
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => void persistNow(), 400);
      return;
    }
    sendingRef.current = true;
    try {
      const sent = draftRef.current;
      const next = await sendRef.current({ type: "SET_FLEET", ships: shipsPayload(sent) });
      if (next === null && draftRef.current === sent) {
        // Envoi refusé (réseau occupé) sans nouveau brouillon : réessaie.
        if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => void persistNow(), 400);
        return;
      }
      if (draftRef.current !== sent) {
        // Le joueur a reposé un bateau pendant l'envoi : persiste la suite.
        if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => void persistNow(), 400);
        return;
      }
      dirtyRef.current = false;
      setDirty(false);
    } finally {
      sendingRef.current = false;
    }
  }

  function schedulePersist() {
    dirtyRef.current = true;
    setDirty(true);
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void persistNow(), 600);
  }

  /** Vide la file de persistance : utilisé avant READY et avant le tirage aléatoire. */
  async function flushDraft(): Promise<void> {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    const deadline = Date.now() + 8000;
    while (sendingRef.current && Date.now() < deadline) {
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    if (dirtyRef.current) await persistNow();
    if (dirtyRef.current) {
      // Dernier recours : le brouillon a encore bougé pendant le flush.
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      await persistNow();
    }
  }

  useEffect(() => () => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
  }, []);

  // Meilleur effort : ne pas perdre un brouillon posé juste avant de quitter.
  useEffect(() => () => {
    if (dirtyRef.current && !sendingRef.current) {
      void sendRef.current({ type: "SET_FLEET", ships: shipsPayload(draftRef.current) });
    }
  }, []);

  function flagInvalid(cell: Cell) {
    setShake(cell);
    if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
    shakeTimer.current = window.setTimeout(() => setShake(null), 360);
  }

  function commitPlacement(origin: Cell) {
    const { valid } = previewPlacement(selectedId, orientation, origin, draft);
    if (!valid) {
      flagInvalid(origin);
      return;
    }
    const next = draft.filter((ship) => ship.id !== selectedId);
    next.push({ id: selectedId, row: origin.row, col: origin.col, orientation });
    // Affichage immédiat : le bateau est posé avant même l'envoi réseau.
    setDraft(next);
    setPendingTap(null);
    schedulePersist();
  }

  function handleCellActivate(row: number, col: number) {
    if (view.myReady || randomizing || finishing) return;
    const origin = { row, col };
    const canHover = typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(hover: hover)").matches
      : true;
    if (!canHover) {
      // Tactile : premier tap = prévisualisation, second tap = pose.
      if (pendingTap?.row === row && pendingTap?.col === col) commitPlacement(origin);
      else setPendingTap(origin);
      return;
    }
    commitPlacement(origin);
  }

  function removeShip(id: string) {
    if (view.myReady || randomizing || finishing) return;
    const next = draft.filter((ship) => ship.id !== id);
    setDraft(next);
    setPendingTap(null);
    schedulePersist();
  }

  async function confirmReady() {
    if (finishing || !valid || !view.allowedActions.includes("READY_FLEET")) return;
    setFinishing(true);
    try {
      // Le serveur ne verrouille que ce qu'il a reçu : persiste d'abord.
      await flushDraft();
      await send({ type: "READY_FLEET" });
    } finally {
      setFinishing(false);
    }
  }

  function focusCell(row: number, col: number) {
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${row}-${col}"]`)?.focus();
  }

  const valid = draftValid(draft);
  const selectedLength = lengthOf(selectedId);
  // La prévisualisation suit le survol / le focus, ou le tap en attente sur tactile.
  const previewOrigin = hoverCell ?? pendingTap;
  const preview = previewOrigin && !view.myReady ? previewPlacement(selectedId, orientation, previewOrigin, draft) : null;
  const previewKeys = useMemo(() => new Set((preview?.cells ?? []).map((cell) => `${cell.row}:${cell.col}`)), [preview]);

  return (
    <section aria-label="Préparation de la flotte" className="naval-setup">
      <div className="naval-panel naval-board-panel">
        <p className="naval-board-title"><strong>{shipName(selectedId)}</strong></p>
        <div ref={gridRef} role="grid" aria-label="Grille de placement, 10 par 10" className="naval-board" data-zoom={false}>
          {Array.from({ length: 100 }, (_, index) => {
            const row = Math.floor(index / 10);
            const col = index % 10;
            const occupant = occupied.get(`${row}:${col}`);
            const inPreview = previewKeys.has(`${row}:${col}`);
            const isShake = shake?.row === row && shake?.col === col;
            return (
              <button
                key={index}
                type="button"
                role="gridcell"
                disabled={view.myReady || randomizing || finishing}
                tabIndex={focus.row === row && focus.col === col ? 0 : -1}
                onClick={() => { setFocus({ row, col }); handleCellActivate(row, col); }}
                onMouseEnter={() => setHoverCell({ row, col })}
                onMouseLeave={() => setHoverCell(null)}
                onFocus={() => { setFocus({ row, col }); setHoverCell({ row, col }); }}
                onBlur={() => setHoverCell(null)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp") { event.preventDefault(); setFocus((f) => ({ row: Math.max(0, f.row - 1), col: f.col })); focusCell(Math.max(0, row - 1), col); }
                  else if (event.key === "ArrowDown") { event.preventDefault(); focusCell(Math.min(9, row + 1), col); setFocus((f) => ({ row: Math.min(9, f.row + 1), col: f.col })); }
                  else if (event.key === "ArrowLeft") { event.preventDefault(); focusCell(row, Math.max(0, col - 1)); setFocus((f) => ({ row: f.row, col: Math.max(0, f.col - 1) })); }
                  else if (event.key === "ArrowRight") { event.preventDefault(); focusCell(row, Math.min(9, col + 1)); setFocus((f) => ({ row: f.row, col: Math.min(9, f.col + 1) })); }
                  else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); handleCellActivate(row, col); }
                }}
                data-cell={`${row}-${col}`}
                aria-label={`${cellLabel(row, col)}${occupant ? `, occupée par ${shipName(occupant)}` : ", libre"}${inPreview ? (preview?.valid ? ", aperçu du placement" : ", placement impossible ici") : ""}`}
                aria-invalid={inPreview && !preview?.valid ? true : undefined}
                className={`naval-cell${isShake ? " naval-cell--shake" : ""}`}
                data-state={occupant ? "ship" : "water"}
                data-preview={inPreview ? (preview?.valid ? "ok" : "bad") : undefined}
              >
                {occupant ? "●" : "·"}
              </button>
            );
          })}
        </div>
        <p className="naval-board-hint" aria-live="polite">{preview && !preview.valid ? "Emplacement impossible" : `${selectedLength} cases · ${orientation === "horizontal" ? "→" : "↓"}`}</p>
      </div>
      <div className="naval-panel naval-side-panel">
        <div className="play-ship-picker">
          <label htmlFor="naval-ship" className="sr-only">Bateau à placer</label>
          <select id="naval-ship" value={selectedId} disabled={view.myReady || randomizing || finishing} onChange={(event) => { setSelectedId(event.target.value as ShipId); setPendingTap(null); }}>
            {NAVAL_SHIP_CATALOG.map((entry) => <option key={entry.id} value={entry.id}>{shipName(entry.id)} · {entry.length}{draft.some((ship) => ship.id === entry.id) ? " ✓" : ""}</option>)}
          </select>
          {draft.some((ship) => ship.id === selectedId) && !view.myReady && <button type="button" className="naval-secondary-button" onClick={() => removeShip(selectedId)}>Retirer</button>}
        </div>
        <div className="naval-form-actions">
          <button type="button" disabled={view.myReady || randomizing || finishing} onClick={() => { setOrientation((o) => (o === "horizontal" ? "vertical" : "horizontal")); }} className="naval-secondary-button">
            Pivoter ({orientation === "horizontal" ? "→" : "↓"})
          </button>
          <button type="button" disabled={view.myReady || randomizing || finishing} onClick={() => { void (async () => {
            // Le tirage remplace toute la flotte : annule d'abord la
            // persistance en attente pour ne pas écraser le résultat,
            // puis adopte la flotte renvoyée par le serveur.
            if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
            dirtyRef.current = false;
            setDirty(false);
            setRandomizing(true);
            try {
              const next = await send({ type: "RANDOMIZE_FLEET" });
              if (next) {
                setDraft(next.view.myFleet.map((ship) => ({ id: ship.id as ShipId, row: ship.row, col: ship.col, orientation: ship.orientation })));
                setPendingTap(null);
              }
            } finally {
              setRandomizing(false);
            }
          })(); }} className="naval-secondary-button">
            {randomizing ? "Tirage…" : "Aléatoire"}
          </button>
        </div>
        {!view.myReady ? (
          <button
            type="button"
            disabled={!valid || finishing || !view.allowedActions.includes("READY_FLEET")}
            onClick={() => void confirmReady()}
            className="naval-primary-button"
          >
            {finishing ? "Verrouillage…" : `Prêt (${draft.length}/5)`}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || !view.allowedActions.includes("UNREADY_FLEET")}
            onClick={() => void send({ type: "UNREADY_FLEET" })}
            className="naval-secondary-button"
            style={{ width: "100%", marginTop: "0.7rem" }}
          >
            Modifier ma flotte
          </button>
        )}
        <p className="naval-panel-note">
          {view.opponentReady ? "Ton adversaire est prêt." : "Ton adversaire place sa flotte…"}
          {dirty && !view.myReady ? " · Enregistrement…" : ""}
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
    <section className="naval-panel naval-finish motion-finish">
      <p className="naval-kicker">Résultats</p>
      <h1 className="naval-finish-title">{title}</h1>
      <div className="naval-finish-scores">
        {view.players.map((player) => (
          <div key={player.id}>
            <p>{player.pseudo}</p>
            <strong>{result?.players[player.seat]?.score ?? 0}<span>/17</span></strong>
            <span>cases touchées</span>
          </div>
        ))}
      </div>
      <p className="naval-finish-meta">
        {view.sunkByMe.length} bateau{view.sunkByMe.length > 1 ? "x" : ""} coulé{view.sunkByMe.length > 1 ? "s" : ""}
        {accuracy === null ? " · aucun tir" : ` · précision ${Math.round(accuracy * 100)} %`} · tour {view.turn}.
      </p>
      {view.opponentFleet && (
        <MatchDetails label="Flotte adverse"><div className="naval-finish-reveal">
          <p className="naval-board-title">Flotte adverse révélée</p>
          <FleetGrid fleet={view.opponentFleet} incoming={view.myShots} lastShot={null} mySeat={view.mySeat} zoom={false} />
        </div></MatchDetails>
      )}
      <button type="button" onClick={back} className="naval-primary-button">
        Rejouer
      </button>
    </section>
  );
}
