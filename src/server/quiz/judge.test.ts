import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { judgeTrouNoirAnswer } from "@/server/quiz/judge";
import type { QuizQuestion } from "@/games/trou-noir/types";

const question: QuizQuestion = {
  itemId: "tn1-0001",
  packId: "trou-noir-v1",
  logicalKey: "culture-livre-miserables",
  category: "culture",
  themeLabel: "Littérature",
  difficulty: 3,
  prompt: "Qui est l'auteur du roman « Les Misérables », publié en 1862 ?",
  canonical: "Victor Hugo",
  aliases: [],
  answerType: "person",
  requiredPrecision: "Le nom de l'auteur suffit.",
  allowSurnameOnly: true,
  allowDescription: false,
  numericTolerance: 0,
  explanation: "« Les Misérables » est un roman de Victor Hugo paru en 1862.",
};

describe("juge serveur Trou Noir", () => {
  it("accepte le canonique en méthode exacte sans appeler le modèle", async () => {
    const outcome = await judgeTrouNoirAnswer(question, "Victor Hugo");
    expect(outcome).toEqual({ verdict: "accept", method: "exact", reasonCode: "exact_meaning" });
  });

  it("rejette une réponse vide", async () => {
    const outcome = await judgeTrouNoirAnswer(question, "   ");
    expect(outcome.verdict).toBe("reject");
  });

  it("rend un verdict ambigu sans pénalité quand le modèle n'est pas configuré", async () => {
    const outcome = await judgeTrouNoirAnswer(question, "un écrivain français du XIXe siècle");
    expect(outcome).toEqual({ verdict: "ambiguous", method: "llm", reasonCode: "ambiguous" });
  });
});
