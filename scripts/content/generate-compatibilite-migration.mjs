import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeNewMigration } from "./write-new-migration.mjs";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const pack = JSON.parse(await readFile(resolve(root, "content/compatibilite/compatibilite.json"), "utf8"));
const manifest = JSON.parse(await readFile(resolve(root, "content/compatibilite/manifest.json"), "utf8"));
const output = process.argv[2]
  ? resolve(root, process.argv[2])
  : resolve(root, "supabase/migrations/20260911200000_compatibilite_ready.sql");
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const quoteJson = (value) => `${quote(JSON.stringify(value))}::jsonb`;
const sql = [
  "-- tibo.fun — publication additive d'un pack Compatibilité versionné.",
  "-- Les RPC et triggers communs restent dans leurs migrations immuables ; ce fichier ne les réécrit pas.",
  `insert into private.content_packs (id, kind, slug, version, status, manifest, published_at) values (${quote(pack.packId)}, 'compatibility', 'compatibilite', ${pack.packVersion}, 'published', ${quoteJson(manifest)}, now())`,
  "on conflict (kind, slug, version) do nothing;",
  "",
  ...pack.questions.map((question) => `insert into private.content_items (id, pack_id, logical_key, category, difficulty, payload) values (${quote(question.itemId)}, ${quote(pack.packId)}, ${quote(question.logicalKey)}, ${quote(question.category)}, null, ${quoteJson({ logicalKey: question.logicalKey, category: question.category, prompt: question.prompt, options: question.options, sensitivity: question.sensitivity })}) on conflict (pack_id, logical_key) do nothing;`),
  "",
];

await writeNewMigration(output, `${sql.join("\n")}\n`);
console.log(`Migration de contenu Compatibilité écrite : ${output} (${pack.questions.length} items)`);
