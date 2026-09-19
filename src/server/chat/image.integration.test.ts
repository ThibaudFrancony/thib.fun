import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));
import { optimizeChatImage } from "@/server/chat/image";

describe("réencodage réel des photos de chat", () => {
  it.each(["png", "jpeg", "webp"] as const)("accepte %s et produit un WebP borné", async (format) => {
    const input = await sharp({ create: { width: 1800, height: 900, channels: 3, background: "#7955c8" } })
      .toFormat(format).toBuffer();
    const result = await optimizeChatImage(input);
    const metadata = await sharp(result.data).metadata();
    expect(metadata.format).toBe("webp");
    expect([result.width, result.height]).toEqual([1280, 640]);
    expect(result.bytes).toBeLessThanOrEqual(400 * 1024);
  });

  it("refuse des octets corrompus malgré une signature PNG", async () => {
    const input = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(optimizeChatImage(input)).rejects.toThrow("IMAGE_INVALID");
    vi.restoreAllMocks();
  });

  it("refuse un SVG et une image dépassant les dimensions autorisées", async () => {
    await expect(optimizeChatImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).rejects.toThrow("IMAGE_INVALID");
    const input = await sharp({ create: { width: 4097, height: 1, channels: 3, background: "red" } }).png().toBuffer();
    await expect(optimizeChatImage(input)).rejects.toThrow("IMAGE_INVALID");
  });
});
