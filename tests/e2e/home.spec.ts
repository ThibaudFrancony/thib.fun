import { expect, test } from "@playwright/test";

test("présente les neuf jeux dans un carrousel 3D et navigue vers les jeux implémentés", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "On joue à quoi ?" })).toBeVisible();
  await expect(page.locator(".home-game-card")).toHaveCount(9);

  // La carte centrale est jouable ; Géographie est centrée au départ.
  await expect(page.getByRole("button", { name: "Jouer à Géographie" })).toBeVisible();

  // Les flèches changent la carte active.
  await page.getByRole("button", { name: "Jeu suivant" }).click();
  await expect(page.getByRole("button", { name: "Jouer à Skyjo" })).toBeVisible();
  await page.getByRole("button", { name: "Jeu précédent" }).click();
  await expect(page.getByRole("button", { name: "Jouer à Géographie" })).toBeVisible();

  // Un point cible un jeu précis, le clavier parcourt le carrousel.
  await page.getByRole("button", { name: "Afficher UNO" }).click();
  await expect(page.getByRole("button", { name: "Jouer à UNO" })).toBeVisible();
  await page.locator(".home-carousel").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Jouer à BombParty" })).toBeVisible();

  // Cliquer une carte latérale la recentre.
  await page.getByRole("button", { name: "Voir Compatibilité" }).click();
  await expect(page.getByRole("button", { name: "Jouer à Compatibilité" })).toBeVisible();

  const settle = () => page.waitForTimeout(700);
  await settle();

  // Le clic-glisser déplace plusieurs cartes puis s'aimante.
  const viewport = page.locator(".home-carousel-viewport");
  const box = await viewport.boundingBox();
  if (!box) throw new Error("Vignette du carrousel introuvable");
  const activeLabel = () => page.locator('.home-game-card[data-active="true"]').getAttribute("aria-label");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 340, box.y + box.height / 2, { steps: 14 });
  await page.mouse.up();
  await expect.poll(activeLabel).not.toBe("Jouer à Compatibilité");
  await settle();

  // Clic sur la carte centrale : lance le jeu sélectionné.
  await page.getByRole("button", { name: "Afficher Géographie" }).click();
  await expect(page.getByRole("button", { name: "Jouer à Géographie" })).toBeVisible();
  await settle();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.getByRole("button", { name: "Jouer à Géographie" }).click();
  await expect(page).toHaveURL(/\/jeux\/geographie/);
});
