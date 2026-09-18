<script setup lang="ts">
import type { Location } from '@house-cost/domain';
import { useVirtualizer } from '@tanstack/vue-virtual';
import type { ComponentPublicInstance } from 'vue';
import type { AsyncDataRequestStatus } from '#app';

import {
  buildingTypeLabel,
  countPriced,
  houseAddressLabel,
  houseCountSummary,
  type HouseSort,
  listHouses,
  NO_PRICE_DATA,
  priceKindLabel,
} from '~/utils/houses';
import type { MapHouse } from '~/utils/map/types';

/**
 * The house list inside the Bottom Sheet (spec "House List", user stories 23 to 30). The header
 * is one 48 px row so it fits the sheet's peek state: the count summary ("42 houses, 18 with a
 * price") and the sort toggle. Rows are buttons; tapping one emits `select`, and a selection made
 * elsewhere (the map) scrolls its row into view. Above `VIRTUALISE_ABOVE` rows the list is
 * virtualised with the nearest scrollable ancestor (the sheet body) as the scroll element.
 */
const props = withDefaults(
  defineProps<{
    houses: MapHouse[];
    centre: Location;
    selectedHouseId?: string | null;
    /** The Data Provider capped the result; the summary says so. */
    truncated?: boolean;
    /** ISO 3166-1 alpha-2 for currency and distance formatting. */
    countryCode?: string;
    /** Status of the prices fetch: rows show a placeholder until it settles. */
    pricesStatus?: AsyncDataRequestStatus;
    /** The scrolling ancestor; found by walking up from the list when not given. */
    scrollElement?: HTMLElement | null;
  }>(),
  {
    selectedHouseId: null,
    truncated: false,
    countryCode: undefined,
    pricesStatus: 'idle',
    scrollElement: null,
  },
);

const emit = defineEmits<{ select: [houseId: string] }>();

/** Plain rows up to here; several hundred Houses need virtualisation to scroll smoothly. */
const VIRTUALISE_ABOVE = 50;
const ESTIMATED_ROW_HEIGHT = 64;

const format = useLocaleFormat(() => props.countryCode);
const sort = ref<HouseSort>('distance');

const listed = computed(() => listHouses(props.houses, props.centre, sort.value));
const pricesKnown = computed(() => props.pricesStatus === 'success');
const summary = computed(() =>
  houseCountSummary(
    props.houses.length,
    countPriced(props.houses),
    pricesKnown.value,
    props.truncated,
  ),
);

const root = useTemplateRef<HTMLElement>('root');
const rows = useTemplateRef<HTMLElement>('rows');
const scrollParent = ref<HTMLElement | null>(null);
const scrollMargin = ref(0);

const virtualised = computed(
  () => props.houses.length > VIRTUALISE_ABOVE && scrollParent.value !== null,
);

const virtualizer = useVirtualizer(
  computed(() => ({
    count: virtualised.value ? listed.value.length : 0,
    getScrollElement: () => scrollParent.value,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 6,
    scrollMargin: scrollMargin.value,
    getItemKey: (index: number) => listed.value[index]?.house.id ?? index,
  })),
);

interface Row {
  index: number;
  house: MapHouse;
  distanceMetres: number;
  /** Offset inside the virtualised container; absent for plain rows. */
  start?: number;
}

const visibleRows = computed<Row[]>(() => {
  if (!virtualised.value) return listed.value.map((item, index) => ({ index, ...item }));
  return virtualizer.value.getVirtualItems().flatMap((item) => {
    const entry = listed.value[item.index];
    return entry ? [{ index: item.index, start: item.start, ...entry }] : [];
  });
});

const totalSize = computed(() => (virtualised.value ? virtualizer.value.getTotalSize() : 0));

function measureRow(element: Element | ComponentPublicInstance | null) {
  if (virtualised.value && element instanceof Element) virtualizer.value.measureElement(element);
}

function findScrollParent(element: HTMLElement | null): HTMLElement | null {
  for (let node = element?.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
  }
  return null;
}

/** Where the rows start inside the scroll element, so virtual offsets line up. */
function measureScrollMargin() {
  const container = rows.value;
  const scroller = scrollParent.value;
  if (!container || !scroller) return;
  scrollMargin.value =
    container.getBoundingClientRect().top -
    scroller.getBoundingClientRect().top +
    scroller.scrollTop;
}

onMounted(() => {
  scrollParent.value = props.scrollElement ?? findScrollParent(root.value);
  void nextTick(measureScrollMargin);
});

watch(
  () => props.scrollElement,
  (element) => {
    if (element) scrollParent.value = element;
  },
);

function rowFor(houseId: string): HTMLElement | null {
  return root.value?.querySelector<HTMLElement>(`[data-house-id="${CSS.escape(houseId)}"]`) ?? null;
}

/** How long a reveal keeps the row in view while the scroll viewport is still moving. */
const REVEAL_SETTLE_MS = 2000;

let revealFrame: number | undefined;
let stopRevealListeners: (() => void) | undefined;

function stopRevealing() {
  if (revealFrame !== undefined) cancelAnimationFrame(revealFrame);
  revealFrame = undefined;
  stopRevealListeners?.();
  stopRevealListeners = undefined;
}

/** The user taking hold of the list ends the reveal so it never fights their scroll. */
function stopRevealOnUserScroll(scroller: HTMLElement) {
  const events = ['pointerdown', 'wheel'] as const;
  for (const event of events) scroller.addEventListener(event, stopRevealing, { passive: true });
  return () => {
    for (const event of events) scroller.removeEventListener(event, stopRevealing);
  };
}

