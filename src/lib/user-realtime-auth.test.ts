import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function findMigration(suffix: string): string {
  const dir = resolve(process.cwd(), "supabase/migrations");
  const match = readdirSync(dir).find((name) => name.endsWith(suffix));
  if (!match) throw new Error(`Migration introuvable : ${suffix}`);
  return readFileSync(resolve(dir, match), "utf8");
}

describe("autorisation Broadcast du canal utilisateur", () => {
  it("corrige la sonde Realtime sans ouvrir le canal aux tiers", () => {
    const migration = findMigration("_fix_user_broadcast_authorization.sql");
    expect(migration).toContain("alter policy user_broadcast_receive on realtime.messages");
    expect(migration).toContain("realtime.topic() = 'user:'");
    expect(migration).toContain("topic = 'user:'");
    expect(migration).toContain("extension = 'broadcast'");
    expect(migration).toContain("is_site_member()");
    // La sonde d'autorisation Realtime envoie private=false meme pour un
    // canal prive : ce filtre rejetait systematiquement l'abonnement.
    expect(migration).not.toContain("private = true");
  });

  it("ne reecrit pas la migration historique de l'etape 6", () => {
    const legacy = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20260914173142_step6_realtime_active_membership.sql"),
      "utf8",
    );
    expect(legacy).toContain("private = true");
  });

  it("transmet le JWT a Realtime avant de souscrire au canal utilisateur", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/realtime.ts"), "utf8");
    const setAuthIndex = source.indexOf("realtime.setAuth()");
    const channelIndex = source.indexOf("`user:${userId}`");
    expect(setAuthIndex).toBeGreaterThan(-1);
    expect(channelIndex).toBeGreaterThan(-1);
    expect(setAuthIndex).toBeLessThan(channelIndex);
  });
});
