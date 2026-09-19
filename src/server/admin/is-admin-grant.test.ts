import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("correctif du privilège is_admin_account", () => {
  it("accorde EXECUTE au seul rôle serveur sans rouvrir aux rôles clients", async () => {
    const sql = await readFile(
      resolve(process.cwd(), "supabase/migrations/20260919172621_fix_admin_is_admin_account_grant.sql"),
      "utf8",
    );
    expect(sql).toContain("grant execute on function private.is_admin_account(uuid) to service_role");
    expect(sql).not.toMatch(/to\s+(anon|authenticated|public)\s*;/);
  });
});
