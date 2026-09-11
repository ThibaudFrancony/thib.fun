import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("RPC et migration du pack À l'unisson", () => {
  it("restent idempotentes et réservées au serveur", async () => {
    const sql = await readFile(resolve(process.cwd(), "supabase/migrations/20260911210000_longueur_onde_ready.sql"), "utf8");
    expect(sql).toContain("on conflict (kind, slug, version) do update");
    expect(sql).toContain("on conflict (pack_id, logical_key) do nothing");
    expect(sql).toContain("create or replace function public.server_get_longueur_onde_content()");
    expect(sql).toContain("security invoker");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("revoke all on function public.server_get_longueur_onde_content() from public, anon, authenticated");
    expect(sql).toContain("grant execute on function public.server_get_longueur_onde_content() to service_role");
    expect(sql).toContain("update public.games set availability = 'ready'");
    expect(sql).toContain("normalize_longueur_onde_player_result");
    expect(sql).toContain("record_longueur_onde_pair_stats");
    expect(sql).toContain("outcome = 'abandoned'");
    expect((sql.match(/insert into private\.content_items/g) ?? []).length).toBe(80);
  });

  it("conserve les triggers coopératifs dans une migration corrective additive", async () => {
    const sql = await readFile(resolve(process.cwd(), "supabase/migrations/20260911233839_longueur_onde_cooperative_result_triggers.sql"), "utf8");
    expect(sql).toContain("create trigger normalize_longueur_onde_player_result");
    expect(sql).toContain("create trigger normalize_longueur_onde_history_entry");
    expect(sql).toContain("create trigger normalize_longueur_onde_player_stats");
    expect(sql).toContain("create trigger record_longueur_onde_pair_stats");
    expect(sql).toContain("security definer");
    expect(sql).toContain("revoke all on function private.record_longueur_onde_pair_stats()");
  });
});
