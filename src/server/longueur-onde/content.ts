import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { longueurOndeContentSchema, type LongueurOndeContent } from "@/games/longueur-onde/types";
import { getSupabaseServerConfig } from "@/server/config";
import { createAdminClient } from "@/server/supabase/admin";

async function loadFileContent(): Promise<LongueurOndeContent> {
  const raw = await readFile(resolve(process.cwd(), "content/longueur-onde/longueur-onde.json"), "utf8");
  return longueurOndeContentSchema.parse(JSON.parse(raw));
}

async function loadDatabaseContent(): Promise<LongueurOndeContent> {
  const { data, error } = await createAdminClient().rpc("server_get_longueur_onde_content");
  if (error || !data) throw new Error("LONGUEUR_ONDE_CONTENT_UNAVAILABLE");
  return longueurOndeContentSchema.parse(data);
}

export async function loadLongueurOndeContent(): Promise<LongueurOndeContent> {
  const source = process.env.LONGUEUR_ONDE_CONTENT_SOURCE ?? "database";
  if (source === "file" || !getSupabaseServerConfig()) {
    if (process.env.NODE_ENV === "production" && source !== "file") throw new Error("SUPABASE_SERVER_CONFIGURATION_MISSING");
    return loadFileContent();
  }
  try {
    const content = await loadDatabaseContent();
    if (content.axes.length === 0) throw new Error("LONGUEUR_ONDE_CONTENT_UNAVAILABLE");
    return content;
  } catch {
    throw new Error("LONGUEUR_ONDE_CONTENT_UNAVAILABLE");
  }
}
