import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/server/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: rpcMock, from: fromMock }),
}));

vi.mock("@/server/config", () => ({
  getSupabaseServerConfig: () => ({ url: "http://localhost", anonKey: "anon", serviceRoleKey: "service" }),
}));

import { quizQuestionSchema } from "@/games/trou-noir/types";
import { loadTrouNoirContent } from "@/server/quiz/content";

const flatQuestion = {
  itemId: "11111111-1111-4111-8111-111111111111",
  packId: "22222222-2222-4222-8222-222222222222",
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

describe("loader quiz Trou Noir", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    process.env.QUIZ_CONTENT_SOURCE = "database";
  });

  it("interroge la RPC serveur et retourne une réponse plate conforme à quizQuestionSchema", async () => {
    rpcMock.mockResolvedValue({
      error: null,
      data: { packId: flatQuestion.packId, packVersion: 1, questions: [flatQuestion] },
    });
    const content = await loadTrouNoirContent();
    expect(rpcMock).toHaveBeenCalledWith("server_get_quiz_content");
    expect(fromMock).not.toHaveBeenCalled();
    expect(content.packId).toBe(flatQuestion.packId);
    expect(content.questions).toHaveLength(1);
    // Chaque question runtime doit valider exactement quizQuestionSchema.
    expect(() => quizQuestionSchema.parse(content.questions[0])).not.toThrow();
    expect(content.questions[0]).toEqual(flatQuestion);
  });

  it("convertit numericValue null en champ absent sans casser le schéma", async () => {
    rpcMock.mockResolvedValue({
      error: null,
      data: {
        packId: flatQuestion.packId,
        packVersion: 1,
        questions: [{ ...flatQuestion, numericValue: null }],
      },
    });
    const content = await loadTrouNoirContent();
    expect(content.questions[0]?.numericValue).toBeUndefined();
    expect(() => quizQuestionSchema.parse(content.questions[0])).not.toThrow();
  });

  it("signale un contenu indisponible sans interroger les tables privées", async () => {
    rpcMock.mockResolvedValue({ error: new Error("denied"), data: null });
    await expect(loadTrouNoirContent()).rejects.toThrow("QUIZ_CONTENT_UNAVAILABLE");
    expect(fromMock).not.toHaveBeenCalled();
  });
});
