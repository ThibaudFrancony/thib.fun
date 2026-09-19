import "server-only";

import { createAdminClient } from "@/server/supabase/admin";
import { signStoragePaths } from "@/server/storage/signed-urls";

const AVATARS_BUCKET = "avatars";

export type PublicProfile = {
  id: string;
  name: string;
  avatarPreset: string;
  avatarUrl: string | null;
};

export type PlayerGameStat = {
  gameSlug: string;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  cooperative: number;
  abandoned: number;
};

type ActorRow = {
  id?: unknown;
  pseudo?: unknown;
  accountName?: unknown;
  displayName?: unknown;
  effectiveName?: unknown;
  avatarPreset?: unknown;
  avatarPath?: unknown;
  isGuest?: unknown;
};

function safeName(row: ActorRow): string {
  for (const candidate of [row.effectiveName, row.displayName, row.accountName, row.pseudo]) {
    if (typeof candidate === "string" && candidate.trim().length > 0) return candidate.trim().slice(0, 64);
  }
  return "Joueur";
}

/**
 * Profil public d'un compte permanent actif. `server_get_actor` renvoie `null`
 * pour un membre désactivé et porte `isGuest`, que l'on refuse ici : les invités
 * n'ont pas de profil consultable.
 */
export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  const admin = createAdminClient();
  const response = await admin.rpc("server_get_actor", { p_actor: userId });
  if (response.error) throw new Error("PROFILE_UNAVAILABLE");
  const row = response.data as ActorRow | null;
  if (!row || typeof row.id !== "string" || row.isGuest === true) return null;
  const avatarPath = typeof row.avatarPath === "string" && row.avatarPath.length > 0 ? row.avatarPath : null;
  const avatars = avatarPath ? await signStoragePaths(admin, AVATARS_BUCKET, [avatarPath]) : new Map<string, string>();
  return {
    id: row.id,
    name: safeName(row),
    avatarPreset: typeof row.avatarPreset === "string" ? row.avatarPreset : "avatar-1",
    avatarUrl: avatarPath ? avatars.get(avatarPath) ?? null : null,
  };
}

function safeCount(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

/** Agrégats par jeu du profil, déjà lisibles par tout membre via RLS. */
export async function getPlayerGameStats(userId: string): Promise<PlayerGameStat[]> {
  const admin = createAdminClient();
  const response = await admin
    .from("player_game_stats")
    .select("game_slug,played,wins,losses,draws,cooperative,abandoned")
    .eq("user_id", userId);
  if (response.error) throw new Error("PROFILE_STATS_UNAVAILABLE");
  return ((response.data ?? []) as unknown as Record<string, unknown>[]).flatMap((row) => {
    const gameSlug = typeof row.game_slug === "string" ? row.game_slug : null;
    if (!gameSlug) return [];
    return [{
      gameSlug,
      played: safeCount(row.played),
      wins: safeCount(row.wins),
      losses: safeCount(row.losses),
      draws: safeCount(row.draws),
      cooperative: safeCount(row.cooperative),
      abandoned: safeCount(row.abandoned),
    }];
  });
}
