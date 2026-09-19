import { expect, test, type Page } from "@playwright/test";
import type { GeoView } from "@/games/geographie/types";
import type { NavalView } from "@/games/bataille-navale/types";
import type { TrouNoirView } from "@/games/trou-noir/types";

const matchId = "network-fixture";
const roomId = "room-network-fixture";

type CommandBody = {
  action?: { type?: string };
};

const players = [
  { id: "alice", seat: 0 as const, pseudo: "Alice", avatarPreset: "avatar-1", active: true },
  { id: "bob", seat: 1 as const, pseudo: "Bob", avatarPreset: "avatar-2", active: false },
];

function matchResponse(gameSlug: string, view: object) {
  return {
    matchId,
    roomId,
    gameSlug,
    status: "active",
    version: 1,
    phaseId: "phase-network-fixture",
    deadlineAt: null,
    deadlineKind: null,
    serverNow: new Date().toISOString(),
    view,
  };
}

function trouNoirView(): TrouNoirView {
  return {
    kind: "trou-noir",
    stateSchemaVersion: 1,
    phase: "answering",
    round: 1,
    maxRounds: 1,
    answerSeconds: 20,
    mySeat: 0,
    activeSeat: 0,
    activePlayerId: "alice",
    question: { prompt: "Quelle est la réponse ?", category: "culture", difficulty: 3, addresseeIsMe: true },
    judging: null,
    reveal: null,
    acknowledged: false,
    players: [
      { ...players[0], reserve: 100, correct: 0, incorrect: 0, timeouts: 0 },
      { ...players[1], reserve: 100, correct: 0, incorrect: 0, timeouts: 0 },
    ],
    result: null,
    allowedActions: ["SUBMIT_ANSWER", "RESIGN", "CLAIM_FORFEIT"],
  };
}

function geographyView(): GeoView {
  return {
    kind: "geographie",
    stateSchemaVersion: 1,
    phase: "placing",
    round: 1,
    rounds: 1,
    turnSeconds: 20,
    difficulty: "easy",
    selection: "random",
    mySeat: 0,
    target: { id: "city-1", name: "Paris", departmentName: "Paris" },
    targetPoint: null,
    players: [
      { ...players[0], score: 0, submitted: false, placement: null },
      { ...players[1], score: 0, submitted: false, placement: null },
    ],
    challenge: null,
    acknowledged: false,
    totals: [0, 0],
    lastRound: null,
    result: null,
  };
}

function navalView(phase: NavalView["phase"]): NavalView {
  return {
    kind: "bataille-navale",
    stateSchemaVersion: 1,
    phase,
    turnSeconds: null,
    mySeat: 0,
    activeSeat: 0,
    activePlayerId: phase === "playing" ? "alice" : null,
    turn: 1,
    myFleet: [],
    myShots: [],
    incomingShots: [],
    myReady: false,
    opponentReady: false,
    sunkByMe: [],
    sunkOfMine: [],
    hitsByMe: 0,
    missesByMe: 0,
    opponentFleet: null,
    lastShot: null,
    players: [
      { ...players[0], score: 0 },
      { ...players[1], score: 0 },
    ],
    result: null,
    allowedActions: phase === "playing"
      ? ["FIRE", "RESIGN", "CLAIM_FORFEIT"]
      : ["SET_FLEET", "RANDOMIZE_FLEET", "READY_FLEET", "RESIGN", "CLAIM_FORFEIT"],
  };
}

