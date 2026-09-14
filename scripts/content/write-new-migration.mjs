import { access, writeFile } from "node:fs/promises";

/**
 * Une migration existante est considérée comme immuable : son application
 * distante est indépendante de la présence du fichier dans ce clone.
 */
export async function writeNewMigration(path, sql) {
  try {
    await access(path);
    throw new Error(`Refus d'écraser une migration existante : ${path}`);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code !== "ENOENT") throw error;
    if (error instanceof Error && error.message.startsWith("Refus d'écraser")) throw error;
  }

  try {
    await writeFile(path, sql, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error(`Refus d'écraser une migration existante : ${path}`);
    }
    throw error;
  }
}
