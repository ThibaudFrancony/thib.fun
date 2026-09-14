import type { RoomView } from "@/server/rooms/schemas";

export type RoomViewWithMetadata = RoomView & {
  hostId?: string;
  expiresAt?: string | null;
};

export function roomHostId(room: RoomViewWithMetadata): string | null {
  return room.hostId ?? room.members.find((member) => member.seat === 0)?.id ?? null;
}

export function roomIsHost(room: RoomViewWithMetadata): boolean {
  return roomHostId(room) === room.viewerId;
}

export function roomHasExactlyTwoMembers(room: RoomView): boolean {
  return room.members.length === 2 && new Set(room.members.map((member) => member.id)).size === 2;
}

export function roomExpirationLabel(room: RoomViewWithMetadata, now = new Date()): string | null {
  if (!room.expiresAt) return null;
  const expiresAt = Date.parse(room.expiresAt);
  if (!Number.isFinite(expiresAt)) return null;
  if (expiresAt <= now.getTime()) return "Ce salon a expiré. Rejoins-le depuis un lien encore valide.";
  return `Salon ouvert jusqu'au ${new Date(expiresAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}.`;
}
