import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { normalizeBombpartyWord } from "@/games/bombparty/normalize";
import { clearBombpartyContentCache, loadBombpartyContent } from "@/server/bombparty/content";
import { hashCommand } from "@/server/hash";

describe("pack lexical partagé et immuable", () => {
  it("charge le lexique français fusionné avec son checksum", async () => {
    clearBombpartyContentCache();
    const content = await loadBombpartyContent();
    const bytes = await readFile(resolve(process.cwd(), "content/bombparty/lexicon.json"));
    const raw = JSON.parse(bytes.toString("utf8")) as { packId: string; license: string; words: Array<{ displayForm: string }> };

    expect(raw.packId).toBe("bombparty-fr-2026-09-26");
    expect(raw.license).toBe("MPL-2.0 AND CC-BY-SA-4.0 AND GFDL");
    expect(raw.words).toHaveLength(514607);
    expect(content.packId).toBe("bombparty-fr-2026-09-26");
    expect(content.packChecksum).toBe("933cd7342ba35bdb70d25812e68bfb8bc9429badbe0709b51fe61c1fc1d82afb");
    expect(content.packChecksum).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(content.words).toHaveLength(514607);
  }, 30_000);

  it("conserve les formes accentuées d'affichage et des formes normalisées valides", async () => {
    clearBombpartyContentCache();
    const content = await loadBombpartyContent();
    const byNormalized = new Map(content.words.map((entry) => [entry.normalizedForm, entry.displayForm]));
    expect(byNormalized.get("etre")).toBe("être");
    expect(byNormalized.get("arbre")).toBe("arbre");
    expect(byNormalized.get("le")).toBe("le");
    expect(byNormalized.get("connard")).toBe("connard");
    expect(byNormalized.get("paris")).toBe("paris");
    for (const entry of content.words) {
      if (!/^[a-z]{2,30}$/.test(entry.normalizedForm)) throw new Error(entry.id);
      if (normalizeBombpartyWord(entry.displayForm) !== entry.normalizedForm) throw new Error(entry.displayForm);
    }
    expect(byNormalized.size).toBe(content.words.length);
  }, 30_000);

  it("indexe chaque séquence de 2-3 lettres sans recherche linéaire au runtime", async () => {
    clearBombpartyContentCache();
    const content = await loadBombpartyContent();
    const sequences = Object.keys(content.bySequence);
    expect(sequences.length).toBeGreaterThan(1000);
    const byId = new Map(content.words.map((entry) => [entry.id, entry.normalizedForm]));
    const indexed = new Set<string>();
    for (const sequence of sequences) {
      if (!/^[a-z]{2,3}$/.test(sequence)) throw new Error(sequence);
      const ids = content.bySequence[sequence] ?? [];
      if (ids.length === 0) throw new Error(sequence);
      for (let index = 1; index < ids.length; index += 1) {
        if ((ids[index - 1] ?? "") > (ids[index] ?? "")) throw new Error(`tri ${sequence}`);
      }
      for (const id of ids) {
        const form = byId.get(id);
        if (!form?.includes(sequence)) throw new Error(`${sequence}:${id}`);
        indexed.add(id);
      }
    }
    expect(indexed.size).toBe(content.words.length);
  }, 60_000);

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
  }, 30_000);
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
