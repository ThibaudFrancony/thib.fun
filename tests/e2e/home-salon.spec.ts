import { expect, test, type Page } from "@playwright/test";
import { aliceEmail, bobEmail, requireE2ECredentials, signIn } from "./support";

requireE2ECredentials(test);
test.setTimeout(120_000);

async function openSalon(page: Page) {
  await page.getByRole("button", { name: "Salon" }).click();
}

/** Un compte ne garde qu'un salon générique actif : on le libère avant le test. */
async function resetLobby(page: Page) {
  await openSalon(page);
  const door = page.getByRole("button", { name: "Quitter le groupe" });
  const hasLobby = await door.waitFor({ state: "visible", timeout: 6000 }).then(() => true).catch(() => false);
  if (hasLobby) {
    page.once("dialog", (dialog) => void dialog.accept());
    await door.click();
    await expect(page.getByRole("button", { name: "Salon" })).toBeVisible({ timeout: 10_000 });
    return;
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Salon" })).toBeVisible({ timeout: 5_000 });
}

test("crée un salon depuis l'accueil, invite, détecte le groupe et lance un jeu", async ({ browser, page: alice }) => {
  const bobContext = await browser.newContext();
  const bob = await bobContext.newPage();
  try {
    await signIn(alice, aliceEmail, "/");
    await resetLobby(alice);
    await openSalon(alice);
    await alice.getByRole("button", { name: /Créer un salon/ }).click();
    await expect(alice.locator(".salon-code")).toBeVisible({ timeout: 15_000 });
    const code = (await alice.locator(".salon-code").textContent())?.trim() ?? "";
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    await expect(alice.locator(".salon-slot[data-filled='true']")).toHaveCount(1);
    await expect(alice.locator(".salon-slot[data-filled='false']")).toHaveCount(1);

    await signIn(bob, bobEmail, "/");
    await resetLobby(bob);
    await openSalon(bob);
    await bob.getByRole("button", { name: /Rejoindre/ }).first().click();
    await bob.getByLabel("Code du salon").fill(code);
    await bob.getByRole("button", { name: "Rejoindre" }).click();
    // L'invité voit le groupe sans le code d'invitation.
    await expect(bob.locator(".salon-games")).toBeVisible({ timeout: 15_000 });
    await expect(bob.locator(".salon-code")).toHaveCount(0);

    // La place vide de l'hôte se remplit en direct.
    await expect(alice.locator(".salon-slot[data-filled='true']")).toHaveCount(2, { timeout: 15_000 });
    await expect(alice.locator(".salon-games")).toBeVisible();

    // Clic sur le jeu : page normale, sans interface créer/rejoindre.
    await alice.getByRole("link", { name: "Géographie" }).click();
    await alice.waitForURL(/\/jeux\/geographie/);
    await expect(alice.locator(".group-room-banner")).toBeVisible({ timeout: 15_000 });
    await expect(alice.getByRole("button", { name: "Créer le salon" })).toHaveCount(0);
    await expect(alice.getByRole("button", { name: "Rejoindre le salon" })).toHaveCount(0);

    await bob.goto("/jeux/geographie");
    await expect(bob.locator(".group-room-banner")).toBeVisible({ timeout: 15_000 });
    await expect(bob.getByRole("button", { name: "Lancer la partie" })).toHaveCount(0);

    const launch = alice.getByRole("button", { name: "Lancer la partie" });
    await expect(launch).toBeEnabled({ timeout: 15_000 });
    await launch.click();
    await Promise.all([
      expect(alice).toHaveURL(/\/parties\/[0-9a-f-]+$/, { timeout: 20_000 }),
      expect(bob).toHaveURL(/\/parties\/[0-9a-f-]+$/, { timeout: 20_000 }),
    ]);
  } finally {
    await bobContext.close();
  }
});

test("le bouton porte fait quitter le groupe et libère la place", async ({ browser, page: alice }) => {
  const bobContext = await browser.newContext();
  const bob = await bobContext.newPage();
  bob.on("dialog", (dialog) => void dialog.accept());
  alice.on("dialog", (dialog) => void dialog.accept());
  try {
    await signIn(alice, aliceEmail, "/");
    await resetLobby(alice);
    await openSalon(alice);
    await alice.getByRole("button", { name: /Créer un salon/ }).click();
    await expect(alice.locator(".salon-code")).toBeVisible({ timeout: 15_000 });
    const code = (await alice.locator(".salon-code").textContent())?.trim() ?? "";

    await signIn(bob, bobEmail, "/");
    await resetLobby(bob);
    await openSalon(bob);
    await bob.getByRole("button", { name: /Rejoindre/ }).first().click();
    await bob.getByLabel("Code du salon").fill(code);
    await bob.getByRole("button", { name: "Rejoindre" }).click();
    await expect(bob.locator(".salon-games")).toBeVisible({ timeout: 15_000 });

    // L'invité quitte : la place se libère chez l'hôte.
    await bob.getByRole("button", { name: "Quitter le groupe" }).click();
    await expect(bob.getByRole("button", { name: "Salon" })).toBeVisible({ timeout: 15_000 });
    await expect(alice.locator(".salon-slot[data-filled='true']")).toHaveCount(1, { timeout: 15_000 });

    // L'hôte ferme à son tour : plus de salon actif.
    await alice.getByRole("button", { name: "Quitter le groupe" }).click();
    await expect(alice.getByRole("button", { name: "Salon" })).toBeVisible({ timeout: 15_000 });
  } finally {
    await bobContext.close();
  }
});
