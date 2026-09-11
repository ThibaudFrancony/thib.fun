import type { TtmcQuestion } from "@/games/ttmc/types";

export type TtmcDeterministicVerdict = "accept" | "undecided";

export function normalizeTtmcAnswer(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFKC")
    .toLocaleLowerCase("fr-FR")
    .replace(/[’‘‛`´]/g, "'")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Correction déterministe TTMC : canonique/alias normalisé => accept.
 * Tout le reste est "undecided" et relève du correcteur sémantique
 * (DeepSeek) ou, à défaut, d'un remplacement technique sans pénalité.
 * Un chiffre faux ne se rattrape jamais ici : seule l'égalité normalisée
 * accepte, sans distance floue (Monet/Manet restent distincts).
 */
export function deterministicTtmcJudge(
  question: Pick<TtmcQuestion, "canonical" | "aliases">,
  rawAnswer: string,
): TtmcDeterministicVerdict {
  const normalized = normalizeTtmcAnswer(rawAnswer);
  if (!normalized) return "undecided";
  const candidates = [question.canonical, ...question.aliases].map(normalizeTtmcAnswer);
  if (candidates.includes(normalized)) return "accept";
  return "undecided";
}
