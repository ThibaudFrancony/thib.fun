/**
 * Localisation d'une séquence normalisée (a–z, 2–3 lettres) dans une forme
 * d'affichage accentuée, en conservant les caractères d'origine pour le
 * surlignage. La recherche lowercase simple échoue dès qu'un accent distingue
 * l'affichage du normalisé (ex. « École » vs séquence « eco ») ; on aligne
 * donc la forme normalisée caractère par caractère.
 *
 * Retourne l'intervalle [start, end) dans `display`, ou null si introuvable.
 */
function normalizeChar(char: string): string {
  return char
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae");
}

export function findSequenceRange(display: string, sequence: string): { start: number; end: number } | null {
  const needle = sequence.toLowerCase();
  if (!/^[a-z]{2,3}$/.test(needle) || display.length === 0) return null;
  // Contribution normalisée de chaque caractère d'affichage.
  const parts: string[] = Array.from(display, (char) => normalizeChar(char));
  for (let start = 0; start < parts.length; start += 1) {
    let built = "";
    let end = start;
    while (end < parts.length && built.length < needle.length) {
      built += parts[end];
      end += 1;
    }
    if (built === needle) return { start, end };
    // Une ligature (œ→oe) peut faire dépasser la longueur : on accepte aussi
    // le cas où l'aiguillage produit exactement la séquence.
    if (built.length > needle.length) continue;
  }
  return null;
}

/** Découpe `display` autour de la séquence pour surlignage, ou null. */
export function splitAroundSequence(
  display: string,
  sequence: string,
): { before: string; match: string; after: string } | null {
  const range = findSequenceRange(display, sequence);
  if (!range) return null;
  const chars = Array.from(display);
  return {
    before: chars.slice(0, range.start).join(""),
    match: chars.slice(range.start, range.end).join(""),
    after: chars.slice(range.end).join(""),
  };
}
