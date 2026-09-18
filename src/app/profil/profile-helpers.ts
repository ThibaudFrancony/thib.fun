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
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u;

export function normalizeProfilePseudo(value: string): string | null {
  if (CONTROL_CHARACTERS.test(value)) return null;
  const normalized = value.trim().replace(/\s+/gu, " ");
  return normalized.length >= 2 && normalized.length <= 24 && PSEUDO_PATTERN.test(normalized)
    ? normalized
    : null;
}

/** Même clé fonctionnelle que private.pseudo_key, sans exposer cette fonction SQL. */
export function profilePseudoKey(pseudo: string): string {
  return pseudo.trim().replace(/\s+/gu, " ").toLocaleLowerCase("fr-FR");
}

/**
 * Nom affiché optionnel : chaîne vide/blanche = null (on affiche alors le
 * nom de création). Sinon mêmes règles que le pseudo (2–24, alphabet restreint).
 */
export function normalizeDisplayName(value: string): string | null {
  if (CONTROL_CHARACTERS.test(value)) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return normalizeProfilePseudo(trimmed);
}

/** Clé d'unicité du nom affiché (NULL quand vide). */
export function displayNameKey(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return profilePseudoKey(trimmed);
}

/** Nom effectif affiché partout : nom affiché s'il existe, sinon nom de création. */
export function effectiveDisplayName(accountName: string | null, displayName: string | null, fallback: string): string {
  const display = displayName?.trim();
  if (display) return display;
  if (accountName?.trim()) return accountName;
  return fallback;
}

export function isAvatarPreset(value: unknown): value is AvatarPreset {
  return typeof value === "string" && (AVATAR_PRESETS as readonly string[]).includes(value);
}
