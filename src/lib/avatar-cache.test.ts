import { describe, expect, it } from "vitest";
import { avatarUrlCacheKey } from "./avatar-cache";

describe("avatarUrlCacheKey", () => {
  it("extrait le chemin stable d'une URL signée Supabase", () => {
    const url =
      "https://demo.supabase.co/storage/v1/object/sign/avatars/5f0f9c2e-1111-2222-3333-444455556666/abc.webp?token=eyJhbGciOi";
    expect(avatarUrlCacheKey(url)).toBe("avatars/5f0f9c2e-1111-2222-3333-444455556666/abc.webp");
  });

  it("change de clé quand le fichier change (nouvelle photo)", () => {
    const first = "https://demo.supabase.co/storage/v1/object/sign/avatars/user/a.webp?token=x";
    const second = "https://demo.supabase.co/storage/v1/object/sign/avatars/user/b.webp?token=x";
    expect(avatarUrlCacheKey(first)).not.toBe(avatarUrlCacheKey(second));
  });

  it("ignore les URL étrangères au bucket avatars", () => {
    expect(avatarUrlCacheKey("https://demo.supabase.co/storage/v1/object/sign/chat/1/a.webp?token=x")).toBeNull();
    expect(avatarUrlCacheKey("https://example.com/photo.png")).toBeNull();
  });

  it("ignore les URL locales et vides", () => {
    expect(avatarUrlCacheKey(null)).toBeNull();
    expect(avatarUrlCacheKey(undefined)).toBeNull();
    expect(avatarUrlCacheKey("")).toBeNull();
    expect(avatarUrlCacheKey("data:image/webp;base64,AAAA")).toBeNull();
    expect(avatarUrlCacheKey("blob:http://localhost/1234")).toBeNull();
  });
});
