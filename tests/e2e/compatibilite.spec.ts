import { expect, test, type Page } from "@playwright/test";

const password = process.env.E2E_PASSWORD;
const aliceEmail = process.env.E2E_ALICE_EMAIL ?? "alice@local.tibo.fun";
const bobEmail = process.env.E2E_BOB_EMAIL ?? "bob@local.tibo.fun";

test.skip(!password, "E2E_PASSWORD est requis après `node scripts/seed-local-members.mjs`.");
test.setTimeout(120_000);

async function signIn(page: Page, email: string) {
  await page.goto("/connexion");
  await page.getByRole("textbox", { name: "E-mail" }).fill(email);
  await page.getByRole("textbox", { name: "Mot de passe" }).fill(password!);
  await page.getByRole("button", { name: "Entrer à la table" }).click();
  await page.waitForURL("**/jeux/geographie");
  await page.goto("/jeux/compatibilite");
}

test("compare deux choix simultanés sans exposer le choix adverse avant la révélation", async ({ browser, page: alice }) => {
  const bobContext = await browser.newContext();
  const bob = await bobContext.newPage();
  try {
    await signIn(alice, aliceEmail);
    await alice.getByLabel("Catégorie").selectOption("amitie");
    await alice.getByLabel("Questions comparées").selectOption("10");
    const createResponsePromise = alice.waitForResponse((response) => response.url().endsWith("/api/rooms") && response.request().method() === "POST");
    await alice.getByRole("button", { name: "Créer le salon Même réponse ?" }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.ok()).toBeTruthy();
    const created = (await createResponse.json()) as { roomId: string; code: string };
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

    await expect(alice.getByText("Question 1 / 10")).toBeVisible({ timeout: 10_000 });
    const aliceOption = alice.locator('[role="radio"]').first();
    const bobOption = bob.locator('[role="radio"]').nth(1);
    await aliceOption.click();
    await alice.getByRole("button", { name: "Confirmer mon choix" }).click();
    await expect(alice.getByText("En attente de Basile")).toBeVisible({ timeout: 10_000 });
    await expect(alice.getByText("Vos choix se dévoilent")).toHaveCount(0);
    await bobOption.click();
    await bob.getByRole("button", { name: "Confirmer mon choix" }).click();
    await expect(alice.getByText("Vos choix se dévoilent")).toBeVisible({ timeout: 10_000 });
    await expect(alice.getByText("Basile")).toBeVisible();
  } finally {
    await bobContext.close();
  }
});
