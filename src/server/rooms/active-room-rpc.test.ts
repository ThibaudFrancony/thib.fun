import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const MIGRATION = "supabase/migrations/20260919095951_step12_active_room.sql";

describe("salon actif tous jeux (étape 12, sans base distante)", () => {
  it("expose server_get_active_room sans filtre de jeu et verrouille les grants", () => {
    const sql = read(MIGRATION)
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");
    expect(sql).toContain("create or replace function public.server_get_active_room(p_actor uuid)");
    expect(sql).toMatch(/security\s+invoker/i);
    expect(sql).not.toMatch(/security\s+definer/i);
    expect(sql).toMatch(/set\s+search_path\s*=\s*''/i);
    expect(sql).toContain("and r.status in ('waiting', 'playing')");
    expect(sql).toContain("and r.expires_at > clock_timestamp()");
    expect(sql).toContain("order by r.updated_at desc");
    expect(sql).toContain("public.room_views");
    expect(sql).toContain("private.room_members");
    expect(sql).toContain("private.site_members");
    expect(sql).not.toContain("game_slug is null");
    expect(sql).toMatch(
      /revoke all on function public\.server_get_active_room\(uuid\) from public,\s*anon,\s*authenticated/i,
    );
    expect(sql).toMatch(/grant execute on function public\.server_get_active_room\(uuid\) to service_role/i);
    expect(sql).not.toMatch(/drop\s+(table|function)/i);
  });

  it("la page de jeu et la route de découverte utilisent la nouvelle RPC", () => {
    const lobbies = read("src/server/lobbies.ts");
    expect(lobbies).toContain("getActiveRoom");
    expect(lobbies).toContain("getActiveRoomForViewer");
    expect(lobbies).toContain("safeParse");
    const repository = read("src/server/matches/repository.ts");
    expect(repository).toContain('rpc("server_get_active_room"');
    expect(repository).not.toContain('rpc("server_get_active_lobby"');
    const route = read("src/app/api/lobbies/active/route.ts");
    expect(route).toContain("getActiveRoomForViewer");
  });

  it("le header de jeu montre le salon et la découverte accepte toutes les salles", () => {
    const header = read("src/components/site-header.tsx");
    expect(header).toContain('variant === "geo"');
    expect(header).toContain("<SalonLauncher connected={Boolean(account)} triggerClassName=\"geo-nav-link\" />");
    const realtime = read("src/lib/realtime.ts");
    expect(realtime).toContain('listener.id === "*"');
    const groupRoom = read("src/lib/group-room.ts");
    expect(groupRoom).toContain("useActiveRoomDiscovery");
    expect(groupRoom).toContain("useActiveGroupRoom");
    expect(groupRoom).toContain('event: "room.updated", id: "*"');
  });
});
