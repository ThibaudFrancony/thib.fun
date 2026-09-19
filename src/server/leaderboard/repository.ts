import "server-only";

import { createAdminClient } from "@/server/supabase/admin";
import { signStoragePaths } from "@/server/storage/signed-urls";
import { leaderboardRpcSchema } from "@/server/leaderboard/schemas";
import type { LeaderboardPayload } from "@/lib/leaderboard-types";

const AVATARS_BUCKET = "avatars";

const stableRpcErrorCodes = new Set(["ACCOUNT_REQUIRED", "INVALID_REQUEST"]);

function rpcErrorCode(message: string | undefined, fallback: string): string {
  const candidate = message?.trim();
  return candidate && stableRpcErrorCodes.has(candidate) ? candidate : fallback;
}

function rpcData<T>(response: { data: unknown; error: { message: string } | null }, parse: (value: unknown) => T | null): T {
  if (response.error) throw new Error(rpcErrorCode(response.error.message, "DATABASE_UNAVAILABLE"));
  const parsed = parse(response.data);
  if (parsed === null) throw new Error("DATABASE_UNAVAILABLE");
  return parsed;
}

/** Classement général : top 3 + 100 premiers, avatars signés, rang du joueur courant. */
export async function getLeaderboard(actorId: string, limit = 100): Promise<LeaderboardPayload> {
  const admin = createAdminClient();
  const response = await admin.rpc("server_get_leaderboard", {
    p_actor: actorId,
    p_limit: limit,
  });
  const data = rpcData(response, (value) => {
    const parsed = leaderboardRpcSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  });

  const avatarUrls = await signStoragePaths(
    admin,
    AVATARS_BUCKET,
    data.entries.map((entry) => entry.avatarPath),
  );

  return {
    entries: data.entries.map((entry) => ({
      rank: entry.rank,
      userId: entry.userId,
      name: entry.name,
      avatarUrl: entry.avatarPath ? avatarUrls.get(entry.avatarPath) ?? null : null,
      avatarPreset: entry.avatarPreset,
      points: entry.points,
      wins: entry.wins,
      losses: entry.losses,
      draws: entry.draws,
    })),
    me: data.me ?? null,
  };
}
