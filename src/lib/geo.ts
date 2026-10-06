/**
 * Location helpers.
 *
 * Privacy is built into this module: coordinates are always rounded before they
 * leave the server (`roundCoord`), and distance is only ever presented at coarse
 * granularity. Exact street addresses are never stored in request records.
 */

export type Coordinates = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Coordinates are rounded to two decimals (~1.1 km) so that a home or hospital
 * location can never be reverse-engineered from the published record.
 */
export function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

export function roundCoordinates(point: Coordinates): Coordinates {
  return { lat: roundCoord(point.lat), lng: roundCoord(point.lng) };
}

export function isValidCoordinates(value: unknown): value is Coordinates {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<Coordinates>;
  return (
    typeof point.lat === "number" &&
    typeof point.lng === "number" &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180
  );
}

export function formatDistance(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km)) return "Distance unavailable";
  if (km < 1) return "Under 1 km away";
  if (km < 10) return `${Math.round(km)} km away`;
  return `${Math.round(km / 5) * 5} km away`;
}

/** Coarse label used in cards — avoids publishing precise distances. */
export function distanceBand(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km)) return "Unknown distance";
  if (km <= 5) return "Same area (0–5 km)";
  if (km <= 15) return "Nearby (5–15 km)";
  if (km <= 40) return "Same city (15–40 km)";
  if (km <= 100) return "Same region (40–100 km)";
  return "Further away (100 km+)";
}

export function formatCoordinates(point: Coordinates): string {
  return `${point.lat.toFixed(2)}, ${point.lng.toFixed(2)}`;
}
