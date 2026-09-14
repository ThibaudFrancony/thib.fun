import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { ttmcQuestionSchema, type TtmcContent } from "@/games/ttmc/types";
import { createAdminClient } from "@/server/supabase/admin";
import { getSupabaseServerConfig } from "@/server/config";
import {
  assertManifestChecksum,
  assertManifestCount,
  assertManifestIdentity,
  assertOptionalManifest,
  assertPackReference,
  checksumJson,
  readContentManifest,
  type ContentPackReference,
} from "@/server/content/manifest";

const filePackSchema = z.object({
  packId: z.string(),
  packVersion: z.number().int().positive(),
  themes: z.array(
    z.object({
      themeId: z.string(),
      label: z.string(),
      shortDescription: z.string(),
    }),
  ),
  questions: z.array(ttmcQuestionSchema),
}).strict();

export async function loadTtmcFileContent(expected?: ContentPackReference): Promise<TtmcContent> {
  const root = resolve(process.cwd(), "content/quiz/dist");
  const text = await readFile(resolve(root, "ttmc.json"), "utf8");
  const parsed = filePackSchema.parse(JSON.parse(text));
  const content = {
    packId: parsed.packId,
    packVersion: parsed.packVersion,
    themes: parsed.themes,
    questions: parsed.questions,
  };
  const manifest = await readContentManifest(resolve(root, "ttmc-manifest.json"));
  assertManifestIdentity(manifest, { kind: "quiz", slug: "ttmc", packId: content.packId, packVersion: content.packVersion });
  assertManifestChecksum(manifest, checksumJson(content));
  assertManifestCount(manifest, "questionCount", content.questions.length);
  assertManifestCount(manifest, "themeCount", content.themes.length);
  assertPackReference(content, expected);
  return content;
}

const rpcResponseSchema = z.object({
  packId: z.string(),
  packVersion: z.number().int().positive(),
  themes: z.array(
    z.object({
      themeId: z.string(),
      label: z.string(),
      shortDescription: z.string(),
    }),
  ),
  questions: z.array(ttmcQuestionSchema),
  manifest: z.unknown().optional(),
}).strict();

async function loadDatabaseContent(expected?: ContentPackReference): Promise<TtmcContent> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("server_get_ttmc_content");
  if (error || !data) throw new Error("QUIZ_CONTENT_UNAVAILABLE");
  const parsed = rpcResponseSchema.parse(data);
  const content = {
    packId: parsed.packId,
    packVersion: parsed.packVersion,
    themes: parsed.themes,
    questions: parsed.questions,
  };
  assertOptionalManifest(parsed.manifest, { kind: "quiz", slug: "ttmc", packId: content.packId, packVersion: content.packVersion }, checksumJson(content));
  assertPackReference(content, expected);
  return content;
}

export async function loadTtmcContent(expected?: ContentPackReference): Promise<TtmcContent> {
  const source = process.env.QUIZ_CONTENT_SOURCE ?? "database";
  if (source === "file" || !getSupabaseServerConfig()) {
    if (process.env.NODE_ENV === "production" && source !== "file") {
      throw new Error("SUPABASE_SERVER_CONFIGURATION_MISSING");
    }
    return loadTtmcFileContent(expected);
  }
  try {
    const content = await loadDatabaseContent(expected);
    if (content.questions.length === 0) throw new Error("QUIZ_CONTENT_UNAVAILABLE");
    return content;
  } catch (error) {
    if (error instanceof Error && (error.message === "CONTENT_VERSION_MISMATCH" || error.message === "CONTENT_MANIFEST_MISMATCH")) throw error;
    throw new Error("QUIZ_CONTENT_UNAVAILABLE");
  }
}
