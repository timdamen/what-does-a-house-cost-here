import {
  countHousingMix,
  HOUSE_CAP,
  roundLocation,
  type DataProvider,
  type House,
  type Location,
  type Provenance,
  type SearchArea,
} from '@house-cost/domain';

import { createHttpClient, type FetchLike, type HttpClient } from './http-client';
import { createNominatimClient, NOMINATIM_SOURCE, NOMINATIM_URL } from './nominatim';
import { fetchAmenities } from './overpass/amenities';
import { OVERPASS_SOURCE, OVERPASS_URL } from './overpass/client';
import { searchHousesOverpass } from './overpass/houses';
import { createLandRegistryAdapter, LAND_REGISTRY_URL } from './prices/land-registry-gb';
import { createPriceRegistry, type PriceAdapter, type PriceRegistry } from './prices/registry';

/** Default concurrency across all upstream services. */
export const DEFAULT_CONCURRENCY = 2;

/**
 * Radius, in metres, within which `getNeighbourhoodFacts` gathers amenities and the housing mix.
 * Matches the app's default Search Radius.
 */
export const DEFAULT_FACTS_RADIUS_METRES = 500;

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
  /** See `DEFAULT_FACTS_RADIUS_METRES`. */
  factsRadiusMetres?: number;
  /** Replaces the default price adapters (HM Land Registry for `GB`). */
  priceAdapters?: readonly PriceAdapter[];
}

interface OpenDataRuntime {
  client: HttpClient;
  now: () => Date;
  overpassUrl: string;
  nominatimUrl: string;
  registry: PriceRegistry;
  factsRadiusMetres: number;
}

/** Resolves options to defaults and builds the shared HTTP client. Also used by the geocoder. */
export function createOpenDataRuntime(options: OpenDataOptions): OpenDataRuntime {
  const client = createHttpClient({
    userAgent: options.userAgent,
    concurrency: options.concurrency ?? DEFAULT_CONCURRENCY,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  const now = options.now ?? (() => new Date());
  const adapters = options.priceAdapters ?? [
    createLandRegistryAdapter({ client, url: options.landRegistryUrl ?? LAND_REGISTRY_URL, now }),
  ];
  return {
    client,
    now,
    overpassUrl: options.overpassUrl ?? OVERPASS_URL,
    nominatimUrl: options.nominatimUrl ?? NOMINATIM_URL,
    registry: createPriceRegistry(adapters),
    factsRadiusMetres: options.factsRadiusMetres ?? DEFAULT_FACTS_RADIUS_METRES,
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
 * requests (and cache keys).
 */
export function createOpenDataProvider(options: OpenDataOptions): DataProvider {
  const runtime = createOpenDataRuntime(options);
  const { client, now, overpassUrl, registry } = runtime;
  const nominatim = createNominatimClient(client, runtime.nominatimUrl);

  const provenance = (source: string): Provenance => ({ source, fetchedAt: now().toISOString() });

  return {
    async searchHouses(area) {
      const rounded = roundArea(area);
      const result = await searchHousesOverpass(client, overpassUrl, rounded, HOUSE_CAP);
      return { ...result, provenance: provenance(OVERPASS_SOURCE) };
    },

    async getNeighbourhoodFacts(location) {
      const centre = roundLocation(location);
      const area: SearchArea = { centre, radiusMetres: runtime.factsRadiusMetres };
      const [place, houses, amenities] = await Promise.all([
        nominatim.reverse(centre),
        searchHousesOverpass(client, overpassUrl, area, HOUSE_CAP),
        fetchAmenities(client, overpassUrl, area),
      ]);

      const adapter = registry.adapterFor(place.hierarchy.countryCode);
      const priceSummary = adapter ? await adapter.getPriceSummary(area, houses.data) : null;
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

/** Arithmetic mean of the House locations; good enough to pick a country. */
function centroid(houses: readonly House[]): Location {
  let lat = 0;
  let lng = 0;
  for (const house of houses) {
    lat += house.location.lat;
    lng += house.location.lng;
  }
  return { lat: lat / houses.length, lng: lng / houses.length };
}
