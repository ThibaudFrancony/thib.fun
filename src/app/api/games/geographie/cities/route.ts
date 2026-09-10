import { getAuthenticatedMember } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { jsonError, jsonOk, mapServerError } from "@/server/http";
import { searchGeoCities } from "@/server/geo/content";

export async function GET(request: Request) {
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  if (!(await getAuthenticatedMember())) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour rechercher une ville.");
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const difficulty = url.searchParams.get("difficulty");
  if (query.length < 2) return jsonOk({ cities: [] });
  const parsedDifficulty = difficulty === null || ["easy", "medium", "hard"].includes(difficulty) ? difficulty : null;
  try {
    return jsonOk({ cities: await searchGeoCities(query, parsedDifficulty) });
  } catch (error) {
    return mapServerError(error);
  }
}
