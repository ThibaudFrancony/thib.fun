import { z } from "zod";
import { getAuthenticatedAccount } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { assertMutationOrigin, jsonError, jsonOk, mapServerError } from "@/server/http";
import { createAdminClient } from "@/server/supabase/admin";
import { isAvatarPreset, normalizeProfilePseudo, profilePseudoKey } from "../profile-helpers";

const bodySchema = z.object({
  pseudo: z.string().max(80).optional(),
  avatarPreset: z.string().optional(),
}).strict().refine((value) => value.pseudo !== undefined || value.avatarPreset !== undefined, {
  message: "Aucun changement demandé.",
});

export async function POST(request: Request) {
  const originError = assertMutationOrigin(request);
  if (originError) return originError;
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const account = await getAuthenticatedAccount();
  if (!account) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour modifier ton profil.");
  if (account.isGuest) return jsonError("ACCOUNT_REQUIRED", 403, "Crée un compte permanent pour modifier ton profil.");

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("INVALID_REQUEST", 400, "Les informations du profil sont invalides.");

  const pseudo = body.data.pseudo === undefined
    ? account.member.pseudo
    : normalizeProfilePseudo(body.data.pseudo);
  if (!pseudo) return jsonError("INVALID_REQUEST", 400, "Le pseudo doit contenir 2 à 24 lettres, chiffres, espaces, tirets ou underscores.");
  const avatarPreset = body.data.avatarPreset === undefined ? account.member.avatarPreset : body.data.avatarPreset;
  if (!isAvatarPreset(avatarPreset)) return jsonError("INVALID_REQUEST", 400, "Ce preset d'avatar n'existe pas.");

  try {
    const admin = createAdminClient();
    const duplicate = await admin
      .from("profiles")
      .select("id")
      .eq("pseudo_key", profilePseudoKey(pseudo))
      .neq("id", account.member.id)
      .maybeSingle();
    if (duplicate.error) throw new Error("DATABASE_UNAVAILABLE");
    if (duplicate.data) return jsonError("INVALID_REQUEST", 409, "Ce pseudo est déjà utilisé.");

    const updated = await admin
      .from("profiles")
      .update({ pseudo, pseudo_key: profilePseudoKey(pseudo), avatar_preset: avatarPreset })
      .eq("id", account.member.id)
      .select("id, pseudo, avatar_preset, avatar_path")
      .maybeSingle();
    if (updated.error) {
      if (updated.error.code === "23505") return jsonError("INVALID_REQUEST", 409, "Ce pseudo est déjà utilisé.");
      throw new Error("DATABASE_UNAVAILABLE");
    }
    if (!updated.data) return jsonError("NOT_FOUND", 404, "Profil introuvable.");
    return jsonOk({
      id: updated.data.id,
      pseudo: updated.data.pseudo,
      avatarPreset: updated.data.avatar_preset,
      avatarPath: updated.data.avatar_path,
    });
  } catch (error) {
    return mapServerError(error);
  }
}
