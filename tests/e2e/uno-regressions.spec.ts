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
    pendingPenalty: null,
    players,
    turns: 0,
    counters,
    actions: {
      canDraw: true,
      canPlay: hand.length > 0,
      canPlayDrawn: false,
      canKeepDrawn: false,
      canResign: true,
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
  const dialog = page.getByRole("dialog", { name: "Choisis la couleur" });
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(2_700);
  await expect(dialog).toBeVisible();
});

test("une panne réseau réactive les commandes UNO", async ({ page }) => {
  await openFixture(page, view([{ id: "red-5", color: "red", symbol: "5" }]));
  await page.route(`**/api/matches/${matchId}/commands`, async (route) => route.abort("failed"));
  await page.getByRole("button", { name: "5 · jouable" }).click();
  await page.waitForTimeout(500);
  await expect(page.getByRole("button", { name: "5 · jouable" })).toBeEnabled();
});

test("un double clic pendant l'envoi ne produit qu'une commande", async ({ page }) => {
  await openFixture(page, view([{ id: "red-5", color: "red", symbol: "5" }]));
  let commandCount = 0;
  await page.route(`**/api/matches/${matchId}/commands`, async (route) => {
    commandCount += 1;
    await route.abort("failed");
  });
  const play = page.getByRole("button", { name: "5 · jouable" });
  await play.evaluate((element) => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await expect.poll(() => commandCount).toBe(1);
  await expect(play).toBeEnabled();
});

test("une carte jouée reste sur la défausse pendant l'attente serveur puis revient en cas d'échec", async ({ page }) => {
  await openFixture(page, view([{ id: "red-5", color: "red", symbol: "5" }]));
  await page.route(`**/api/matches/${matchId}/commands`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    await route.abort("failed");
  });
  const play = page.getByRole("button", { name: "5 · jouable" });
  await play.click();
  await expect(play).toBeHidden();
  await expect(page.locator(".uno-discard-optimistic")).toBeVisible();
  await expect(play).toBeVisible({ timeout: 8_000 });
  await expect(page.locator(".uno-discard-optimistic")).toHaveCount(0);
});

test("un clic sur la pioche envoie une commande DRAW", async ({ page }) => {
  await openFixture(page, view([{ id: "red-5", color: "red", symbol: "5" }]));
  const actions: string[] = [];
  await page.route(`**/api/matches/${matchId}/commands`, async (route) => {
    const body = route.request().postDataJSON() as { action?: { type?: string } };
    if (body.action?.type) actions.push(body.action.type);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matchId, version: 2, commandHash: "fixture" }) });
  });
  await page.getByRole("button", { name: "Piocher une carte" }).click();
  await expect.poll(() => actions.length).toBe(1);
  expect(actions[0]).toBe("DRAW");
});

test("une pioche auto-passée ne laisse pas de carte fantôme dans la main", async ({ page }) => {
  const before = view([{ id: "red-5", color: "red", symbol: "5" }]);
  const after: UnoView = {
    ...before,
    hand: [...before.hand, { id: "blue-9", color: "blue", symbol: "9" }],
    activeSeat: 1,
    playableCardIds: [],
    actions: { ...before.actions, canDraw: false, canPlay: false },
    players: [
      { ...players[0], active: false },
      { ...players[1], active: true },
    ],
  };
  let version = 1;
  await page.route(`**/api/matches/${matchId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response(version === 1 ? before : after, version)),
    });
  });
  await page.route(`**/api/matches/${matchId}/commands`, async (route) => {
    version = 2;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matchId, version: 2, commandHash: "fixture" }) });
  });
  await page.goto(`/parties/${matchId}`);
  await expect(page.getByRole("button", { name: "Piocher une carte" })).toBeEnabled();
  await page.getByRole("button", { name: "Piocher une carte" }).click();
  await expect(page.getByRole("heading", { name: /2 cartes/ })).toBeVisible();
  await expect(page.locator(".uno-hand-placeholder")).toHaveCount(0);
});

test("un clic sur une carte non jouable ne produit aucune commande", async ({ page }) => {
  const blocked = view([{ id: "blue-2", color: "blue", symbol: "2" }]);
  await openFixture(page, { ...blocked, playableCardIds: [], actions: { ...blocked.actions, canPlay: false } });
  let commandCount = 0;
  await page.route(`**/api/matches/${matchId}/commands`, async (route) => {
    commandCount += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matchId, version: 2, commandHash: "fixture" }) });
  });
  await page.getByRole("button", { name: "2", exact: true }).click();
  await page.waitForTimeout(500);
  expect(commandCount).toBe(0);
  await expect(page.getByRole("button", { name: "2", exact: true })).toBeVisible();
});

test("Abandonner demande confirmation puis envoie RESIGN", async ({ page }) => {
  await openFixture(page, view([{ id: "red-5", color: "red", symbol: "5" }]));
  const actions: string[] = [];
  await page.route(`**/api/matches/${matchId}/commands`, async (route) => {
    const body = route.request().postDataJSON() as { action?: { type?: string } };
    if (body.action?.type) actions.push(body.action.type);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matchId, version: 2, commandHash: "fixture" }) });
  });
  page.on("dialog", (dialog) => { void dialog.accept(); });
  await page.getByRole("button", { name: "Abandonner" }).click();
  await expect.poll(() => actions.length).toBe(1);
  expect(actions[0]).toBe("RESIGN");
});

test("jouer une carte sans annonce envoie une commande sans announceLastCard", async ({ page }) => {
  const twoCards = view([{ id: "red-5", color: "red", symbol: "5" }, { id: "red-7", color: "red", symbol: "7" }]);
  await page.route(`**/api/matches/${matchId}`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(response(twoCards)) });
  });
  await page.goto(`/parties/${matchId}`);
  await expect(page.getByRole("heading", { name: /2 cartes/ })).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  let body: unknown = null;
  await page.route(`**/api/matches/${matchId}/commands`, async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matchId, version: 2, commandHash: "fixture" }) });
  });
  await page.getByRole("button", { name: "5 · jouable" }).click();
  await expect.poll(() => body !== null).toBe(true);
  expect(JSON.stringify(body)).not.toContain("announceLastCard");
});

test("une pénalité en attente propose de prendre le cumul", async ({ page }) => {
  const pending = view([
    { id: "blue-draw2", color: "blue", symbol: "draw2" },
    { id: "red-5", color: "red", symbol: "5" },
  ]);
  pending.pendingPenalty = { symbol: "draw2", count: 4 };
  pending.playableCardIds = ["blue-draw2"];
  await page.route(`**/api/matches/${matchId}`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(response(pending)) });
  });
  await page.goto(`/parties/${matchId}`);
  await expect(page.getByRole("heading", { name: /2 cartes/ })).toBeVisible();
  await expect(page.getByText("+4 à prendre ou à contrer avec un +2")).toBeVisible();
  const actions: string[] = [];
  await page.route(`**/api/matches/${matchId}/commands`, async (route) => {
    const body = route.request().postDataJSON() as { action?: { type?: string } };
    if (body.action?.type) actions.push(body.action.type);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matchId, version: 2, commandHash: "fixture" }) });
  });
  await page.getByRole("button", { name: "Prendre 4 cartes" }).click();
  await expect.poll(() => actions.length).toBe(1);
  expect(actions[0]).toBe("DRAW");
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
  const play = page.getByRole("button", { name: "5 · jouable" });
  await play.click();
  await expect.poll(() => commandIds.length).toBe(1);
  await play.click();
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
  await expect(second.getByRole("button", { name: "Piocher une carte" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Piocher une carte" })).toBeEnabled();
  await second.close();
});
