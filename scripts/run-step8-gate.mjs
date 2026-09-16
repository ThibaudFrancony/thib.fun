import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

const password = process.env.E2E_PASSWORD ?? randomBytes(24).toString("base64url");
const env = {
  ...process.env,
  CI: "1",
  E2E_PASSWORD: password,
  LOCAL_FIXTURE_PASSWORD: password,
};

const seed = spawnSync(process.execPath, ["scripts/seed-local-members.mjs"], {
  cwd: process.cwd(),
  env,
  encoding: "utf8",
});
if (seed.status !== 0) {
  process.stderr.write(seed.stderr || "Le fixture local Étape 8 n'a pas pu être préparé.\n");
  process.exit(seed.status ?? 1);
}

const requestedTests = process.argv.slice(2);
const testFiles = requestedTests.includes("--full")
  ? []
  : requestedTests.length > 0 ? requestedTests : [
  "tests/e2e/auth-guest.spec.ts",
  "tests/e2e/room-management.spec.ts",
  "tests/e2e/trou-noir.spec.ts",
  "tests/e2e/ttmc.spec.ts",
  ];
const playwright = spawnSync(resolve("node_modules/.bin/playwright"), [
  "test",
  ...testFiles,
  "--workers=1",
], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
});

process.exit(playwright.status ?? 1);
