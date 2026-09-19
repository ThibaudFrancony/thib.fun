import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { safeNextForOrigin } from "@/components/auth-form";

function readAuthForm(): string {
  return readFileSync(resolve(process.cwd(), "src/components/auth-form.tsx"), "utf8");
}

describe("auth-form navigation post-authentification", () => {
  it("utilise une navigation complète du navigateur après succès, sans router RSC", () => {
    const source = readAuthForm();
    expect(source).toContain('window.location.href = safeNext(searchParams.get("next"))');
    expect(source).not.toContain('window.location.href = "/profil"');
    expect(source).not.toContain("router.push");
    expect(source).not.toContain("router.refresh");
    expect(source).not.toContain("useRouter");
  });

  it("refuse les redirections externes, les antislashs, l'encodage dangereux et les contrôles", () => {
    const source = readAuthForm();
    expect(source).toContain("function safeNext(value: string | null): string");
    const origin = "https://jeu.example";
    expect(safeNextForOrigin("/profil", origin)).toBe("/profil");
    expect(safeNextForOrigin("/salons/ABC?from=auth", origin)).toBe("/salons/ABC?from=auth");
    for (const value of [
      "https://evil.example/",
      "//evil.example/",
      "/\\evil.example/",
      "/%5Cevil.example/",
      "/%2f%2fevil.example/",
      "/%252f%252fevil.example/",
      "/profil%00",
      "/profil%0A",
      "/profil%ZZ",
      "/connexion",
    ]) {
      expect(safeNextForOrigin(value, origin)).toBe("/");
    }
  });

  it("attend l'hydratation avant d'autoriser les actions d'authentification", () => {
    const source = readAuthForm();
    expect(source).toContain("useSyncExternalStore");
    expect(source).toContain("data-auth-hydrated={hydrated}");
    expect(source).toContain("disabled={busy || !hydrated}");
  });
});
