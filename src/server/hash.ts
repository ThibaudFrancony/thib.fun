import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";

export function newCommandId(): string {
  return randomUUID();
}

export const DEFAULT_ENTROPY_LENGTH = 4096;

export function entropyValues(length = DEFAULT_ENTROPY_LENGTH): number[] {
  if (!Number.isInteger(length) || length <= 0) throw new RangeError("Entropy length must be a positive integer");
  const bytes = randomBytes(length);
  return [...bytes].map((value) => value / 256);
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

export function hashCommand(matchId: string, actorId: string, actionType: string, payload: unknown): string {
  return createHash("sha256").update(canonical({ matchId, actorId, actionType, payload })).digest("hex");
}
