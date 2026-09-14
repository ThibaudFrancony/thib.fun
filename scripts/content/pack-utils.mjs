import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));

export function checksumJson(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function checksumBytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
