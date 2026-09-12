import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readAuthForm(): string {
  return readFileSync(resolve(process.cwd(), "src/components/auth-form.tsx"), "utf8");
}

describe("auth-form navigation post-authentification", () => {
  it("utilise une navigation complète du navigateur après succès, sans router RSC", () => {
    const source = readAuthForm();
    expect(source).toContain('window.location.href = "/profil"');
    expect(source).toContain('window.location.href = safeNext(searchParams.get("next"))');
    expect(source).not.toContain("router.push");
    expect(source).not.toContain("router.refresh");
    expect(source).not.toContain("useRouter");
  });

  it("conserve le garde safeNext pour le flux invité", () => {
    const source = readAuthForm();
    expect(source).toContain("function safeNext(value: string | null): string");
    expect(source).toContain('!value.startsWith("//")');
  });
});
