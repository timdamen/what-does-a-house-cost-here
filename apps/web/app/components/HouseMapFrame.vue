<script setup lang="ts">
import type { Location } from '@house-cost/domain';

import { searchAreaSummary } from '~/utils/map/summary';
import type { HouseMapProps } from '~/utils/map/types';

/**
 * SSR-safe wrapper around the client-only map. Renders the fixed-height placeholder on the
 * server (and until hydration), the `aria-live` summary, and forwards props and events.
 * The frame is `100dvh` tall by default (the bottom sheet overlays it); override with
 * `--house-map-height`. Ticket 08 sets `--house-map-top-offset` to its header height so the
 * "Search here" pill and desktop zoom buttons clear it.
 */
const props = withDefaults(defineProps<HouseMapProps>(), {
  selectedHouseId: null,
  userPosition: null,
  amenityFocus: null,
  countryCode: undefined,
  peekHeight: '15dvh',
  testHook: false,
});

const emit = defineEmits<{
  select: [houseId: string | null];
  'search-here': [centre: Location];
  'radius-change': [metres: number];
}>();

const summary = computed(() =>
  searchAreaSummary(props.centre, props.radiusMetres, props.houses.length),
);
</script>

<template>
  <div
    class="house-map-frame relative w-full overflow-hidden"
    :style="{ '--house-map-peek': peekHeight }"
    data-testid="house-map-frame"
  >
    <p class="sr-only" aria-live="polite">{{ summary }}</p>
    <ClientOnly>
      <HouseMap
        v-bind="props"
        @select="emit('select', $event)"
        @search-here="emit('search-here', $event)"
        @radius-change="emit('radius-change', $event)"
      >
        <template v-if="$slots.locate" #locate="slotProps">
          <slot name="locate" v-bind="slotProps" />
        </template>
      </HouseMap>
      <template #fallback>
        <MapPlaceholder :summary="summary" status="loading" spinner="delayed" />
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.house-map-frame {
  height: var(--house-map-height, 100dvh);
  --house-map-bottom-inset: calc(var(--house-map-peek, 15dvh) + 16px + env(safe-area-inset-bottom));
  --house-map-top-inset: calc(env(safe-area-inset-top) + var(--house-map-top-offset, 16px));
}
</style>
