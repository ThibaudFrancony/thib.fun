import "server-only";

import { createRequestSupabaseClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";

export type AuthenticatedMember = {
  id: string;
  pseudo: string;
  avatarPreset: string;
  avatarPath: string | null;
};

export type AuthenticatedAccount = {
  email: string | null;
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
  return { email: data.user.email ?? null, member: actor.data as AuthenticatedMember };
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
