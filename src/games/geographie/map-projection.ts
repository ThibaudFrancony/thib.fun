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
  const activeViewport = viewport ?? DEFAULT_VIEWPORT;
  const centerX = size.width / 2;
  const centerY = size.height / 2;
  return [
    centerX + (projected[0] - centerX) * activeViewport.scale + activeViewport.offsetX,
    centerY + (projected[1] - centerY) * activeViewport.scale + activeViewport.offsetY,
  ];
}

export function invertGeoPoint(
  geojson: FranceGeometry,
  size: MapSize,
  point: [number, number],
  viewport?: MapViewport,
): { longitude: number; latitude: number } | null {
  const activeViewport = viewport ?? DEFAULT_VIEWPORT;
  const centerX = size.width / 2;
  const centerY = size.height / 2;
  const untransformed: [number, number] = [
    centerX + (point[0] - centerX - activeViewport.offsetX) / activeViewport.scale,
    centerY + (point[1] - centerY - activeViewport.offsetY) / activeViewport.scale,
  ];
  const inverted = createGeoProjection(geojson, size).invert?.(untransformed);
  return inverted ? { longitude: inverted[0], latitude: inverted[1] } : null;
}
