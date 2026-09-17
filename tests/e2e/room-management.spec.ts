import { expect, test } from "@playwright/test";
import { aliceEmail, bobEmail, requireE2ECredentials, signIn } from "./support";

requireE2ECredentials(test);
test.setTimeout(120_000);

test("rejoint un salon par son lien partagé", async ({ browser, page: alice }) => {
  const bobContext = await browser.newContext();
  const bob = await bobContext.newPage();
  try {
    await signIn(alice, aliceEmail, "/jeux/geographie");
    const createResponsePromise = alice.waitForResponse(
      (response) => response.url().endsWith("/api/rooms") && response.request().method() === "POST",
    );
    await alice.getByRole("button", { name: "Créer le salon" }).click();
    const created = await createResponsePromise.then((response) => response.json()) as { roomId: string; code: string };
    await alice.waitForURL(`**/salons/${created.roomId}`);

    await signIn(bob, bobEmail, "/jeux/geographie");
    await bob.goto(`/salons/${created.roomId}`);
    await expect(bob.getByRole("heading", { name: new RegExp(created.code) })).toBeVisible();
    await expect(bob.getByRole("button", { name: "Rejoindre le salon" })).toBeVisible();
    await bob.getByRole("button", { name: "Rejoindre le salon" }).click();

    await expect(bob.locator(".geo-member-name").filter({ hasText: /^Bob$/ })).toBeVisible();
    await expect(alice.locator(".geo-member-name").filter({ hasText: /^Bob$/ })).toBeVisible();

    bob.once("dialog", (dialog) => void dialog.accept());
    await bob.getByRole("button", { name: "Quitter le salon" }).click();
    await bob.waitForURL("**/jeux/geographie");

    alice.once("dialog", (dialog) => void dialog.accept());
    await alice.getByRole("button", { name: "Quitter le salon" }).click();
    await alice.waitForURL("**/jeux/geographie");
  } finally {
    await bobContext.close();
  }
});

test("configure, transfère, quitte et rejoint réellement un salon", async ({ browser, page: alice }) => {
  const bobContext = await browser.newContext();
  const bob = await bobContext.newPage();
  try {
    await signIn(alice, aliceEmail, "/jeux/geographie");
    const createResponsePromise = alice.waitForResponse(
      (response) => response.url().endsWith("/api/rooms") && response.request().method() === "POST",
    );
    await alice.getByRole("button", { name: "Créer le salon" }).click();
    const created = await createResponsePromise.then((response) => response.json()) as { roomId: string; code: string };
    await alice.waitForURL(`**/salons/${created.roomId}`);

    await signIn(bob, bobEmail, "/jeux/geographie");
    await bob.getByLabel("Code du salon").fill(created.code);
    await bob.getByRole("button", { name: "Rejoindre le salon" }).click();
    await bob.waitForURL(`**/salons/${created.roomId}`);

    await expect(alice.getByRole("heading", { name: "Jeu et configuration" })).toBeVisible();
    await expect(alice.getByRole("heading", { name: "Transférer l'hôte" })).toBeVisible();
    await expect(alice.getByText(/gestion avancée du salon sera disponible/i)).toHaveCount(0);

    await alice.getByRole("button", { name: "Je suis prêt" }).click();
    await expect(alice.locator(".geo-member-card").filter({ hasText: "Alice" }).locator(".geo-ready-badge[data-ready='true']")).toHaveCount(1);
    await bob.getByRole("button", { name: "Je suis prêt" }).click();
    await expect(alice.locator(".geo-ready-badge[data-ready='true']")).toHaveCount(2);

    const configResponsePromise = alice.waitForResponse(
      (response) => response.url().endsWith(`/salons/${created.roomId}/actions`) && response.request().method() === "POST",
    );
    await alice.getByLabel("Configuration JSON").fill(JSON.stringify({
      rounds: 5,
      turnSeconds: 30,
      difficulty: "medium",
      selection: "random",
    }));
    await alice.getByRole("button", { name: "Enregistrer les réglages" }).click();
    expect((await configResponsePromise).ok()).toBeTruthy();
    await expect(alice.locator(".geo-ready-badge[data-ready='false']")).toHaveCount(2);

    const transferResponsePromise = alice.waitForResponse(
      (response) => response.url().endsWith(`/salons/${created.roomId}/actions`) && response.request().method() === "POST",
    );
    await alice.getByRole("button", { name: "Transférer l'hôte" }).click();
    expect((await transferResponsePromise).ok()).toBeTruthy();
    await expect(bob.getByRole("heading", { name: "Transférer l'hôte" })).toBeVisible();
    await expect(alice.getByRole("heading", { name: "Transférer l'hôte" })).toHaveCount(0);

    bob.once("dialog", (dialog) => void dialog.accept());
    await bob.getByRole("button", { name: "Quitter le salon" }).click();
    await bob.waitForURL("**/jeux/geographie");
    await expect(alice.getByRole("heading", { name: "Transférer l'hôte" })).toHaveCount(0);
    await expect(alice.getByRole("heading", { name: "Jeu et configuration" })).toBeVisible();

    await bob.getByLabel("Code du salon").fill(created.code);
    await bob.getByRole("button", { name: "Rejoindre le salon" }).click();
    await bob.waitForURL(`**/salons/${created.roomId}`);
    await expect(alice.locator(".geo-member-name").filter({ hasText: /^Bob$/ })).toBeVisible();

    bob.once("dialog", (dialog) => void dialog.accept());
    await bob.getByRole("button", { name: "Quitter le salon" }).click();
    await bob.waitForURL("**/jeux/geographie");

    alice.once("dialog", (dialog) => void dialog.accept());
    await alice.getByRole("button", { name: "Quitter le salon" }).click();
    await alice.waitForURL("**/jeux/geographie");
  } finally {
    await bobContext.close();
  }
});
