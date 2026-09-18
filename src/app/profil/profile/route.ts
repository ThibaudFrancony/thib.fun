import { z } from "zod";
import { getAuthenticatedAccount } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { assertMutationOrigin, jsonError, jsonOk, mapServerError } from "@/server/http";
import { createAdminClient } from "@/server/supabase/admin";
import { displayNameKey, isAvatarPreset, normalizeDisplayName } from "../profile-helpers";

const bodySchema = z.object({
  pseudo: z.string().max(80).optional(),
  displayName: z.string().max(80).nullable().optional(),
  avatarPreset: z.string().optional(),
}).strict().refine((value) => value.pseudo !== undefined || value.displayName !== undefined || value.avatarPreset !== undefined, {
  message: "Aucun changement demandé.",
});

function memberNames(member: { pseudo: string; accountName: string | null; displayName: string | null }) {
  return {
    accountName: member.accountName,
    displayName: member.displayName,
    effectiveName: member.displayName ?? member.accountName ?? member.pseudo,
    needsOnboarding: member.accountName == null,
  };
}

export async function POST(request: Request) {
  const originError = assertMutationOrigin(request);
  if (originError) return originError;
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const account = await getAuthenticatedAccount();
  if (!account) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour modifier ton profil.");
  if (account.isGuest) return jsonError("ACCOUNT_REQUIRED", 403, "Crée un compte permanent pour modifier ton profil.");

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("INVALID_REQUEST", 400, "Les informations du profil sont invalides.");

  const names = memberNames(account.member);

  // Le pseudo historique est gelé : toute tentative de changement est refusée
  // avec un message explicite (le nom de création ne peut pas être changé).
  if (body.data.pseudo !== undefined && body.data.pseudo !== names.effectiveName && body.data.pseudo !== account.member.pseudo) {
    return jsonError("INVALID_REQUEST", 400, "Ton nom de création est figé et ne peut pas être changé. Modifie ton nom affiché ci-dessous.");
  }

  // Sans nom de création, l'utilisateur doit d'abord passer par l'onboarding.
  if (names.needsOnboarding && (body.data.displayName !== undefined || body.data.avatarPreset !== undefined)) {
    return jsonError("ONBOARDING_REQUIRED", 409, "Choisis d'abord ton pseudo unique (il ne pourra plus être changé).");
  }

  let nextDisplay: string | null | undefined;
  if (body.data.displayName !== undefined) {
    if (body.data.displayName === null || body.data.displayName.trim() === "") {
      nextDisplay = null;
    } else {
      const normalized = normalizeDisplayName(body.data.displayName);
      if (!normalized) return jsonError("INVALID_REQUEST", 400, "Le nom affiché doit contenir 2 à 24 lettres, chiffres, espaces, tirets ou underscores.");
      nextDisplay = normalized;
    }
  } else {
    nextDisplay = names.displayName;
  }

  const avatarPreset = body.data.avatarPreset === undefined ? account.member.avatarPreset : body.data.avatarPreset;
  if (!isAvatarPreset(avatarPreset)) return jsonError("INVALID_REQUEST", 400, "Ce preset d'avatar n'existe pas.");

  try {
    const admin = createAdminClient();

    if (nextDisplay) {
      const key = displayNameKey(nextDisplay);
      const conflict = await admin
        .from("profiles")
        .select("id")
        .eq("display_name_key", key)
        .neq("id", account.member.id)
        .maybeSingle();
      if (conflict.error && (conflict.error as { code?: string }).code !== "42703") throw new Error("DATABASE_UNAVAILABLE");
      if (!conflict.error && conflict.data) return jsonError("INVALID_REQUEST", 409, "Ce nom affiché est déjà utilisé.");
      // Le nom affiché ne doit pas non plus écraser le nom de création d'un tiers
      // (comparaison insensible à la casse, comme pseudo_key).
      const accountConflict = await admin
        .from("profiles")
        .select("id")
        .ilike("account_name", nextDisplay)
        .neq("id", account.member.id)
        .maybeSingle();
      if (!accountConflict.error && accountConflict.data) return jsonError("INVALID_REQUEST", 409, "Ce nom affiché est déjà utilisé.");
    }

    const payload: Record<string, string | null> = { avatar_preset: avatarPreset };
    if (body.data.displayName !== undefined) {
      payload.display_name = nextDisplay ?? null;
      payload.display_name_key = nextDisplay ? displayNameKey(nextDisplay) : null;
    }

    const updated = await admin
      .from("profiles")
      .update(payload)
      .eq("id", account.member.id)
      .select("id, pseudo, account_name, display_name, avatar_preset, avatar_path")
      .maybeSingle();
    if (updated.error) throw new Error("DATABASE_UNAVAILABLE");
    if (!updated.data) return jsonError("NOT_FOUND", 404, "Profil introuvable.");
    const row = updated.data as { id: string; pseudo: string; account_name: string | null; display_name: string | null; avatar_preset: string; avatar_path: string | null };
    const effective = row.display_name ?? row.account_name ?? row.pseudo;
    return jsonOk({
      id: row.id,
      pseudo: effective,
      accountName: row.account_name,
      displayName: row.display_name,
      effectiveName: effective,
      avatarPreset: row.avatar_preset,
      avatarPath: row.avatar_path,
    });
  } catch (error) {
    return mapServerError(error);
  }
}
