import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260912092235_fix_guest_auth_projection_permissions.sql",
);

describe("correctif des projections invitées", () => {
  it("matérialise le statut invité dans la table privée des membres", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain(
      "add column if not exists is_guest boolean not null default false",
    );
    expect(sql).toContain("set is_guest = exists");
    expect(sql).toContain(
      "insert into private.site_members (user_id, role, status, is_guest)",
    );
    expect(sql).toContain("on conflict (user_id) do update");
    expect(sql).toContain("set is_guest = excluded.is_guest");
  });

  it("supprime les lectures invoker de auth.users dans les RPC concernées", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const rpcNames = [
      "public.server_get_actor",
      "private.refresh_room_views",
      "public.server_get_match",
      "public.server_get_pair_history",
    ];

    for (const rpcName of rpcNames) {
      const start = sql.indexOf(`create or replace function ${rpcName}`);
      const end = sql.indexOf("$$;", start);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(sql.slice(start, end)).toContain("security invoker");
      expect(sql.slice(start, end)).not.toContain("auth.users");
    }

    expect(sql).toContain(
      "grant execute on function private.refresh_room_views(uuid) to service_role",
    );
    expect(sql).toContain(
      "grant execute on function public.server_get_match(uuid, uuid) to service_role",
    );
  });
});
