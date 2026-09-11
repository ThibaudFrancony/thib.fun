import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const packId = "8c7f4d21-3a6e-4b92-9f15-0d28e6a4c753";
const packVersion = 1;

const source = [
  ["Silencieux", "Bruyant", "quotidien", "Une bibliothèque calme"],
  ["Lent", "Rapide"],
  ["Rangé", "En désordre"],
  ["Spontané", "Planifié"],
  ["Solitaire", "Collectif"],
  ["Minimal", "Abondant"],
  ["Le matin", "La nuit"],
  ["La ville", "La nature"],
  ["Pratique", "Esthétique"],
  ["Économique", "Luxueux"],
  ["Classique", "Original"],
  ["Local", "Lointain"],
  ["Chez soi", "Dehors"],
  ["Simple", "Sophistiqué"],
  ["La tradition", "La nouveauté"],
  ["Le papier", "L'écran"],
  ["Sucré", "Salé"],
  ["Chaud", "Froid"],
  ["Petite équipe", "Grande équipe"],
  ["La routine", "L'aventure"],
  ["Le confort", "Le défi"],
  ["Calme", "Énergique"],
  ["Direct", "Détourné"],
  ["Prévisible", "Surprenant"],
  ["Intime", "Public"],
  ["Matériel", "Immatériel"],
  ["La marche", "Les roues"],
  ["Immédiat", "Patient"],
  ["Net", "Flou"],
  ["Réparer", "Remplacer"],

  ["Indépendant", "Populaire", "culture", "Un film qui passe dans une petite salle"],
  ["Ancien", "Contemporain"],
  ["Fiction", "Documentaire"],
  ["Comédie", "Drame"],
  ["Instrumental", "Chanté"],
  ["Musée", "Festival"],
  ["Roman", "Essai"],
  ["Vers", "Prose"],
  ["Peinture", "Sculpture"],
  ["Architecture", "Paysage"],
  ["Classique", "Expérimental"],
  ["Solo", "Orchestre"],
  ["Local", "International"],
  ["Débutant", "Expert"],
  ["Chef-d'œuvre", "Plaisir coupable"],
  ["Adaptation fidèle", "Réinterprétation"],
  ["Petite salle", "Grand écran"],
  ["Lire", "Regarder"],
  ["Écouter", "Participer"],
  ["Questionner", "Admirer"],
  ["L'énigme", "L'évidence"],
  ["La chronique", "L'épopée"],
  ["Réaliste", "Onirique"],
  ["Épuré", "Foisonnant"],
  ["La référence", "La découverte"],

  ["Minuscule", "Immense", "absurde", "Un monde où tout tient dans une tasse"],
  ["Tout droit", "En zigzag"],
  ["Très tôt", "Très tard"],
  ["Canapé", "Trampoline"],
  ["Escargot", "Fusée"],
  ["Chaussettes assorties", "Chaussettes dépareillées"],
  ["Chocolat", "Cornichon"],
  ["Dragon", "Pigeon"],
  ["Confettis", "Spaghettis"],
  ["Très sérieux", "Complètement louche"],
  ["Parler à une plante", "Négocier avec une chaise"],
  ["À roulettes", "À ressorts"],
  ["Une porte", "Un rideau"],
  ["Un bouton", "Une manivelle"],
  ["Un rire", "Un klaxon"],
  ["Un château", "Une cabane"],
  ["Un robot", "Un fantôme"],
  ["Une moustache", "Un monocle"],
  ["Un secret", "Un panneau"],
  ["Un détour", "Un raccourci"],
  ["Une cuillère", "Une fourchette"],
  ["Un pull", "Un parapluie"],
  ["Une fusée", "Un sous-marin"],
  ["Un cri", "Un chuchotement"],
  ["Une idée brillante", "Une idée farfelue"],
];

