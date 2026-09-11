import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { ttmcQuestionSchema, type TtmcContent } from "@/games/ttmc/types";
import { createAdminClient } from "@/server/supabase/admin";
import { getSupabaseServerConfig } from "@/server/config";

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
});

async function loadFileContent(): Promise<TtmcContent> {
  const text = await readFile(resolve(process.cwd(), "content/quiz/dist/ttmc.json"), "utf8");
  const parsed = filePackSchema.parse(JSON.parse(text));
  return {
    packId: parsed.packId,
    packVersion: parsed.packVersion,
    themes: parsed.themes,
    questions: parsed.questions,
  };
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
});

async function loadDatabaseContent(): Promise<TtmcContent> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("server_get_ttmc_content");
  if (error || !data) throw new Error("QUIZ_CONTENT_UNAVAILABLE");
  const parsed = rpcResponseSchema.parse(data);
  return {
    packId: parsed.packId,
    packVersion: parsed.packVersion,
    themes: parsed.themes,
    questions: parsed.questions,
  };
}

export async function loadTtmcContent(): Promise<TtmcContent> {
  const source = process.env.QUIZ_CONTENT_SOURCE ?? "database";
  if (source === "file" || !getSupabaseServerConfig()) {
    if (process.env.NODE_ENV === "production" && source !== "file") {
      throw new Error("SUPABASE_SERVER_CONFIGURATION_MISSING");
    }
    return loadFileContent();
  }
  try {
    const content = await loadDatabaseContent();
    if (content.questions.length === 0) throw new Error("QUIZ_CONTENT_UNAVAILABLE");
    return content;
  } catch {
    throw new Error("QUIZ_CONTENT_UNAVAILABLE");
  }
}
