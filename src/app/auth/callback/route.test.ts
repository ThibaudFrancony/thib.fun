import { describe, expect, it, vi } from "vitest";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: { exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }) } })),
}));
vi.mock("@/server/config", () => ({ getSupabaseServerConfig: () => ({ url: "https://supabase.example", anonKey: "anon" }) }));

import { NextRequest } from "next/server";
import { GET } from "@/app/auth/callback/route";

describe("callback d'authentification", () => {
  it("autorise seulement les chemins internes après décodage complet", async () => {
    const allowed = await GET(new NextRequest("https://jeu.example/auth/callback?code=ok&next=/parties/123?from=auth"));
    expect(allowed.headers.get("location")).toBe("https://jeu.example/parties/123?from=auth");
    for (const value of [
      "https://evil.example/",
      "//evil.example/",
      "/\\evil.example/",
      "/%5Cevil.example/",
      "/%2f%2fevil.example/",
      "/%252f%252fevil.example/",
      "/profil%00",
      "/profil%0D%0A",
      "/profil%ZZ",
      "/connexion",
    ]) {
      const response = await GET(new NextRequest(`https://jeu.example/auth/callback?code=ok&next=${encodeURIComponent(value)}`));
      expect(response.headers.get("location")).toBe("https://jeu.example/");
    }
  });

  it("marque aussi les redirections d'erreur comme privées et non stockables", async () => {
    const response = await GET(new NextRequest("https://jeu.example/auth/callback?next=//evil.example"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://jeu.example/connexion?error=confirmation");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("vary")).toBe("Cookie");
  });
});
