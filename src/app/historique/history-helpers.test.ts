import { describe, expect, it } from "vitest";
import { historyAccess, historyOutcomeLabel, opponentPseudoFromPayload, toHistoryListItem, viewerParticipates } from "@/app/historique/history-helpers";
import type { HistoryEntry } from "@/server/matches/repository";

const entry: HistoryEntry = {
  matchId: "00000000-0000-4000-8000-000000000001",
  opponentId: "00000000-0000-4000-8000-000000000002",
  gameSlug: "compatibilite",
  startedAt: "2026-09-14T10:00:00.000Z",
  endedAt: "2026-09-14T10:05:00.000Z",
  outcome: "cooperative",
  score: null,
  opponentScore: null,
  sharedScore: 8,
  payload: { players: [{ userId: "00000000-0000-4000-8000-000000000002", pseudo: "Ada" }] },
};

describe("accès et résumé de l'historique", () => {
  it("distingue compte permanent, invité et absence de session", () => {
    expect(historyAccess({ isGuest: false })).toBe("public");
    expect(historyAccess({ isGuest: true })).toBe("account_required");
    expect(historyAccess(null)).toBe("unauthorized");
  });

  it("utilise le pseudo adverse du snapshot sans renvoyer le payload privé dans la liste", () => {
    expect(opponentPseudoFromPayload(entry)).toBe("Ada");
    const item = toHistoryListItem(entry);
    expect(item.opponentPseudo).toBe("Ada");
    expect("payload" in item).toBe(false);
    expect(historyOutcomeLabel(item.outcome)).toBe("Résultat commun");
  });

  it("reconnaît un participant via l'adversaire ou le snapshot", () => {
    expect(viewerParticipates(entry, "00000000-0000-4000-8000-000000000002")).toBe(true);
    expect(viewerParticipates(entry, "00000000-0000-4000-8000-000000000009")).toBe(false);
    const withViewer: HistoryEntry = { ...entry, payload: { players: [{ userId: "00000000-0000-4000-8000-000000000009", pseudo: "Léo" }] } };
    expect(viewerParticipates(withViewer, "00000000-0000-4000-8000-000000000009")).toBe(true);
    const incomplete: HistoryEntry = { ...entry, payload: {} };
    expect(viewerParticipates(incomplete, "00000000-0000-4000-8000-000000000009")).toBe(false);
  });
});
