import { expect, test } from "@playwright/test";

test("présente les neuf jeux et n'active que Géographie", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "On joue à quoi ?" })).toBeVisible();
  await expect(page.locator(".home-game-card")).toHaveCount(9);
  await expect(page.getByRole("link", { name: "HexaPoint", exact: true })).toHaveAttribute("href", "/jeux/geographie");
  await expect(page.locator("article.home-game-card")).toHaveCount(8);
  await expect(page.getByRole("link", { name: "Inscription" })).toHaveAttribute("href", "/connexion?mode=signUp");

  const rail = page.locator("#home-game-rail");
  const before = await rail.evaluate((element) => element.scrollLeft);
  await page.getByRole("button", { name: "Voir les jeux suivants" }).click();
  await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(before);
  await expect(page.locator("html")).toHaveCSS("overflow-x", "visible");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
