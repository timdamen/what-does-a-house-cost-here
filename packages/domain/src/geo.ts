import type { Location, SearchArea } from './types';

/** Mean Earth radius in metres (IUGG). */
export const EARTH_RADIUS_METRES = 6_371_008.8;

/** Average walking speed used to turn a distance into minutes. */
export const WALKING_SPEED_METRES_PER_MINUTE = 80;

/** Street networks are longer than the straight line; this factor accounts for the detour. */
export const WALKING_DETOUR_FACTOR = 1.3;

/** Decimals kept when rounding a Location for URLs, cache keys and server requests. */
export const LOCATION_DECIMALS = 4;

/**
 * Search Radius used when none is given (research note `docs/research/mobile-map-ux.md`,
 * decision 1). The URL, the server routes and the map all fall back to it.
 */
export const DEFAULT_RADIUS_METRES = 500;

const DEGREES_TO_RADIANS = Math.PI / 180;

/** Straight-line (great-circle) distance in metres between two Locations. */
export function haversineMetres(a: Location, b: Location): number {
  const dLat = (b.lat - a.lat) * DEGREES_TO_RADIANS;
  const dLng = (b.lng - a.lng) * DEGREES_TO_RADIANS;
  const latA = a.lat * DEGREES_TO_RADIANS;
  const latB = b.lat * DEGREES_TO_RADIANS;

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.sqrt(h));
}

/**
 * Estimated walking time for a straight-line distance, rounded up to whole minutes.
 * `distance * WALKING_DETOUR_FACTOR / WALKING_SPEED_METRES_PER_MINUTE`.
 */
export function walkingMinutes(straightLineMetres: number): number {
  if (!Number.isFinite(straightLineMetres) || straightLineMetres <= 0) return 0;
  return Math.ceil((straightLineMetres * WALKING_DETOUR_FACTOR) / WALKING_SPEED_METRES_PER_MINUTE);
}

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** The smallest lat/lng box that contains the Search Area circle. Latitudes clamp to the poles. */
export function boundingBox(area: SearchArea): BoundingBox {
  const { centre, radiusMetres } = area;
  const dLat = radiusMetres / EARTH_RADIUS_METRES / DEGREES_TO_RADIANS;
  const cosLat = Math.cos(centre.lat * DEGREES_TO_RADIANS);
  const dLng = cosLat > 1e-12 ? dLat / cosLat : 180;

  return {
    south: Math.max(-90, centre.lat - dLat),
    north: Math.min(90, centre.lat + dLat),
    west: Math.max(-180, centre.lng - dLng),
    east: Math.min(180, centre.lng + dLng),
  };
}

/** Whether a Location lies inside the Search Area circle (boundary inclusive). */
export function isWithinArea(location: Location, area: SearchArea): boolean {
  return haversineMetres(area.centre, location) <= area.radiusMetres;
}

/** Rounds a Location's latitude and longitude to `LOCATION_DECIMALS` (about 11 m), the precision the app works at. */
export function roundLocation(location: Location, decimals = LOCATION_DECIMALS): Location {
  const factor = 10 ** decimals;
  return {
    lat: Math.round(location.lat * factor) / factor,
    lng: Math.round(location.lng * factor) / factor,
  };
}

/** Moves a Location by metres east (`dx`) and north (`dy`) using a local flat-earth approximation. */
export function offsetLocation(origin: Location, dxMetres: number, dyMetres: number): Location {
  const dLat = dyMetres / EARTH_RADIUS_METRES / DEGREES_TO_RADIANS;
  const dLng =
    dxMetres /
    (EARTH_RADIUS_METRES * Math.cos(origin.lat * DEGREES_TO_RADIANS)) /
    DEGREES_TO_RADIANS;
  return { lat: origin.lat + dLat, lng: origin.lng + dLng };
}
