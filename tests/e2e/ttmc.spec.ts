import { expect, test } from "@playwright/test";
import { aliceEmail, bobEmail, requireE2ECredentials, signIn } from "./support";

requireE2ECredentials(test);
test.setTimeout(120_000);

test("mène un tour TTMC à deux avec niveaux différents et sans fuite", async ({ browser, page: alice }) => {
  const bobContext = await browser.newContext();
  const bob = await bobContext.newPage();
  try {
    await signIn(alice, aliceEmail, "/jeux/ttmc");
    await alice.getByLabel("Score à atteindre").selectOption("20");
    const createResponsePromise = alice.waitForResponse(
      (response) => response.url().endsWith("/api/rooms") && response.request().method() === "POST",
    );
    await alice.getByRole("button", { name: "Créer le salon" }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.ok()).toBeTruthy();
    const created = (await createResponse.json()) as { roomId: string; code: string };
    await alice.waitForURL(`**/salons/${created.roomId}`);

    await signIn(bob, bobEmail, "/jeux/ttmc");
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

    // Thème visible sans question avant le choix de niveau.
    await expect(alice.getByText("Thème de la manche")).toBeVisible({ timeout: 10_000 });
    await expect(alice.locator("text=Réponse attendue")).toHaveCount(0);
    await expect(bob.locator("text=Réponse attendue")).toHaveCount(0);

    // Le joueur actif choisit un niveau puis répond.
    const aliceConfirm = alice.getByRole("button", { name: /Choisir/ });
    const bobConfirm = bob.getByRole("button", { name: /Choisir/ });
    const activeConfirm = (await aliceConfirm.count()) > 0 ? aliceConfirm : bobConfirm;
    const activePage = (await aliceConfirm.count()) > 0 ? alice : bob;
    await activeConfirm.click();
    await expect(activePage.getByLabel("Ta réponse")).toBeVisible({ timeout: 10_000 });
    await activePage.getByLabel("Ta réponse").fill("une réponse de test");
    await activePage.getByRole("button", { name: "Valider" }).click();
    await expect(activePage.getByText("Vérification de la réponse")).toBeVisible({ timeout: 15_000 });
  } finally {
    await bobContext.close();
  }
});
