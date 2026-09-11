/**
 * Normalisation serveur stricte des mots BombParty.
 * Pipeline contractuel : trim, minuscules, NFKD + suppression des accents,
 * ligatures œ→oe / æ→ae, lettres a–z uniquement, longueur normalisée 2..30.
 * Les noms propres, abréviations et mots à tiret/apostrophe sont rejetés
 * (caractères hors a–z). Retourne null si le mot est invalide.
 */
export function normalizeBombpartyWord(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 60) return null;
  const normalized = trimmed
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae");
  if (normalized.length < 2 || normalized.length > 30) return null;
  if (!/^[a-z]+$/.test(normalized)) return null;
  return normalized;
}

/** Normalisation d'une séquence (2 ou 3 lettres a–z), utilisée pour les garde-fous. */
export function normalizeBombpartySequence(raw: unknown): string | null {
  const normalized = normalizeBombpartyWord(raw);
  if (normalized === null || normalized.length < 2 || normalized.length > 3) return null;
  return normalized;
}
