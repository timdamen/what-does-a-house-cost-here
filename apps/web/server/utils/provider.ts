import {
  createFixtureGeocoder,
  createFixtureProvider,
  UpstreamError,
  type DataProvider,
  type Geocoder,
} from '@house-cost/domain';
import {
  createNominatimGeocoder,
  createOpenDataProvider,
  type OpenDataOptions,
} from '@house-cost/open-data';
import type { H3Event } from 'h3';

/**
 * Values `runtimeConfig.dataProvider` (env `NUXT_DATA_PROVIDER`) accepts.
 * `failing` exists for tests only: every operation rejects with an `UpstreamError`.
 */
export const PROVIDER_NAMES = ['fixture', 'open-data', 'failing'] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];

interface ProviderSet {
  provider: DataProvider;
  geocoder: Geocoder;
}

/** Service name the `failing` provider reports in its `UpstreamError`. */
export const FAILING_SERVICE = 'failing-provider';

/** Upstream requests in flight at once across Overpass, Nominatim and the price registers. */
export const OPEN_DATA_CONCURRENCY = 2;

const providerSets = new Map<ProviderName, ProviderSet>();

function isProviderName(value: unknown): value is ProviderName {
  return typeof value === 'string' && (PROVIDER_NAMES as readonly string[]).includes(value);
}

/** The provider selected by runtime config. Exported so cache keys can include it. */
export function providerName(event: H3Event): ProviderName {
  const { dataProvider } = useRuntimeConfig(event);
  if (!isProviderName(dataProvider)) {
    throw new Error(
      `Unknown dataProvider "${String(dataProvider)}"; expected one of ${PROVIDER_NAMES.join(', ')}`,
    );
  }
  return dataProvider;
}

function fail(): never {
  throw new UpstreamError(FAILING_SERVICE, 'Simulated upstream failure', { retryable: true });
}

function createFailingSet(): ProviderSet {
  return {
    provider: {
      async searchHouses() {
        return fail();
      },
      async getNeighbourhoodFacts() {
        return fail();
      },
      async getPriceSignals() {
        return fail();
      },
    },
    geocoder: {
      async search() {
        return fail();
      },
    },
  };
}

/**
 * The real adapters. `userAgent` comes from `runtimeConfig.userAgent` (env `NUXT_USER_AGENT`,
 * default set in `nuxt.config.ts`); the upstream policies require it to identify this deployment.
 */
function createOpenDataSet(event: H3Event): ProviderSet {
  const { userAgent } = useRuntimeConfig(event);
  if (typeof userAgent !== 'string' || userAgent.trim() === '') {
    throw new Error('runtimeConfig.userAgent (NUXT_USER_AGENT) must be a non-empty string');
  }
  const options: OpenDataOptions = { userAgent, concurrency: OPEN_DATA_CONCURRENCY };
  return {
    provider: createOpenDataProvider(options),
    geocoder: createNominatimGeocoder(options),
  };
}

function createProviderSet(name: ProviderName, event: H3Event): ProviderSet {
  switch (name) {
    case 'fixture':
      return { provider: createFixtureProvider(), geocoder: createFixtureGeocoder() };
    case 'failing':
      return createFailingSet();
    case 'open-data':
      return createOpenDataSet(event);
  }
}

/**
 * Providers are singletons per server instance: the fixture town is generated once and the
 * open-data adapters share one HTTP client so the concurrency limit holds across requests.
 */
function resolveProviderSet(event: H3Event): ProviderSet {
  const name = providerName(event);
  let set = providerSets.get(name);
  if (!set) {
    set = createProviderSet(name, event);
    providerSets.set(name, set);
  }
  return set;
}

/** The Data Provider the server routes use, chosen by `runtimeConfig.dataProvider`. */
export function useDataProvider(event: H3Event): DataProvider {
  return resolveProviderSet(event).provider;
}

/** The Geocoder behind `GET /api/geocode`, chosen by `runtimeConfig.dataProvider`. */
export function useGeocoder(event: H3Event): Geocoder {
  return resolveProviderSet(event).geocoder;
}
