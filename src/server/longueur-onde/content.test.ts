import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { loadLongueurOndeContent } from "@/server/longueur-onde/content";

describe("pack À l'unisson", () => {
  beforeEach(() => {
    process.env.LONGUEUR_ONDE_CONTENT_SOURCE = "file";
  });

  it("charge 80 axes originaux et la couverture attendue", async () => {
    const content = await loadLongueurOndeContent();
    expect(content.axes).toHaveLength(80);
    expect(new Set(content.axes.map((axis) => axis.logicalKey)).size).toBe(80);
    expect(content.axes.filter((axis) => axis.category === "quotidien")).toHaveLength(30);
    expect(content.axes.filter((axis) => axis.category === "culture")).toHaveLength(25);
    expect(content.axes.filter((axis) => axis.category === "absurde")).toHaveLength(25);
    expect(content.axes.every((axis) => axis.leftLabel.length <= 60 && axis.rightLabel.length <= 60)).toBe(true);
  });

  it("refuse une version locale différente sans supprimer le loader historique", async () => {
    await expect(loadLongueurOndeContent({ packId: "old-longueur-v0", packVersion: 0 })).rejects.toThrow("CONTENT_VERSION_MISMATCH");
  });
});
