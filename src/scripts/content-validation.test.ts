import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("publication et validation des packs", () => {
  it("garde content:validate en lecture seule", () => {
    const packageJson = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    const command = packageJson.scripts["content:validate"] ?? "";
    expect(command).toBe("node scripts/content/validate-packs.mjs");
    const validator = read("scripts/content/validate-packs.mjs");
    expect(validator).not.toContain("writeFile");
    expect(validator).not.toContain("supabase/migrations");
  });

  it("résout les chemins Géographie avec fileURLToPath", () => {
    for (const path of [
      "scripts/build-geography-pack.mjs",
      "scripts/geography/validate-pack.mjs",
      "scripts/write-geography-migration.mjs",
    ]) {
      expect(read(path)).toContain("fileURLToPath");
      expect(read(path)).not.toContain("new URL(\"..\", import.meta.url).pathname");
    }
  });

  it("sépare les générateurs de contenu des publications SQL et protège les migrations", () => {
    expect(read("scripts/build-compatibilite-pack.mjs")).not.toContain("supabase/migrations");
    expect(read("scripts/build-longueur-onde-pack.mjs")).not.toContain("supabase/migrations");
    expect(read("scripts/content/generate-compatibilite-migration.mjs")).toContain("writeNewMigration");
    expect(read("scripts/content/generate-longueur-onde-migration.mjs")).toContain("writeNewMigration");
    expect(read("scripts/content/write-new-migration.mjs")).toContain('flag: "wx"');
  });
});
