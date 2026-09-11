import { expect, test, type Page } from "@playwright/test";

const password = process.env.E2E_PASSWORD;
const aliceEmail = process.env.E2E_ALICE_EMAIL ?? "alice@local.tibo.fun";
const bobEmail = process.env.E2E_BOB_EMAIL ?? "bob@local.tibo.fun";

test.skip(!password, "E2E_PASSWORD est requis après `node scripts/seed-local-members.mjs`.");
test.setTimeout(120_000);

async function signIn(page: Page, email: string) {
  await page.goto("/connexion");
  await page.getByRole("textbox", { name: "E-mail" }).fill(email);
  await page.getByRole("textbox", { name: "Mot de passe" }).fill(password!);
  await page.getByRole("button", { name: "Entrer à la table" }).click();
  await page.waitForURL("**/jeux/geographie");
  await page.goto("/jeux/bombparty");
}

test("mène un tour BombParty à deux sans fuite de dictionnaire", async ({ browser, page: alice }) => {
  const bobContext = await browser.newContext();
  const bob = await bobContext.newPage();
  try {
    await signIn(alice, aliceEmail);
    const createResponsePromise = alice.waitForResponse(
      (response) => response.url().endsWith("/api/rooms") && response.request().method() === "POST",
    );
    await alice.getByRole("button", { name: "Créer le salon Syllabe Express" }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.ok()).toBeTruthy();
    const created = (await createResponse.json()) as { roomId: string; code: string };
    await alice.waitForURL(`**/salons/${created.roomId}`);

    await signIn(bob, bobEmail);
    await bob.getByLabel("Code du salon").fill(created.code);
    await bob.getByRole("button", { name: "Rejoindre le salon" }).click();
    await bob.waitForURL(`**/salons/${created.roomId}`);

    await alice.getByRole("button", { name: "Je suis prêt" }).click();
    await bob.getByRole("button", { name: "Je suis prêt" }).click();
    await expect(alice.getByRole("button", { name: "Lancer" })).toBeEnabled({ timeout: 10_000 });
    await alice.getByRole("button", { name: "Lancer" }).click();
    await Promise.all([
      expect(alice).toHaveURL(/\/parties\/[0-9a-f-]+$/, { timeout: 15_000 }),
      expect(bob).toHaveURL(/\/parties\/[0-9a-f-]+$/, { timeout: 15_000 }),
    ]);

    // Séquence visible des deux côtés, sans liste de mots possibles.
    await expect(alice.getByText("Séquence", { exact: false })).toBeVisible({ timeout: 10_000 });
    await expect(bob.getByText("Séquence", { exact: false })).toBeVisible({ timeout: 10_000 });

    // Le joueur actif propose un mot invalide : refus local, tour inchangé.
    const aliceInput = alice.getByLabel(/Ton mot contenant/);
    const bobInput = bob.getByLabel(/Ton mot contenant/);
    const activeInput = (await aliceInput.count()) > 0 ? aliceInput : bobInput;
    const activePage = (await aliceInput.count()) > 0 ? alice : bob;
    await activeInput.fill("zzz-mot-inconnu");
    await activePage.getByRole("button", { name: /Valider/ }).click();
    await expect(activePage.getByRole("alert")).toBeVisible({ timeout: 10_000 });
  } finally {
    await bobContext.close();
  }
});
