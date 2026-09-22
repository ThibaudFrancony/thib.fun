import { expect, test, type Page } from "@playwright/test";
import { compactViews } from "./compact-views";

// Browser-only projections: no authentication, database or Docker required.
async function openMatch(page: Page, slug: string, changes: Record<string, unknown> = {}) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/matches/compact-fixture") return route.fulfill({ json: {
      matchId: "compact-fixture", roomId: "compact-room", gameSlug: slug, status: "active",
      version: 1, phaseId: "p1", deadlineAt: null, deadlineKind: null, serverNow: new Date().toISOString(),
      view: { ...compactViews[slug], ...changes },
    } });
    if (path.endsWith("/heartbeat")) return route.fulfill({ json: { matchVersion: 1, serverNow: new Date().toISOString(), opponentLastSeenAt: null } });
    return route.fulfill({ status: 401, json: { error: { code: "UNAUTHORIZED", message: "Fixture" } } });
  });
  await page.goto("/parties/compact-fixture");
  await expect(page.locator(".play-toolbar")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  if (slug === "geographie" && [undefined, "placing", "reveal"].includes(changes.phase as string | undefined)) await expect(page.locator("[data-map-ready=true]")).toBeVisible();
  return errors;
}

async function expectFits(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const root = document.documentElement;
    const outside = [...document.querySelectorAll<HTMLElement>("main button, main input, main textarea, main select, main svg")]
      .filter((element) => element.getClientRects().length && !element.closest("dialog") && !element.closest('[aria-hidden="true"]'))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.bottom > innerHeight + 2 || rect.right > innerWidth + 2 || rect.top < -2 || rect.left < -2;
      }).map((element) => element.getAttribute("aria-label") ?? element.textContent?.slice(0, 40));
    return { extraWidth: Math.max(0, root.scrollWidth - innerWidth), extraHeight: Math.max(0, root.scrollHeight - innerHeight), outside };
  })).toEqual({ extraWidth: 0, extraHeight: 0, outside: [] });
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 360, height: 640 }, { width: 844, height: 390 }]) {
  for (const slug of Object.keys(compactViews)) {
    test(`${slug} tient dans ${viewport.width} × ${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const errors = await openMatch(page, slug);
      await expectFits(page);
      expect(errors).toEqual([]);
    });
  }
}

test("les options restent accessibles au clavier et rendent le focus au plateau", async ({ page }) => {
  await openMatch(page, "ttmc");
  const options = page.getByRole("button", { name: "Options de la partie" });
  await options.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Abandonner", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(options).toBeFocused();
  await expectFits(page);
});

test("une grande main UNO reste lisible et chaque carte accessible sans défiler", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await openMatch(page, "uno", { hand: Array.from({ length: 28 }, (_, index) => ({ id: `c${index}`, color: "red", symbol: String(index % 10) })) });
  for (let index = 0; index < 4; index++) {
    const cards = page.locator(".uno-hand > button:visible");
    await expect(cards).toHaveCount(7);
    await expectFits(page);
    expect((await cards.first().boundingBox())?.width).toBeGreaterThan(30);
    if (index < 3) await page.getByRole("button", { name: "Cartes suivantes" }).click();
  }
  await expect(page.getByRole("button", { name: "Cartes suivantes" })).toBeDisabled();
});

const reveal = { timeout: false, verdict: "reject", submittedAnswer: "Une réponse incorrecte", expectedAnswer: "Or", explanation: "Le symbole Au vient du latin aurum.", points: 0, contestable: true, attemptId: "a", contest: { status: "pending", requesterIsMe: false } };
const states: { slug: string; name: string; changes: Record<string, unknown> }[] = [
  ...["trou-noir", "ttmc"].map((slug) => ({ slug, name: "contestation", changes: { phase: "reveal", reveal, allowedActions: ["RESOLVE_CONTEST", "NEXT"] } })),
  { slug: "ttmc", name: "question longue", changes: { phase: "answering", question: { level: 8, addresseeIsMe: true, prompt: "Dans Le Seigneur des anneaux, quel personnage accompagne Frodon tout au long de son voyage jusqu’à la Montagne du Destin, malgré les épreuves et la tentation de l’Anneau, et lui permet finalement d’accomplir sa mission ?" } } },
  { slug: "skyjo", name: "carte piochée", changes: { phase: "resolve_draw", held: { value: 5, source: "draw" }, lastTurn: true, allowedActions: ["REPLACE", "DISCARD_AND_REVEAL"] } },
  { slug: "skyjo", name: "fin de manche", changes: { phase: "round_reveal", roundSummary: { round: 3, final: [24, 12], raw: [12, 12], cumulativeAfter: [45, 32], penalizedSeat: 0 }, allowedActions: ["NEXT"] } },
  { slug: "compatibilite", name: "révélation", changes: { phase: "reveal", myChoice: "a", opponentChoice: "a", allowedActions: ["NEXT"] } },
  { slug: "longueur-onde", name: "indice", changes: { phase: "clue", isClueGiver: true, target: 45, clue: null } },
  { slug: "longueur-onde", name: "révélation", changes: { phase: "reveal", target: 45, myGuess: 48, allowedActions: ["NEXT"] } },
  { slug: "bataille-navale", name: "tir", changes: { phase: "playing", myReady: true, opponentReady: true, allowedActions: ["FIRE"] } },
  { slug: "geographie", name: "révélation", changes: { phase: "reveal", targetPoint: { latitude: 48.86, longitude: 2.35 }, lastRound: { target: { name: "Paris", departmentName: "Paris" }, placements: [{ distanceKm: 12, points: 900 }, { distanceKm: 40, points: 700 }] } } },
  ...Object.keys(compactViews).map((slug) => ({ slug, name: "résultat", changes: { phase: "finished", result: { outcome: ["compatibilite", "longueur-onde"].includes(slug) ? "cooperative" : "win", winnerId: "alice", players: [{ score: 12 }, { score: 8 }], total: 24, maxTotal: 32, percentage: 75, missed: 0, averageError: 5, sharedScore: 80, matches: 8, compared: 10, skipped: 0, rounds: [] } } })),
];
for (const viewport of [{ width: 360, height: 640 }, { width: 844, height: 390 }]) {
  for (const state of states) {
    test(`${state.slug} ${state.name} dans ${viewport.width} × ${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const errors = await openMatch(page, state.slug, state.changes);
      if (state.name === "tir") {
        await page.locator('[data-cell="0-0"]').click();
        await expect(page.getByRole("button", { name: "Tirer en A1" })).toBeEnabled();
      }
      if (state.name === "carte piochée") {
        await page.locator(".table-skyjo-board > div:last-child button").first().click();
        await expect(page.getByRole("button", { name: "Remplacer", exact: true })).toBeEnabled();
      }
      await expectFits(page);
      expect(errors).toEqual([]);
    });
  }
}
