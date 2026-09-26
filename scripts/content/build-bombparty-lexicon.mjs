/**
 * Reconstruit content/bombparty/lexicon.json à partir des lexiques ouverts.
 *
 * Sources lues dans BOMBPARTY_SRC (défaut /tmp/bombparty-src) :
 * - lexique-grammalecte-fr-v7.7.txt (MPL-2.0)
 * - Lexique400.tsv (CC BY-SA 4.0)
 * - kaikki-fr.jsonl.gz (Wiktionnaire, CC BY-SA 4.0 et GFDL)
 *
 * Lefff 3.4 n'est pas fusionné : le dépôt Inria refuse le téléchargement automatisé.
 * La normalisation reprend src/games/bombparty/normalize.ts.
 */
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { createGunzip } from "node:zlib";

const SRC = process.env.BOMBPARTY_SRC ?? "/tmp/bombparty-src";
const OUT = resolve(process.cwd(), "content/bombparty/lexicon.json");

function normalizeBombpartyWord(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 60) return null;
  const normalized = trimmed
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae");
  if (normalized.length < 2 || normalized.length > 30) return null;
  if (!/^[a-z]+$/.test(normalized)) return null;
  return normalized;
}

const displays = new Map();
const addedBySource = { grammalecte: 0, lexique: 0, wiktionnaire: 0 };

function consider(raw, source) {
  const normalized = normalizeBombpartyWord(raw);
  if (normalized === null) return;
  const display = raw.trim().toLowerCase();
  if (normalizeBombpartyWord(display) !== normalized) return;
  // Première graphie retenue. Grammalecte arrive en tête, trié par fréquence,
  // donc « le » n'est pas remplacé par « lé », et « être » reste accentué.
  if (displays.has(normalized)) return;
  displays.set(normalized, display);
  addedBySource[source] += 1;
}

async function readGrammalecte() {
  const rl = createInterface({ input: createReadStream(resolve(SRC, "lexique-grammalecte-fr-v7.7.txt")), crlfDelay: Infinity });
  let headerSeen = false;
  for await (const line of rl) {
    if (!headerSeen) {
      if (line.startsWith("id\t")) headerSeen = true;
      continue;
    }
    const flexion = line.split("\t")[2];
    if (flexion) consider(flexion, "grammalecte");
  }
}

async function readLexique() {
  const rl = createInterface({ input: createReadStream(resolve(SRC, "Lexique400.tsv")), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (first) {
      first = false;
      continue;
    }
    const word = line.split("\t")[0];
    if (word) consider(word, "lexique");
  }
}

async function readWiktionnaire() {
  const rl = createInterface({
    input: createReadStream(resolve(SRC, "kaikki-fr.jsonl.gz")).pipe(createGunzip()),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.lang_code !== "fr") continue;
    if (typeof entry.word === "string") consider(entry.word, "wiktionnaire");
    if (Array.isArray(entry.forms)) {
      for (const form of entry.forms) {
        if (typeof form?.form === "string") consider(form.form, "wiktionnaire");
      }
    }
  }
}

await readGrammalecte();
await readLexique();
await readWiktionnaire();

const words = [...displays.entries()]
  .sort((left, right) => (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0))
  .map(([normalized, displayForm], index) => ({ id: `w${String(index + 1).padStart(7, "0")}`, displayForm, normalized }));

const header = {
  packId: "bombparty-fr-2026-09-26",
  packVersion: 2,
  source:
    "Grammalecte 7.7 (Olivier R., Dicollecte, MPL-2.0, https://grammalecte.net/dic/lexique-grammalecte-fr-v7.7.zip) ; Lexique 4.00 (New, Pallier, Schalchli, Bourgin et Gimenes, CC BY-SA 4.0, http://www.lexique.org/databases/Lexique400/Lexique400.tsv) ; Wiktionnaire français extrait par Kaikki le 2026-09-25 (CC BY-SA 4.0 et GFDL, https://kaikki.org/dictionary/French/). Fusion filtrée par la normalisation BombParty. Noms propres, déterminants et injures inclus lorsqu'ils passent le filtre a–z de 2 à 30 lettres. Lefff 3.4 non intégré : téléchargement Inria refusé.",
  license: "MPL-2.0 AND CC-BY-SA-4.0 AND GFDL",
  normalization: "lowercase + NFKD + accents supprimés + œ/æ développés + lettres a-z uniquement",
};

const stream = createWriteStream(OUT);
const write = (chunk) => {
  if (!stream.write(chunk)) return new Promise((resolveDrain) => stream.once("drain", resolveDrain));
  return Promise.resolve();
};
await write(
  `{"packId":${JSON.stringify(header.packId)},"packVersion":${header.packVersion},"source":${JSON.stringify(header.source)},"license":${JSON.stringify(header.license)},"normalization":${JSON.stringify(header.normalization)},"words":[`,
);
for (let index = 0; index < words.length; index += 1) {
  const entry = words[index];
  await write(`${index === 0 ? "" : ","}{"id":${JSON.stringify(entry.id)},"displayForm":${JSON.stringify(entry.displayForm)}}`);
}
await write("]}");
await new Promise((resolveClose, rejectClose) => {
  stream.end(() => resolveClose());
  stream.on("error", rejectClose);
});

const bytes = await readFile(OUT);
const checksum = createHash("sha256").update(bytes).digest("hex");
const probes = ["arbre", "le", "des", "connard", "paris", "etre", "coeur"];
const present = Object.fromEntries(probes.map((probe) => [probe, displays.has(probe)]));
console.log(JSON.stringify({ total: words.length, addedBySource, bytes: bytes.length, checksum, present }, null, 2));
