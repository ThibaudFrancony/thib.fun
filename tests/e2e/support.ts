import { expect, type Page } from "@playwright/test";

type PlaywrightTest = typeof import("@playwright/test").test;

export const e2ePassword = process.env.E2E_PASSWORD;
export const aliceEmail = process.env.E2E_ALICE_EMAIL ?? "alice@local.tibo.fun";
export const bobEmail = process.env.E2E_BOB_EMAIL ?? "bob@local.tibo.fun";

/**
 * Multijoueur est une recette obligatoire en CI. En local, elle reste
 * explicitement bloquée tant que le fixture n'a pas été préparé.
 */
export function requireE2ECredentials(test: PlaywrightTest): void {
  const missing = !e2ePassword;
  test.skip(missing && !process.env.CI, "E2E_PASSWORD est requis après `node scripts/seed-local-members.mjs`.");
  test.beforeAll(() => {
    if (missing && process.env.CI) {
      throw new Error(
        "E2E_PASSWORD est requis en CI : prépare le Supabase local avec `LOCAL_FIXTURE_PASSWORD=... pnpm local:fixture` et fournis le secret E2E_PASSWORD.",
      );
    }
  });
}

export async function signIn(page: Page, email: string, nextPath?: string): Promise<void> {
  if (!e2ePassword) throw new Error("E2E_PASSWORD est requis pour ouvrir une session multijoueur.");
  await page.goto("/connexion");
  await expect(page.locator("form")).toHaveAttribute("data-auth-hydrated", "true");
  await page.getByRole("textbox", { name: "E-mail" }).fill(email);
  await page.getByRole("textbox", { name: "Mot de passe" }).fill(e2ePassword);
  await page.getByRole("button", { name: "Entrer à la table" }).click();
  // La connexion ramène à l'accueil (sauf `next` allowlisté) : les scénarios
  // rejoignent ensuite leur page via `nextPath`.
  await page.waitForURL(/\/$/);
  if (nextPath) await page.goto(nextPath);
}
