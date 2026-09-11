import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration(name: string): string {
  return readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8");
}

describe("invariants SQL Trou Noir (cycle 2, sans base distante)", () => {
  it("ordonne lexicographiquement pack puis RPC et garde les deux rejouables", () => {
    const files = readdirSync(resolve(process.cwd(), "supabase/migrations")).filter((name) =>
      name.includes("trou_noir"),
    );
    expect(files).toEqual([...files].sort());
    expect(files).toEqual([
      "20260911120000_trou_noir_ready.sql",
      "20260911130000_trou_noir_quiz_rpc.sql",
    ]);
    const pack = readMigration("20260911120000_trou_noir_ready.sql");
    expect(pack).toContain("on conflict (kind, slug, version) do update");
    expect(pack).toContain("on conflict (pack_id, logical_key) do nothing");
    expect(pack).not.toMatch(/drop\s+(table|function)/i);
    const rpc = readMigration("20260911130000_trou_noir_quiz_rpc.sql");
    expect(rpc).toContain("create or replace function public.server_get_quiz_content()");
  });

  it("exécute la RPC en SECURITY INVOKER avec search_path vide et schéma private qualifié", () => {
    const rpc = readMigration("20260911130000_trou_noir_quiz_rpc.sql");
    expect(rpc).toMatch(/security\s+invoker/i);
    expect(rpc).not.toMatch(/security\s+definer/i);
    expect(rpc).toMatch(/set\s+search_path\s*=\s*''/i);
    expect(rpc).toContain("private.content_packs");
    expect(rpc).toContain("private.content_items");
    expect(rpc).toContain("jsonb_strip_nulls");
    // Absence de pack publié : 0 ligne retournée (loader => QUIZ_CONTENT_UNAVAILABLE),
    // pack sans questions : tableau vide (loader => QUIZ_CONTENT_UNAVAILABLE).
    expect(rpc).toContain("coalesce((");
    expect(rpc).toContain("'[]'::jsonb");
  });

  it("retourne la forme plate compatible quizQuestionSchema et verrouille les grants", () => {
    const rpc = readMigration("20260911130000_trou_noir_quiz_rpc.sql");
    for (const key of [
      "'itemId'",
      "'packId'",
      "'logicalKey'",
      "'category'",
      "'themeLabel'",
      "'difficulty'",
      "'prompt'",
      "'canonical'",
      "'aliases'",
      "'answerType'",
      "'requiredPrecision'",
      "'allowSurnameOnly'",
      "'allowDescription'",
      "'numericValue'",
      "'numericTolerance'",
      "'explanation'",
    ]) {
      expect(rpc).toContain(key);
    }
    expect(rpc).toMatch(
      /revoke all on function public\.server_get_quiz_content\(\) from public,\s*anon,\s*authenticated/i,
    );
    expect(rpc).toMatch(
      /grant execute on function public\.server_get_quiz_content\(\) to service_role/i,
    );
  });

  it("n'autorise aucune lecture PostgREST directe des tables private côté loader", () => {
    const loader = readFileSync(
      resolve(process.cwd(), "src/server/quiz/content.ts"),
      "utf8",
    );
    expect(loader).toContain('rpc("server_get_quiz_content")');
    expect(loader).not.toContain("content_packs");
    expect(loader).not.toContain("content_items");
    expect(loader).not.toContain('from("content');
    expect(loader).not.toMatch(/from\(\s*["']private/);
  });
});
