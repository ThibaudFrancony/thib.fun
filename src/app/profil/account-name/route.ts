import { z } from "zod";
import { getAuthenticatedAccount } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { assertMutationOrigin, jsonError, jsonOk, mapServerError } from "@/server/http";
import { createAdminClient } from "@/server/supabase/admin";
import { normalizeProfilePseudo, profilePseudoKey } from "../profile-helpers";

const bodySchema = z.object({ accountName: z.string().max(80) }).strict();

/**
 * Onboarding du pseudo : choix unique du nom de création, à la première
 * connexion d'un compte permanent. Refusé si déjà posé, réservé aux comptes
 * permanents, avec avertissement d'immuabilité porté par l'UI.
 */
export async function POST(request: Request) {
  const originError = assertMutationOrigin(request);
  if (originError) return originError;
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const account = await getAuthenticatedAccount();
  if (!account) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour choisir ton pseudo.");
  if (account.isGuest) return jsonError("ACCOUNT_REQUIRED", 403, "Crée un compte permanent pour choisir un pseudo.");
  if (account.member.accountName) return jsonError("INVALID_REQUEST", 409, "Ton nom de création est déjà fixé et ne peut pas être changé.");

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("INVALID_REQUEST", 400, "Le pseudo est invalide.");
  const normalized = normalizeProfilePseudo(body.data.accountName);
  if (!normalized) return jsonError("INVALID_REQUEST", 400, "Le pseudo doit contenir 2 à 24 lettres, chiffres, espaces, tirets ou underscores.");
  const key = profilePseudoKey(normalized);

  try {
    const admin = createAdminClient();
    const duplicate = await admin
      .from("profiles")
      .select("id")
      .eq("pseudo_key", key)
      .neq("id", account.member.id)
      .maybeSingle();
    if (duplicate.error) throw new Error("DATABASE_UNAVAILABLE");
    if (duplicate.data) return jsonError("INVALID_REQUEST", 409, "Ce pseudo est déjà utilisé.");

    const updated = await admin
      .from("profiles")
      .update({ account_name: normalized })
      .eq("id", account.member.id)
      .is("account_name", null)
      .select("id, pseudo, account_name, display_name, avatar_preset, avatar_path")
      .maybeSingle();
    if (updated.error) {
      if ((updated.error as { code?: string }).code === "23505") return jsonError("INVALID_REQUEST", 409, "Ce pseudo est déjà utilisé.");
      throw new Error("DATABASE_UNAVAILABLE");
    }
    if (!updated.data) return jsonError("INVALID_REQUEST", 409, "Ton nom de création est déjà fixé et ne peut pas être changé.");
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
