<script setup lang="ts">
import type { Location } from '@house-cost/domain';

import { searchAreaLabel, searchAreaSummary } from '~/utils/map/summary';
import type { HouseMapProps, MapPlaceholderState } from '~/utils/map/types';

/**
 * SSR-safe wrapper around the client-only map. Renders the fixed-height placeholder, the
 * `aria-live` summary, and forwards props and events. The placeholder lives here, outside
 * `<ClientOnly>`, so the node the server rendered is hydrated in place rather than replaced:
 * Chrome only keeps it as the largest contentful paint if it survives hydration (ticket 13).
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
/** Count-free so the server-rendered text never changes size while the map loads. */
const placeholderSummary = computed(() => searchAreaLabel(props.centre, props.radiusMetres));

/** Loading until the map reports otherwise; identical on the server and before hydration. */
const placeholder = ref<MapPlaceholderState | null>({ status: 'loading' });
const houseMap = useTemplateRef<{ retry: () => Promise<void> }>('houseMap');

function retry() {
  void houseMap.value?.retry();
}
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
        ref="houseMap"
        v-bind="props"
        @select="emit('select', $event)"
        @search-here="emit('search-here', $event)"
        @radius-change="emit('radius-change', $event)"
        @placeholder="placeholder = $event"
      >
        <template v-if="$slots.locate" #locate="slotProps">
          <slot name="locate" v-bind="slotProps" />
        </template>
      </HouseMap>
    </ClientOnly>
    <MapPlaceholder
      v-if="placeholder"
      :summary="placeholderSummary"
      :status="placeholder.status"
      spinner="delayed"
      :detail="placeholder.detail"
      @retry="retry"
    />
  </div>
</template>

<style scoped>
.house-map-frame {
  height: var(--house-map-height, 100dvh);
  --house-map-bottom-inset: calc(var(--house-map-peek, 15dvh) + 16px + env(safe-area-inset-bottom));
  --house-map-top-inset: calc(env(safe-area-inset-top) + var(--house-map-top-offset, 16px));
}
</style>
