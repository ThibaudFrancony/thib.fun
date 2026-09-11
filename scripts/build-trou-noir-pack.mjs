import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const quizDir = resolve(root, "content/quiz");
const CATEGORIES = ["culture", "histoire-geo", "cuisine", "sport", "sciences"];
const DIFFICULTIES = [3, 4, 5, 6];

const sourceSchema = (item) => {
  const errors = [];
  if (typeof item.logicalKey !== "string" || !item.logicalKey) errors.push("logicalKey");
  if (!CATEGORIES.includes(item.category)) errors.push("category");
  if (typeof item.theme !== "string" || !item.theme) errors.push("theme");
  if (!DIFFICULTIES.includes(item.difficulty)) errors.push("difficulty");
  if (typeof item.prompt !== "string" || item.prompt.length > 500 || !item.prompt) errors.push("prompt");
  if (typeof item.canonical !== "string" || item.canonical.length > 240 || !item.canonical) errors.push("canonical");
  if (!Array.isArray(item.aliases)) errors.push("aliases");
  if (!["person", "place", "text", "number", "date"].includes(item.answerType)) errors.push("answerType");
  if (typeof item.requiredPrecision !== "string" || !item.requiredPrecision) errors.push("requiredPrecision");
  if (typeof item.allowSurnameOnly !== "boolean") errors.push("allowSurnameOnly");
  if (typeof item.allowDescription !== "boolean") errors.push("allowDescription");
  if (typeof item.explanation !== "string" || item.explanation.length > 400 || !item.explanation) errors.push("explanation");
  if (!Array.isArray(item.sources) || item.sources.length === 0) errors.push("sources");
  return errors;
};

const rawAnswers = [];
const seenKeys = new Set();
let failed = false;

for (const category of CATEGORIES) {
  const text = await readFile(resolve(quizDir, `trou-noir-${category}.json`), "utf8");
  const items = JSON.parse(text);
  for (const item of items) {
    const errors = sourceSchema(item);
    if (errors.length > 0) {
      console.error(`Invalide ${item.logicalKey ?? "?"}: ${errors.join(", ")}`);
      failed = true;
    }
    if (seenKeys.has(item.logicalKey)) {
      console.error(`logicalKey dupliquée: ${item.logicalKey}`);
      failed = true;
    }
    seenKeys.add(item.logicalKey);
    rawAnswers.push(item);
  }
}

// Couverture : 6 questions minimum par (catégorie, difficulté) pour le format par défaut.
for (const category of CATEGORIES) {
  for (const difficulty of DIFFICULTIES) {
    const count = rawAnswers.filter((item) => item.category === category && item.difficulty === difficulty).length;
    if (count < 6) {
      console.error(`Couverture insuffisante: ${category}/${difficulty} (${count}/6)`);
      failed = true;
    }
  }
}

// Aucune collision de prompt/canonical normalisé entre questions.
const normalized = (value) =>
  value.trim().toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const seenPrompts = new Set();
for (const item of rawAnswers) {
  const key = normalized(item.prompt);
  if (seenPrompts.has(key)) {
    console.error(`Prompt dupliqué: ${item.logicalKey}`);
    failed = true;
  }
  seenPrompts.add(key);
}

if (failed) {
  console.error("Pack Trou Noir invalide.");
  process.exit(1);
}

const packId = "trou-noir-v1";
const questions = rawAnswers.map((item, index) => ({
  itemId: `tn1-${String(index + 1).padStart(4, "0")}`,
  packId,
  logicalKey: item.logicalKey,
  category: item.category,
  themeLabel: item.theme,
  difficulty: item.difficulty,
  prompt: item.prompt,
  canonical: item.canonical,
  aliases: item.aliases,
  answerType: item.answerType,
  requiredPrecision: item.requiredPrecision,
  allowSurnameOnly: item.allowSurnameOnly,
  allowDescription: item.allowDescription,
  ...(item.numericValue !== undefined ? { numericValue: item.numericValue } : {}),
  numericTolerance: item.numericTolerance ?? 0,
  explanation: item.explanation,
  sources: item.sources,
}));

const manifest = {
  kind: "quiz",
  slug: "trou-noir",
  version: 1,
  status: "published",
  source: "Rédaction originale pour tibo.fun",
  license: "Contenu original tibo.fun, usage privé",
  author: "tibo.fun",
  questionCount: questions.length,
  reviewedBy: "relecture ciblée du 11/09/2026 (corpus de production 300 questions restant à publier)",
  reviewedAt: "2026-09-11",
  coverage: "6 questions par (catégorie, difficulté 3-6) ; configuration complète à 5 catégories garantie, sous-ensembles restreints ou formats longs pouvant refuser le démarrage (CONTENT_UNAVAILABLE)",
};

await mkdir(resolve(quizDir, "dist"), { recursive: true });
await writeFile(resolve(quizDir, "dist/trou-noir.json"), `${JSON.stringify({ packId, packVersion: 1, questions }, null, 2)}\n`);
await writeFile(resolve(quizDir, "dist/manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Pack Trou Noir assemblé : ${questions.length} questions, pack ${packId}.`);
void dirname;
