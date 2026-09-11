import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compatibilityContentSchema, type CompatibilityContent } from "@/games/compatibilite/types";
import { getSupabaseServerConfig } from "@/server/config";
import { createAdminClient } from "@/server/supabase/admin";

async function loadFileContent(): Promise<CompatibilityContent> {
  const raw = await readFile(resolve(process.cwd(), "content/compatibilite/compatibilite.json"), "utf8");
  return compatibilityContentSchema.parse(JSON.parse(raw));
}

async function loadDatabaseContent(): Promise<CompatibilityContent> {
  const { data, error } = await createAdminClient().rpc("server_get_compatibilite_content");
  if (error || !data) throw new Error("COMPATIBILITY_CONTENT_UNAVAILABLE");
  return compatibilityContentSchema.parse(data);
}

export async function loadCompatibiliteContent(): Promise<CompatibilityContent> {
  const source = process.env.COMPATIBILITY_CONTENT_SOURCE ?? "database";
  if (source === "file" || !getSupabaseServerConfig()) {
    if (process.env.NODE_ENV === "production" && source !== "file") {
      throw new Error("SUPABASE_SERVER_CONFIGURATION_MISSING");
    }
    return loadFileContent();
  }
  try {
    const content = await loadDatabaseContent();
    if (content.questions.length === 0) throw new Error("COMPATIBILITY_CONTENT_UNAVAILABLE");
    return content;
  } catch {
    throw new Error("COMPATIBILITY_CONTENT_UNAVAILABLE");
  }
}
