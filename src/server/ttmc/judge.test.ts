import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { judgeTtmcAnswer } from "@/server/ttmc/judge";
import type { TtmcQuestion } from "@/games/ttmc/types";

const question: TtmcQuestion = {
  itemId: "ttmc-1",
  packId: "pack-test",
  logicalKey: "ttmc-histoire-1-1",
  themeId: "histoire",
  themeLabel: "Histoire",
  themeDescription: "Dates et tournants.",
  level: 1,
  prompt: "Quelle civilisation a construit le Machu Picchu ?",
  canonical: "Les Incas",
  aliases: [],
  explanation: "Réponse de référence : Les Incas.",
};

describe("juge serveur TTMC", () => {
  it("accepte le canonique en méthode exacte sans appeler le modèle", async () => {
    const outcome = await judgeTtmcAnswer(question, "Les Incas");
    expect(outcome).toEqual({ verdict: "accept", method: "exact", reasonCode: "exact_meaning" });
  });

  it("accepte un alias normalisé (casse, accents, espaces) sans appeler le modèle", async () => {
    const withAlias: TtmcQuestion = { ...question, aliases: ["Empire inca"] };
    const outcome = await judgeTtmcAnswer(withAlias, "  empire  inca ");
    expect(outcome.verdict).toBe("accept");
    expect(outcome.method).toBe("exact");
  });

  it("rejette une réponse vide", async () => {
    const outcome = await judgeTtmcAnswer(question, "   ");
    expect(outcome.verdict).toBe("reject");
  });

  it("rend un verdict ambigu sans pénalité quand le modèle n'est pas configuré", async () => {
    const outcome = await judgeTtmcAnswer(question, "une civilisation andine");
    expect(outcome).toEqual({ verdict: "ambiguous", method: "llm", reasonCode: "ambiguous" });
  });

  it("ne devine jamais : une entité fausse reste ambigue sans modèle, sans acceptation floue", async () => {
    const outcome = await judgeTtmcAnswer(question, "Les Aztèques");
    expect(outcome.verdict).toBe("ambiguous");
  });
});
