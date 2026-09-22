import { expect, test } from "@playwright/test";
import { aliceEmail, bobEmail, requireE2ECredentials, signIn } from "./support";

requireE2ECredentials(test);
test.setTimeout(120_000);

test("compare deux choix simultanés sans exposer le choix adverse avant la révélation", async ({ browser, page: alice }) => {
  const bobContext = await browser.newContext();
  const bob = await bobContext.newPage();
  try {
    await signIn(alice, aliceEmail, "/jeux/compatibilite");
    await alice.getByLabel("Catégorie").selectOption("amitie");
    await alice.getByLabel("Questions comparées").selectOption("10");
    const createResponsePromise = alice.waitForResponse((response) => response.url().endsWith("/api/rooms") && response.request().method() === "POST");
    await alice.getByRole("button", { name: "Créer le salon Même réponse ?" }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.ok()).toBeTruthy();
    const created = (await createResponse.json()) as { roomId: string; code: string };
    await alice.waitForURL(`**/salons/${created.roomId}`);

    await signIn(bob, bobEmail, "/jeux/compatibilite");
    await bob.getByLabel("Code du salon").fill(created.code);
    await bob.getByRole("button", { name: "Rejoindre le salon" }).click();
    await bob.waitForURL(`**/salons/${created.roomId}`);
    await alice.getByRole("button", { name: "Je suis prêt" }).click();
    await expect(alice.locator(".geo-member-card").filter({ hasText: "Alice" }).locator(".geo-ready-badge[data-ready='true']")).toHaveCount(1);
    await bob.getByRole("button", { name: "Je suis prêt" }).click();
    await expect(alice.locator(".geo-ready-badge[data-ready='true']")).toHaveCount(2);
    await expect(alice.getByRole("button", { name: "Lancer" })).toBeEnabled({ timeout: 10_000 });
    await alice.getByRole("button", { name: "Lancer" }).click();
    await Promise.all([
      expect(alice).toHaveURL(/\/parties\/[0-9a-f-]+$/, { timeout: 15_000 }),
      expect(bob).toHaveURL(/\/parties\/[0-9a-f-]+$/, { timeout: 15_000 }),
    ]);

    await expect(alice.locator(".play-toolbar h1")).toContainText("1/10", { timeout: 10_000 });
    const aliceOption = alice.locator('[role="radio"]').first();
    const bobOption = bob.locator('[role="radio"]').nth(1);
    await aliceOption.click();
    await alice.getByRole("button", { name: "Valider" }).click();
    await expect(alice.getByText(/^En attente de .+$/)).toBeVisible({ timeout: 10_000 });
    await expect(alice.getByText("Vos choix se dévoilent")).toHaveCount(0);
    await bobOption.click();
    await bob.getByRole("button", { name: "Valider" }).click();
    await expect(alice.getByText("Vos choix se dévoilent")).toBeVisible({ timeout: 10_000 });
    await alice.getByRole("button", { name: "Options de la partie" }).click();
    await expect(alice.getByText("Choix confirmé")).toHaveCount(2);
  } finally {
    await bobContext.close();
  }
});
