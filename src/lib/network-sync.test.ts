import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  actionFingerprint,
  heartbeatVersion,
  parseMatchSnapshot,
  parseRoomSnapshot,
  pendingCommandMatches,
  shouldApplySnapshot,
  shouldRefreshFromHeartbeat,
  type PendingNetworkCommand,
  type VersionedSnapshot,
} from "@/lib/network-sync";

type TestSnapshot = VersionedSnapshot & { matchId: string; view: Record<string, unknown> };

const snapshot = (version: number, matchId = "match-a"): TestSnapshot => ({
  version,
  matchId,
  view: {},
});

describe("synchronisation des vues versionnées", () => {
  it("accepte la première vue puis uniquement une version strictement plus récente", () => {
    expect(shouldApplySnapshot(null, snapshot(1))).toBe(true);
    expect(shouldApplySnapshot(snapshot(2), snapshot(1))).toBe(false);
    expect(shouldApplySnapshot(snapshot(2), snapshot(2))).toBe(false);
    expect(shouldApplySnapshot(snapshot(2), snapshot(3))).toBe(true);
  });

  it("déduit la reprise HTTP d'un heartbeat plus récent sans confondre les deux versions", () => {
    expect(heartbeatVersion({ roomVersion: 8, matchVersion: 5 })).toBe(8);
    expect(shouldRefreshFromHeartbeat(5, { matchVersion: 6 })).toBe(true);
    expect(shouldRefreshFromHeartbeat(6, { matchVersion: 6 })).toBe(false);
    expect(shouldRefreshFromHeartbeat(null, { roomVersion: 0 })).toBe(true);
    expect(shouldRefreshFromHeartbeat(3, { opponentLastSeenAt: null })).toBe(false);
  });

  it("rejette les réponses qui ne sont pas une projection de partie ou de salon", () => {
    expect(parseMatchSnapshot<TestSnapshot>({ version: 1, matchId: "match-a", view: {} })).not.toBeNull();
    expect(parseMatchSnapshot<TestSnapshot>({ version: 1, matchId: "match-a", view: null })).toBeNull();
    expect(parseMatchSnapshot<TestSnapshot>({ version: -1, matchId: "match-a", view: {} })).toBeNull();
    expect(parseRoomSnapshot({ version: 1, roomId: "room-a", status: "waiting", members: [] })).not.toBeNull();
    expect(parseRoomSnapshot({ version: 1, roomId: "room-a", status: "finished", members: [] })).toBeNull();
  });

  it("réutilise l'intention d'une commande seulement dans la même phase et ressource", () => {
    const pending: PendingNetworkCommand = {
      resourceId: "match-a",
      commandId: "command-a",
      expectedVersion: 4,
      phaseId: "phase-a",
      action: { type: "FIRE", row: 2, col: 3 },
      createdAt: 100,
    };
    expect(pendingCommandMatches(pending, "match-a", "phase-a", { type: "FIRE", row: 2, col: 3 })).toBe(true);
    expect(pendingCommandMatches(pending, "match-a", "phase-b", pending.action)).toBe(false);
    expect(pendingCommandMatches(pending, "match-b", "phase-a", pending.action)).toBe(false);
    expect(actionFingerprint({ b: 2, a: 1 })).not.toBe(actionFingerprint({ a: 1, b: 2 }));
  });

  it("conserve la garde Broadcast d'appartenance active sans modifier l'ancienne migration", () => {
    const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260914173142_step6_realtime_active_membership.sql"), "utf8");
    expect(migration).toContain("drop policy if exists user_broadcast_receive on realtime.messages");
    expect(migration).toContain("and (select public.is_site_member())");
    expect(migration).toContain("extension = 'broadcast'");
    expect(migration).toContain("private = true");
  });

  it("branche le heartbeat partagé sur les neuf parties et le salon", () => {
    const gameFiles = [
      ["geographie", "geography"],
      ["uno", "uno"],
      ["trou-noir", "trou-noir"],
      ["ttmc", "ttmc"],
      ["skyjo", "skyjo"],
      ["bombparty", "bombparty"],
      ["bataille-navale", "bataille-navale"],
      ["compatibilite", "compatibilite"],
      ["longueur-onde", "longueur-onde"],
    ];
    for (const [game, component] of gameFiles) {
      const source = readFileSync(resolve(process.cwd(), `src/games/${game}/components/${component}-match.tsx`), "utf8");
      expect(source).toContain("useResourceNetwork");
      expect(source).toContain("heartbeatUrl");
    }
    const room = readFileSync(resolve(process.cwd(), "src/app/salons/[roomId]/room-lobby.tsx"), "utf8");
    expect(room).toContain("heartbeatUrl");
    expect(room).toContain("useResourceNetwork");
  });
});
