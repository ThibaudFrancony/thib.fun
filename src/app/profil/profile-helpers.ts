export const AVATAR_PRESETS = [
  "avatar-1",
  "avatar-2",
  "avatar-3",
  "avatar-4",
  "avatar-5",
  "avatar-6",
  "avatar-7",
  "avatar-8",
  "avatar-9",
  "avatar-10",
] as const;

/** Libellés dans l'ordre des PNG public/avatars/avatar-N.png. */
export const AVATAR_PRESET_LABELS: Record<AvatarPresetId, string> = {
  "avatar-1": "Étoile",
  "avatar-2": "Cœur",
  "avatar-3": "Soleil",
  "avatar-4": "Lune",
  "avatar-5": "Nuage",
  "avatar-6": "Chat",
  "avatar-7": "Robot",
  "avatar-8": "Lapin",
  "avatar-9": "Panda",
  "avatar-10": "Fusée",
};

export type AvatarPresetId = (typeof AVATAR_PRESETS)[number];

export type AvatarPreset = AvatarPresetId;

/** Chemin public du PNG transparent d'un preset. */
export function avatarPresetImage(preset: string): string | null {
  return (AVATAR_PRESETS as readonly string[]).includes(preset)
    ? "/avatars/" + preset + ".png"
    : null;
}

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
