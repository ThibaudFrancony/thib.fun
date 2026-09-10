import { describe, expect, it } from "vitest";
import {
  invertGeoPoint,
  pathForGeojson,
  projectGeoPoint,
  type FranceGeometry,
} from "@/games/geographie/map-projection";

const franceGeometry: FranceGeometry = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "metropole" },
      geometry: {
        type: "Polygon",
        coordinates: [[[-5, 42], [8, 42], [8, 51], [-5, 51], [-5, 42]]],
      },
    },
    {
      type: "Feature",
      properties: { name: "corse" },
      geometry: {
        type: "Polygon",
        coordinates: [[[8.5, 41.3], [9.7, 41.3], [9.7, 43], [8.5, 43], [8.5, 41.3]]],
      },
    },
  ],
};

describe("projection cartographique Géographie", () => {
  it("réinverse un point corse après zoom et déplacement", () => {
    const size = { width: 720, height: 500 };
    const viewport = { scale: 1.8, offsetX: 34, offsetY: -19 };
    const projected = projectGeoPoint(franceGeometry, size, { longitude: 9.05, latitude: 42.2 }, viewport);
    expect(projected).not.toBeNull();
    const inverted = invertGeoPoint(franceGeometry, size, projected!, viewport);
    expect(inverted).not.toBeNull();
    expect(Math.abs(inverted!.longitude - 9.05)).toBeLessThan(0.00001);
    expect(Math.abs(inverted!.latitude - 42.2)).toBeLessThan(0.00001);
  });

  it("produit un chemin SVG à partir des frontières fournies", () => {
    expect(pathForGeojson(franceGeometry, { width: 720, height: 500 })).toMatch(/^M/);
  });
});
