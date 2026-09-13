import "server-only";

export const MAX_WORKER_BODY_BYTES = 16 * 1024;

export async function readWorkerBody(request: Request): Promise<{ rawBody: string; tooLarge: boolean }> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_WORKER_BODY_BYTES) {
    return { rawBody: "", tooLarge: true };
  }
  if (!request.body) {
    const rawBody = await request.text();
    return {
      rawBody,
      tooLarge: new TextEncoder().encode(rawBody).byteLength > MAX_WORKER_BODY_BYTES,
    };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_WORKER_BODY_BYTES) {
        await reader.cancel();
        return { rawBody: "", tooLarge: true };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { rawBody: new TextDecoder().decode(bytes), tooLarge: false };
}
