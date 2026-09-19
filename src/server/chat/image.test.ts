import { afterEach, describe, expect, it, vi } from "vitest";

const imageOptimizerTools = vi.fn();

vi.mock("server-only", () => ({}));

vi.mock("@/server/images/optimizer", () => ({
  ALLOWED_IMAGE_CONTENT_TYPES: new Set(["image/jpeg", "image/png", "image/webp"]),
  imageOptimizerTools: () => imageOptimizerTools(),
}));

import { optimizeChatImage } from "@/server/chat/image";

afterEach(() => {
  imageOptimizerTools.mockReset();
  vi.restoreAllMocks();
});

describe("optimizeChatImage", () => {
  it("distingue un outil de décodage indisponible d'une image invalide", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    imageOptimizerTools.mockImplementation(() => {
      throw new Error("Cannot find module 'sharp'");
    });
    await expect(optimizeChatImage(Buffer.from("x"))).rejects.toThrow("IMAGE_UNAVAILABLE");
  });

  it("refuse un type de contenu non autorisé", async () => {
    imageOptimizerTools.mockImplementation(() => ({
      detectContentType: async () => "application/pdf",
      getSharp: () => undefined,
    }));
    await expect(optimizeChatImage(Buffer.from("x"))).rejects.toThrow("IMAGE_INVALID");
  });
});
