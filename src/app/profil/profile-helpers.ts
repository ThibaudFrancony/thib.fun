export const AVATAR_PRESETS = [
  "orbit-1",
  "orbit-2",
  "orbit-3",
  "orbit-4",
  "orbit-5",
  "orbit-6",
  "orbit-7",
  "orbit-8",
] as const;

export type AvatarPreset = (typeof AVATAR_PRESETS)[number];

const PSEUDO_PATTERN = /^[\p{L}\p{N} _-]+$/u;

export function normalizeProfilePseudo(value: string): string | null {
  if (/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value)) return null;
  const normalized = value.trim().replace(/\s+/gu, " ");
  return normalized.length >= 2 && normalized.length <= 24 && PSEUDO_PATTERN.test(normalized)
    ? normalized
    : null;
}

/** Même clé fonctionnelle que private.pseudo_key, sans exposer cette fonction SQL. */
export function profilePseudoKey(pseudo: string): string {
  return pseudo.trim().replace(/\s+/gu, " ").toLocaleLowerCase("fr-FR");
}

export function isAvatarPreset(value: unknown): value is AvatarPreset {
  return typeof value === "string" && (AVATAR_PRESETS as readonly string[]).includes(value);
}
