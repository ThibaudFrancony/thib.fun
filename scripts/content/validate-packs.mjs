import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ROOT, checksumBytes, checksumJson, readJson } from "./pack-utils.mjs";

const HEX_CHECKSUM = /^[a-f0-9]{64}$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertManifest(manifest, expected) {
  for (const field of ["kind", "slug", "version", "status", "source", "license", "author", "checksum", "reviewedBy", "reviewedAt"]) {
    assert(manifest[field] !== undefined, `Manifest ${expected.slug} incomplet: ${field}`);
  }
  assert(manifest.kind === expected.kind, `Manifest ${expected.slug}: kind inattendu`);
  assert(manifest.slug === expected.slug, `Manifest ${expected.slug}: slug inattendu`);
  assert(manifest.version === expected.version, `Manifest ${expected.slug}: version inattendue`);
  assert(manifest.status === "published", `Manifest ${expected.slug}: statut non publié`);
  assert(typeof manifest.checksum === "string" && HEX_CHECKSUM.test(manifest.checksum), `Manifest ${expected.slug}: checksum invalide`);
  assert(manifest.packId === expected.packId, `Manifest ${expected.slug}: packId incohérent`);
}

function assertPack(manifest, pack, expected, countField, coverage) {
  assertManifest(manifest, expected);
  assert(pack.packId === expected.packId && pack.packVersion === expected.version, `Pack ${expected.slug}: identité incohérente`);
  assert(manifest.checksum === checksumJson(pack), `Pack ${expected.slug}: checksum incohérent`);
  assert(manifest[countField] === expected.count, `Pack ${expected.slug}: quantité incohérente`);
  if (coverage) {
    for (const [key, value] of Object.entries(coverage)) assert(manifest.coverage?.[key] === value, `Pack ${expected.slug}: couverture ${key} incohérente`);
  }
}

await import("../geography/validate-pack.mjs");

const trouNoir = await readJson(resolve(ROOT, "content/quiz/dist/trou-noir.json"));
const trouNoirManifest = await readJson(resolve(ROOT, "content/quiz/dist/manifest.json"));
const trouNoirCategories = Object.fromEntries([...new Set(trouNoir.questions.map((question) => question.category))].map((category) => [
  category,
  trouNoir.questions.filter((question) => question.category === category).length,
]));
const trouNoirDifficulties = Object.fromEntries([3, 4, 5, 6].map((difficulty) => [
  String(difficulty),
  trouNoir.questions.filter((question) => question.difficulty === difficulty).length,
]));
assertPack(trouNoirManifest, trouNoir, { kind: "quiz", slug: "trou-noir", packId: "trou-noir-v1", version: 1, count: 120 }, "questionCount", { categoryCount: 5, difficultyCount: 4, minPerCategoryDifficulty: 6 });
assert(JSON.stringify(trouNoirManifest.coverage.byCategory) === JSON.stringify(trouNoirCategories), "Pack Trou Noir: couverture par catégorie incohérente");
assert(JSON.stringify(trouNoirManifest.coverage.byDifficulty) === JSON.stringify(trouNoirDifficulties), "Pack Trou Noir: couverture par difficulté incohérente");
assert(trouNoirManifest.launchReady === false, "Pack Trou Noir: seuil de lancement annoncé à tort comme disponible");
assert(trouNoirManifest.launchThreshold?.questionCount === 300 && trouNoirManifest.launchThreshold?.minPerCategory === 60, "Pack Trou Noir: seuil de lancement absent");

const ttmc = await readJson(resolve(ROOT, "content/quiz/dist/ttmc.json"));
const ttmcManifest = await readJson(resolve(ROOT, "content/quiz/dist/ttmc-manifest.json"));
const ttmcCoverage = Math.min(...ttmc.themes.flatMap((theme) => Array.from({ length: 10 }, (_, index) => ttmc.questions.filter((question) => question.themeId === theme.themeId && question.level === index + 1).length)));
assertPack(ttmcManifest, ttmc, { kind: "quiz", slug: "ttmc", packId: "3a4b7c2d-5e6f-4789-8a0b-1c2d3e4f5a6b", version: 1, count: 440 }, "questionCount", { themeCount: 22, levelCount: 10, minPerThemeLevel: 2 });
assert(ttmcManifest.themeCount === ttmc.themes.length && ttmcManifest.coverage.minPerThemeLevel === ttmcCoverage, "Pack TTMC: couverture par thème/niveau incohérente");
assert(ttmcManifest.launchReady === false, "Pack TTMC: seuil de lancement annoncé à tort comme disponible");
assert(ttmcManifest.launchThreshold?.themeCount === 30, "Pack TTMC: seuil de lancement absent");
assert(ttmcManifest.configurationAvailability?.["20/15"] === true, "Pack TTMC: la configuration 20/15 devrait être disponible");
assert(ttmcManifest.configurationAvailability?.["30/20"] === true, "Pack TTMC: la configuration 30/20 devrait être disponible");
assert(ttmcManifest.configurationAvailability?.["50/30"] === false, "Pack TTMC: la configuration 50/30 ne doit pas être activée");

const compatibilite = await readJson(resolve(ROOT, "content/compatibilite/compatibilite.json"));
const compatibiliteManifest = await readJson(resolve(ROOT, "content/compatibilite/manifest.json"));
assertPack(compatibiliteManifest, compatibilite, { kind: "compatibility", slug: "compatibilite", packId: "4f5d8a31-6b2e-4c70-9d14-8e3f2a1b6c57", version: 1, count: 160 }, "questionCount", { quotidien: 40, absurde: 40, amitie: 40, couple: 40 });

const longueurOnde = await readJson(resolve(ROOT, "content/longueur-onde/longueur-onde.json"));
const longueurOndeManifest = await readJson(resolve(ROOT, "content/longueur-onde/manifest.json"));
assertPack(longueurOndeManifest, longueurOnde, { kind: "spectrums", slug: "longueur-onde", packId: "8c7f4d21-3a6e-4b92-9f15-0d28e6a4c753", version: 1, count: 80 }, "axisCount", { quotidien: 30, culture: 25, absurde: 25 });

const bombpartyBytes = await readFile(resolve(ROOT, "content/bombparty/lexicon.json"));
const bombparty = JSON.parse(bombpartyBytes.toString("utf8"));
assert(bombparty.packId === "bombparty-fr-seed-2026-09", "Pack BombParty: packId inattendu");
assert(bombparty.license === "CC0-1.0", "Pack BombParty: licence inattendue");
assert(Array.isArray(bombparty.words) && bombparty.words.length === 431, "Pack BombParty: quantité incohérente");
assert(checksumBytes(bombpartyBytes) === "a6b74cd6950107f917b7d206b8601d80f15876fe6139fe30318e9514c22a0a39", "Pack BombParty: checksum incohérent");

console.log("Packs valides en lecture seule : Géographie 380 villes/96 départements ; Trou Noir 120 questions ; TTMC 440 questions/22 thèmes ; Compatibilité 160 questions ; Longueur d'onde 80 axes ; BombParty 431 formes.");
console.log("Seuils réels : Trou Noir 120/300 questions et 24/60 par catégorie (launchReady=false) ; TTMC 22/30 thèmes, configurations 20/15 et 30/20 disponibles, 50/30 refusée.");
