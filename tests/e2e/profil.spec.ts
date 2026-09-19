import { expect, test, type Page } from "@playwright/test";
import { aliceEmail, e2ePassword, requireE2ECredentials } from "./support";

requireE2ECredentials(test);

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
];

async function signInForProfil(page: Page): Promise<void> {
  if (!e2ePassword) throw new Error("E2E_PASSWORD est requis.");
  await page.goto("/connexion");
  await expect(page.locator("form")).toHaveAttribute("data-auth-hydrated", "true");
  await page.getByRole("textbox", { name: "E-mail" }).fill(aliceEmail);
  await page.getByRole("textbox", { name: "Mot de passe" }).fill(e2ePassword);
  await page.getByRole("button", { name: "Entrer à la table" }).click();
  // La connexion ramène à l'accueil : rejoindre ensuite le profil.
  // Le profil charge des assets (fond, avatars) qui peuvent retarder
  // l'événement load en dev : domcontentloaded suffit.
  await page.waitForURL(/\/$/, { waitUntil: "domcontentloaded" });
  await page.goto("/profil");
}

for (const viewport of VIEWPORTS) {
  test(`profil tient dans le viewport sans scroll en ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await signInForProfil(page);
    // signInForProfil rejoint /profil après l'atterrissage à l'accueil.
    await expect(page).toHaveURL(/\/profil/);
    await expect(page.getByRole("heading", { name: /C.est toi/ })).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(10);
    await expect(page.getByRole("button", { name: "Enregistrer" })).toBeVisible();
    const scroll = await page.evaluate(() => ({
      vertical: document.documentElement.scrollHeight - window.innerHeight,
      horizontal: document.documentElement.scrollWidth - window.innerWidth,
    }));
    expect(scroll.vertical).toBeLessThanOrEqual(1);
    expect(scroll.horizontal).toBeLessThanOrEqual(1);
  });
}
