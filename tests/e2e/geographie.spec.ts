import { expect, test, type Page } from "@playwright/test";

const password = process.env.E2E_PASSWORD;
const aliceEmail = process.env.E2E_ALICE_EMAIL ?? "alice@local.tibo.fun";
const bobEmail = process.env.E2E_BOB_EMAIL ?? "bob@local.tibo.fun";

test.skip(!password, "E2E_PASSWORD est requis après `node scripts/seed-local-members.mjs`.");

async function signIn(page: Page, email: string) {
  await page.goto("/connexion");
  await page.getByRole("textbox", { name: "E-mail" }).fill(email);
  await page.getByRole("textbox", { name: "Mot de passe" }).fill(password!);
  await page.getByRole("button", { name: "Entrer à la table" }).click();
  await page.waitForURL("**/jeux/geographie");
}

async function placeFrom(page: Page) {
  const map = page.locator('svg[role="application"]');
  await expect(map).toBeVisible();
  await map.click({ position: { x: 240, y: 180 } });
  await page.getByRole("button", { name: "Confirmer le placement" }).click();
}

test("joue une manche à deux et ne révèle le résultat qu'après les deux placements", async ({ browser, page: alice }) => {
  const bobContext = await browser.newContext();
  const bob = await bobContext.newPage();
  try {
    await signIn(alice, aliceEmail);
    await alice.getByLabel("Manches").selectOption("5");
    const createResponsePromise = alice.waitForResponse((response) => response.url().endsWith("/api/rooms") && response.request().method() === "POST");
    await alice.getByRole("button", { name: "Créer le salon" }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.ok()).toBeTruthy();
    const created = await createResponse.json() as { roomId: string; code: string };
    await alice.waitForURL(`**/salons/${created.roomId}`);

    await signIn(bob, bobEmail);
    await bob.getByLabel("Code du salon").fill(created.code);
    await bob.getByRole("button", { name: "Rejoindre le salon" }).click();
    await bob.waitForURL(`**/salons/${created.roomId}`);

    await alice.getByRole("button", { name: "Je suis prêt" }).click();
    await bob.getByRole("button", { name: "Je suis prêt" }).click();
    await expect(alice.getByRole("button", { name: "Lancer" })).toBeEnabled({ timeout: 10_000 });
    await alice.getByRole("button", { name: "Lancer" }).click();
    await Promise.all([
      expect(alice).toHaveURL(/\/parties\/[0-9a-f-]+$/, { timeout: 15_000 }),
      expect(bob).toHaveURL(/\/parties\/[0-9a-f-]+$/, { timeout: 15_000 }),
    ]);

    await expect(alice.getByText(/À toi de placer le point|Au tour de ton partenaire/)).toBeVisible({ timeout: 10_000 });
    await expect(bob.getByText(/À toi de placer le point|Au tour de ton partenaire/)).toBeVisible({ timeout: 10_000 });
    const activePage = (await alice.getByText("À toi de placer le point").isVisible()) ? alice : bob;
    const waitingPage = activePage === alice ? bob : alice;
    await placeFrom(activePage);
    await expect(waitingPage.getByText("Placement reçu")).toBeVisible({ timeout: 10_000 });
    await expect(waitingPage.getByText("À toi de placer le point")).toBeVisible();
    await placeFrom(waitingPage);
    await expect(alice.getByText("Résultats de la manche")).toBeVisible({ timeout: 10_000 });
    await expect(bob.getByText("Résultats de la manche")).toBeVisible({ timeout: 10_000 });
  } finally {
    await bobContext.close();
  }
});
