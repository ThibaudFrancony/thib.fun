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
  await page.goto("/jeux/trou-noir");
}

test("mène une manche Trou Noir à deux sans fuite de solution", async ({ browser, page: alice }) => {
  const bobContext = await browser.newContext();
  const bob = await bobContext.newPage();
  try {
    await signIn(alice, aliceEmail);
    await alice.getByLabel("Manches").selectOption("5");
    const createResponsePromise = alice.waitForResponse(
      (response) => response.url().endsWith("/api/rooms") && response.request().method() === "POST",
    );
    await alice.getByRole("button", { name: "Créer le salon" }).click();
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

    // Les deux voient la question ; la réponse attendue n'est écrite nulle part.
    const question = await alice.locator("h2").first().textContent();
    expect(question?.trim().length).toBeGreaterThan(0);
    await expect(bob.locator("h2", { hasText: question?.trim() ?? "" })).toBeVisible({ timeout: 10_000 });
    await expect(alice.locator("text=Réponse attendue")).toHaveCount(0);
    await expect(bob.locator("text=Réponse attendue")).toHaveCount(0);

    // Le joueur actif répond ; la phase de vérification s'affiche.
    const aliceAnswer = alice.getByLabel("Ta réponse");
    const bobAnswer = bob.getByLabel("Ta réponse");
    const activeField = (await aliceAnswer.count()) > 0 ? aliceAnswer : bobAnswer;
    const activePage = (await aliceAnswer.count()) > 0 ? alice : bob;
    await activeField.fill("une réponse de test");
    await activePage.getByRole("button", { name: "Valider ma réponse" }).click();
    await expect(activePage.getByText("Vérification de la réponse")).toBeVisible({ timeout: 15_000 });
  } finally {
    await bobContext.close();
  }
});
