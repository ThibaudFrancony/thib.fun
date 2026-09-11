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
  "",
  "-- Le RPC partagé attribue loss par défaut lorsqu'il n'y a pas de vainqueur ;",
  "-- ces triggers privés conservent la sémantique coopérative d'À l'unisson.",
  "alter table private.match_results drop constraint if exists match_results_shared_score_consistency;",
  "alter table private.match_results add constraint match_results_shared_score_consistency check ((kind = 'cooperative' and (shared_score is not null or outcome = 'abandoned')) or (kind = 'competitive' and shared_score is null));",
  "",
  "create or replace function private.normalize_longueur_onde_player_result() returns trigger language plpgsql security definer set search_path = '' as $$",
  "declare game_slug text; result_kind text; result_outcome text;",
  "begin",
  "  select m.game_slug, mr.kind, mr.outcome into game_slug, result_kind, result_outcome from private.matches m join private.match_results mr on mr.match_id = m.id where mr.match_id = new.match_id;",
  "  if game_slug = 'longueur-onde' and result_kind = 'cooperative' and result_outcome = 'cooperative' then new.outcome := 'cooperative'; new.score := null; end if;",
  "  return new;",
  "end; $$;",
  "drop trigger if exists normalize_longueur_onde_player_result on private.player_results;",
  "create trigger normalize_longueur_onde_player_result before insert on private.player_results for each row execute function private.normalize_longueur_onde_player_result();",
  "",
  "create or replace function private.normalize_longueur_onde_history_entry() returns trigger language plpgsql security definer set search_path = '' as $$",
  "declare game_slug text; result_kind text; result_outcome text;",
  "begin",
  "  select m.game_slug, mr.kind, mr.outcome into game_slug, result_kind, result_outcome from private.matches m join private.match_results mr on mr.match_id = m.id where m.id = new.match_id;",
  "  if game_slug = 'longueur-onde' and result_kind = 'cooperative' and result_outcome = 'cooperative' then new.outcome := 'cooperative'; new.score := null; new.opponent_score := null; end if;",
  "  return new;",
  "end; $$;",
  "drop trigger if exists normalize_longueur_onde_history_entry on public.history_entries;",
  "create trigger normalize_longueur_onde_history_entry before insert on public.history_entries for each row execute function private.normalize_longueur_onde_history_entry();",
  "",
  "create or replace function private.normalize_longueur_onde_player_stats() returns trigger language plpgsql security definer set search_path = '' as $$",
  "declare game_slug text; result_kind text; result_outcome text;",
  "begin",
  "  select m.game_slug, mr.kind, mr.outcome into game_slug, result_kind, result_outcome from private.matches m join private.match_results mr on mr.match_id = m.id join private.player_results pr on pr.match_id = mr.match_id and pr.user_id = new.user_id where m.game_slug = 'longueur-onde' order by mr.completed_at desc limit 1;",
  "  if new.game_slug = 'longueur-onde' and result_kind = 'cooperative' and result_outcome = 'cooperative' then new.played := 1; new.wins := 0; new.losses := 0; new.draws := 0; new.cooperative := 1; new.abandoned := 0; end if;",
  "  return new;",
  "end; $$;",
  "drop trigger if exists normalize_longueur_onde_player_stats on public.player_game_stats;",
  "create trigger normalize_longueur_onde_player_stats before insert on public.player_game_stats for each row execute function private.normalize_longueur_onde_player_stats();",
  "",
  "create or replace function private.record_longueur_onde_pair_stats() returns trigger language plpgsql security definer set search_path = '' as $$",
  "declare game_slug text; low_id uuid; high_id uuid; played integer; cooperative integer; abandoned integer;",
  "begin",
  "  select m.game_slug into game_slug from private.matches m where m.id = new.match_id;",
  "  if game_slug is distinct from 'longueur-onde' or new.kind <> 'cooperative' then return new; end if;",
  "  select least(mp0.user_id, mp1.user_id), greatest(mp0.user_id, mp1.user_id) into low_id, high_id from private.match_players mp0 join private.match_players mp1 on mp0.match_id = mp1.match_id where mp0.match_id = new.match_id and mp0.seat = 0 and mp1.seat = 1;",
  "  played := case when new.outcome = 'cooperative' then 1 else 0 end; cooperative := played; abandoned := case when new.outcome = 'abandoned' then 1 else 0 end;",
  "  insert into private.pair_game_stats (player_low, player_high, game_slug, played, low_wins, high_wins, draws, cooperative, abandoned, metrics) values (low_id, high_id, game_slug, played, 0, 0, 0, cooperative, abandoned, coalesce(new.summary, '{}'::jsonb))",
  "  on conflict (player_low, player_high, game_slug) do update set played = private.pair_game_stats.played + excluded.played, cooperative = private.pair_game_stats.cooperative + excluded.cooperative, abandoned = private.pair_game_stats.abandoned + excluded.abandoned, metrics = private.pair_game_stats.metrics || excluded.metrics, updated_at = clock_timestamp();",
  "  return new;",
  "end; $$;",
  "drop trigger if exists record_longueur_onde_pair_stats on private.match_results;",
  "create trigger record_longueur_onde_pair_stats after insert on private.match_results for each row execute function private.record_longueur_onde_pair_stats();",
  "",
  "revoke all on function private.normalize_longueur_onde_player_result() from public, anon, authenticated;",
  "revoke all on function private.normalize_longueur_onde_history_entry() from public, anon, authenticated;",
  "revoke all on function private.normalize_longueur_onde_player_stats() from public, anon, authenticated;",
  "revoke all on function private.record_longueur_onde_pair_stats() from public, anon, authenticated;",
);
await writeFile(resolve(root, "supabase/migrations/20260911210000_longueur_onde_ready.sql"), `${sql.join("\n")}\n`);
console.log(`Longueur d'onde généré: ${axes.length} axes (${JSON.stringify(coverage)}).`);
