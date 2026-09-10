import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseServerConfig } from "@/server/config";

export async function createRequestSupabaseClient() {
  const config = getSupabaseServerConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(values) {
        try {
          for (const { name, value, options } of values) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot write cookies. Route handlers can.
        }
      },
    },
  });
}
