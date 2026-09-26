import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { normalizeBombpartyWord } from "@/games/bombparty/normalize";
import type { BombpartyContent, BombpartyWordEntry } from "@/games/bombparty/types";
import { createAdminClient } from "@/server/supabase/admin";

const EXPECTED_PACK_ID = "bombparty-fr-2026-09-26";
const EXPECTED_LICENSE = "MPL-2.0 AND CC-BY-SA-4.0 AND GFDL";
// Pack strictement partagé : toute dérive du fichier doit échouer au chargement.
const EXPECTED_CHECKSUM = "933cd7342ba35bdb70d25812e68bfb8bc9429badbe0709b51fe61c1fc1d82afb";

const filePackSchema = z.object({
  packId: z.string(),
  packVersion: z.number().int().positive().optional(),
  source: z.string().optional(),
  license: z.string(),
  normalization: z.string().optional(),
  words: z.array(z.object({ id: z.string().min(1), displayForm: z.string().min(1) })),
});

let cached: BombpartyContent | null = null;

function buildIndex(entries: BombpartyWordEntry[]): Record<string, string[]> {
  const index = new Map<string, string[]>();
  for (const entry of entries) {
    const form = entry.normalizedForm;
    const seen = new Set<string>();
    for (let length = 2; length <= 3; length += 1) {
      for (let start = 0; start + length <= form.length; start += 1) {
        const sequence = form.slice(start, start + length);
        if (seen.has(sequence)) continue;
        seen.add(sequence);
        const list = index.get(sequence);
        if (list) list.push(entry.id);
        else index.set(sequence, [entry.id]);
      }
    }
  }
  const record: Record<string, string[]> = {};
  for (const sequence of [...index.keys()].sort()) {
    record[sequence] = (index.get(sequence) ?? []).sort();
  }
  return record;
}

/**
 * Charge le pack lexical partagé depuis content/bombparty/lexicon.json.
 * Le chargeur ne fabrique aucun mot : il valide la normalisation stricte
 * et déduplique sur la forme normalisée (deux variantes = un seul mot utilisé).
 */
export async function loadBombpartyContent(): Promise<BombpartyContent> {
  if (cached) return cached;
  const path = resolve(process.cwd(), "content/bombparty/lexicon.json");
  const bytes = await readFile(path);
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const parsed = filePackSchema.parse(JSON.parse(bytes.toString("utf8")));
  if (parsed.packId !== EXPECTED_PACK_ID) throw new Error("BOMBPARTY_CONTENT_MISMATCH");
  if (parsed.license !== EXPECTED_LICENSE) throw new Error("BOMBPARTY_CONTENT_MISMATCH");
  if (checksum !== EXPECTED_CHECKSUM) throw new Error("BOMBPARTY_CONTENT_MISMATCH");
  const entries: BombpartyWordEntry[] = [];
  const seen = new Set<string>();
  for (const item of parsed.words) {
    const normalizedForm = normalizeBombpartyWord(item.displayForm);
    if (normalizedForm === null) continue;
    if (seen.has(normalizedForm)) continue;
    seen.add(normalizedForm);
    entries.push({ id: item.id, displayForm: item.displayForm, normalizedForm });
  }
  if (entries.length === 0) throw new Error("BOMBPARTY_CONTENT_UNAVAILABLE");
  cached = {
    packId: parsed.packId,
    packChecksum: checksum,
    words: entries,
    bySequence: buildIndex(entries),
  };
  return cached;
}

/** Réservé aux tests : vide le cache immuable du processus. */
export function clearBombpartyContentCache(): void {
  cached = null;
}

export function bombpartyContentManifest(content: BombpartyContent): Record<string, unknown> {
  return { packId: content.packId, packChecksum: content.packChecksum, words: content.words.length };
}

/**
 * Garde d'entraînement : refuse les routes d'aide pendant une partie
 * BombParty active du même compte (fonction serveur `server_has_active_match`).
 */
export async function hasActiveBombpartyMatch(actorId: string): Promise<boolean> {
  let response: { error: unknown; data: unknown };
  try {
    response = await createAdminClient().rpc("server_has_active_match", { p_actor: actorId, p_slug: "bombparty" });
  } catch {
    throw new Error("TRAINING_UNAVAILABLE");
  }
  if (response.error || !response.data) throw new Error("TRAINING_UNAVAILABLE");
  const parsed = z.object({ active: z.boolean() }).safeParse(response.data);
  if (!parsed.success) throw new Error("TRAINING_UNAVAILABLE");
  return parsed.data.active;
}
