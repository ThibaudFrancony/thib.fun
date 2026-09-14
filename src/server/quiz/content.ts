import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { quizQuestionSchema, type TrouNoirContent } from "@/games/trou-noir/types";
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
  questions: z.array(quizQuestionSchema),
}).strict();
const rawFilePackSchema = z.object({
  packId: z.string(),
  packVersion: z.number().int().positive(),
  questions: z.array(z.unknown()),
}).strict();

export async function loadTrouNoirFileContent(expected?: ContentPackReference): Promise<TrouNoirContent> {
  const root = resolve(process.cwd(), "content/quiz/dist");
  const text = await readFile(resolve(root, "trou-noir.json"), "utf8");
  const rawPack = rawFilePackSchema.parse(JSON.parse(text));
  const parsed = filePackSchema.parse(rawPack);
  const manifest = await readContentManifest(resolve(root, "manifest.json"));
  const content = { packId: parsed.packId, packVersion: parsed.packVersion, questions: parsed.questions };
  assertManifestIdentity(manifest, { kind: "quiz", slug: "trou-noir", packId: content.packId, packVersion: content.packVersion });
  assertManifestChecksum(manifest, checksumJson(rawPack));
  assertManifestCount(manifest, "questionCount", content.questions.length);
  assertPackReference(content, expected);
  return content;
}

// La RPC serveur retourne déjà la forme runtime plate (aucune table privée
// interrogée directement via PostgREST côté applicatif).
const rpcQuestionSchema = quizQuestionSchema.extend({
  numericValue: z.number().finite().nullable().optional(),
});

const rpcResponseSchema = z.object({
  packId: z.string(),
  packVersion: z.number().int().positive(),
  questions: z.array(rpcQuestionSchema),
  manifest: z.unknown().optional(),
}).strict();

async function loadDatabaseContent(expected?: ContentPackReference): Promise<TrouNoirContent> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("server_get_quiz_content");
  if (error || !data) throw new Error("QUIZ_CONTENT_UNAVAILABLE");
  const parsed = rpcResponseSchema.parse(data);
  const questions = z.array(quizQuestionSchema).parse(
    parsed.questions.map((item) => ({
      ...item,
      numericValue: item.numericValue ?? undefined,
    })),
  );
  const content = { packId: parsed.packId, packVersion: parsed.packVersion, questions };
  assertOptionalManifest(parsed.manifest, { kind: "quiz", slug: "trou-noir", packId: content.packId, packVersion: content.packVersion }, checksumJson(content));
  assertPackReference(content, expected);
  return content;
}

export async function loadTrouNoirContent(expected?: ContentPackReference): Promise<TrouNoirContent> {
  const source = process.env.QUIZ_CONTENT_SOURCE ?? "database";
  if (source === "file" || !getSupabaseServerConfig()) {
    if (process.env.NODE_ENV === "production" && source !== "file") {
      throw new Error("SUPABASE_SERVER_CONFIGURATION_MISSING");
    }
    return loadTrouNoirFileContent(expected);
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
