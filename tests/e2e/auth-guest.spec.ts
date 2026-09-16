import { expect, test } from "@playwright/test";

test("présente l'avertissement avant une session invitée", async ({ page }) => {
  await page.goto("/connexion?mode=signUp");

  await page.getByRole("button", { name: "Continuer en tant qu'invité" }).click();
  const dialog = page.getByRole("dialog", { name: "Jouer sans créer de compte ?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("ta progression ne seront pas conservés");
  await expect(dialog.getByRole("button", { name: "Continuer comme invité" })).toBeVisible();

  await dialog.getByRole("button", { name: "Retour à l'inscription" }).click();
  await expect(dialog).toBeHidden();
});

test("ouvre une session invitée complète dans la base isolée de CI", async ({ page }) => {
  test.skip(!process.env.CI, "La session anonyme complète nécessite le Supabase local préparé par la CI.");
  await page.goto("/connexion?mode=signUp&next=/profil");
  await page.getByRole("button", { name: "Continuer en tant qu'invité" }).click();
  const dialog = page.getByRole("dialog", { name: "Jouer sans créer de compte ?" });
  const anonymousSignInPromise = page.waitForResponse(
    (response) => response.url().includes("/auth/v1/signup") && response.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Continuer comme invité" }).click();
  expect((await anonymousSignInPromise).ok()).toBeTruthy();
  await page.waitForURL("**/profil");
  await expect(page.getByRole("heading", { name: /Tu joues sous le pseudo/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Cette session te permet de rejoindre des salons et de jouer")).toBeVisible();
});
