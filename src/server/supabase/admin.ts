import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerConfig } from "@/server/config";

export function createAdminClient(): SupabaseClient {
  const config = getSupabaseServerConfig();
  if (!config) throw new Error("SUPABASE_SERVER_CONFIGURATION_MISSING");
  return createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
