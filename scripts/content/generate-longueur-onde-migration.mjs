import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeNewMigration } from "./write-new-migration.mjs";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const pack = JSON.parse(await readFile(resolve(root, "content/longueur-onde/longueur-onde.json"), "utf8"));
const manifest = JSON.parse(await readFile(resolve(root, "content/longueur-onde/manifest.json"), "utf8"));
const output = process.argv[2]
  ? resolve(root, process.argv[2])
  : resolve(root, "supabase/migrations/20260911210000_longueur_onde_ready.sql");
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const quoteJson = (value) => `${quote(JSON.stringify(value))}::jsonb`;
const sql = [
  "-- tibo.fun — publication additive d'un pack À l'unisson versionné.",
  "-- Les RPC et triggers communs restent dans leurs migrations immuables ; ce fichier ne les réécrit pas.",
  `insert into private.content_packs (id, kind, slug, version, status, manifest, published_at) values (${quote(pack.packId)}, 'spectrums', 'longueur-onde', ${pack.packVersion}, 'published', ${quoteJson(manifest)}, now())`,
  "on conflict (kind, slug, version) do nothing;",
  "",
  ...pack.axes.map((axis) => `insert into private.content_items (id, pack_id, logical_key, category, difficulty, payload) values (${quote(axis.itemId)}, ${quote(pack.packId)}, ${quote(axis.logicalKey)}, ${quote(axis.category)}, null, ${quoteJson({ logicalKey: axis.logicalKey, leftLabel: axis.leftLabel, rightLabel: axis.rightLabel, category: axis.category, ...(axis.exampleClue ? { exampleClue: axis.exampleClue } : {}) })}) on conflict (pack_id, logical_key) do nothing;`),
  "",
];

await writeNewMigration(output, `${sql.join("\n")}\n`);
console.log(`Migration de contenu À l'unisson écrite : ${output} (${pack.axes.length} axes)`);
