import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { quizQuestionSchema, type TrouNoirContent } from "@/games/trou-noir/types";
import { createAdminClient } from "@/server/supabase/admin";
import { getSupabaseServerConfig } from "@/server/config";

const filePackSchema = z.object({
  packId: z.string(),
  packVersion: z.number().int().positive(),
  questions: z.array(quizQuestionSchema),
});

async function loadFileContent(): Promise<TrouNoirContent> {
  const text = await readFile(resolve(process.cwd(), "content/quiz/dist/trou-noir.json"), "utf8");
  const parsed = filePackSchema.parse(JSON.parse(text));
  return { packId: parsed.packId, packVersion: parsed.packVersion, questions: parsed.questions };
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
});

async function loadDatabaseContent(): Promise<TrouNoirContent> {
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
  return { packId: parsed.packId, packVersion: parsed.packVersion, questions };
}

export async function loadTrouNoirContent(): Promise<TrouNoirContent> {
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
