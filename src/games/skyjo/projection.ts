import type { Seat } from "@/games/contracts";
import { skyjoConfigSchema, skyjoMaxRoundsFor } from "@/games/skyjo/config";
import { skyjoStateSchema, type SkyjoCellView, type SkyjoState, type SkyjoView } from "@/games/skyjo/types";

type PlayerIdentity = { id: string; pseudo: string };

function seatOf(viewerId: string, participants: readonly [string, string]): Seat {
  const seat = participants.indexOf(viewerId);
  if (seat !== 0 && seat !== 1) throw new Error("NOT_A_PARTICIPANT");
  return seat;
}

function gridView(grid: SkyjoState["grids"][number]): SkyjoCellView[] {
  return grid.map((cell, slot): SkyjoCellView => {
    if (!cell) return { slot, revealed: false, empty: true };
    if (!cell.revealed) return { slot, revealed: false };
    return { slot, revealed: true, value: cell.card.value };
  });
}

export function projectSkyjo(
  stateInput: unknown,
  configInput: unknown,
  viewerId: string,
  participants: readonly [string, string],
  identities: readonly [PlayerIdentity, PlayerIdentity],
): SkyjoView {
  const state = skyjoStateSchema.parse(stateInput);
  const config = skyjoConfigSchema.parse(configInput);
  const viewerSeat = seatOf(viewerId, participants);
  const opponentSeat = (1 - viewerSeat) as Seat;
  const inTurnPhase = state.phase !== "finished" && state.phase !== "round_reveal" && state.phase !== "setup";
  const active = inTurnPhase && state.activeSeat === viewerSeat;

  const myGrid = gridView(state.grids[viewerSeat]);
  const opponentGrid = gridView(state.grids[opponentSeat]);

  const held: SkyjoView["held"] =
    state.heldCard && (state.phase === "resolve_draw" || state.phase === "replace_discard")
      ? state.activeSeat === viewerSeat
        ? { value: state.heldCard.value, source: state.heldSource ?? "draw" }
        : { hidden: true }
      : null;

  const allowedActions: string[] = [];
  if (state.phase === "setup" && !state.initialReady[viewerSeat]) allowedActions.push("REVEAL_INITIAL");
  if (active && state.phase === "choose_source") {
    if (state.discardPile.length > 0) allowedActions.push("TAKE_DISCARD");
    // TAKE_DRAW est interdit sans recyclable : pioche vide et au plus le
    // sommet en défausse. Le serveur reste l'autorité (DRAW_UNAVAILABLE).
    if (state.drawPile.length > 0 || state.discardPile.length > 1) allowedActions.push("TAKE_DRAW");
  }
  if (active && state.phase === "resolve_draw") {
    allowedActions.push("REPLACE");
    if (state.grids[viewerSeat].some((cell) => cell && !cell.revealed)) allowedActions.push("DISCARD_AND_REVEAL");
  }
  if (active && state.phase === "replace_discard") allowedActions.push("REPLACE");
  if (state.phase === "round_reveal" && !state.acknowledgedBy.includes(viewerId)) allowedActions.push("NEXT");
  if (state.phase !== "finished") allowedActions.push("RESIGN", "CLAIM_FORFEIT");

  const countRevealed = (seat: Seat): number => state.grids[seat].filter((cell) => cell && cell.revealed).length;
  const countRemaining = (seat: Seat): number => state.grids[seat].filter((cell) => cell !== null).length;

  const result: SkyjoView["result"] =
    state.phase === "finished"
      ? {
          outcome: state.finishedOutcome ?? "abandoned",
          winnerId: state.winnerId,
          reason: state.finishedReason ?? "blocked",
          players: [
            { id: participants[0], score: state.cumulative[0] },
            { id: participants[1], score: state.cumulative[1] },
          ],
        }
      : null;

  return {
    kind: "skyjo",
    stateSchemaVersion: 1,
    phase: state.phase,
    round: state.round,
    maxRounds: skyjoMaxRoundsFor(config),
    format: config.format,
    turnSeconds: config.turnSeconds,
    mySeat: viewerSeat,
    activeSeat: state.activeSeat,
    activePlayerId: state.phase === "setup" || state.phase === "finished" || state.phase === "round_reveal" ? null : participants[state.activeSeat],
    myGrid,
    opponentGrid,
    held,
    discardTop: state.discardPile.length > 0 ? state.discardPile[state.discardPile.length - 1].value : null,
    discardCount: state.discardPile.length,
    drawCount: state.drawPile.length,
    removedCount: state.removed.length,
    revealedCount: [countRevealed(0), countRevealed(1)],
    remainingCount: [countRemaining(0), countRemaining(1)],
    closingSeat: state.closingSeat,
    lastTurn: state.closingSeat !== null,
    cumulative: [...state.cumulative] as [number, number],
    roundSummary: state.roundSummary,
    acknowledged: state.acknowledgedBy.includes(viewerId),
    players: [
      { id: identities[0].id, seat: 0, pseudo: identities[0].pseudo, score: state.cumulative[0], active: inTurnPhase && state.activeSeat === 0 },
      { id: identities[1].id, seat: 1, pseudo: identities[1].pseudo, score: state.cumulative[1], active: inTurnPhase && state.activeSeat === 1 },
    ],
    result,
    allowedActions,
  };
}
