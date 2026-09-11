import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("RPC et migration du pack Compatibilité", () => {
  it("restent idempotentes et n'exposent le contenu qu'au rôle serveur", async () => {
    const sql = await readFile(resolve(process.cwd(), "supabase/migrations/20260911200000_compatibilite_ready.sql"), "utf8");
    expect(sql).toContain("on conflict (kind, slug, version) do update");
    expect(sql).toContain("on conflict (pack_id, logical_key) do nothing");
    expect(sql).toContain("security invoker");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("revoke all on function public.server_get_compatibilite_content() from public, anon, authenticated");
    expect(sql).toContain("grant execute on function public.server_get_compatibilite_content() to service_role");
    expect(sql).toContain("update public.games set availability = 'ready'");
    expect(sql).toContain("outcome = 'abandoned'");
    expect(sql).toContain("record_compat_pair_stats");
    expect((sql.match(/insert into private\.content_items/g) ?? []).length).toBe(160);
  });
});