async function openFixture(page: Page, gameSlug: string, view: object): Promise<CommandBody[]> {
  const commands: CommandBody[] = [];
  await page.route(`**/api/matches/${matchId}`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(matchResponse(gameSlug, view)) });
  });
  await page.route(`**/api/matches/${matchId}/heartbeat`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ matchId, matchVersion: 1, serverNow: new Date().toISOString(), opponentLastSeenAt: null }),
    });
  });
  await page.route(`**/api/matches/${matchId}/commands`, async (route) => {
    commands.push(route.request().postDataJSON() as CommandBody);
    await route.abort("failed");
  });
  if (gameSlug === "geographie") {
    await page.route("**/maps/france-departments.geojson", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/geo+json",
        body: JSON.stringify({
          type: "FeatureCollection",
          features: [{
            type: "Feature",
            properties: { name: "metropole" },
            geometry: { type: "Polygon", coordinates: [[[-5, 42], [8, 42], [8, 51], [-5, 51], [-5, 42]]] },
          }],
        }),
      });
    });
  }
  await page.goto(`/parties/${matchId}`);
  return commands;
}

async function expectCommand(commands: CommandBody[], type: string): Promise<void> {
  await expect.poll(() => commands.length).toBe(1);
  expect(commands[0]?.action?.type).toBe(type);
}

async function expectPendingIntent(page: Page, actionType: string): Promise<void> {
  await expect.poll(async () => page.evaluate((id) => {
    const entry = Object.entries(window.sessionStorage).find(([key]) => key.includes(encodeURIComponent(id)));
    return entry?.[1] ?? "";
  }, matchId)).toContain(`"type":"${actionType}"`);
}

test("une coupure pendant l'abandon conserve l'intention et libère le bouton", async ({ page }) => {
  const commands = await openFixture(page, "trou-noir", trouNoirView());
  const abandon = page.getByRole("button", { name: "Abandonner", exact: true });
  await expect(abandon).toBeEnabled();
  await abandon.click();
  await expectCommand(commands, "RESIGN");
  await expect(abandon).toBeEnabled();
  await expectPendingIntent(page, "RESIGN");
});

test("une coupure pendant une réponse conserve le brouillon et libère l'envoi", async ({ page }) => {
  const commands = await openFixture(page, "trou-noir", trouNoirView());
  const answer = page.getByLabel("Ta réponse");
  await answer.fill("réponse interrompue");
  const submit = page.getByRole("button", { name: "Valider ma réponse" });
  await submit.click();
  await expectCommand(commands, "SUBMIT_ANSWER");
  await expect(submit).toBeEnabled();
  await expect(answer).toHaveValue("réponse interrompue");
  await expectPendingIntent(page, "SUBMIT_ANSWER");
});

test("une coupure pendant un tir conserve l'intention FIRE et réactive la grille", async ({ page }) => {
  const commands = await openFixture(page, "bataille-navale", navalView("playing"));
  const cell = page.locator('[data-cell="0-0"]');
  await expect(cell).toBeEnabled();
  await cell.click();
  await page.getByRole("button", { name: "Tirer en A1" }).click();
  await expectCommand(commands, "FIRE");
  await expect(cell).toBeEnabled();
  await expectPendingIntent(page, "FIRE");
});

test("une coupure pendant un placement conserve le point local et le bouton", async ({ page }) => {
  const commands = await openFixture(page, "geographie", geographyView());
  const map = page.locator('svg[role="application"]');
  await expect(map).toBeVisible();
  await map.click({ position: { x: 240, y: 180 } });
  const place = page.getByRole("button", { name: "Confirmer le placement" });
  await expect(place).toBeEnabled();
  await place.click();
  await expectCommand(commands, "PLACE_CITY");
  await expect(place).toBeEnabled();
  await expectPendingIntent(page, "PLACE_CITY");
});

test("une coupure pendant la configuration conserve RANDOMIZE_FLEET et libère le bouton", async ({ page }) => {
  const commands = await openFixture(page, "bataille-navale", navalView("setup"));
  const randomize = page.getByRole("button", { name: "Aléatoire", exact: true });
  await expect(randomize).toBeEnabled();
  await randomize.click();
  await expectCommand(commands, "RANDOMIZE_FLEET");
  await expect(randomize).toBeEnabled();
  await expectPendingIntent(page, "RANDOMIZE_FLEET");
});
