import { z } from "zod";

export const roomMemberViewSchema = z.object({
  id: z.string().uuid(),
  pseudo: z.string(),
  seat: z.union([z.literal(0), z.literal(1)]),
  ready: z.boolean(),
});

export const roomViewSchema = z.object({
  roomId: z.string().uuid(),
  code: z.string().length(6),
  gameSlug: z.string(),
  config: z.record(z.string(), z.unknown()),
  status: z.enum(["waiting", "playing", "closed"]),
  version: z.number().int().nonnegative(),
  currentMatchId: z.string().uuid().nullable(),
  members: z.array(roomMemberViewSchema).max(2),
  viewerId: z.string().uuid(),
});

export type RoomView = z.infer<typeof roomViewSchema>;
