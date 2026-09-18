import type { Location } from '@house-cost/domain';

import { cachedApiData, factsKey, upstreamErrorOf } from '~/utils/api';

/**
 * Neighbourhood Facts for the Location from `GET /api/facts`, keyed on the rounded Location.
 * Browser-only and cached like `useHouses`. `facts.priceSummary === null` is a normal value
 * ("no open price data here"), never an error.
 */
export function useFacts(location: MaybeRefOrGetter<Location | null>) {
  const centre = computed(() => toValue(location));
  const key = computed(() => factsKey(centre.value));

  const { data, status, error, refresh } = useFetch('/api/facts', {
    key,
    query: computed(() => ({ lat: centre.value?.lat, lng: centre.value?.lng })),
    server: false,
    lazy: true,
    enabled: () => centre.value !== null,
    getCachedData: cachedApiData,
  });

  const facts = computed(() => data.value?.data ?? null);
  const countryCode = computed(() => facts.value?.hierarchy.countryCode);
  const upstreamError = computed(() => upstreamErrorOf(error.value));

  return { key, result: data, facts, countryCode, status, error, upstreamError, refresh };
}
