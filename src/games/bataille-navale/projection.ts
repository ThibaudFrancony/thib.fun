import type { Seat } from "@/games/contracts";
import { navalConfigSchema } from "@/games/bataille-navale/config";
import {
  navalStateSchema,
  type NavalShip,
  type NavalShot,
  type NavalShotView,
  type NavalShipView,
  type NavalState,
  type NavalView,
} from "@/games/bataille-navale/types";

type PlayerIdentity = { id: string; pseudo: string };

function seatOf(viewerId: string, participants: readonly [string, string]): Seat {
  const seat = participants.indexOf(viewerId);
  if (seat !== 0 && seat !== 1) throw new Error("NOT_A_PARTICIPANT");
  return seat;
}

function shipView(ship: NavalShip): NavalShipView {
  return { id: ship.id, row: ship.row, col: ship.col, orientation: ship.orientation, length: ship.length };
}

function shotView(shot: NavalShot): NavalShotView {
  // Un simple hit n'expose jamais l'identifiant du bateau touché ; le
  // shipId, le type et les cellules ne sont présents qu'après un coulé,
  // dont toutes les cases sont déjà connues de l'attaquant.
  if (shot.result === "sunk" && shot.shipId) {
    return {
      row: shot.row,
      col: shot.col,
      result: shot.result,
      shipId: shot.shipId,
      shipType: shot.shipType ?? shot.shipId,
      sunkCells: shot.sunkCells ? [...shot.sunkCells] : undefined,
      automatic: shot.automatic,
    };
  }
  return { row: shot.row, col: shot.col, result: shot.result, automatic: shot.automatic };
}

function sunkIds(shots: readonly NavalShot[]): string[] {
  const ids: string[] = [];
  for (const shot of shots) {
    if (shot.result === "sunk" && shot.shipId && !ids.includes(shot.shipId)) ids.push(shot.shipId);
  }
  return ids;
}

export function projectNaval(
  stateInput: unknown,
  configInput: unknown,
  viewerId: string,
  participants: readonly [string, string],
  identities: readonly [PlayerIdentity, PlayerIdentity],
): NavalView {
  const state = navalStateSchema.parse(stateInput);
  const config = navalConfigSchema.parse(configInput);
  const viewerSeat = seatOf(viewerId, participants);
  const opponentSeat = (1 - viewerSeat) as Seat;
  const inTurnPhase = state.phase === "playing";
  const active = inTurnPhase && state.activeSeat === viewerSeat;

  const myShots = state.shots[viewerSeat].map(shotView);
  const incomingShots = state.shots[opponentSeat].map(shotView);
  const finished = state.phase === "finished";

  const allowedActions: string[] = [];
  if (state.phase === "setup") {
    if (!state.ready[viewerSeat]) {
      allowedActions.push("SET_FLEET", "RANDOMIZE_FLEET", "READY_FLEET");
    } else if (!state.ready[opponentSeat]) {
      allowedActions.push("UNREADY_FLEET");
    }
  }
  if (active) allowedActions.push("FIRE");
  if (!finished) allowedActions.push("RESIGN");

  const hitsByMe = state.shots[viewerSeat].filter((shot) => shot.result === "hit" || shot.result === "sunk").length;
  const missesByMe = state.shots[viewerSeat].filter((shot) => shot.result === "miss").length;

  const result: NavalView["result"] =
    finished
      ? {
          outcome: state.finishedOutcome ?? "abandoned",
          winnerId: state.winnerId,
          reason: state.finishedReason ?? "blocked",
          players: [
            { id: participants[0], score: hitsOn(state, 0) },
            { id: participants[1], score: hitsOn(state, 1) },
          ],
        }
      : null;

  return {
    kind: "bataille-navale",
    stateSchemaVersion: 1,
    phase: state.phase,
    turnSeconds: config.turnSeconds,
    mySeat: viewerSeat,
    activeSeat: state.activeSeat,
    activePlayerId: inTurnPhase ? participants[state.activeSeat] : null,
    turn: state.turn,
    myFleet: state.fleets[viewerSeat].map(shipView),
    myShots,
    incomingShots,
    myReady: state.ready[viewerSeat],
    opponentReady: state.ready[opponentSeat],
    sunkByMe: sunkIds(state.shots[viewerSeat]),
    sunkOfMine: sunkIds(state.shots[opponentSeat]),
    hitsByMe,
    missesByMe,
    opponentFleet: finished ? state.fleets[opponentSeat].map(shipView) : null,
    lastShot: state.lastShot ? { by: state.lastShot.by, shot: shotView(state.lastShot.shot) } : null,
    players: [
      { id: identities[0].id, seat: 0, pseudo: identities[0].pseudo, score: hitsOn(state, 0), active: inTurnPhase && state.activeSeat === 0 },
      { id: identities[1].id, seat: 1, pseudo: identities[1].pseudo, score: hitsOn(state, 1), active: inTurnPhase && state.activeSeat === 1 },
    ],
    result,
    allowedActions,
  };
}

function hitsOn(state: NavalState, seat: Seat): number {
  return state.shots[seat].filter((shot) => shot.result === "hit" || shot.result === "sunk").length;
}
