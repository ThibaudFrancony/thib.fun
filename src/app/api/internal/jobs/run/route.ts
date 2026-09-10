import { getSupabaseServerConfig } from "@/server/config";
import { jsonError, jsonOk } from "@/server/http";
import { hasValidWorkerSecret, processWorkerJob, workerRequestSchema } from "@/server/jobs/worker";

const MAX_WORKER_BODY_BYTES = 16 * 1024;

export async function POST(request: Request) {
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  if (!hasValidWorkerSecret(request.headers.get("x-internal-job-secret"))) return jsonError("UNAUTHORIZED", 401, "Worker non autorisé.");
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_WORKER_BODY_BYTES) return jsonError("INVALID_REQUEST", 413, "Le lot de tâches est trop volumineux.");
  let input: unknown;
  try {
    input = JSON.parse(rawBody);
  } catch {
    return jsonError("INVALID_REQUEST", 400, "Le lot de tâches est invalide.");
  }
  const parsed = workerRequestSchema.safeParse(input);
  if (!parsed.success) return jsonError("INVALID_REQUEST", 400, "Le lot de tâches est invalide.");
  const results = await Promise.all(parsed.data.jobs.map((job) => processWorkerJob(job)));
  return jsonOk({ processed: results.length, results });
}
