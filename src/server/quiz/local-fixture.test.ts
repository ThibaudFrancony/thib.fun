import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createLocalQuizFixtureFetch } from "@/server/quiz/local-fixture";

describe("transport IA de recette locale", () => {
  it.each(["accept", "reject", "ambiguous"] as const)("retourne un verdict %s sans appel réseau", async (verdict) => {
    const response = await createLocalQuizFixtureFetch(verdict)("https://api.deepseek.com/chat/completions");
    const payload = await response.json() as { choices: Array<{ message: { content: string } }> };
    expect(response.status).toBe(200);
    expect(JSON.parse(payload.choices[0].message.content)).toMatchObject({ verdict });
  });
});
