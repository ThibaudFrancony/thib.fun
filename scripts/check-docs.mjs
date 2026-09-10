import { access, readdir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const docsRoot = resolve(root, "docs");
const files = [];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (entry.name.endsWith(".md")) files.push(path);
  }
}

await collect(docsRoot);
files.push(resolve(root, "README.md"), resolve(root, "AGENTS.md"));
const errors = [];
for (const file of files) {
  const text = await readFile(file, "utf8");
  if (/\b(?:TODO|TBD)\b/i.test(text)) errors.push(`${file}: placeholder TODO/TBD`);
  const fences = text.split("\n").filter((line) => line.trimStart().startsWith("```")).length;
  if (fences % 2 !== 0) errors.push(`${file}: blocs de code Markdown déséquilibrés`);
  const links = [...text.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]);
  for (const link of links) {
    if (/^(?:https?:|mailto:|#|codex:)/.test(link)) continue;
    const target = link.split("#", 1)[0];
    if (!target) continue;
    const path = target.startsWith("/") ? resolve(root, `.${target}`) : resolve(dirname(file), target);
    try {
      await access(path, constants.F_OK);
    } catch {
      errors.push(`${file}: lien introuvable ${link}`);
    }
  }
}
if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Documentation valide: ${files.length} fichiers Markdown contrôlés.`);
}
