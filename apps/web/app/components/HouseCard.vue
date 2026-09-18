<script setup lang="ts">
import type { Location } from '@house-cost/domain';
import { haversineMetres } from '@house-cost/domain';

import {
  buildingTypeLabel,
  formatSignalDate,
  houseAddressLabel,
  NO_PRICE_DATA,
  osmUrl,
  priceKindLabel,
  priceScopeLabel,
} from '~/utils/houses';
import type { MapHouse } from '~/utils/map/types';

/**
 * The compact card for the selected House (user story 13), rendered in the Bottom Sheet's `card`
 * slot above the list: address, building type, distance, the Price Signal with its kind, date and
 * scope (or "No price data"), and a link to the OSM object. Kept under 120 px on a phone so the
 * list is still visible at the half snap point. Closing emits `close`; the page clears `h`.
 */
const props = withDefaults(
  defineProps<{
    house: MapHouse;
    centre: Location;
    countryCode?: string;
    pricesStatus?: 'idle' | 'pending' | 'success' | 'error';
  }>(),
  { countryCode: undefined, pricesStatus: 'idle' },
);

const emit = defineEmits<{ close: [] }>();

const format = useLocaleFormat(() => props.countryCode);

const address = computed(() => houseAddressLabel(props.house.address));
const distance = computed(() =>
  format.distance(haversineMetres(props.centre, props.house.location)),
);
const signal = computed(() => props.house.priceSignal ?? null);
const price = computed(() =>
  signal.value ? format.price(signal.value.amount, signal.value.currency) : null,
);
const priceDetail = computed(() =>
  signal.value
    ? `${priceKindLabel(signal.value.kind)}, ${formatSignalDate(signal.value.date, format.locale.value)}, ${priceScopeLabel(signal.value.scope)}`
    : null,
);
const link = computed(() => osmUrl(props.house.id));
</script>

<template>
  <article
    class="house-card flex flex-col gap-1 pt-1"
    aria-labelledby="house-card-title"
    data-testid="house-card"
  >
    <div class="flex items-start gap-2">
      <div class="min-w-0 flex-1">
        <h2 id="house-card-title" class="text-highlighted truncate text-base font-semibold">
          {{ address }}
        </h2>
        <p class="text-muted text-sm">
          {{ buildingTypeLabel(house.buildingType) }}
          <span aria-hidden="true">·</span>
          {{ distance }} away
        </p>
      </div>
      <UButton
        type="button"
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        square
        aria-label="Close house card"
        :ui="{ base: 'min-h-11 min-w-11 justify-center -mr-2 -mt-1' }"
        data-testid="house-card-close"
        @click="emit('close')"
      />
    </div>

    <div class="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
      <p class="min-w-0" data-testid="house-card-price">
        <template v-if="signal">
          <span class="text-highlighted block text-lg font-semibold tabular-nums">{{ price }}</span>
          <span class="text-muted block text-xs">{{ priceDetail }}</span>
        </template>
        <template v-else-if="pricesStatus === 'pending'">
          <USkeleton class="h-6 w-24" />
          <span class="sr-only">Loading price</span>
        </template>
        <span v-else class="text-muted text-sm">{{ NO_PRICE_DATA }}</span>
      </p>
      <UButton
        v-if="link"
        :to="link"
        target="_blank"
        rel="noopener noreferrer"
        color="neutral"
        variant="link"
        size="sm"
        label="View on OpenStreetMap"
        trailing-icon="i-lucide-external-link"
        :ui="{ base: 'min-h-11 px-0' }"
        data-testid="house-card-osm"
      />
    </div>
  </article>
</template>
