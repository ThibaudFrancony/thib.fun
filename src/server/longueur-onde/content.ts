import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { longueurOndeContentSchema, type LongueurOndeContent } from "@/games/longueur-onde/types";
import { getSupabaseServerConfig } from "@/server/config";
import { createAdminClient } from "@/server/supabase/admin";
import {
  assertManifestChecksum,
  assertManifestCount,
  assertManifestCoverage,
  assertManifestIdentity,
  assertOptionalManifest,
  assertPackReference,
  checksumJson,
  readContentManifest,
  type ContentPackReference,
} from "@/server/content/manifest";

export async function loadLongueurOndeFileContent(expected?: ContentPackReference): Promise<LongueurOndeContent> {
  const root = resolve(process.cwd(), "content/longueur-onde");
  const raw = await readFile(resolve(root, "longueur-onde.json"), "utf8");
  const content = longueurOndeContentSchema.parse(JSON.parse(raw));
  const manifest = await readContentManifest(resolve(root, "manifest.json"));
  assertManifestIdentity(manifest, { kind: "spectrums", slug: "longueur-onde", packId: content.packId, packVersion: content.packVersion });
  assertManifestChecksum(manifest, checksumJson(content));
  assertManifestCount(manifest, "axisCount", content.axes.length);
  assertManifestCoverage(manifest, Object.fromEntries(["quotidien", "culture", "absurde"].map((category) => [category, content.axes.filter((axis) => axis.category === category).length])));
  assertPackReference(content, expected);
  return content;
}

const rpcResponseSchema = longueurOndeContentSchema.extend({ manifest: z.unknown().optional() });

async function loadDatabaseContent(expected?: ContentPackReference): Promise<LongueurOndeContent> {
  const { data, error } = await createAdminClient().rpc("server_get_longueur_onde_content");
  if (error || !data) throw new Error("LONGUEUR_ONDE_CONTENT_UNAVAILABLE");
  const parsed = rpcResponseSchema.parse(data);
  const { manifest, ...content } = parsed;
  assertOptionalManifest(manifest, { kind: "spectrums", slug: "longueur-onde", packId: content.packId, packVersion: content.packVersion }, checksumJson(content));
  assertPackReference(content, expected);
  return content;
}

export async function loadLongueurOndeContent(expected?: ContentPackReference): Promise<LongueurOndeContent> {
  const source = process.env.LONGUEUR_ONDE_CONTENT_SOURCE ?? "database";
  if (source === "file" || !getSupabaseServerConfig()) {
    if (process.env.NODE_ENV === "production" && source !== "file") throw new Error("SUPABASE_SERVER_CONFIGURATION_MISSING");
    return loadLongueurOndeFileContent(expected);
  }
  try {
    const content = await loadDatabaseContent(expected);
    if (content.axes.length === 0) throw new Error("LONGUEUR_ONDE_CONTENT_UNAVAILABLE");
    return content;
  } catch (error) {
    if (error instanceof Error && (error.message === "CONTENT_VERSION_MISMATCH" || error.message === "CONTENT_MANIFEST_MISMATCH")) throw error;
    throw new Error("LONGUEUR_ONDE_CONTENT_UNAVAILABLE");
  }
}
