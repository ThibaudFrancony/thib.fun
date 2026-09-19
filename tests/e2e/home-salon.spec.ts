import { expect, test, type Page } from "@playwright/test";
import { aliceEmail, bobEmail, requireE2ECredentials, signIn } from "./support";

requireE2ECredentials(test);
test.setTimeout(120_000);

async function openSalon(page: Page) {
  await page.locator(".salon-trigger").click();
}

/** Un compte ne garde qu'un salon générique actif : on le libère avant le test. */
async function resetLobby(page: Page) {
  await expect(page.locator('.salon-anchor[data-salon-ready="true"]')).toBeVisible({ timeout: 15_000 });
  if (await page.locator(".salon-chip").count()) {
    page.once("dialog", (dialog) => void dialog.accept());
    await page.locator(".salon-door").click();
    await expect(page.locator(".salon-trigger")).toBeVisible({ timeout: 10_000 });
  }
}

test("crée un salon depuis l'accueil, invite, détecte le groupe et lance un jeu", async ({ browser, page: alice }) => {
  const bobContext = await browser.newContext();
  const bob = await bobContext.newPage();
  try {
    await signIn(alice, aliceEmail, "/");
    await resetLobby(alice);
    await openSalon(alice);
    await alice.getByRole("button", { name: /Créer un salon/ }).click();
    // Le bouton laisse place au badge de groupe : code + ronds + porte.
    await expect(alice.locator(".salon-chip")).toBeVisible({ timeout: 15_000 });
    const code = (await alice.locator(".salon-chip-code").textContent({ timeout: 10_000 }))?.trim() ?? "";
    expect(code).toMatch(/^[A-Z0-9]{6}$/);

    // Ouvre la petite fenêtre : une place prise, une place vide.
    await alice.locator(".salon-chip-main").click();
    await expect(alice.locator(".salon-popover")).toBeVisible();
    await expect(alice.locator(".salon-slot[data-filled='true']")).toHaveCount(1);
    await expect(alice.locator(".salon-slot[data-filled='false']")).toHaveCount(1);

    await signIn(bob, bobEmail, "/");
    await resetLobby(bob);
    await openSalon(bob);
    await bob.getByRole("button", { name: "Rejoindre" }).click();
    await bob.getByLabel("Code du salon").fill(code);
    await bob.getByRole("button", { name: "Rejoindre" }).click();
    // L'invité voit le badge sans le code d'invitation.
    await expect(bob.locator(".salon-chip")).toBeVisible({ timeout: 15_000 });
    await expect(bob.locator(".salon-chip-code")).toHaveCount(0);

    // La place vide de l'hôte se remplit en direct.
    await expect(alice.locator(".salon-slot[data-filled='true']")).toHaveCount(2, { timeout: 15_000 });
    await expect(alice.locator(".salon-games")).toBeVisible();

    // Clic sur le jeu : page normale, sans interface créer/rejoindre, avec le
    // salon toujours visible dans le header de jeu.
    await alice.getByRole("link", { name: "Géographie" }).click();
    await alice.waitForURL(/\/jeux\/geographie/);
    await expect(alice.locator(".group-room-banner")).toBeVisible({ timeout: 15_000 });
    await expect(alice.locator(".geo-header .salon-chip")).toBeVisible({ timeout: 15_000 });
    await expect(alice.getByRole("button", { name: "Créer le salon" })).toHaveCount(0);
    await expect(alice.getByRole("button", { name: "Rejoindre le salon" })).toHaveCount(0);

    await bob.goto("/jeux/geographie");
    await expect(bob.locator(".group-room-banner")).toBeVisible({ timeout: 15_000 });
    await expect(bob.locator(".geo-header .salon-chip")).toBeVisible({ timeout: 15_000 });
    await expect(bob.getByRole("button", { name: "Jouer" })).toHaveCount(0);

    const launch = alice.getByRole("button", { name: "Jouer" });
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
    await expect(alice.locator(".salon-chip")).toBeVisible({ timeout: 15_000 });
    const code = (await alice.locator(".salon-chip-code").textContent({ timeout: 10_000 }))?.trim() ?? "";

    await signIn(bob, bobEmail, "/");
    await resetLobby(bob);
    await openSalon(bob);
    await bob.getByRole("button", { name: "Rejoindre" }).click();
    await bob.getByLabel("Code du salon").fill(code);
    await bob.getByRole("button", { name: "Rejoindre" }).click();
    await expect(bob.locator(".salon-chip")).toBeVisible({ timeout: 15_000 });

    // L'invité quitte : la place se libère chez l'hôte.
    await bob.locator(".salon-door").click();
    await expect(bob.locator(".salon-trigger")).toBeVisible({ timeout: 15_000 });

    await alice.locator(".salon-chip-main").click();
    await expect(alice.locator(".salon-slot[data-filled='true']")).toHaveCount(1, { timeout: 15_000 });

    // L'hôte ferme à son tour : plus de salon actif.
    await alice.locator(".salon-door").click();
    await expect(alice.locator(".salon-trigger")).toBeVisible({ timeout: 15_000 });
  } finally {
    await bobContext.close();
  }
});

test("un salon avec jeu posé reste détecté hors de sa page", async ({ page: alice }) => {
  alice.on("dialog", (dialog) => void dialog.accept());
  await signIn(alice, aliceEmail, "/");
  await resetLobby(alice);

  // Salon créé depuis la page d'un jeu : `game_slug` est posé dès la création.
  await alice.goto("/jeux/geographie");
  await alice.getByRole("button", { name: "Créer le salon" }).click();
  await alice.waitForURL(/\/salons\/[0-9a-f-]+$/);

  // Retour à l'accueil : le badge du salon reste visible pour son propre compte.
  await alice.goto("/");
  await expect(alice.locator(".salon-chip")).toBeVisible({ timeout: 15_000 });

  // Une autre page de jeu masque créer/rejoindre et garde le bandeau du groupe.
  await alice.goto("/jeux/uno");
  await expect(alice.locator(".group-room-banner")).toBeVisible({ timeout: 15_000 });
  await expect(alice.locator(".geo-header .salon-chip")).toBeVisible({ timeout: 15_000 });
  await expect(alice.getByRole("button", { name: "Créer le salon UNO" })).toHaveCount(0);
  await expect(alice.getByRole("button", { name: "Rejoindre le salon" })).toHaveCount(0);
});
