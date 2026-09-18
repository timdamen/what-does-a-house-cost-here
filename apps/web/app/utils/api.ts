import type { House, Location, UpstreamErrorShape } from '@house-cost/domain';
import { isUpstreamError, LOCATION_DECIMALS } from '@house-cost/domain';
import type { NuxtApp } from '#app';

/**
 * Helpers shared by the `useHouses`, `useFacts` and `usePrices` composables: cache keys built
 * from the rounded Search Area, the client-side cache lookup, and the typed view of a 502.
 */

function roundedPart(location: Location): string {
  return `${location.lat.toFixed(LOCATION_DECIMALS)}:${location.lng.toFixed(LOCATION_DECIMALS)}`;
}

/** `houses:52.3676:4.9041:500`, or `houses:none` while there is no Location. */
export function housesKey(location: Location | null, radiusMetres: number): string {
  return location ? `houses:${roundedPart(location)}:${radiusMetres}` : 'houses:none';
}

/** `facts:52.3676:4.9041:500`, or `facts:none` while there is no Location. */
export function factsKey(location: Location | null, radiusMetres: number): string {
  return location ? `facts:${roundedPart(location)}:${radiusMetres}` : 'facts:none';
}

/** `prices:<digest of the sorted house ids>`, or `prices:none` when there are no Houses. */
export function pricesKey(houses: readonly Pick<House, 'id'>[]): string {
  if (houses.length === 0) return 'prices:none';
  const ids = houses
    .map((house) => house.id)
    .toSorted()
    .join('\n');
  return `prices:${stringDigest(ids)}`;
}

/** Short, stable, browser-safe digest (FNV-1a, 32 bit) for cache keys built from id lists. */
export function stringDigest(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${hash.toString(16).padStart(8, '0')}-${text.length.toString(36)}`;
}

/**
 * `getCachedData` for the area composables: whatever the app already fetched for this key comes
 * back at once (user story 40), so returning to a recent area never waits on the network. A
 * manual `refresh()` (the retry button) bypasses it and hits the server again.
 */
export function cachedApiData<T>(
  key: string,
  nuxtApp: NuxtApp,
  context: { cause: string },
): T | undefined {
  if (context.cause === 'refresh:manual') return undefined;
  return (nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]) as T | undefined;
}

/**
 * The `{ error: { kind: 'upstream' } }` envelope a 502 from `/api/*` carries, read from the
 * rejected fetch (`FetchError.data`), or `null` for any other failure or none at all.
 */
export function upstreamErrorOf(error: unknown): UpstreamErrorShape | null {
  if (typeof error !== 'object' || error === null) return null;
  const data: unknown = (error as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) return null;
  const shape: unknown = (data as { error?: unknown }).error;
  return isUpstreamError(shape) ? shape : null;
}
