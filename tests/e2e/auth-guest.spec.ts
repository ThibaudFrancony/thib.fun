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
