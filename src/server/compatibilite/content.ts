import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { compatibilityContentSchema, type CompatibilityContent } from "@/games/compatibilite/types";
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

export async function loadCompatibiliteFileContent(expected?: ContentPackReference): Promise<CompatibilityContent> {
  const root = resolve(process.cwd(), "content/compatibilite");
  const raw = await readFile(resolve(root, "compatibilite.json"), "utf8");
  const content = compatibilityContentSchema.parse(JSON.parse(raw));
  const manifest = await readContentManifest(resolve(root, "manifest.json"));
  assertManifestIdentity(manifest, { kind: "compatibility", slug: "compatibilite", packId: content.packId, packVersion: content.packVersion });
  assertManifestChecksum(manifest, checksumJson(content));
  assertManifestCount(manifest, "questionCount", content.questions.length);
  assertManifestCoverage(manifest, Object.fromEntries(["quotidien", "absurde", "amitie", "couple"].map((category) => [category, content.questions.filter((question) => question.category === category).length])));
  assertPackReference(content, expected);
  return content;
}

const rpcResponseSchema = compatibilityContentSchema.extend({ manifest: z.unknown().optional() });

async function loadDatabaseContent(expected?: ContentPackReference): Promise<CompatibilityContent> {
  const { data, error } = await createAdminClient().rpc("server_get_compatibilite_content");
  if (error || !data) throw new Error("COMPATIBILITY_CONTENT_UNAVAILABLE");
  const parsed = rpcResponseSchema.parse(data);
  const { manifest, ...content } = parsed;
  assertOptionalManifest(manifest, { kind: "compatibility", slug: "compatibilite", packId: content.packId, packVersion: content.packVersion }, checksumJson(content));
  assertPackReference(content, expected);
  return content;
}

export async function loadCompatibiliteContent(expected?: ContentPackReference): Promise<CompatibilityContent> {
  const source = process.env.COMPATIBILITY_CONTENT_SOURCE ?? "database";
  if (source === "file" || !getSupabaseServerConfig()) {
    if (process.env.NODE_ENV === "production" && source !== "file") {
      throw new Error("SUPABASE_SERVER_CONFIGURATION_MISSING");
    }
    return loadCompatibiliteFileContent(expected);
  }
  try {
    const content = await loadDatabaseContent(expected);
    if (content.questions.length === 0) throw new Error("COMPATIBILITY_CONTENT_UNAVAILABLE");
    return content;
  } catch (error) {
    if (error instanceof Error && (error.message === "CONTENT_VERSION_MISMATCH" || error.message === "CONTENT_MANIFEST_MISMATCH")) throw error;
    throw new Error("COMPATIBILITY_CONTENT_UNAVAILABLE");
  }
}
