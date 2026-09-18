/** Search Radius options in metres (research decision 1). Each step is one zoom level on a phone. */
export const RADIUS_OPTIONS = [250, 500, 1000] as const;

const DEFAULT_RADIUS_METRES = 500;

const ZOOM_AT_DEFAULT_RADIUS = 15;
const MIN_ZOOM = 10;
const MAX_ZOOM = 18;

/**
 * Zoom that shows the whole Search Area on a phone: 250 m -> z16, 500 m -> z15, 1000 m -> z14.
 * Other radii follow the same halving rule, rounded to a whole zoom level.
 */
export function zoomForRadius(radiusMetres: number): number {
  if (!Number.isFinite(radiusMetres) || radiusMetres <= 0) return ZOOM_AT_DEFAULT_RADIUS;
  const zoom = ZOOM_AT_DEFAULT_RADIUS - Math.log2(radiusMetres / DEFAULT_RADIUS_METRES);
  return Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)));
}

/** Short label for a radius button: `250 m`, `500 m`, `1 km`, `1.5 km`. */
export function radiusLabel(metres: number): string {
  if (metres >= 1000) {
    const km = metres / 1000;
    return `${Number.isInteger(km) ? km : km.toFixed(1)} km`;
  }
  return `${metres} m`;
}

/** Distance the map must be dragged from the Search Area centre before "Search here" appears. */
const SEARCH_HERE_MIN_METRES = 300;

/** "A few hundred metres", scaled down for small radii so a 250 m area still offers it. */
export function shouldOfferSearchHere(distanceMetres: number, radiusMetres: number): boolean {
  return distanceMetres >= Math.min(SEARCH_HERE_MIN_METRES, radiusMetres / 2);
}
