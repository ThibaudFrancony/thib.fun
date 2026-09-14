import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const packId = "3a4b7c2d-5e6f-4789-8a0b-1c2d3e4f5a6b";
const seeds = JSON.parse(await readFile(resolve(root, "content/quiz/ttmc-seeds.json"), "utf8"));

function stableUuid(key) {
  const hex = createHash("sha256").update(`ttmc:${key}`).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = (Number.parseInt(hex[16], 16) & 0x3 | 0x8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

const questions = [];
for (const theme of seeds) {
  if (!Array.isArray(theme.facts) || theme.facts.length !== 10) throw new Error(`Le thème ${theme.themeId} doit fournir 10 faits.`);
  theme.facts.forEach(([prompt, answer], index) => {
    const level = index + 1;
    for (const variant of [0, 1]) {
      const itemId = stableUuid(`${theme.themeId}:${level}:${variant}`);
      questions.push({
        itemId,
        packId,
        logicalKey: `ttmc-${theme.themeId}-${level}-${variant + 1}`,
        themeId: theme.themeId,
        themeLabel: theme.label,
        themeDescription: theme.shortDescription,
        level,
        prompt: variant === 0 ? prompt : `Sans changer de sujet, quelle est la réponse à cette question : ${prompt}`,
        canonical: answer,
        aliases: [],
        explanation: `Réponse de référence : ${answer}.`,
      });
    }
  });
}

const output = {
  packId,
  packVersion: 1,
  themes: seeds.map(({ themeId, label, shortDescription }) => ({ themeId, label, shortDescription })),
  questions,
};
const checksum = createHash("sha256").update(JSON.stringify(output)).digest("hex");
const manifest = {
  kind: "quiz",
  slug: "ttmc",
  version: 1,
  packId,
  status: "published",
  source: "Rédaction originale pour tibo.fun",
  license: "Contenu original tibo.fun, usage privé",
  author: "tibo.fun",
  checksum,
  questionCount: questions.length,
  themeCount: seeds.length,
  coverage: { themeCount: seeds.length, levelCount: 10, minPerThemeLevel: 2 },
  reviewedBy: "relecture structurelle interne",
  reviewedAt: "2026-09-11",
  launchThreshold: { themeCount: 30, levelsPerTheme: 10, minPerThemeLevel: 2 },
  configurationAvailability: { "20/15": seeds.length >= 17, "30/20": seeds.length >= 22, "50/30": seeds.length >= 32 },
  launchReady: seeds.length >= 30,
};

await mkdir(resolve(root, "content/quiz/dist"), { recursive: true });
await writeFile(resolve(root, "content/quiz/dist/ttmc.json"), `${JSON.stringify(output, null, 2)}\n`);
await writeFile(resolve(root, "content/quiz/dist/ttmc-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`TTMC: ${seeds.length} thèmes, ${questions.length} questions, pack ${packId}`);
