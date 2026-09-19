import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export const SIGNED_URL_SECONDS = 5 * 60;

/**
 * URLs signées courtes pour un bucket privé. Les chemins bruts ne sont jamais
 * renvoyés au navigateur ; seules ces URLs le sont.
 */
export async function signStoragePaths(
  admin: SupabaseClient,
  bucket: string,
  paths: readonly (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  const urls = new Map<string, string>();
  if (unique.length === 0) return urls;
  const { data, error } = await admin.storage.from(bucket).createSignedUrls(unique, SIGNED_URL_SECONDS);
  if (error || !data) return urls;
  for (const entry of data) {
    if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
  }
  return urls;
}
