import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const pack = JSON.parse(await readFile(resolve(root, "content/quiz/dist/ttmc.json"), "utf8"));
const sql = [];
sql.push("-- tibo.fun — pack TTMC À ton niveau v1, contenu original versionné.");
sql.push("-- Migration additive et idempotente : aucune suppression ni réinitialisation.");
sql.push(`insert into private.content_packs (id, kind, slug, version, status, manifest, published_at)`);
sql.push(`values ('${pack.packId}', 'quiz', 'ttmc', ${pack.packVersion}, 'published', ${quoteJson({ kind: "quiz", slug: "ttmc", version: 1, status: "published", source: "Rédaction originale pour tibo.fun", license: "Contenu original tibo.fun, usage privé", questionCount: pack.questions.length, themeCount: pack.themes.length, reviewedAt: "2026-09-11" })}::jsonb, now())`);
sql.push("on conflict (kind, slug, version) do update set status = excluded.status, manifest = excluded.manifest, published_at = coalesce(private.content_packs.published_at, now());");
sql.push("");
for (const question of pack.questions) {
  const payload = {
    logicalKey: question.logicalKey,
    games: ["ttmc"],
    themeId: question.themeId,
    themeLabel: question.themeLabel,
    themeDescription: question.themeDescription,
    level: question.level,
    prompt: question.prompt,
    answer: { canonical: question.canonical, aliases: question.aliases },
    explanation: question.explanation,
    validUntil: null,
  };
  sql.push(`insert into private.content_items (id, pack_id, logical_key, category, difficulty, payload) values ('${question.itemId}', '${question.packId}', '${question.logicalKey}', 'ttmc', ${question.level}, ${quoteJson(payload)}::jsonb) on conflict (pack_id, logical_key) do nothing;`);
}
sql.push("");
sql.push("-- Le chargement applicatif passe par server_get_ttmc_content() (migration suivante).");
await writeFile(resolve(root, "supabase/migrations/20260911140000_ttmc_ready.sql"), `${sql.join("\n")}\n`);
console.log(`Migration TTMC générée : ${pack.questions.length} questions.`);

function quoteJson(value) {
  return `'${JSON.stringify(value).replaceAll("'", "''")}'`;
}
