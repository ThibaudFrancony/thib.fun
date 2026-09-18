import { getSupabaseServerConfig } from "@/server/config";
import { jsonError, jsonOk } from "@/server/http";
import { getActiveLobbyForViewer } from "@/server/lobbies";

export async function GET() {
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  try {
    return jsonOk({ lobby: await getActiveLobbyForViewer() });
  } catch (error) {
    return jsonError("DATABASE_UNAVAILABLE", 503, error instanceof Error ? error.message : "Salon indisponible.");
  }
}
