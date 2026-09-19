import type { HistoryEntry } from "@/server/matches/repository";

export type HistoryListItem = Omit<HistoryEntry, "payload"> & { opponentPseudo: string };

/** Entrée d'historique d'un tiers, avec l'indication « j'ai joué cette partie ». */
export type ProfileHistoryListItem = HistoryListItem & { viewerIsParticipant: boolean };

/**
 * Le joueur courant a-t-il joué cette partie ? On regarde d'abord l'adversaire
 * enregistré puis les joueurs du snapshot public. Un payload incomplet renvoie
 * `false` : on préfère une carte non cliquable à un faux accès au détail.
 */
export function viewerParticipates(entry: Pick<HistoryEntry, "opponentId" | "payload">, viewerId: string): boolean {
  if (entry.opponentId === viewerId) return true;
  const players = entry.payload.players;
  if (!Array.isArray(players)) return false;
  return players.some((candidate) => {
    if (typeof candidate !== "object" || candidate === null) return false;
    const value = candidate as Record<string, unknown>;
    return value.userId === viewerId || value.id === viewerId;
  });
}

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u;

export function opponentPseudoFromPayload(entry: Pick<HistoryEntry, "opponentId" | "payload">): string {
  const players = entry.payload.players;
  if (!Array.isArray(players)) return "Partenaire";
  const player = players.find((candidate) => {
    if (typeof candidate !== "object" || candidate === null) return false;
    const value = candidate as Record<string, unknown>;
    return value.userId === entry.opponentId || value.id === entry.opponentId;
  });
  if (typeof player !== "object" || player === null) return "Partenaire";
  const pseudo = (player as Record<string, unknown>).pseudo;
  return typeof pseudo === "string" && pseudo.trim().length > 0 && !CONTROL_CHARACTERS.test(pseudo)
    ? pseudo.trim().slice(0, 64)
    : "Partenaire";
}

export function toHistoryListItem(entry: HistoryEntry): HistoryListItem {
  return {
    matchId: entry.matchId,
    opponentId: entry.opponentId,
    gameSlug: entry.gameSlug,
    startedAt: entry.startedAt,
    endedAt: entry.endedAt,
    outcome: entry.outcome,
    score: entry.score,
    opponentScore: entry.opponentScore,
    sharedScore: entry.sharedScore,
    opponentPseudo: opponentPseudoFromPayload(entry),
  };
}

export function historyOutcomeLabel(outcome: HistoryEntry["outcome"]): string {
  if (outcome === "win") return "Victoire";
  if (outcome === "loss") return "Défaite";
  if (outcome === "draw") return "Égalité";
  if (outcome === "cooperative") return "Résultat commun";
  return "Partie interrompue";
}

export function historyReasonLabel(reason: string, outcome: HistoryEntry["outcome"]): string {
  const labels: Record<string, string> = {
    normal: "Partie terminée normalement",
    round_limit: "Limite de manches atteinte",
    turn_limit: "Limite de tours atteinte",
    resign: "Un joueur a quitté la partie",
    claimed_forfeit: "Forfait validé après absence",
    absence: "Partie interrompue pour absence",
    blocked: "Partie interrompue techniquement",
    technical_error: "Partie interrompue techniquement",
    dictionary_exhausted: "Dictionnaire épuisé",
    judging_unavailable: "Correction indisponible",
    superseded: "Partie remplacée par une nouvelle",
    worker_unreachable: "Partie interrompue techniquement",
  };
  return labels[reason] ?? (outcome === "abandoned" ? "Partie interrompue" : "Résultat enregistré");
}

export function historyAccess(account: { isGuest: boolean } | null): "public" | "account_required" | "unauthorized" {
  if (!account) return "unauthorized";
  return account.isGuest ? "account_required" : "public";
}
