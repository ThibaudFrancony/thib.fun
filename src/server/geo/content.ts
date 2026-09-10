import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { geoCitySchema, type GeoContent } from "@/games/geographie/types";
import { createAdminClient } from "@/server/supabase/admin";
import { getSupabaseServerConfig } from "@/server/config";

const contentResponseSchema = z.object({
  packId: z.string(),
  packVersion: z.number().int().positive(),
  cities: z.array(geoCitySchema),
});

const fileManifestSchema = z.object({ version: z.number().int().positive() });

async function loadFileContent(): Promise<GeoContent> {
  const root = resolve(process.cwd(), "content/geography");
  const [citiesText, manifestText] = await Promise.all([
    readFile(resolve(root, "cities.json"), "utf8"),
    readFile(resolve(root, "manifest.json"), "utf8"),
  ]);
  const cities = z.array(geoCitySchema).parse(JSON.parse(citiesText));
  const manifest = fileManifestSchema.parse(JSON.parse(manifestText));
  return { packId: "local-geography-v1", packVersion: manifest.version, cities };
}

export async function loadGeoContent(): Promise<GeoContent> {
  const source = process.env.GEO_CONTENT_SOURCE ?? "database";
  if (source === "file" || !getSupabaseServerConfig()) {
    if (process.env.NODE_ENV === "production" && source !== "file") {
      throw new Error("SUPABASE_SERVER_CONFIGURATION_MISSING");
    }
    return loadFileContent();
  }
  const admin = createAdminClient();
  const response = await admin.rpc("server_get_geography_content", { p_difficulty: null });
  if (response.error || !response.data) throw new Error("GEOGRAPHY_CONTENT_UNAVAILABLE");
  return contentResponseSchema.parse(response.data);
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
