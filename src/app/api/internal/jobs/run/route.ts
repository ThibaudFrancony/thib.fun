import { getSupabaseServerConfig } from "@/server/config";
import { jsonError, jsonOk } from "@/server/http";
import { readWorkerBody } from "@/server/jobs/body";
import { hasValidWorkerSecret, processWorkerJob, workerRequestSchema } from "@/server/jobs/worker";

// Le bail SQL dure 30 s et pg_net attend 25 s : les 4 jobs d'un lot
// (jusqu'à ~12 s de correction quiz chacun) doivent tenir dans la fonction.
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  if (!hasValidWorkerSecret(request.headers.get("x-internal-job-secret"))) return jsonError("UNAUTHORIZED", 401, "Worker non autorisé.");
  let body: { rawBody: string; tooLarge: boolean };
  try {
    body = await readWorkerBody(request);
  } catch {
    return jsonError("INVALID_REQUEST", 400, "Le lot de tâches est invalide.");
  }
  if (body.tooLarge) return jsonError("INVALID_REQUEST", 413, "Le lot de tâches est trop volumineux.");
  let input: unknown;
  try {
    input = JSON.parse(body.rawBody);
  } catch {
    return jsonError("INVALID_REQUEST", 400, "Le lot de tâches est invalide.");
  }
  const parsed = workerRequestSchema.safeParse(input);
  if (!parsed.success) return jsonError("INVALID_REQUEST", 400, "Le lot de tâches est invalide.");
  const results = await Promise.all(parsed.data.jobs.map((job) => processWorkerJob(job)));
  return jsonOk({ processed: results.length, results });
}
