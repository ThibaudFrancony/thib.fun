import { describe, expect, it } from "vitest";
import { UNO_CARD_BACK_SRC, UNO_WILD4_SRC, UNO_WILD_SRC, unoCardArtwork } from "@/games/uno/components/uno-card";

describe("habillage des cartes UNO", () => {
  it("superpose le chiffre sur la base colorée, sans asset par numéro", () => {
    const seven = unoCardArtwork({ color: "red", symbol: "7" });
    expect(seven.src).toBe("/uno/uno_rouge_vide.png");
    expect(seven.center).toEqual({ main: "7" });
    expect(seven.corner).toBe("7");

    const zero = unoCardArtwork({ color: "green", symbol: "0" });
    expect(zero.src).toBe("/uno/uno_vert_vide.png");
    expect(zero.center).toEqual({ main: "0" });
  });

  it("associe chaque couleur à sa base vide", () => {
    expect(unoCardArtwork({ color: "yellow", symbol: "9" }).src).toBe("/uno/uno_jaune_vide.png");
    expect(unoCardArtwork({ color: "blue", symbol: "3" }).src).toBe("/uno/uno_bleu_vide.png");
  });

  it("utilise les assets dédiés pour les jokers", () => {
    expect(unoCardArtwork({ color: null, symbol: "wild" })).toEqual({ src: UNO_WILD_SRC, corner: null, center: null });
    expect(unoCardArtwork({ color: null, symbol: "wild4" })).toEqual({ src: UNO_WILD4_SRC, corner: null, center: null });
  });

  it("ajoute le symbole dynamique des cartes spéciales colorées", () => {
    const skip = unoCardArtwork({ color: "red", symbol: "skip" });
    expect(skip.src).toBe("/uno/uno_rouge_vide.png");
    expect(skip.center).toEqual({ main: "∅", label: "Passe ton tour" });
    expect(skip.corner).toBe("∅");

    const reverse = unoCardArtwork({ color: "blue", symbol: "reverse" });
    expect(reverse.center?.label).toBe("Sens inverse");

    const draw2 = unoCardArtwork({ color: "green", symbol: "draw2" });
    expect(draw2.center).toEqual({ main: "+2" });
  });

  it("expose le dos commun à la pioche et aux cartes adverses", () => {
    expect(UNO_CARD_BACK_SRC).toBe("/uno/uno_dos.png");
  });
});
