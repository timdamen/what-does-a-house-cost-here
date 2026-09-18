import type { House, PriceSignal } from '@house-cost/domain';

import { cachedApiData, pricesKey, upstreamErrorOf } from '~/utils/api';

/**
 * Price Signals for a set of Houses from `POST /api/prices`, fetched after the Houses arrive and
 * keyed on the set of house ids, so a retry of the same area reuses them. An empty result means
 * "no open price data for this region", which is normal. `byHouseId` is what the page merges into
 * `MapHouse.priceSignal`.
 */
export function usePrices(houses: MaybeRefOrGetter<readonly House[]>) {
  const list = computed(() => toValue(houses));
  const key = computed(() => pricesKey(list.value));

  const { data, status, error, refresh } = useFetch('/api/prices', {
    method: 'POST',
    key,
    body: computed(() => ({
      houses: list.value.map(({ id, location, address }) => ({ id, location, address })),
    })),
    server: false,
    lazy: true,
    enabled: () => list.value.length > 0,
    getCachedData: cachedApiData,
  });

  const signals = computed(() => data.value?.data ?? []);
  const byHouseId = computed(
    () => new Map<string, PriceSignal>(signals.value.map((signal) => [signal.houseId, signal])),
  );
  const upstreamError = computed(() => upstreamErrorOf(error.value));

  return { key, result: data, signals, byHouseId, status, error, upstreamError, refresh };
}
