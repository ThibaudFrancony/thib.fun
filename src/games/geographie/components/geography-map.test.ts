import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GeographyMapLoadError, clampMapPoint } from "@/games/geographie/components/geography-map";

describe("composant de carte Géographie", () => {
  it("borne le curseur clavier aux limites d'affichage", () => {
    const size = { width: 720, height: 500 };
    expect(clampMapPoint([-20, 540], size)).toEqual([0, 500]);
    expect(clampMapPoint([480, 220], size)).toEqual([480, 220]);
    expect(clampMapPoint([900, -4], size)).toEqual([720, 0]);
  });

  it("affiche une erreur rejouable au lieu d'une carte vide", () => {
    const markup = renderToStaticMarkup(createElement(GeographyMapLoadError, { onRetry: () => undefined }));
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("La carte n&#x27;a pas pu être chargée.");
    expect(markup).toContain("Réessayer");
  });
});
