import { expect, test } from "@playwright/test";

test("présente les neuf jeux dans un carrousel et navigue vers les jeux implémentés", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "On joue à quoi ?" })).toBeVisible();
  await expect(page.locator(".home-game-card")).toHaveCount(9);

  // La carte active est un lien jouable ; Géographie est centrée au départ.
  await expect(page.getByRole("link", { name: "Jouer à Géographie" })).toHaveAttribute("href", "/jeux/geographie");

  // Les flèches changent la carte active.
  await page.getByRole("button", { name: "Jeu suivant" }).click();
  await expect(page.getByRole("link", { name: "Jouer à Skyjo" })).toHaveAttribute("href", "/jeux/skyjo");
  await page.getByRole("button", { name: "Jeu précédent" }).click();
  await expect(page.getByRole("link", { name: "Jouer à Géographie" })).toBeVisible();

  // Un point cible un jeu précis.
  await page.getByRole("button", { name: "Afficher UNO" }).click();
  await expect(page.getByRole("link", { name: "Jouer à UNO" })).toHaveAttribute("href", "/jeux/uno");

  // Le clavier parcourt le carrousel.
  await page.locator(".home-carousel").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("link", { name: "Jouer à BombParty" })).toBeVisible();

  // Une carte latérale se recentre puis devient jouable.
  await page.getByRole("button", { name: "Voir Bataille navale" }).click();
  await expect(page.getByRole("link", { name: "Jouer à Bataille navale" })).toHaveAttribute("href", "/jeux/bataille-navale");

  // Aucun jeu non prêt et pas de débordement horizontal.
  await expect(page.locator("article.home-game-card")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Inscription" })).toHaveAttribute("href", "/connexion?mode=signUp");
  await expect(page.locator("html")).toHaveCSS("overflow-x", "visible");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
