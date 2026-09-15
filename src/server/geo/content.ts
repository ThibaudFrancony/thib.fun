import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { geoCitySchema, type GeoContent } from "@/games/geographie/types";
import { createAdminClient } from "@/server/supabase/admin";
import { getSupabaseServerConfig } from "@/server/config";
import {
  assertManifestChecksum,
  assertManifestCount,
  assertManifestIdentity,
  assertOptionalManifest,
  assertPackReference,
  checksumJson,
  readContentManifest,
  type ContentPackReference,
} from "@/server/content/manifest";

const LOCAL_PACK_ID = "local-geography-v1";

function checksumCities(cities: readonly z.infer<typeof geoCitySchema>[]): string {
  const ordered = [...cities].sort((left, right) =>
    left.inseeCode < right.inseeCode ? -1 : left.inseeCode > right.inseeCode ? 1 : 0,
  );
  return checksumJson(ordered);
}

const contentResponseSchema = z.object({
  packId: z.string(),
  packVersion: z.number().int().positive(),
  cities: z.array(geoCitySchema),
  manifest: z.unknown().optional(),
}).strict();

export async function loadGeoFileContent(expected?: ContentPackReference): Promise<GeoContent> {
  const root = resolve(process.cwd(), "content/geography");
  const [citiesText, mapText] = await Promise.all([
    readFile(resolve(root, "cities.json"), "utf8"),
    readFile(resolve(root, "france-departments.geojson"), "utf8"),
  ]);
  const cities = z.array(geoCitySchema).parse(JSON.parse(citiesText));
  const map = JSON.parse(mapText) as { type?: unknown; features?: unknown };
  if (map.type !== "FeatureCollection" || !Array.isArray(map.features)) throw new Error("CONTENT_MANIFEST_MISMATCH");
  const content = { packId: LOCAL_PACK_ID, packVersion: 1, cities };
  const manifest = await readContentManifest(resolve(root, "manifest.json"));
  assertManifestIdentity(manifest, { kind: "geography", slug: "france-metropole", packId: content.packId, packVersion: content.packVersion });
  assertManifestChecksum(manifest, checksumCities(content.cities));
  assertManifestCount(manifest, "cityCount", content.cities.length);
  assertManifestCount(manifest, "mapFeatureCount", map.features.length);
  if (manifest.mapChecksum !== checksumJson(map)) throw new Error("CONTENT_MANIFEST_MISMATCH");
  assertPackReference(content, expected);
  return content;
}

async function loadDatabaseContent(expected?: ContentPackReference): Promise<GeoContent> {
  const admin = createAdminClient();
  const response = await admin.rpc("server_get_geography_content", { p_difficulty: null });
  if (response.error || !response.data) throw new Error("GEOGRAPHY_CONTENT_UNAVAILABLE");
  const parsed = contentResponseSchema.parse(response.data);
  const { manifest, ...content } = parsed;
  assertOptionalManifest(manifest, { kind: "geography", slug: "france-metropole", packId: content.packId, packVersion: content.packVersion }, checksumCities(content.cities));
  assertPackReference(content, expected);
  return content;
}

export async function loadGeoContent(expected?: ContentPackReference): Promise<GeoContent> {
  const source = process.env.GEO_CONTENT_SOURCE ?? "database";
  if (source === "file" || !getSupabaseServerConfig()) {
    if (process.env.NODE_ENV === "production" && source !== "file") {
      throw new Error("SUPABASE_SERVER_CONFIGURATION_MISSING");
    }
    return loadGeoFileContent(expected);
  }
  try {
    return await loadDatabaseContent(expected);
  } catch (error) {
    if (error instanceof Error && (error.message === "CONTENT_VERSION_MISMATCH" || error.message === "CONTENT_MANIFEST_MISMATCH")) throw error;
    throw new Error("GEOGRAPHY_CONTENT_UNAVAILABLE");
  }
}

export async function searchGeoCities(query: string, difficulty: string | null): Promise<Array<{ id: string; name: string; departmentName: string }>> {
  const content = await loadGeoContent();
  const normalized = query.trim().toLocaleLowerCase("fr-FR");
  const requestedDifficulty = difficulty && ["easy", "medium", "hard"].includes(difficulty) ? difficulty : null;
  return content.cities
    .filter((city) => !requestedDifficulty || city.difficulty === requestedDifficulty)
    .filter((city) => {
      if (!normalized) return true;
      return `${city.name} ${city.departmentName} ${city.inseeCode}`.toLocaleLowerCase("fr-FR").includes(normalized);
    })
    .slice(0, 20)
    .map((city) => ({ id: city.inseeCode, name: city.name, departmentName: city.departmentName }));
}
