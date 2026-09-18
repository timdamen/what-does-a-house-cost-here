import {
  countHousingMix,
  HOUSE_CAP,
  roundLocation,
  type DataProvider,
  type HouseRef,
  type Location,
  type Provenance,
  type SearchArea,
} from '@house-cost/domain';

import { createHttpClient, type FetchLike, type HttpClient } from './http-client';
import { createTtlMemo } from './memo';
import {
  createNominatimClient,
  NOMINATIM_SOURCE,
  NOMINATIM_URL,
  type NominatimClient,
} from './nominatim';
import { fetchAmenities } from './overpass/amenities';
import { OVERPASS_SOURCE, OVERPASS_URL } from './overpass/client';
import { searchHousesOverpass, type OverpassHouseSearch } from './overpass/houses';
import { createLandRegistryAdapter, LAND_REGISTRY_URL } from './prices/land-registry-gb';
import { createPriceRegistry, type PriceAdapter } from './prices/registry';

/** Default concurrency across all upstream services. */
export const DEFAULT_CONCURRENCY = 2;

/**
 * How long a `searchHouses` answer is kept so `getNeighbourhoodFacts` for the same Search Area
 * (the app requests both at once) reuses it instead of running the Overpass query twice.
 */
export const HOUSES_MEMO_TTL_MS = 10 * 60 * 1000;
const HOUSES_MEMO_ENTRIES = 64;

export interface OpenDataOptions {
  /** Identifying `User-Agent`, e.g. `what-does-a-house-cost-here/0.1 (+https://example.org)`. */
  userAgent: string;
  /** Upstream requests in flight at once, across all services. Default `DEFAULT_CONCURRENCY`. */
  concurrency?: number;
  /** Defaults to `globalThis.fetch`. Tests inject a stub serving recorded fixtures. */
  fetch?: FetchLike;
  /** Clock for `provenance.fetchedAt` and the price summary window. Default `() => new Date()`. */
  now?: () => Date;
  overpassUrl?: string;
  nominatimUrl?: string;
  landRegistryUrl?: string;
  /** Replaces the default price adapters (HM Land Registry for `GB`). */
  priceAdapters?: readonly PriceAdapter[];
}

/**
 * What the provider and the geocoder share: one HTTP client (so the concurrency limit holds
 * across both) and one Nominatim client (so its single-slot, once-per-second gate does too).
 * Build it once per process with `createOpenDataRuntime` and hand it to both factories.
 */
export interface OpenDataRuntime {
  client: HttpClient;
  nominatim: NominatimClient;
  now: () => Date;
  overpassUrl: string;
  landRegistryUrl: string;
  priceAdapters: readonly PriceAdapter[] | undefined;
}

/** Resolves options to defaults and builds the shared HTTP and Nominatim clients. */
export function createOpenDataRuntime(options: OpenDataOptions): OpenDataRuntime {
  const client = createHttpClient({
    userAgent: options.userAgent,
    concurrency: options.concurrency ?? DEFAULT_CONCURRENCY,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  return {
    client,
    nominatim: createNominatimClient(client, options.nominatimUrl ?? NOMINATIM_URL),
    now: options.now ?? (() => new Date()),
    overpassUrl: options.overpassUrl ?? OVERPASS_URL,
    landRegistryUrl: options.landRegistryUrl ?? LAND_REGISTRY_URL,
    priceAdapters: options.priceAdapters,
  };
}

/**
 * The open-data `DataProvider`: Houses from Overpass, Neighbourhood Facts from Nominatim plus
 * Overpass plus the regional price registry, Price Signals from the registry.
 *
 * `provenance.source` values: `openstreetmap-overpass` for `searchHouses`; the contributing
 * sources joined with `+` for `getNeighbourhoodFacts` (`nominatim+openstreetmap-overpass`, plus
 * the price register when one served the region); the register's source for `getPriceSignals`,
 * or `nominatim` when only the country lookup ran.
 *
 * Locations are rounded to 4 decimals before any upstream call so equal inputs produce equal
 * requests (and cache keys). The Houses of a Search Area are memoised for `HOUSES_MEMO_TTL_MS`
 * because the facts need them too (the Housing Mix and the register's postcodes) and the app
 * asks for Houses and facts at the same moment.
 */
export function createOpenDataProvider(runtime: OpenDataRuntime): DataProvider {
  const { client, nominatim, now, overpassUrl } = runtime;
  const registry = createPriceRegistry(
    runtime.priceAdapters ?? [
      createLandRegistryAdapter({ client, url: runtime.landRegistryUrl, now }),
    ],
  );
  const housesMemo = createTtlMemo<OverpassHouseSearch>({
    ttlMs: HOUSES_MEMO_TTL_MS,
    maxEntries: HOUSES_MEMO_ENTRIES,
    now: () => now().getTime(),
  });

  const provenance = (source: string): Provenance => ({ source, fetchedAt: now().toISOString() });

  /** Houses of a rounded Search Area, shared between the two operations that need them. */
  const housesIn = (area: SearchArea) =>
    housesMemo.get(areaKey(area), () => searchHousesOverpass(client, overpassUrl, area, HOUSE_CAP));

  return {
    async searchHouses(area) {
      const result = await housesIn(roundArea(area));
      return { ...result, provenance: provenance(OVERPASS_SOURCE) };
    },

    async getNeighbourhoodFacts(area) {
      const rounded = roundArea(area);
      const [place, houses, amenities] = await Promise.all([
        nominatim.reverse(rounded.centre),
        housesIn(rounded),
        fetchAmenities(client, overpassUrl, rounded),
      ]);

      const adapter = registry.adapterFor(place.hierarchy.countryCode);
      const priceSummary = adapter ? await adapter.getPriceSummary(houses.data) : null;
      const sources = [NOMINATIM_SOURCE, OVERPASS_SOURCE, ...(adapter ? [adapter.source] : [])];

      return {
        data: {
          name: place.name,
          hierarchy: place.hierarchy,
          priceSummary,
          amenities,
          housingMix: countHousingMix(houses.data),
        },
        provenance: provenance(sources.join('+')),
      };
    },

    async getPriceSignals(houses) {
      if (houses.length === 0) return { data: [], provenance: provenance(NOMINATIM_SOURCE) };
      const place = await nominatim.reverse(roundLocation(centroid(houses)));
      const adapter = registry.adapterFor(place.hierarchy.countryCode);
      if (!adapter) return { data: [], provenance: provenance(NOMINATIM_SOURCE) };
      const data = await adapter.getPriceSignals(houses);
      return { data, provenance: provenance(adapter.source) };
    },
  };
}

function roundArea(area: SearchArea): SearchArea {
  return { centre: roundLocation(area.centre), radiusMetres: area.radiusMetres };
}

function areaKey(area: SearchArea): string {
  return `${area.centre.lat}:${area.centre.lng}:${area.radiusMetres}`;
}

/** Arithmetic mean of the House locations; good enough to pick a country. */
function centroid(houses: readonly HouseRef[]): Location {
  let lat = 0;
  let lng = 0;
  for (const house of houses) {
    lat += house.location.lat;
    lng += house.location.lng;
  }
  return { lat: lat / houses.length, lng: lng / houses.length };
}