function scrollRowIntoView(index: number, houseId: string) {
  if (virtualised.value) {
    measureScrollMargin();
    virtualizer.value.scrollToIndex(index, { align: 'auto' });
    return;
  }
  rowFor(houseId)?.scrollIntoView?.({ block: 'nearest' });
}

/** Whether the row sits entirely inside the scroll element (or the viewport without one). */
function rowInView(houseId: string): boolean {
  const row = rowFor(houseId);
  if (!row) return false;
  const box = row.getBoundingClientRect();
  const frame = scrollParent.value?.getBoundingClientRect() ?? {
    top: 0,
    bottom: window.innerHeight,
  };
  return box.top >= frame.top && box.bottom <= frame.bottom;
}

/**
 * A selection from the map brings its row into view (user story 27). The scroll viewport keeps
 * moving for a moment after a selection: the Bottom Sheet grows from peek to half over 250 ms,
 * the House card is inserted above this list, and the virtualiser re-measures rows as they
 * render. A single scroll lands the row below the fold, so for a short while after the first
 * scroll every frame that finds the row outside the viewport scrolls it back in.
 */
async function revealSelected(houseId: string | null) {
  stopRevealing();
  if (!houseId) return;
  const index = listed.value.findIndex((item) => item.house.id === houseId);
  if (index === -1) return;
  await nextTick();
  scrollRowIntoView(index, houseId);

  const scroller = scrollParent.value;
  if (!scroller) return;
  stopRevealListeners = stopRevealOnUserScroll(scroller);
  const deadline = performance.now() + REVEAL_SETTLE_MS;
  const step = () => {
    revealFrame = undefined;
    if (performance.now() >= deadline) {
      stopRevealing();
      return;
    }
    if (!rowInView(houseId)) scrollRowIntoView(index, houseId);
    revealFrame = requestAnimationFrame(step);
  };
  revealFrame = requestAnimationFrame(step);
}

onBeforeUnmount(stopRevealing);

watch(() => props.selectedHouseId, revealSelected);
watch(sort, () => revealSelected(props.selectedHouseId));

function priceLabel(house: MapHouse): string | null {
  const signal = house.priceSignal;
  return signal ? format.priceAbbreviated(signal.amount, signal.currency) : null;
}
</script>

<template>
  <div ref="root" class="house-list flex flex-col gap-2" data-testid="house-list">
    <div class="flex min-h-12 items-center justify-between gap-3">
      <h2 id="houses-heading" class="sr-only">Houses</h2>
      <p class="text-muted min-w-0 text-sm" aria-live="polite" data-testid="house-count">
        {{ summary }}
      </p>
      <UFieldGroup size="sm" role="group" aria-label="Sort houses" data-testid="house-sort">
        <UButton
          type="button"
          label="Distance"
          color="neutral"
          :variant="sort === 'distance' ? 'solid' : 'outline'"
          :aria-pressed="sort === 'distance'"
          :ui="{ base: 'min-h-11' }"
          data-testid="sort-distance"
          @click="sort = 'distance'"
        />
        <UButton
          type="button"
          label="Price"
          color="neutral"
          :variant="sort === 'price' ? 'solid' : 'outline'"
          :aria-pressed="sort === 'price'"
          :ui="{ base: 'min-h-11' }"
          data-testid="sort-price"
          @click="sort = 'price'"
        />
      </UFieldGroup>
    </div>

    <p v-if="houses.length === 0" class="text-muted py-2 text-sm" data-testid="house-list-empty">
      No residential buildings in OpenStreetMap within this Search Area. Try a wider radius.
    </p>

    <ul
      v-else
      ref="rows"
      class="house-list__rows relative m-0 list-none p-0"
      :class="{ 'house-list__rows--virtual': virtualised }"
      :style="virtualised ? { height: `${totalSize}px` } : undefined"
      :data-virtualised="virtualised"
    >
      <li
        v-for="row in visibleRows"
        :key="row.house.id"
        :ref="measureRow"
        :data-index="row.index"
        :aria-setsize="listed.length"
        :aria-posinset="row.index + 1"
        :class="virtualised ? 'absolute inset-x-0 top-0' : 'block'"
        :style="row.start === undefined ? undefined : { transform: `translateY(${row.start}px)` }"
      >
        <button
          type="button"
          class="flex min-h-14 w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors"
          :class="
            row.house.id === selectedHouseId
              ? 'bg-primary/10 ring-primary ring-1'
              : 'hover:bg-elevated focus-visible:bg-elevated'
          "
          :aria-current="row.house.id === selectedHouseId ? 'true' : undefined"
          :data-house-id="row.house.id"
          data-testid="house-row"
          @click="emit('select', row.house.id)"
        >
          <span class="min-w-0 flex-1">
            <span class="text-highlighted block truncate font-medium">
              {{ houseAddressLabel(row.house.address) }}
            </span>
            <span class="text-muted block text-sm">
              {{ buildingTypeLabel(row.house.buildingType) }}
              <span aria-hidden="true">·</span>
              {{ format.distance(row.distanceMetres) }}
            </span>
          </span>
          <span class="shrink-0 text-right">
            <template v-if="row.house.priceSignal">
              <span class="text-highlighted block font-semibold tabular-nums">
                {{ priceLabel(row.house) }}
              </span>
              <span class="text-muted block text-xs">
                {{ priceKindLabel(row.house.priceSignal.kind) }}
              </span>
            </template>
            <template v-else-if="pricesStatus === 'pending'">
              <USkeleton class="h-4 w-14" />
              <span class="sr-only">Loading price</span>
            </template>
            <span v-else class="text-muted text-sm">{{ NO_PRICE_DATA }}</span>
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>