function stableUuid(key) {
  const hex = createHash("sha256").update(`longueur-onde:${key}`).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = (Number.parseInt(hex[16], 16) & 0x3 | 0x8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

const categories = ["quotidien", "culture", "absurde"];
const axes = source.map(([leftLabel, rightLabel, categoryOrExample, explicitExample], index) => {
  const category = categories[index < 30 ? 0 : index < 55 ? 1 : 2];
  const exampleClue = explicitExample ?? (categoryOrExample && categories.includes(categoryOrExample) ? undefined : categoryOrExample);
  return {
  itemId: stableUuid(`axis:${index + 1}`),
  packId,
  logicalKey: `longueur-onde-${category}-${String(index + 1).padStart(2, "0")}`,
  leftLabel,
  rightLabel,
  category,
  ...(exampleClue ? { exampleClue } : {}),
  };
});

if (axes.length !== 80) throw new Error(`Longueur d'onde doit fournir 80 axes, reçu ${axes.length}.`);
const keys = new Set();
for (const axis of axes) {
  if (keys.has(axis.logicalKey)) throw new Error(`logicalKey dupliquée: ${axis.logicalKey}`);
  keys.add(axis.logicalKey);
  if (axis.leftLabel.length > 60 || axis.rightLabel.length > 60) throw new Error(`Libellé trop long: ${axis.logicalKey}`);
}
const coverage = Object.fromEntries(["quotidien", "culture", "absurde"].map((category) => [category, axes.filter((axis) => axis.category === category).length]));
if (coverage.quotidien !== 30 || coverage.culture !== 25 || coverage.absurde !== 25) throw new Error(`Couverture inattendue: ${JSON.stringify(coverage)}`);

const manifest = {
  kind: "spectrums",
  slug: "longueur-onde",
  version: packVersion,
  status: "published",
  source: "Axes originaux rédigés pour tibo.fun",
  license: "Contenu original tibo.fun, usage privé",
  author: "tibo.fun",
  axisCount: axes.length,
  coverage,
  reviewedBy: "relecture structurelle et éditoriale interne",
  reviewedAt: "2026-09-11",
};
const pack = { packId, packVersion, axes };

await mkdir(resolve(root, "content/longueur-onde"), { recursive: true });
await writeFile(resolve(root, "content/longueur-onde/longueur-onde.json"), `${JSON.stringify(pack, null, 2)}\n`);
await writeFile(resolve(root, "content/longueur-onde/manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const quoteJson = (value) => `'${JSON.stringify(value).replaceAll("'", "''")}'`;
const sql = [
  "-- tibo.fun — pack À l'unisson v1, axes originaux versionnés.",
  "-- Migration additive et idempotente : aucun contenu existant n'est supprimé.",
  `insert into private.content_packs (id, kind, slug, version, status, manifest, published_at) values ('${packId}', 'spectrums', 'longueur-onde', ${packVersion}, 'published', ${quoteJson(manifest)}::jsonb, now())`,
  "on conflict (kind, slug, version) do update set status = excluded.status, manifest = excluded.manifest, published_at = coalesce(private.content_packs.published_at, now());",
  "",
];
for (const axis of axes) {
  sql.push(`insert into private.content_items (id, pack_id, logical_key, category, difficulty, payload) values ('${axis.itemId}', '${packId}', '${axis.logicalKey}', '${axis.category}', null, ${quoteJson({ logicalKey: axis.logicalKey, leftLabel: axis.leftLabel, rightLabel: axis.rightLabel, category: axis.category, ...(axis.exampleClue ? { exampleClue: axis.exampleClue } : {}) })}::jsonb) on conflict (pack_id, logical_key) do nothing;`);
}
sql.push(
  "",
  "create or replace function public.server_get_longueur_onde_content()",
  "returns jsonb",
  "language sql",
  "security invoker",
  "set search_path = ''",
  "as $$",
  "  with pack as (",
  "    select id, version from private.content_packs",
  "    where kind = 'spectrums' and slug = 'longueur-onde' and status = 'published'",
  "    order by version desc limit 1",
  "  )",
  "  select jsonb_build_object(",
  "    'packId', pack.id, 'packVersion', pack.version,",
  "    'axes', coalesce((",
  "      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(",
  "        'itemId', ci.id, 'packId', pack.id, 'logicalKey', ci.logical_key,",
  "        'leftLabel', ci.payload ->> 'leftLabel', 'rightLabel', ci.payload ->> 'rightLabel',",
  "        'category', ci.payload ->> 'category', 'exampleClue', ci.payload ->> 'exampleClue'",
  "      )) order by ci.logical_key) from private.content_items ci where ci.pack_id = pack.id",
  "    ), '[]'::jsonb)",
  "  ) from pack;",
  "$$;",
  "",
  "revoke all on function public.server_get_longueur_onde_content() from public, anon, authenticated;",
  "grant execute on function public.server_get_longueur_onde_content() to service_role;",
  "",
  "update public.games set availability = 'ready', rules_version = 'longueur-onde-1' where slug = 'longueur-onde';",
);
await writeFile(resolve(root, "supabase/migrations/20260911210000_longueur_onde_ready.sql"), `${sql.join("\n")}\n`);
console.log(`Longueur d'onde généré: ${axes.length} axes (${JSON.stringify(coverage)}).`);
