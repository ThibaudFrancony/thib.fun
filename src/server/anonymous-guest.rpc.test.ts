import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("migration des invités anonymes", () => {
  it("provisionne un pseudo serveur et protège les données persistantes", async () => {
    const sql = await readFile(resolve(process.cwd(), "supabase/migrations/20260912000100_anonymous_guest_access.sql"), "utf8");
    expect(sql).toContain("extensions.gen_random_bytes(5)");
    expect(sql).toContain("coalesce(u.is_anonymous, false)");
    expect(sql).toContain("create or replace function private.provision_account");
    expect(sql).toContain("create or replace function public.server_get_actor");
    expect(sql).toContain("'isGuest'");
    expect(sql).toContain("create trigger suppress_guest_history_entry");
    expect(sql).toContain("create trigger suppress_guest_player_stats");
    expect(sql).toContain("create trigger suppress_guest_pair_stats");
    expect(sql).toContain("private.pair_game_stats");
    expect(sql).toContain("coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false) = false");
    expect(sql).toContain("revoke all on function private.guest_pseudo()");
    expect(sql).toContain("grant execute on function public.server_get_actor(uuid) to service_role");
  });
});
