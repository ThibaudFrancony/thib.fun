import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const output = execFileSync("supabase", ["status", "-o", "env"], {
  encoding: "utf8",
  env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" },
});
const localEnv = Object.fromEntries(
  output
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1).trim().replace(/^"(.*)"$/, "$1")];
    }),
);

const required = ["API_URL", "ANON_KEY", "SERVICE_ROLE_KEY"];
for (const key of required) {
  if (!localEnv[key]) throw new Error(`Supabase local ne fournit pas ${key}.`);
}

const target = resolve(process.env.LOCAL_ENV_FILE ?? ".env.local");
const lines = [
  `NEXT_PUBLIC_SUPABASE_URL=${localEnv.API_URL}`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=${localEnv.ANON_KEY}`,
  `SUPABASE_SERVICE_ROLE_KEY=${localEnv.SERVICE_ROLE_KEY}`,
  `INTERNAL_JOB_SECRET=${process.env.INTERNAL_JOB_SECRET ?? randomBytes(32).toString("hex")}`,
  "APP_ORIGIN=http://127.0.0.1:3000",
  "GEO_CONTENT_SOURCE=database",
  "QUIZ_CONTENT_SOURCE=database",
  "COMPATIBILITY_CONTENT_SOURCE=database",
  "LONGUEUR_ONDE_CONTENT_SOURCE=database",
].join("\n");
await writeFile(target, `${lines}\n`, { mode: 0o600 });
console.log(`Configuration Supabase locale écrite dans ${target}.`);
