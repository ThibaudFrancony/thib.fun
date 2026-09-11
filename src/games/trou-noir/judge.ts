import type { QuizQuestion } from "@/games/trou-noir/types";

export type DeterministicVerdict = "accept" | "reject" | "undecided";

export function normalizeAnswer(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFKC")
    .toLocaleLowerCase("fr-FR")
    .replace(/[’‘‛`´]/g, "'")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function surnameOf(value: string): string {
  const tokens = value.split(" ").filter(Boolean);
  return tokens[tokens.length - 1] ?? "";
}

function parseFrenchNumber(value: string): number | null {
  const cleaned = value.replace(/\s+/g, "").replace(",", ".");
  const match = cleaned.match(/^(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Correction déterministe côté serveur : canonique/alias, nombres avec
 * tolérance, noms de personne selon la politique de l'item. Tout le reste
 * est "undecided" et relève du correcteur sémantique (DeepSeek) ou, à défaut,
 * d'un remplacement technique sans pénalité.
 */
export function deterministicJudge(question: QuizQuestion, rawAnswer: string): DeterministicVerdict {
  const normalized = normalizeAnswer(rawAnswer);
  if (!normalized) return "reject";
  const candidates = [question.canonical, ...question.aliases].map(normalizeAnswer);

  if (candidates.includes(normalized)) return "accept";

  if (question.answerType === "number") {
    if (question.numericValue === undefined) return "undecided";
    const submitted = parseFrenchNumber(normalized);
    const expected = parseFrenchNumber(normalizeAnswer(question.canonical));
    const reference = question.numericValue;
    if (submitted === null || expected === null) return "undecided";
    // Un chiffre faux ne se rattrape jamais sémantiquement : hors tolérance => reject.
    const tolerance = question.numericTolerance ?? 0;
    return Math.abs(submitted - reference) <= tolerance ? "accept" : "reject";
  }

  if (question.answerType === "date") {
    // Les dates exigent le format explicite de l'item : pas d'acceptation floue ici.
    return "undecided";
  }

  if (question.answerType === "person" && question.allowSurnameOnly) {
    const expectedSurnames = [question.canonical, ...question.aliases].map((name) =>
      normalizeAnswer(surnameOf(normalizeAnswer(name))),
    );
    const submittedSurname = normalizeAnswer(surnameOf(normalized));
    if (submittedSurname && expectedSurnames.includes(submittedSurname)) return "accept";
  }

  // Descriptions autorisées : la réponse doit contenir le canonique normalisé
  // sans ajouter de candidat contradictoire (heuristique simple : pas de " et " / virgule multiple).
  if (question.allowDescription && normalized.length >= 4 && question.canonical) {
    const canonicalNormalized = normalizeAnswer(question.canonical);
    if (normalized.includes(canonicalNormalized) && !/[;,]/.test(normalized) && normalized.split(" et ").length <= 1) {
      return "accept";
    }
  }

  // Listes de candidats, réponses multiples ou contradictions => reject déterministe.
  if (/[;,]/.test(normalized) || normalized.split(" et ").length > 1 || normalized.split(" ou ").length > 1) {
    return "reject";
  }

  return "undecided";
}

export function isTimeoutContestAllowed(): false {
  return false;
}

/** Précise la méthode d'un verdict déterministe accepté (null si non concluant). */
export function deterministicMatchKind(
  question: QuizQuestion,
  rawAnswer: string,
): "exact" | "alias" | "numeric" | null {
  const normalized = normalizeAnswer(rawAnswer);
  if (!normalized) return null;
  if (normalizeAnswer(question.canonical) === normalized) return "exact";
  if (question.answerType === "number") {
    return deterministicJudge(question, rawAnswer) === "accept" ? "numeric" : null;
  }
  return deterministicJudge(question, rawAnswer) === "accept" ? "alias" : null;
}
