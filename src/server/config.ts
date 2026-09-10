import "server-only";

export type SupabaseServerConfig = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
};

export function getSupabaseServerConfig(): SupabaseServerConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) return null;
  return { url, anonKey, serviceRoleKey };
}

export function getInternalJobSecret(): string | null {
  const secret = process.env.INTERNAL_JOB_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}
