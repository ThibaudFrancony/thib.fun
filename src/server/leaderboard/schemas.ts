import "server-only";

import { z } from "zod";

const positiveInteger = z.coerce.number().int().min(0);
const rankValue = z.coerce.number().int().min(1);

const scoreCountersShape = {
  points: positiveInteger,
  wins: positiveInteger,
  losses: positiveInteger,
  draws: positiveInteger,
};

const entrySchema = z.object({
  rank: rankValue,
  userId: z.string().uuid(),
  name: z.string(),
  avatarPath: z.string().min(1).nullable(),
  avatarPreset: z.string(),
  ...scoreCountersShape,
});

export const leaderboardRpcSchema = z.object({
  entries: z.array(entrySchema),
  me: z
    .object({
      rank: rankValue,
      ...scoreCountersShape,
    })
    .nullable()
    .optional(),
});
