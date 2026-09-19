import type { Seat } from "@/games/contracts";
import { challengeSelectionLength, type GeoConfig } from "@/games/geographie/config";
import type { GeoContent, GeoPlacement, GeoState, GeoView, GeoViewPlayer, ResultView } from "@/games/geographie/types";

type PlayerIdentity = { id: string; pseudo: string; avatarPreset?: string };

export function geoAvatarPresetFromSnapshot(snapshotAvatar: unknown): string {
  if (snapshotAvatar !== null && typeof snapshotAvatar === "object") {
    const preset = (snapshotAvatar as Record<string, unknown>).preset;
    if (typeof preset === "string" && preset.length > 0) return preset;
  }
  return "avatar-1";
}

function seatOf(viewerId: string, participants: readonly [string, string]): Seat {
  const seat = participants.indexOf(viewerId);
  if (seat !== 0 && seat !== 1) throw new Error("NOT_A_PARTICIPANT");
  return seat;
}

function cityLabel(content: GeoContent, id: string): { id: string; name: string; departmentName: string } | null {
  const city = content.cities.find((item) => item.inseeCode === id);
  return city ? { id: city.inseeCode, name: city.name, departmentName: city.departmentName } : null;
}

function playerView(
  identity: PlayerIdentity,
  seat: Seat,
  state: GeoState,
  viewerSeat: Seat,
  reveal: boolean,
): GeoViewPlayer {
  // Placements simultanés : chaque siège reste actif tant qu'il n'a pas validé.
  const active = state.phase === "placing" && !state.submitted[seat];
  const canSeePlacement = reveal || seat === viewerSeat;
  const placement = canSeePlacement && state.placements[seat]
    ? { latitude: state.placements[seat].latitude, longitude: state.placements[seat].longitude }
    : null;
  return {
    id: identity.id,
    seat,
    pseudo: identity.pseudo,
    avatarPreset: identity.avatarPreset ?? "avatar-1",
    score: state.totals[seat],
    submitted: state.submitted[seat],
    active,
    placement,
  };
}

function resultView(state: GeoState, participants: readonly [string, string]): ResultView | null {
  if (state.phase !== "finished") return null;
  const first = state.totals[0];
  const second = state.totals[1];
  const reason = state.finishedReason ?? "round_limit";
  const outcome = state.finishedOutcome ?? (first === second ? "draw" : "win");
  const winnerId = outcome === "win"
    ? state.winnerId ?? participants[first > second ? 0 : 1]
    : null;
  return {
    outcome,
    winnerId,
    reason,
    players: [
      { id: participants[0], score: first },
      { id: participants[1], score: second },
    ],
  };
}

export function projectGeo(
  state: GeoState,
  config: GeoConfig,
  content: GeoContent,
  viewerId: string,
  participants: readonly [string, string],
  identities: readonly [PlayerIdentity, PlayerIdentity],
): GeoView {
  const viewerSeat = seatOf(viewerId, participants);
  const reveal = state.phase === "reveal" || (state.phase === "finished" && state.finishedReason === "round_limit");
  const targetId = state.cityIds[state.round - 1];
  const targetCity = targetId ? content.cities.find((city) => city.inseeCode === targetId) ?? null : null;
  const players: [GeoViewPlayer, GeoViewPlayer] = [
    playerView(identities[0], 0, state, viewerSeat, reveal),
    playerView(identities[1], 1, state, viewerSeat, reveal),
  ];
  const challenge = config.selection === "challenge"
    ? {
        mySelection: state.challengeSelections[viewerSeat]
          .map((id) => cityLabel(content, id))
          .filter((city): city is { id: string; name: string; departmentName: string } => city !== null),
        myConfirmed: state.challengeConfirmed[viewerSeat],
        opponentConfirmed: state.challengeConfirmed[(1 - viewerSeat) as Seat],
        required: challengeSelectionLength(config.rounds, viewerSeat, state.firstSeat),
      }
    : null;
  const lastRound = reveal && targetCity
    ? {
        target: {
          id: targetCity.inseeCode,
          name: targetCity.name,
          departmentName: targetCity.departmentName,
          latitude: targetCity.latitude,
          longitude: targetCity.longitude,
        },
        placements: state.placements,
        totals: state.totals,
      }
    : null;
  return {
    kind: "geographie",
    stateSchemaVersion: 1,
    phase: state.phase,
    round: state.round,
    rounds: config.rounds,
    turnSeconds: config.turnSeconds,
    difficulty: config.difficulty,
    selection: config.selection,
    mySeat: viewerSeat,
    target: targetCity ? { id: targetCity.inseeCode, name: targetCity.name, departmentName: targetCity.departmentName } : null,
    targetPoint: reveal && targetCity ? { latitude: targetCity.latitude, longitude: targetCity.longitude } : null,
    players,
    challenge,
    acknowledged: state.acknowledgedBy.includes(viewerId),
    totals: state.totals,
    lastRound,
    result: resultView(state, participants),
  };
}

export function hasPrivateCoordinates(view: GeoView): boolean {
  return view.players.some((player) => player.placement !== null);
}

export function placementForSeat(view: GeoView, seat: Seat): GeoPlacement | null {
  const player = view.players[seat];
  if (!player.placement || !view.lastRound) return null;
  const full = view.lastRound.placements[seat];
  return full ?? null;
}
