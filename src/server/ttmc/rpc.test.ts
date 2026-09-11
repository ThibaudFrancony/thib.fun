import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration(name: string): string {
  return readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8");
}

describe("invariants SQL TTMC (sans base distante)", () => {
  it("ordonne lexicographiquement pack, RPC puis activation, sans DROP", () => {
    const files = readdirSync(resolve(process.cwd(), "supabase/migrations")).filter((name) =>
      name.includes("ttmc"),
    );
    expect(files).toEqual([...files].sort());
    expect(files).toEqual([
      "20260911140000_ttmc_ready.sql",
      "20260911171852_ttmc_quiz_rpc.sql",
      "20260911180000_ttmc_activate.sql",
    ]);
    const pack = readMigration("20260911140000_ttmc_ready.sql");
    expect(pack).toContain("on conflict (kind, slug, version) do update");
    expect(pack).toContain("on conflict (pack_id, logical_key) do nothing");
    expect(pack).not.toMatch(/drop\s+(table|function)/i);
    expect(pack).not.toMatch(/truncate/i);
    const rpc = readMigration("20260911171852_ttmc_quiz_rpc.sql");
    expect(rpc).toContain("create or replace function public.server_get_ttmc_content()");
    expect(rpc).toContain("order by");
    const activate = readMigration("20260911180000_ttmc_activate.sql");
    expect(activate).toContain("update public.games");
    expect(activate).toContain("slug = 'ttmc'");
    expect(activate).not.toMatch(/drop\s+(table|function)/i);
  });

  it("exécute la RPC en SECURITY INVOKER avec search_path vide et schéma private qualifié", () => {
    const rpc = readMigration("20260911171852_ttmc_quiz_rpc.sql");
    expect(rpc).toMatch(/security\s+invoker/i);
    expect(rpc).not.toMatch(/security\s+definer/i);
    expect(rpc).toMatch(/set\s+search_path\s*=\s*''/i);
    expect(rpc).toContain("private.content_packs");
    expect(rpc).toContain("private.content_items");
    expect(rpc).toContain("jsonb_strip_nulls");
    expect(rpc).toContain("coalesce((");
    expect(rpc).toContain("'[]'::jsonb");
  });

  it("retourne la forme plate TTMC et verrouille les grants", () => {
    const rpc = readMigration("20260911171852_ttmc_quiz_rpc.sql");
    for (const key of [
      "'itemId'",
      "'packId'",
      "'logicalKey'",
      "'themeId'",
      "'themeLabel'",
      "'themeDescription'",
      "'level'",
      "'prompt'",
      "'canonical'",
      "'aliases'",
      "'explanation'",
    ]) {
      expect(rpc).toContain(key);
    }
    expect(rpc).toMatch(
      /revoke all on function public\.server_get_ttmc_content\(\) from public,\s*anon,\s*authenticated/i,
    );
    expect(rpc).toMatch(
      /grant execute on function public\.server_get_ttmc_content\(\) to service_role/i,
    );
  });

  it("n'autorise aucune lecture PostgREST directe des tables private côté loader", () => {
    const loader = readFileSync(resolve(process.cwd(), "src/server/ttmc/content.ts"), "utf8");
    expect(loader).toContain('rpc("server_get_ttmc_content")');
    expect(loader).not.toContain("content_packs");
    expect(loader).not.toContain("content_items");
    expect(loader).not.toContain('from("content');
    expect(loader).not.toMatch(/from\(\s*["']private/);
  });

  it("le pack versionné contient 440 inserts sans écrasement", () => {
    const pack = readMigration("20260911140000_ttmc_ready.sql");
    const inserts = pack.split("\n").filter((line) => line.startsWith("insert into private.content_items"));
    expect(inserts).toHaveLength(440);
  });
});
