import { describe, expect, it } from "vitest";

import { haveSameGameSlugs, parseVisibleGames } from "@/lib/visible-games";

const UNO = {
  slug: "uno",
  displayName: "Dernière carte",
  cardName: "UNO",
  description: "Débarrasse-toi de ta main.",
  priority: 1 as const,
  kind: "competitive" as const,
  availability: "ready" as const,
  duration: "8–15 min",
};

describe("rafraîchissement client des jeux visibles", () => {
  it("accepte une charge valide", () => {
    expect(parseVisibleGames([UNO])).toEqual([UNO]);
  });

  it("refuse une charge invalide sans casser le carrousel", () => {
    expect(parseVisibleGames(null)).toBeNull();
    expect(parseVisibleGames([{ slug: "uno" }])).toBeNull();
    expect(parseVisibleGames([{ ...UNO, kind: "solo" }])).toBeNull();
  });

  it("compare uniquement l'ordre des slugs", () => {
    expect(haveSameGameSlugs([{ slug: "uno" }], [{ slug: "uno" }])).toBe(true);
    expect(haveSameGameSlugs([{ slug: "uno" }], [{ slug: "ttmc" }])).toBe(false);
    expect(haveSameGameSlugs([{ slug: "uno" }, { slug: "ttmc" }], [{ slug: "ttmc" }, { slug: "uno" }])).toBe(false);
    expect(haveSameGameSlugs([], [])).toBe(true);
    expect(haveSameGameSlugs([{ slug: "uno" }], [])).toBe(false);
  });
});
