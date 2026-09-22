import { expect, test, type Page } from "@playwright/test";
import { aliceEmail, bobEmail, requireE2ECredentials, signIn } from "./support";

requireE2ECredentials(test);
test.setTimeout(180_000);

async function clickWhenPresent(page: Page, name: string) {
  await expect.poll(() => page.getByRole("button", { name }).count(), { timeout: 20_000 }).toBeGreaterThan(0);
  await page.getByRole("button", { name }).click();
}

test("alterne indices et estimations sur six manches", async ({ browser, page: alice }) => {
  const bobContext = await browser.newContext();
  const bob = await bobContext.newPage();
  try {
    await signIn(alice, aliceEmail, "/jeux/longueur-onde");
    await alice.getByLabel("Manches").selectOption("6");
    await alice.getByLabel("Temps pour l'indice").selectOption("60");
    await alice.getByLabel("Temps pour placer").selectOption("30");
    const createResponsePromise = alice.waitForResponse((response) => response.url().endsWith("/api/rooms") && response.request().method() === "POST");
    await alice.getByRole("button", { name: "Créer le salon À l'unisson" }).click();
    const created = (await (await createResponsePromise).json()) as { roomId: string; code: string };
    await alice.waitForURL(`**/salons/${created.roomId}`);

    await signIn(bob, bobEmail, "/jeux/longueur-onde");
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

    for (let round = 0; round < 6; round += 1) {
      await expect.poll(async () => (await alice.getByLabel("Ton indice").count()) + (await bob.getByLabel("Ton indice").count()), { timeout: 15_000 }).toBe(1);
      const cluePage = (await alice.getByLabel("Ton indice").count()) > 0 ? alice : bob;
      await cluePage.getByLabel("Ton indice").fill("Un café tout juste servi");
      await cluePage.getByRole("button", { name: "Envoyer" }).click();
      const guessPage = cluePage === alice ? bob : alice;
      await expect(guessPage.getByLabel("Place ton aiguille")).toBeVisible({ timeout: 15_000 });
      await guessPage.getByLabel("Place ton aiguille").fill("50");
      await guessPage.getByRole("button", { name: "Valider" }).click();
      await expect(alice.getByText("La cible se révèle")).toBeVisible({ timeout: 15_000 });
      await Promise.all([
        clickWhenPresent(alice, "Continuer"),
        clickWhenPresent(bob, "Continuer"),
      ]);
    }
    await expect(alice.getByText("Résultat commun")).toBeVisible({ timeout: 15_000 });
    await expect(bob.getByText("Résultat commun")).toBeVisible({ timeout: 15_000 });
  } finally {
    await bobContext.close();
  }
});
