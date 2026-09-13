import { expect, test, type Page } from "@playwright/test";
import type { UnoView } from "@/games/uno/types";

const matchId = "uno-fixture";
const players: UnoView["players"] = [
  { id: "alice", seat: 0, pseudo: "Alice", cardCount: 1, score: 0, active: true },
  { id: "bob", seat: 1, pseudo: "Bob", cardCount: 1, score: 0, active: false },
];
const counters: UnoView["counters"] = {
  cardsPlayed: 0,
  cardsDrawn: 0,
  penaltyCardsTaken: 0,
  missedAnnouncements: 0,
  turns: 0,
};

function view(hand: UnoView["hand"]): UnoView {
  return {
    kind: "uno",
    stateSchemaVersion: 1,
    phase: "playing",
    mySeat: 0,
    activeSeat: 0,
    turnSeconds: 20,
    activeColor: "red",
    topCard: { id: "top", color: "red", symbol: "3" },
    drawPileCount: 20,
    hand,
    opponentHand: null,
    drawnCard: null,
    playableCardIds: hand.map((card) => card.id),
    players,
    turns: 0,
    counters,
    actions: {
      canDraw: true,
      canPlay: hand.length > 0,
      canPlayDrawn: false,
      canKeepDrawn: false,
      canResign: true,
      canClaimForfeit: true,
    },
    result: null,
  };
}

function response(currentView: UnoView) {
  return {
    matchId,
    roomId: "room-fixture",
    gameSlug: "uno",
    status: "active",
    version: 1,
    phaseId: "phase-fixture",
    deadlineAt: new Date(Date.now() + 20_000).toISOString(),
    deadlineKind: "turn_timeout",
    serverNow: new Date().toISOString(),
    view: currentView,
  };
}

async function openFixture(page: Page, currentView: UnoView) {
  await page.route(`**/api/matches/${matchId}`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(response(currentView)) });
  });
  await page.goto(`/parties/${matchId}`);
  await expect(page.getByRole("heading", { name: /1 carte/ })).toBeVisible();
}

test("le dialogue de joker survit à une actualisation de projection", async ({ page }) => {
  test.fail(true, "Régression connue : refresh() efface pendingPlay dès que la vue reste en playing.");
  await openFixture(page, view([{ id: "wild", color: null, symbol: "wild" }]));
  await page.getByRole("button", { name: "Joker · jouable" }).click();
  await page.getByRole("button", { name: "Jouer la carte sélectionnée" }).click();
  const dialog = page.getByRole("dialog", { name: "Choisis la couleur" });
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(2_700);
  await expect(dialog).toBeVisible();
});

test("une panne réseau réactive les commandes UNO", async ({ page }) => {
  test.fail(true, "Régression connue : send() n'a pas de try/catch/finally et laisse busy à true après un fetch rejeté.");
  await openFixture(page, view([{ id: "red-5", color: "red", symbol: "5" }]));
  await page.route(`**/api/matches/${matchId}/commands`, async (route) => route.abort("failed"));
  await page.getByRole("button", { name: "5 · jouable" }).click();
  await page.getByRole("button", { name: "Jouer la carte sélectionnée" }).click();
  await page.waitForTimeout(500);
  await expect(page.getByRole("button", { name: "Piocher", exact: true })).toBeEnabled();
});

test("la table UNO entretient la présence par heartbeat", async ({ page }) => {
  test.fail(true, "Régression connue : UnoMatch ne planifie aucun appel /heartbeat.");
  await openFixture(page, view([{ id: "red-5", color: "red", symbol: "5" }]));
  let heartbeatCount = 0;
  await page.route(`**/api/matches/${matchId}/heartbeat`, async (route) => {
    heartbeatCount += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.waitForTimeout(3_500);
  expect(heartbeatCount).toBeGreaterThan(0);
});
