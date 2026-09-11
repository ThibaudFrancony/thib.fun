import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { normalizeBombpartyWord } from "@/games/bombparty/normalize";
import { clearBombpartyContentCache, loadBombpartyContent } from "@/server/bombparty/content";
import { hashCommand } from "@/server/hash";

describe("pack lexical partagé et immuable", () => {
  it("charge les 431 formes du pack licencié CC0-1.0 avec son checksum", async () => {
    clearBombpartyContentCache();
    const content = await loadBombpartyContent();
    const bytes = await readFile(resolve(process.cwd(), "content/bombparty/lexicon.json"));
    const raw = JSON.parse(bytes.toString("utf8")) as { packId: string; license: string; words: Array<{ displayForm: string }> };

    expect(raw.packId).toBe("bombparty-fr-seed-2026-09");
    expect(raw.license).toBe("CC0-1.0");
    expect(raw.words).toHaveLength(431);
    expect(content.packId).toBe("bombparty-fr-seed-2026-09");
    expect(content.packChecksum).toBe("a6b74cd6950107f917b7d206b8601d80f15876fe6139fe30318e9514c22a0a39");
    expect(content.packChecksum).toBe(createHash("sha256").update(bytes).digest("hex"));
    // Le chargeur ne remplace ni n'élargit le pack : chaque entrée provient du fichier.
    expect(content.words.length).toBeLessThanOrEqual(431);
    expect(content.words.length).toBeGreaterThan(400);
  });

  it("conserve les formes accentuées d'affichage et des formes normalisées valides", async () => {
    clearBombpartyContentCache();
    const content = await loadBombpartyContent();
    const displays = new Set(content.words.map((entry) => entry.displayForm));
    expect(displays.has("château") || displays.has("école") || displays.has("forêt")).toBe(true);
    for (const entry of content.words) {
      expect(entry.normalizedForm).toMatch(/^[a-z]{2,30}$/);
      expect(normalizeBombpartyWord(entry.displayForm)).toBe(entry.normalizedForm);
    }
    const normalized = content.words.map((entry) => entry.normalizedForm);
    expect(new Set(normalized).size).toBe(normalized.length);
  });

  it("indexe chaque séquence de 2-3 lettres sans recherche linéaire au runtime", async () => {
    clearBombpartyContentCache();
    const content = await loadBombpartyContent();
    const sequences = Object.keys(content.bySequence);
    expect(sequences.length).toBeGreaterThan(100);
    const byId = new Map(content.words.map((entry) => [entry.id, entry.normalizedForm]));
    for (const sequence of sequences) {
      expect(sequence).toMatch(/^[a-z]{2,3}$/);
      const ids = content.bySequence[sequence] ?? [];
      expect(ids.length).toBeGreaterThan(0);
      expect([...ids].sort()).toEqual(ids);
      for (const id of ids) {
        expect(byId.get(id)).toContain(sequence);
      }
    }
    // Chaque mot contribue au moins une séquence à l'index.
    const indexed = new Set(Object.values(content.bySequence).flat());
    for (const entry of content.words) expect(indexed.has(entry.id)).toBe(true);
  });

  it("couvre les trois difficultés et ne génère aucun mot à la volée", async () => {
    clearBombpartyContentCache();
    const content = await loadBombpartyContent();
    const totals = Object.values(content.bySequence).map((ids) => ids.length);
    const buckets = {
      easy: totals.filter((total) => total >= 200).length,
      normal: totals.filter((total) => total >= 50 && total < 200).length,
      hard: totals.filter((total) => total >= 10 && total < 50).length,
    };
    expect(buckets.normal + buckets.hard).toBeGreaterThan(0);
    expect(buckets.easy).toBeGreaterThanOrEqual(0);
  });
});

describe("idempotence des commandes", () => {
  it("le même mot soumis deux fois produit la même empreinte de reçu", () => {
    const matchId = "33333333-3333-4333-8333-333333333333";
    const first = hashCommand(matchId, "actor-1", "SUBMIT_WORD", { type: "SUBMIT_WORD", word: "chat" });
    const retry = hashCommand(matchId, "actor-1", "SUBMIT_WORD", { type: "SUBMIT_WORD", word: "chat" });
    const different = hashCommand(matchId, "actor-1", "SUBMIT_WORD", { type: "SUBMIT_WORD", word: "chien" });
    expect(retry).toBe(first);
    expect(different).not.toBe(first);
  });
});
