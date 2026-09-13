import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  configured: true,
  validSecret: true,
  processWorkerJob: vi.fn(),
}));

vi.mock("@/server/config", () => ({
  getSupabaseServerConfig: () => mocks.configured ? { url: "http://supabase", anonKey: "anon", serviceRoleKey: "service" } : null,
}));

vi.mock("@/server/jobs/worker", async () => {
  const { z } = await import("zod");
  const workerJobSchema = z.object({
    jobId: z.string().uuid(),
    leaseToken: z.string().uuid(),
  }).strict();
  return {
    hasValidWorkerSecret: () => mocks.validSecret,
    processWorkerJob: mocks.processWorkerJob,
    workerRequestSchema: z.object({ jobs: z.array(workerJobSchema).min(1).max(4) }).strict(),
  };
});

import { POST } from "@/app/api/internal/jobs/run/route";

const job = {
  jobId: "11111111-1111-4111-8111-111111111111",
  leaseToken: "22222222-2222-4222-8222-222222222222",
};

function request(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/internal/jobs/run", {
    method: "POST",
    headers: { "content-type": "application/json", "x-internal-job-secret": "valid-secret", ...headers },
    body,
  });
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

describe("route du worker interne", () => {
  beforeEach(() => {
    mocks.configured = true;
    mocks.validSecret = true;
    mocks.processWorkerJob.mockReset();
    mocks.processWorkerJob.mockImplementation(async (value: typeof job) => ({ jobId: value.jobId, status: "committed" }));
  });

  it("accepte un lot minimal et renvoie les résultats sans exposer le contexte", async () => {
    const response = await POST(request(JSON.stringify({ jobs: [job] })));
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({
      processed: 1,
      results: [{ jobId: job.jobId, status: "committed" }],
    });
    expect(mocks.processWorkerJob).toHaveBeenCalledWith(job);
  });

  it("refuse un secret invalide avant de lire ou traiter le lot", async () => {
    mocks.validSecret = false;
    const response = await POST(request("not-json", { "x-internal-job-secret": "wrong-secret" }));
    expect(response.status).toBe(401);
    expect((await json(response)).error).toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.processWorkerJob).not.toHaveBeenCalled();
  });

  it("retourne 503 quand la configuration Supabase serveur manque", async () => {
    mocks.configured = false;
    const response = await POST(request(JSON.stringify({ jobs: [job] })));
    expect(response.status).toBe(503);
    expect((await json(response)).error).toMatchObject({ code: "CONFIGURATION_REQUIRED" });
  });

  it("refuse un lot vide, un JSON invalide et un objet de job trop riche", async () => {
    const empty = await POST(request(JSON.stringify({ jobs: [] })));
    expect(empty.status).toBe(400);
    const malformed = await POST(request("{"));
    expect(malformed.status).toBe(400);
    const extra = await POST(request(JSON.stringify({ jobs: [{ ...job, matchId: "leak" }] })));
    expect(extra.status).toBe(400);
    expect(mocks.processWorkerJob).not.toHaveBeenCalled();
  });

  it("traite un lot partiel et conserve le résultat d'un bail répété", async () => {
    let calls = 0;
    mocks.processWorkerJob.mockImplementation(async (value: typeof job) => {
      calls += 1;
      return calls === 1
        ? { jobId: value.jobId, status: "committed" }
        : { jobId: value.jobId, status: "ignored", reason: "JOB_LEASE_INVALID" };
    });
    const response = await POST(request(JSON.stringify({ jobs: [job, job] })));
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({
      processed: 2,
      results: [
        { jobId: job.jobId, status: "committed" },
        { jobId: job.jobId, status: "ignored", reason: "JOB_LEASE_INVALID" },
      ],
    });
    expect(mocks.processWorkerJob).toHaveBeenCalledTimes(2);
  });

  it("rejette le corps trop volumineux avant JSON.parse", async () => {
    const response = await POST(request(JSON.stringify({ jobs: [job], padding: "x".repeat(17_000) })));
    expect(response.status).toBe(413);
    expect(mocks.processWorkerJob).not.toHaveBeenCalled();
  });
});
