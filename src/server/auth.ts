import "server-only";

import { createRequestSupabaseClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import { isAnonymousUser } from "@/lib/auth-identity";

export type AuthenticatedMember = {
  id: string;
  pseudo: string;
  accountName: string | null;
  displayName: string | null;
  effectiveName: string;
  needsOnboarding: boolean;
  avatarPreset: string;
  avatarPath: string | null;
};

export type AuthenticatedAccount = {
  email: string | null;
  isGuest: boolean;
  member: AuthenticatedMember;
};

async function getAuthenticatedAccountInternal(): Promise<AuthenticatedAccount | null> {
  const supabase = await createRequestSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const admin = createAdminClient();
  const actor = await admin.rpc("server_get_actor", { p_actor: data.user.id });
  if (actor.error || !actor.data) return null;
  // Compatibilité : la migration des noms peut ne pas être appliquée quand le
  // code est déployé. Les nouveaux champs sont donc repliés localement.
  const raw = actor.data as Partial<AuthenticatedMember> & { pseudo?: string };
  const pseudo = typeof raw.pseudo === "string" ? raw.pseudo : "Joueur";
  const accountName = typeof raw.accountName === "string" ? raw.accountName : null;
  const displayName = typeof raw.displayName === "string" ? raw.displayName : null;
  return {
    email: data.user.email ?? null,
    isGuest: isAnonymousUser(data.user),
    member: {
      id: data.user.id,
      pseudo,
      accountName,
      displayName,
      effectiveName: typeof raw.effectiveName === "string" ? raw.effectiveName : (displayName ?? accountName ?? pseudo),
      needsOnboarding: typeof raw.needsOnboarding === "boolean" ? raw.needsOnboarding : false,
      avatarPreset: typeof raw.avatarPreset === "string" ? raw.avatarPreset : "avatar-1",
      avatarPath: typeof raw.avatarPath === "string" ? raw.avatarPath : null,
    },
  };
}

export async function getAuthenticatedMember(): Promise<AuthenticatedMember | null> {
  const account = await getAuthenticatedAccountInternal();
  return account?.member ?? null;
}

export async function getAuthenticatedAccount(): Promise<AuthenticatedAccount | null> {
  return getAuthenticatedAccountInternal();
}

export async function getAuthenticatedUserId(): Promise<string | null> {
  const supabase = await createRequestSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  return error || !data.user ? null : data.user.id;
}

export async function getAuthenticatedPermanentMember(): Promise<AuthenticatedMember | null> {
  const account = await getAuthenticatedAccountInternal();
  return account && !account.isGuest ? account.member : null;
}
