import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";

const checksumSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const contentManifestSchema = z
  .object({
    kind: z.string().min(1),
    slug: z.string().min(1),
    version: z.number().int().positive(),
    status: z.enum(["draft", "published"]).optional(),
    packId: z.string().min(1).optional(),
    source: z.string().min(1),
    license: z.string().min(1),
    author: z.string().min(1),
    checksum: checksumSchema,
    reviewedBy: z.string().min(1),
    reviewedAt: z.string().min(1),
  })
  .passthrough();

export type ContentManifest = z.infer<typeof contentManifestSchema>;
export type ContentPackReference = { packId: string; packVersion: number };

export function checksumJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function checksumBytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function readContentManifest(path: string): Promise<ContentManifest> {
  const raw = JSON.parse(await readFile(path, "utf8"));
  return contentManifestSchema.parse(raw);
}

export function assertManifestIdentity(
  manifest: ContentManifest,
  expected: { kind: string; slug: string; packId?: string; packVersion: number },
): void {
  if (
    manifest.kind !== expected.kind
    || manifest.slug !== expected.slug
    || manifest.version !== expected.packVersion
    || (expected.packId !== undefined && manifest.packId !== expected.packId)
  ) {
    throw new Error("CONTENT_VERSION_MISMATCH");
  }
}

export function assertManifestChecksum(manifest: ContentManifest, checksum: string): void {
  if (manifest.checksum !== checksum) throw new Error("CONTENT_MANIFEST_MISMATCH");
}

export function assertManifestCount(manifest: ContentManifest, field: string, actual: number): void {
  const declared = manifest[field];
  if (declared !== actual) throw new Error("CONTENT_MANIFEST_MISMATCH");
}

export function assertManifestCoverage(manifest: ContentManifest, expected: Record<string, number>): void {
  const declared = manifest.coverage;
  if (!declared || typeof declared !== "object" || Array.isArray(declared)) throw new Error("CONTENT_MANIFEST_MISMATCH");
  const declaredRecord = declared as Record<string, unknown>;
  const entries = Object.entries(declaredRecord);
  if (entries.length !== Object.keys(expected).length) throw new Error("CONTENT_MANIFEST_MISMATCH");
  for (const [key, value] of Object.entries(expected)) {
    if (declaredRecord[key] !== value) throw new Error("CONTENT_MANIFEST_MISMATCH");
  }
}

export function assertOptionalManifest(
  raw: unknown,
  expected: { kind: string; slug: string; packId: string; packVersion: number },
  checksum: string,
): void {
  if (raw === undefined) return;
  const manifest = contentManifestSchema.parse(raw);
  assertManifestIdentity(manifest, expected);
  assertManifestChecksum(manifest, checksum);
}

export function assertPackReference(
  content: ContentPackReference,
  expected: ContentPackReference | undefined,
): void {
  if (!expected) return;
  if (content.packId !== expected.packId || content.packVersion !== expected.packVersion) {
    throw new Error("CONTENT_VERSION_MISMATCH");
  }
}
