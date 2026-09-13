import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const allowedStatuses = new Set(["pass", "fail", "blocked", "not-run"]);
const file = resolve(process.cwd(), "tests/coverage-matrix.json");
const matrix = JSON.parse(await readFile(file, "utf8"));

if (!matrix || matrix.version !== 1 || !Array.isArray(matrix.entries) || matrix.entries.length === 0) {
  throw new Error("La matrice de couverture doit contenir version=1 et au moins une entrée.");
}

const ids = new Set();
for (const entry of matrix.entries) {
  if (!entry || typeof entry.id !== "string" || ids.has(entry.id)) throw new Error("Chaque entrée de couverture doit avoir un id unique.");
  ids.add(entry.id);
  if (typeof entry.label !== "string" || !allowedStatuses.has(entry.status)) throw new Error(`Entrée de couverture invalide: ${entry.id}`);
  if (entry.status === "blocked" && (typeof entry.reason !== "string" || entry.reason.trim().length === 0)) {
    throw new Error(`Une entrée bloquée doit expliquer sa cause: ${entry.id}`);
  }
}

const counts = Object.fromEntries([...allowedStatuses].map((status) => [status, matrix.entries.filter((entry) => entry.status === status).length]));
console.log(`Matrice de couverture valide (${matrix.entries.length} parcours) : ${counts.pass} pass, ${counts.fail} fail, ${counts.blocked} blocked, ${counts["not-run"]} not-run.`);
