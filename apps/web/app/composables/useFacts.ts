import type { Location } from '@house-cost/domain';

import { cachedApiData, factsKey, upstreamErrorOf } from '~/utils/api';

/**
 * Neighbourhood Facts for the Search Area from `GET /api/facts`, keyed on the rounded Location
 * and Search Radius like `useHouses`, so the amenities and Housing Mix describe the same area
 * as the map and the list. Browser-only and cached the same way. `facts.priceSummary === null`
 * is a normal value ("no open price data here"), never an error. The request goes out after the
 * shell's first paint (`useAfterFirstPaint`).
 */
export function useFacts(
  location: MaybeRefOrGetter<Location | null>,
  radiusMetres: MaybeRefOrGetter<number>,
) {
  const centre = computed(() => toValue(location));
  const radius = computed(() => toValue(radiusMetres));
  const painted = useAfterFirstPaint();
  const key = computed(() => factsKey(centre.value, radius.value));

  const { data, status, error, refresh } = useFetch('/api/facts', {
    key,
    query: computed(() => ({
      lat: centre.value?.lat,
      lng: centre.value?.lng,
      radius: radius.value,
    })),
    server: false,
    lazy: true,
    // `enabled` alone never starts a request when it turns true; the gate is a watch source too.
    watch: [painted],
    enabled: () => painted.value && centre.value !== null,
    getCachedData: cachedApiData,
  });

  const facts = computed(() => data.value?.data ?? null);
  const countryCode = computed(() => facts.value?.hierarchy.countryCode);
  const upstreamError = computed(() => upstreamErrorOf(error.value));

  return { key, result: data, facts, countryCode, status, error, upstreamError, refresh };
}
