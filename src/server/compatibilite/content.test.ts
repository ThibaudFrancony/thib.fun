import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { loadCompatibiliteContent } from "@/server/compatibilite/content";

describe("pack Compatibilité", () => {
  it("charge le pack local original avec 40 questions par catégorie", async () => {
    const content = await loadCompatibiliteContent();
    expect(content.questions).toHaveLength(160);
    expect(new Set(content.questions.map((question) => question.logicalKey)).size).toBe(160);
    for (const category of ["quotidien", "absurde", "amitie", "couple"]) {
      expect(content.questions.filter((question) => question.category === category)).toHaveLength(40);
    }
    expect(content.questions.every((question) => question.options.length >= 2 && question.options.length <= 4)).toBe(true);
  });
});
