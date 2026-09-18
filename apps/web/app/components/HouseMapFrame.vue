<script setup lang="ts">
import type { Location } from '@house-cost/domain';

import { searchAreaLabel, searchAreaSummary } from '~/utils/map/summary';
import type { HouseMapProps, MapPlaceholderState } from '~/utils/map/types';
import { SHEET_SNAP_CSS } from '~/utils/sheet';

/**
 * SSR-safe wrapper around the client-only map. Renders the fixed-height placeholder, the
 * `aria-live` summary, and forwards props and events. The placeholder lives here, as a sibling
 * of `<ClientOnly>` rather than its `#fallback`, so the node the server rendered is hydrated in
 * place rather than replaced: Chrome only keeps it as the largest contentful paint if it survives
 * hydration (ticket 13, ADR-0002). This is also where the props get their defaults; the map
 * component receives every prop resolved.
 * The frame is `100dvh` tall by default (the bottom sheet overlays it); override with
 * `--house-map-height`. Ticket 08 sets `--house-map-top-offset` to its header height so the
 * "Search here" pill and desktop zoom buttons clear it.
 */
const props = withDefaults(defineProps<HouseMapProps>(), {
  selectedHouseId: null,
  centreOn: null,
  userPosition: null,
  amenityFocus: null,
  countryCode: undefined,
  peekHeight: SHEET_SNAP_CSS.peek,
  sheetHeight: undefined,
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

const frameStyle = computed(() => ({
  '--house-map-peek': props.peekHeight,
  '--house-map-sheet': props.sheetHeight ?? props.peekHeight,
}));

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
    :style="frameStyle"
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
      />
    </ClientOnly>
    <MapPlaceholder
      v-if="placeholder"
      :summary="placeholderSummary"
      :status="placeholder.status"
      :detail="placeholder.detail"
      @retry="retry"
    />
  </div>
</template>

<style scoped>
.house-map-frame {
  height: var(--house-map-height, 100dvh);
  /* Controls and attribution stack above the peek; the camera keeps its targets above the sheet. */
  --house-map-bottom-inset: calc(var(--house-map-peek) + 16px + env(safe-area-inset-bottom));
  --house-map-camera-inset: calc(var(--house-map-sheet) + 16px + env(safe-area-inset-bottom));
  --house-map-top-inset: calc(env(safe-area-inset-top) + var(--house-map-top-offset, 16px));
}
</style>
