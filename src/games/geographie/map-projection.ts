import {
  geoConicConformal,
  geoPath,
  type GeoProjection,
} from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";

export type FranceGeometry = FeatureCollection<Geometry>;
export type MapSize = { width: number; height: number };
export type MapViewport = { scale: number; offsetX: number; offsetY: number };

const DEFAULT_VIEWPORT: MapViewport = { scale: 1, offsetX: 0, offsetY: 0 };

function applyViewport(point: [number, number], size: MapSize, viewport: MapViewport): [number, number] {
  const centerX = size.width / 2;
  const centerY = size.height / 2;
  return [
    centerX + (point[0] - centerX) * viewport.scale + viewport.offsetX,
    centerY + (point[1] - centerY) * viewport.scale + viewport.offsetY,
  ];
}

function removeViewport(point: [number, number], size: MapSize, viewport: MapViewport): [number, number] {
  if (!Number.isFinite(viewport.scale) || viewport.scale <= 0) return point;
  const centerX = size.width / 2;
  const centerY = size.height / 2;
  return [
    centerX + (point[0] - centerX - viewport.offsetX) / viewport.scale,
    centerY + (point[1] - centerY - viewport.offsetY) / viewport.scale,
  ];
}

function baseProjection(geojson: FranceGeometry, size: MapSize): GeoProjection {
  const projection = geoConicConformal()
    .parallels([44, 49])
    .rotate([-2.5, 0])
    .center([0, 46.5])
    .precision(0.1);
  projection.fitExtent(
    [
      [18, 18],
      [Math.max(19, size.width - 18), Math.max(19, size.height - 18)],
    ],
    geojson,
  );
  return projection;
}

export function createGeoProjection(geojson: FranceGeometry, size: MapSize, viewport: MapViewport = DEFAULT_VIEWPORT): GeoProjection {
  // The d3 projection always remains in the base SVG coordinate space. The
  // viewport is applied exactly once by projectGeoPoint/invertGeoPoint or by
  // the SVG map group; callers must not apply both to the same overlay.
  void viewport;
  return baseProjection(geojson, size);
}

export function pathForGeojson(geojson: FranceGeometry, size: MapSize, viewport?: MapViewport): string | null {
  return geoPath(createGeoProjection(geojson, size, viewport))(geojson) ?? null;
}

export function projectGeoPoint(
  geojson: FranceGeometry,
  size: MapSize,
  point: { longitude: number; latitude: number },
  viewport?: MapViewport,
): [number, number] | null {
  const projected = createGeoProjection(geojson, size)([point.longitude, point.latitude]);
  if (!projected) return null;
  return applyViewport(projected, size, viewport ?? DEFAULT_VIEWPORT);
}

export function invertGeoPoint(
  geojson: FranceGeometry,
  size: MapSize,
  point: [number, number],
  viewport?: MapViewport,
): { longitude: number; latitude: number } | null {
  const untransformed = removeViewport(point, size, viewport ?? DEFAULT_VIEWPORT);
  const inverted = createGeoProjection(geojson, size).invert?.(untransformed);
  return inverted ? { longitude: inverted[0], latitude: inverted[1] } : null;
}
