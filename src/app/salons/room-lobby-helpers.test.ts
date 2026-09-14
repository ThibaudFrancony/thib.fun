import { describe, expect, it } from "vitest";
import { roomExpirationLabel, roomHasExactlyTwoMembers, roomHostId, roomIsHost, type RoomViewWithMetadata } from "@/app/salons/[roomId]/room-lobby-helpers";

const firstId = "00000000-0000-4000-8000-000000000001";
const secondId = "00000000-0000-4000-8000-000000000002";

function room(overrides: Partial<RoomViewWithMetadata> = {}): RoomViewWithMetadata {
  return {
    roomId: "00000000-0000-4000-8000-000000000010",
    code: "ABC234",
    gameSlug: "geographie",
    config: {},
    status: "waiting",
    version: 2,
    currentMatchId: null,
    members: [
      { id: firstId, pseudo: "A", isGuest: false, seat: 0, ready: false },
      { id: secondId, pseudo: "B", isGuest: false, seat: 1, ready: false },
    ],
    viewerId: firstId,
    ...overrides,
  };
}

describe("projection du salon", () => {
  it("utilise hostId quand il est projeté et garde le siège 0 comme repli", () => {
    expect(roomHostId(room())).toBe(firstId);
    expect(roomIsHost(room())).toBe(true);
    expect(roomHostId(room({ hostId: secondId, viewerId: secondId }))).toBe(secondId);
    expect(roomIsHost(room({ hostId: secondId }))).toBe(false);
  });

  it("refuse un salon qui ne contient pas exactement deux membres distincts", () => {
    expect(roomHasExactlyTwoMembers(room())).toBe(true);
    expect(roomHasExactlyTwoMembers(room({ members: [room().members[0]] }))).toBe(false);
    expect(roomHasExactlyTwoMembers(room({ members: [room().members[0], { ...room().members[0], seat: 1 }] }))).toBe(false);
  });

  it("annonce une expiration future et une expiration passée", () => {
    const now = new Date("2026-09-14T12:00:00.000Z");
    expect(roomExpirationLabel(room({ expiresAt: "2026-09-14T13:00:00.000Z" }), now)).toContain("Salon ouvert");
    expect(roomExpirationLabel(room({ expiresAt: "2026-09-14T11:00:00.000Z" }), now)).toContain("a expiré");
    expect(roomExpirationLabel(room({ expiresAt: "not-a-date" }), now)).toBeNull();
  });
});
