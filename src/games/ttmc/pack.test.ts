import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { initializeTtmc } from "@/games/ttmc/engine";
import { ttmcQuestionSchema, type TtmcContent } from "@/games/ttmc/types";

const packSchema = z.object({
  packId: z.string(),
  packVersion: z.number().int().positive(),
  themes: z.array(z.object({ themeId: z.string(), label: z.string(), shortDescription: z.string() })),
  questions: z.array(ttmcQuestionSchema),
});

function loadPack(): TtmcContent {
  const text = readFileSync(resolve(process.cwd(), "content/quiz/dist/ttmc.json"), "utf8");
  const parsed = packSchema.parse(JSON.parse(text));
  return { packId: parsed.packId, packVersion: parsed.packVersion, themes: parsed.themes, questions: parsed.questions };
}

const entropy = Array.from({ length: 2048 }, (_, index) => ((index * 53 + 7) % 997) / 997);
const participants = ["alice", "bob"] as const;

describe("pack TTMC réel (assets fournis, non remplacé)", () => {
  it("contient 22 thèmes et 440 questions, 2 par niveau 1..10", () => {
    const content = loadPack();
    expect(content.themes).toHaveLength(22);
    expect(content.questions).toHaveLength(440);
    for (const theme of content.themes) {
      for (let level = 1; level <= 10; level += 1) {
        const count = content.questions.filter((item) => item.themeId === theme.themeId && item.level === level).length;
        expect(count).toBe(2);
      }
    }
    const keys = content.questions.map((item) => item.logicalKey);
    expect(new Set(keys).size).toBe(keys.length);
    const ids = content.questions.map((item) => item.itemId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("démarre en 30/20 et 20/15, refuse 50/30 sans 32 thèmes", () => {
    const content = loadPack();
    const base = {
      nowMs: Date.parse("2026-09-11T12:00:00.000Z"),
      actorId: "alice",
      matchId: "match-pack",
      participants,
      content,
      entropy,
      phaseId: "p0",
      nextPhaseId: "p0",
    };
    const classic = initializeTtmc({ targetScore: 30, maxRounds: 20, answerSeconds: 60, themeSelectionSeconds: 20 }, base);
    expect(classic.state.themes).toHaveLength(20);
    const rapide = initializeTtmc({ targetScore: 20, maxRounds: 15, answerSeconds: 60, themeSelectionSeconds: 20 }, base);
    expect(rapide.state.themes).toHaveLength(15);
    expect(() =>
      initializeTtmc({ targetScore: 50, maxRounds: 30, answerSeconds: 60, themeSelectionSeconds: 20 }, base),
    ).toThrow("CONTENT_UNAVAILABLE");
  });

  it("alloue des questions distinctes par siège pour un même niveau", () => {
    const content = loadPack();
    const started = initializeTtmc(
      { targetScore: 30, maxRounds: 20, answerSeconds: 60, themeSelectionSeconds: 20 },
      {
        nowMs: Date.parse("2026-09-11T12:00:00.000Z"),
        actorId: "alice",
        matchId: "match-seats",
        participants,
        content,
        entropy,
        phaseId: "p0",
        nextPhaseId: "p0",
      },
    );
    for (const theme of started.state.themes) {
      for (let level = 1; level <= 10; level += 1) {
        const pair = theme.byLevel[String(level)]!;
        expect(pair[0].itemId).not.toBe(pair[1].itemId);
      }
    }
  });
});
