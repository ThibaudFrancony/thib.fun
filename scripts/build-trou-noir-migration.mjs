// Génère la migration SQL idempotente du pack quiz Trou Noir v1 depuis
// content/quiz/dist/trou-noir.json. Les UUID sont dérivés (SHA-256) des clés
// logiques pour rester stables entre générations.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeNewMigration } from "./content/write-new-migration.mjs";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const dist = await readFile(resolve(root, "content/quiz/dist/trou-noir.json"), "utf8");
const manifestText = await readFile(resolve(root, "content/quiz/dist/manifest.json"), "utf8");
const pack = JSON.parse(dist);
const manifest = JSON.parse(manifestText);

function uuidFromKey(key) {
  const hash = createHash("sha256").update(key).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

const packId = uuidFromKey("content-pack:quiz:trou-noir:1");
const databaseManifest = { ...manifest, packId };
const escape = (value) => value.replace(/'/g, "''");

const lines = [];
lines.push("-- tibo.fun — pack quiz Trou Noir v1 (120 questions originales, version 1).");
lines.push("-- Migration additive et idempotente : rejouable sans doublon, sans DROP.");
lines.push("");
lines.push("insert into private.content_packs (id, kind, slug, version, status, manifest, published_at)");
lines.push(`values ('${packId}', 'quiz', 'trou-noir', 1, 'published', '${escape(JSON.stringify(databaseManifest))}'::jsonb, now())`);
lines.push("on conflict (kind, slug, version) do update set status = excluded.status, manifest = excluded.manifest, published_at = coalesce(private.content_packs.published_at, now());");
lines.push("");

for (const question of pack.questions) {
  const itemId = uuidFromKey(`content-item:trou-noir:1:${question.logicalKey}`);
  const payload = {
    logicalKey: question.logicalKey,
    games: ["trou-noir"],
    category: question.category,
    themeId: question.logicalKey.split("-").slice(0, 2).join("-"),
    themeLabel: question.themeLabel,
    difficulty: question.difficulty,
    prompt: question.prompt,
    answer: {
      canonical: question.canonical,
      aliases: question.aliases,
      type: question.answerType,
      requiredPrecision: question.requiredPrecision,
      allowSurnameOnly: question.allowSurnameOnly,
      allowDescription: question.allowDescription,
      ...(question.numericValue !== undefined ? { numericValue: question.numericValue } : {}),
      numericTolerance: question.numericTolerance ?? 0,
    },
    explanation: question.explanation,
    sources: question.sources ?? [{ url: "https://fr.wikipedia.org/", checkedAt: "2026-09-11" }],
    validUntil: null,
  };
  lines.push("insert into private.content_items (id, pack_id, logical_key, category, difficulty, payload)");
  lines.push(
    `values ('${itemId}', '${packId}', '${escape(question.logicalKey)}', '${escape(question.category)}', ${question.difficulty}, '${escape(JSON.stringify(payload))}'::jsonb)`,
  );
  lines.push("on conflict (pack_id, logical_key) do nothing;");
}

lines.push("");
lines.push("-- Activation du jeu après déploiement du code (même motif que la migration UNO).");
lines.push("update public.games set availability = 'ready', rules_version = 'trou-noir-1' where slug = 'trou-noir';");
lines.push("");

await writeNewMigration(
  resolve(root, "supabase/migrations/20260911120000_trou_noir_ready.sql"),
  `${lines.join("\n")}`,
);
console.log(`Migration générée : ${pack.questions.length} items, pack ${packId}.`);
