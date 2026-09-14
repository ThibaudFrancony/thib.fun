import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/server/config", () => ({ getSupabaseServerConfig: () => ({ url: "http://localhost", anonKey: "anon", serviceRoleKey: "service" }) }));

import { loadGeoContent, loadGeoFileContent } from "@/server/geo/content";

describe("loader du pack Géographie", () => {
  beforeEach(() => {
    process.env.GEO_CONTENT_SOURCE = "file";
  });

  it("valide la version, la provenance et les checksums ville/carte", async () => {
    const content = await loadGeoContent({ packId: "local-geography-v1", packVersion: 1 });
    expect(content.packId).toBe("local-geography-v1");
    expect(content.packVersion).toBe(1);
    expect(content.cities).toHaveLength(380);
  });

  it("refuse une référence de contenu différente sans remplacer le loader historique", async () => {
    await expect(loadGeoFileContent({ packId: "old-geography-v0", packVersion: 0 })).rejects.toThrow("CONTENT_VERSION_MISMATCH");
  });
});
