import {
  createFixtureGeocoder,
  createFixtureProvider,
  UpstreamError,
  type DataProvider,
  type Geocoder,
} from '@house-cost/domain';
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

function createProviderSet(name: ProviderName): ProviderSet {
  switch (name) {
    case 'fixture':
      return { provider: createFixtureProvider(), geocoder: createFixtureGeocoder() };
    case 'failing':
      return createFailingSet();
    case 'open-data':
      // Ticket 11 replaces this branch with the @house-cost/open-data adapters.
      throw new Error(
        'dataProvider "open-data" is not wired yet; set NUXT_DATA_PROVIDER=fixture until ticket 11 lands',
      );
  }
}

/** Providers are singletons per server instance; the fixture town is generated once. */
function resolveProviderSet(event: H3Event): ProviderSet {
  const name = providerName(event);
  let set = providerSets.get(name);
  if (!set) {
    set = createProviderSet(name);
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
