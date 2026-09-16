import "server-only";

import type { LocalQuizFixtureVerdict } from "@/server/quiz/config";

/**
 * Transport déterministe réservé à la recette locale. La configuration refuse
 * de l'activer en production ou avec une origine/Supabase non loopback.
 */
export function createLocalQuizFixtureFetch(verdict: LocalQuizFixtureVerdict): typeof fetch {
  return async () => {
    const reasonCode = verdict === "accept"
      ? "exact_meaning"
      : verdict === "reject"
        ? "wrong_fact"
        : "ambiguous";
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ verdict, reasonCode }) } }],
      usage: { prompt_tokens: 0, completion_tokens: 0 },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}
