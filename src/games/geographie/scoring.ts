export const GEO_EARTH_RADIUS_KM = 6371.0088;
export const GEO_LONGITUDE_BOUNDS = [-6, 10] as const;
export const GEO_LATITUDE_BOUNDS = [41, 52] as const;

export type GeoPoint = { latitude: number; longitude: number };

export function isValidGeoPoint(point: GeoPoint): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= GEO_LATITUDE_BOUNDS[0] &&
    point.latitude <= GEO_LATITUDE_BOUNDS[1] &&
    point.longitude >= GEO_LONGITUDE_BOUNDS[0] &&
    point.longitude <= GEO_LONGITUDE_BOUNDS[1]
  );
}

export function assertValidGeoPoint(point: GeoPoint): void {
  if (!isValidGeoPoint(point)) {
    throw new RangeError("POINT_OUT_OF_BOUNDS");
  }
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(b.longitude - a.longitude);
  const sineLat = Math.sin(deltaLat / 2);
  const sineLon = Math.sin(deltaLon / 2);
  const rawA = sineLat * sineLat + Math.cos(lat1) * Math.cos(lat2) * sineLon * sineLon;
  const clampedA = Math.min(1, Math.max(0, rawA));
  return 2 * GEO_EARTH_RADIUS_KM * Math.asin(Math.sqrt(clampedA));
}

export function scoreDistanceKm(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new RangeError("INVALID_DISTANCE");
  }
  const score = Math.round(1000 * Math.exp(-Math.max(0, distanceKm - 5) / 100));
  return Math.min(1000, Math.max(0, score));
}

export function formatDistanceKm(distanceKm: number | null): string {
  if (distanceKm === null) return "Aucun placement";
  if (distanceKm < 100) return `${distanceKm.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(distanceKm)} km`;
}
