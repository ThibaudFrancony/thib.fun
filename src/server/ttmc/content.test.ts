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

import { ttmcQuestionSchema } from "@/games/ttmc/types";
import { loadTtmcContent } from "@/server/ttmc/content";

const flatQuestion = {
  itemId: "11111111-1111-4111-8111-111111111111",
  packId: "22222222-2222-4222-8222-222222222222",
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

describe("loader TTMC", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    process.env.QUIZ_CONTENT_SOURCE = "database";
  });

  it("interroge la RPC serveur et retourne une réponse plate conforme", async () => {
    rpcMock.mockResolvedValue({
      error: null,
      data: {
        packId: flatQuestion.packId,
        packVersion: 1,
        themes: [{ themeId: "histoire", label: "Histoire", shortDescription: "Dates et tournants." }],
        questions: [flatQuestion],
      },
    });
    const content = await loadTtmcContent();
    expect(rpcMock).toHaveBeenCalledWith("server_get_ttmc_content");
    expect(fromMock).not.toHaveBeenCalled();
    expect(content.questions).toHaveLength(1);
    expect(() => ttmcQuestionSchema.parse(content.questions[0])).not.toThrow();
  });

  it("signale un contenu indisponible sans interroger les tables privées", async () => {
    rpcMock.mockResolvedValue({ error: new Error("denied"), data: null });
    await expect(loadTtmcContent()).rejects.toThrow("QUIZ_CONTENT_UNAVAILABLE");
    expect(fromMock).not.toHaveBeenCalled();
  });
});
