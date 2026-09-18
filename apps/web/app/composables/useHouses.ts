import type { Location } from '@house-cost/domain';

import { cachedApiData, housesKey, upstreamErrorOf } from '~/utils/api';

/**
 * Houses inside the Search Area from `GET /api/houses`, keyed on the rounded Location and
 * Search Radius. Fetched in the browser only (`server: false`): the server-rendered shell must
 * not wait on Overpass, which can take seconds for an uncached area (user story 39). Areas seen
 * before come back from the client cache at once (user story 40). The request goes out after the
 * shell's first paint (`useAfterFirstPaint`).
 */
export function useHouses(
  location: MaybeRefOrGetter<Location | null>,
  radiusMetres: MaybeRefOrGetter<number>,
) {
  const centre = computed(() => toValue(location));
  const radius = computed(() => toValue(radiusMetres));
  const painted = useAfterFirstPaint();
  const key = computed(() => housesKey(centre.value, radius.value));

  const { data, status, error, refresh } = useFetch('/api/houses', {
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

  const houses = computed(() => data.value?.data ?? []);
  const truncated = computed(() => data.value?.truncated ?? false);
  const upstreamError = computed(() => upstreamErrorOf(error.value));

  return { key, result: data, houses, truncated, status, error, upstreamError, refresh };
}
