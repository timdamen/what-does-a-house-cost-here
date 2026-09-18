import pLimit from 'p-limit';
import {
  UpstreamError,
  type GeocodeResult,
  type Location,
  type NeighbourhoodHierarchy,
} from '@house-cost/domain';

import type { HttpClient } from './http-client';

/** Public Nominatim instance. Configurable so a self-hosted instance can replace it. */
export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

/** `provenance.source` for names, hierarchies and geocoding results. */
export const NOMINATIM_SOURCE = 'nominatim';

/** `UpstreamError.service` for Nominatim failures. */
export const NOMINATIM_SERVICE = 'nominatim';

/** Zoom for reverse geocoding: 16 names the area and its major streets rather than a building. */
const NOMINATIM_REVERSE_ZOOM = 16;

/** Results per forward search, enough for a place-search box. */
const NOMINATIM_SEARCH_LIMIT = 5;

/**
 * ISO 3166-1 user-assigned code reported when Nominatim cannot place a Location in a country
 * (open water, for instance). No price register is keyed on it, so it yields "no data".
 */
export const UNKNOWN_COUNTRY_CODE = 'ZZ';

export interface ReverseGeocodeResult {
  /** The most local named area Nominatim knows for the Location. */
  name: string;
  hierarchy: NeighbourhoodHierarchy;
  /** Postcode of the nearest addressable feature, when Nominatim reports one. */
  postcode?: string;
}

export interface NominatimClient {
  reverse(location: Location): Promise<ReverseGeocodeResult>;
  search(query: string): Promise<GeocodeResult[]>;
}

/** The area-name fallback chain, most local first (Nominatim output documentation). */
const AREA_NAME_KEYS = [
  'neighbourhood',
  'quarter',
  'suburb',
  'village',
  'town',
  'city_district',
  'borough',
  'city',
  'municipality',
  'county',
] as const;

/**
 * Reverse geocoding for Neighbourhood names and forward search for the Geocoder. Requests are
 * serialised through their own single-slot limit (inside the shared client limit) so at most one
 * Nominatim request is in flight, in line with its "maximum 1 request per second" policy.
 */
export function createNominatimClient(client: HttpClient, baseUrl: string): NominatimClient {
  const oneAtATime = pLimit(1);
  const base = baseUrl.replace(/\/$/, '');

  return {
    async reverse(location) {
      const params = new URLSearchParams({
        lat: String(location.lat),
        lon: String(location.lng),
        format: 'jsonv2',
        zoom: String(NOMINATIM_REVERSE_ZOOM),
        addressdetails: '1',
      });
      const body = await oneAtATime(() =>
        client.json(`${base}/reverse?${params}`, { service: NOMINATIM_SERVICE }),
      );
      return mapReverse(body);
    },

    async search(query) {
      const trimmed = query.trim();
      if (trimmed.length === 0) return [];
      const params = new URLSearchParams({
        q: trimmed,
        format: 'jsonv2',
        limit: String(NOMINATIM_SEARCH_LIMIT),
        addressdetails: '1',
      });
      const body = await oneAtATime(() =>
        client.json(`${base}/search?${params}`, { service: NOMINATIM_SERVICE }),
      );
      return mapSearch(body);
    },
  };
}

/** Maps a `/reverse` body. An `{ error }` body (nothing at that Location) is not a failure. */
export function mapReverse(body: unknown): ReverseGeocodeResult {
  if (!isRecord(body)) {
    throw new UpstreamError(NOMINATIM_SERVICE, 'nominatim: unexpected response shape', {
      retryable: false,
    });
  }
  const address = isRecord(body.address) ? body.address : {};
  const hierarchy = mapHierarchy(address);
  const name =
    firstString(address, AREA_NAME_KEYS) ??
    firstDisplaySegment(body.display_name) ??
    hierarchy.country ??
    'Unknown place';
  const postcode = stringOrUndefined(address.postcode);

  return postcode === undefined ? { name, hierarchy } : { name, hierarchy, postcode };
}

/** Maps a `/search` body (an array of places) to Geocoder results, skipping malformed entries. */
export function mapSearch(body: unknown): GeocodeResult[] {
  if (!Array.isArray(body)) {
    throw new UpstreamError(NOMINATIM_SERVICE, 'nominatim: unexpected response shape', {
      retryable: false,
    });
  }
  const results: GeocodeResult[] = [];
  for (const place of body) {
    if (!isRecord(place)) continue;
    const lat = Number(place.lat);
    const lng = Number(place.lon);
    const label = stringOrUndefined(place.display_name);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || label === undefined) continue;
    const address = isRecord(place.address) ? place.address : {};
    results.push({ label, location: { lat, lng }, countryCode: countryCode(address) });
  }
  return results;
}

function mapHierarchy(address: Record<string, unknown>): NeighbourhoodHierarchy {
  const hierarchy: NeighbourhoodHierarchy = { countryCode: countryCode(address) };
  const suburb = firstString(address, ['suburb', 'city_district', 'borough', 'quarter']);
  const city = firstString(address, ['city', 'town', 'village', 'municipality']);
  const region = firstString(address, ['state', 'region', 'county', 'state_district']);
  const country = stringOrUndefined(address.country);
  if (suburb) hierarchy.suburb = suburb;
  if (city) hierarchy.city = city;
  if (region) hierarchy.region = region;
  if (country) hierarchy.country = country;
  return hierarchy;
}

function countryCode(address: Record<string, unknown>): string {
  const code = stringOrUndefined(address.country_code)?.toUpperCase();
  return code !== undefined && /^[A-Z]{2}$/.test(code) ? code : UNKNOWN_COUNTRY_CODE;
}

function firstString(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = stringOrUndefined(record[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function firstDisplaySegment(value: unknown): string | undefined {
  const display = stringOrUndefined(value);
  const segment = display?.split(',')[0]?.trim();
  return segment ? segment : undefined;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
