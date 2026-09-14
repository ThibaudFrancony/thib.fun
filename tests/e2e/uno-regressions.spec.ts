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

function response(currentView: UnoView, version = 1) {
  return {
    matchId,
    roomId: "room-fixture",
    gameSlug: "uno",
    status: "active",
    version,
    phaseId: "phase-fixture",
    deadlineAt: new Date(Date.now() + 20_000).toISOString(),
    deadlineKind: "turn_timeout",
    serverNow: new Date().toISOString(),
    view: currentView,
  };
}

async function openFixture(page: Page, currentView: UnoView, getVersion: () => number = () => 1) {
  await page.route(`**/api/matches/${matchId}`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(response(currentView, getVersion())) });
  });
  await page.goto(`/parties/${matchId}`);
  await expect(page.getByRole("heading", { name: /1 carte/ })).toBeVisible();
}

test("le dialogue de joker survit à une actualisation de projection", async ({ page }) => {
  await openFixture(page, view([{ id: "wild", color: null, symbol: "wild" }]));
  await page.getByRole("button", { name: "Joker · jouable" }).click();
  await page.getByRole("button", { name: "Jouer la carte sélectionnée" }).click();
  const dialog = page.getByRole("dialog", { name: "Choisis la couleur" });
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(2_700);
  await expect(dialog).toBeVisible();
});

test("une panne réseau réactive les commandes UNO", async ({ page }) => {
  await openFixture(page, view([{ id: "red-5", color: "red", symbol: "5" }]));
  await page.route(`**/api/matches/${matchId}/commands`, async (route) => route.abort("failed"));
  await page.getByRole("button", { name: "5 · jouable" }).click();
  await page.getByRole("button", { name: "Jouer la carte sélectionnée" }).click();
  await page.waitForTimeout(500);
  await expect(page.getByRole("button", { name: "Piocher", exact: true })).toBeEnabled();
});

test("un double clic pendant l'envoi ne produit qu'une commande", async ({ page }) => {
  await openFixture(page, view([{ id: "red-5", color: "red", symbol: "5" }]));
  let commandCount = 0;
  await page.route(`**/api/matches/${matchId}/commands`, async (route) => {
    commandCount += 1;
    await route.abort("failed");
  });
  await page.getByRole("button", { name: "5 · jouable" }).click();
  const play = page.getByRole("button", { name: "Jouer la carte sélectionnée" });
  await play.evaluate((element) => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await expect.poll(() => commandCount).toBe(1);
  await expect(play).toBeEnabled();
});

test("la table UNO entretient la présence par heartbeat", async ({ page }) => {
  const currentVersion = 1;
  let heartbeatCount = 0;
  await page.route(`**/api/matches/${matchId}/heartbeat`, async (route) => {
    heartbeatCount += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matchId, matchVersion: currentVersion, serverNow: new Date().toISOString(), opponentLastSeenAt: null }) });
  });
  await openFixture(page, view([{ id: "red-5", color: "red", symbol: "5" }]), () => currentVersion);
  await page.waitForTimeout(3_500);
  expect(heartbeatCount).toBeGreaterThan(0);
});

test("une réponse perdue conserve le même identifiant de commande au nouvel essai", async ({ page }) => {
  await openFixture(page, view([{ id: "red-5", color: "red", symbol: "5" }]));
  const commandIds: string[] = [];
  let attempts = 0;
  await page.route(`**/api/matches/${matchId}/commands`, async (route) => {
    attempts += 1;
    const body = route.request().postDataJSON() as { commandId?: string };
    if (body.commandId) commandIds.push(body.commandId);
    if (attempts === 1) {
      await route.abort("failed");
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matchId, version: 2, commandHash: "fixture" }) });
  });
  await page.getByRole("button", { name: "5 · jouable" }).click();
  await page.getByRole("button", { name: "Jouer la carte sélectionnée" }).click();
  await expect(page.getByRole("button", { name: "Jouer la carte sélectionnée" })).toBeEnabled();
  await page.getByRole("button", { name: "Jouer la carte sélectionnée" }).click();
  await expect.poll(() => commandIds.length).toBe(2);
  expect(commandIds[0]).toBe(commandIds[1]);
});

test("une relecture déclenchée par le heartbeat rattrape une mise à jour Realtime manquée", async ({ page }) => {
  let currentVersion = 1;
  let readCount = 0;
  await page.route(`**/api/matches/${matchId}/heartbeat`, async (route) => {
    currentVersion = 2;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matchId, matchVersion: 2, serverNow: new Date().toISOString(), opponentLastSeenAt: null }) });
  });
  await page.route(`**/api/matches/${matchId}`, async (route) => {
    readCount += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(response(view([{ id: "red-5", color: "red", symbol: "5" }]), currentVersion)) });
  });
  await page.goto(`/parties/${matchId}`);
  await expect(page.getByRole("heading", { name: /1 carte/ })).toBeVisible();
  await expect.poll(() => readCount).toBeGreaterThan(1);
  expect(currentVersion).toBe(2);
});

test("deux onglets relisent chacun la projection sans partager une intention locale", async ({ page, context }) => {
  const second = await context.newPage();
  await openFixture(page, view([{ id: "red-5", color: "red", symbol: "5" }]));
  await openFixture(second, view([{ id: "red-5", color: "red", symbol: "5" }]));
  await expect(second.getByRole("button", { name: "Piocher", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Piocher", exact: true })).toBeEnabled();
  await second.close();
});
