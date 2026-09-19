import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const MIGRATION = "supabase/migrations/20260919121421_step13_room_dissolution.sql";

describe("dissolution des salons inactifs (étape 13, sans base distante)", () => {
  const sql = read(MIGRATION)
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

  it("expose un balayage privé des salons sans partie ni présence depuis 1 h", () => {
    expect(sql).toContain("create or replace function private.dissolve_inactive_rooms(p_limit integer default 50)");
    expect(sql).toMatch(/security\s+invoker/i);
    expect(sql).not.toMatch(/security\s+definer/i);
    expect(sql).toMatch(/set\s+search_path\s*=\s*''/i);
    expect(sql).toContain("where r.status = 'waiting'");
    expect(sql).toContain("interval '1 hour'");
    expect(sql).toContain("for update skip locked");
    expect(sql).toContain("set status = 'closed', version = version + 1");
    expect(sql).toContain("perform private.refresh_room_views(v_room.id)");
    expect(sql).toMatch(
      /revoke all on function private\.dissolve_inactive_rooms\(integer\) from public,\s*anon,\s*authenticated/i,
    );
    expect(sql).not.toMatch(/drop\s+(table|function)/i);
  });

  it("planifie le balayage au cron et ferme aussi les salons inactifs via le heartbeat", () => {
    expect(sql).toContain("tibo-fun-dissolve-inactive-rooms");
    expect(sql).toContain("'30 seconds'");
    expect(sql).toContain("select private.dissolve_inactive_rooms();");
    expect(sql).toContain("create or replace function public.server_room_heartbeat(p_actor uuid, p_room_id uuid)");
    expect(sql).toContain("v_room.expires_at <= clock_timestamp()");
    expect(sql).toContain("interval '1 hour'");
    expect(sql).toMatch(/cron\.unschedule\(v_job\.jobid\)/i);
  });
});
