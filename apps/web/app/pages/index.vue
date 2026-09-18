<script setup lang="ts">
import type { Location } from '@house-cost/domain';

import { RADIUS_OPTIONS } from '~/utils/map/radius';
import type { MapHouse } from '~/utils/map/types';
import type { SheetSnap } from '~/utils/sheet';

/**
 * The One-Pager. Without a Location in the URL it shows the prompt. With one: a header bar
 * (app name, place search, locate me), the map filling the viewport, and the Bottom Sheet with
 * the house list and Neighbourhood Facts sections (skeletons here; tickets 09 and 10 fill them).
 * The shell is server-rendered and interactive before the map script loads; houses, facts and
 * prices are fetched in the browser and cached per area.
 */
const APP_NAME = 'What does a house cost here?';

useSeoMeta({
  title: APP_NAME,
  description:
    'See what houses cost around any place, and what it is like to live there, from open data. Share your location or search for a town, street or postcode.',
});

const { location, radius, selectedHouseId, setLocation, setRadius, select } = useLocation();
const { position: userPosition } = useGeolocation();
const config = useRuntimeConfig();

const {
  houses,
  truncated,
  cap,
  status: housesStatus,
  upstreamError: housesError,
  refresh: refreshHouses,
} = useHouses(location, radius);
const {
  facts,
  countryCode,
  status: factsStatus,
  upstreamError: factsError,
  refresh: refreshFacts,
} = useFacts(location);
const {
  byHouseId: priceByHouseId,
  status: pricesStatus,
  upstreamError: pricesError,
  refresh: refreshPrices,
} = usePrices(houses);

/** Houses with their Price Signal merged in once prices have arrived (`undefined` until then). */
const mapHouses = computed<MapHouse[]>(() =>
  houses.value.map((house) => ({
    ...house,
    priceSignal:
      pricesStatus.value === 'success' ? (priceByHouseId.value.get(house.id) ?? null) : undefined,
  })),
);

const upstreamError = computed(
  () => housesError.value ?? factsError.value ?? pricesError.value ?? null,
);
const retrying = computed(
  () =>
    housesStatus.value === 'pending' ||
    factsStatus.value === 'pending' ||
    pricesStatus.value === 'pending',
);

async function retry() {
  const refreshes: Promise<void>[] = [];
  if (housesError.value) refreshes.push(refreshHouses());
  if (factsError.value) refreshes.push(refreshFacts());
  if (pricesError.value) refreshes.push(refreshPrices());
  await Promise.all(refreshes);
}

/** The House behind `h=` in the URL, once the Houses are here; drives the card in the sheet. */
const selectedHouse = computed<MapHouse | null>(() =>
  selectedHouseId.value
    ? (mapHouses.value.find((house) => house.id === selectedHouseId.value) ?? null)
    : null,
);

function onCardClose() {
  void select(null);
}

const sheetSnap = ref<SheetSnap>('peek');
const searchOpen = ref(false);

/** A retry message hidden below the peek would be as good as a blank page (user story 41). */
watch(upstreamError, (failure) => {
  if (failure && sheetSnap.value === 'peek') sheetSnap.value = 'half';
});

function onSelect(houseId: string | null) {
  void select(houseId);
  // ADR-0006: choosing a House on the map brings the sheet up to at least half.
  if (houseId && sheetSnap.value === 'peek') sheetSnap.value = 'half';
}

function onSearchHere(centre: Location) {
  void setLocation(centre);
}

function onRadiusChange(metres: number) {
  const option = RADIUS_OPTIONS.find((candidate) => candidate === metres);
  if (option) void setRadius(option);
}

function onPlaceSelected() {
  searchOpen.value = false;
}

function onHeaderKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && searchOpen.value) {
    event.preventDefault();
    searchOpen.value = false;
  }
}
</script>

<template>
  <main
    v-if="!location"
    class="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 pb-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]"
  >
    <h1 class="text-2xl font-semibold">{{ APP_NAME }}</h1>
    <LocationPrompt />
  </main>

  <div v-else class="one-pager relative overflow-hidden" data-testid="one-pager">
    <header
      class="one-pager__header bg-default/90 border-default fixed inset-x-0 top-0 z-30 border-b backdrop-blur"
      data-testid="header"
      @keydown="onHeaderKeydown"
    >
      <div class="one-pager__bar flex items-center gap-2 px-4">
        <h1 class="min-w-0 flex-1 truncate text-base font-semibold">{{ APP_NAME }}</h1>
        <UButton
          type="button"
          icon="i-lucide-search"
          color="neutral"
          :variant="searchOpen ? 'solid' : 'subtle'"
          square
          aria-label="Search for a place"
          :aria-expanded="searchOpen"
          aria-controls="place-search-panel"
          :ui="{ base: 'min-h-12 min-w-12 justify-center' }"
          data-testid="search-toggle"
          @click="searchOpen = !searchOpen"
        />
        <LocateMeButton />
      </div>
      <div
        v-if="searchOpen"
        id="place-search-panel"
        class="bg-default border-default absolute inset-x-0 top-full border-b p-4 shadow-lg"
      >
        <PlaceSearch autofocus @select="onPlaceSelected" />
      </div>
    </header>

    <div class="one-pager__map">
      <HouseMapFrame
        :centre="location"
        :radius-metres="radius"
        :houses="mapHouses"
        :selected-house-id="selectedHouseId"
        :user-position="userPosition"
        :country-code="countryCode"
        peek-height="var(--sheet-peek)"
        :test-hook="config.public.testHooks"
        @select="onSelect"
        @search-here="onSearchHere"
        @radius-change="onRadiusChange"
      >
        <!-- The header's LocateMeButton replaces the map's built-in locate control. -->
        <template #locate><span hidden aria-hidden="true" /></template>
      </HouseMapFrame>
    </div>

    <BottomSheet v-model:snap="sheetSnap">
      <template v-if="selectedHouse" #card>
        <HouseCard
          :house="selectedHouse"
          :centre="location"
          :country-code="countryCode"
          :prices-status="pricesStatus"
          @close="onCardClose"
        />
      </template>

      <ErrorRetry
        v-if="upstreamError"
        class="mb-4"
        :service="upstreamError.service"
        :retrying="retrying"
        @retry="retry"
      />

      <section id="houses" aria-labelledby="houses-heading" class="flex flex-col gap-3">
        <HouseList
          v-if="housesStatus === 'success'"
          :houses="mapHouses"
          :centre="location"
          :selected-house-id="selectedHouseId"
          :truncated="truncated"
          :cap="cap"
          :country-code="countryCode"
          :prices-status="pricesStatus"
          @select="onSelect"
        />
        <template v-else>
          <div class="flex min-h-12 items-center justify-between gap-3">
            <h2 id="houses-heading" class="text-base font-semibold">Houses</h2>
            <USkeleton class="h-4 w-36" />
          </div>
          <div class="flex flex-col gap-2" aria-busy="true" data-testid="houses-skeleton">
            <USkeleton v-for="n in 4" :key="n" class="h-14 w-full" />
          </div>
        </template>
      </section>

      <section
        id="neighbourhood"
        aria-labelledby="neighbourhood-heading"
        class="mt-6 flex flex-col gap-3"
      >
        <div class="flex min-h-12 items-center justify-between gap-3">
          <h2 id="neighbourhood-heading" class="text-base font-semibold">Neighbourhood</h2>
          <p v-if="factsStatus === 'success' && facts" class="text-muted truncate text-sm">
            {{ facts.name }}
          </p>
          <USkeleton v-else class="h-4 w-28" />
        </div>
        <div
          v-if="factsStatus !== 'success'"
          class="grid grid-cols-2 gap-2"
          aria-busy="true"
          data-testid="neighbourhood-skeleton"
        >
          <USkeleton v-for="n in 4" :key="n" class="h-20 w-full" />
        </div>
      </section>
    </BottomSheet>
  </div>
</template>

<style scoped>
.one-pager {
  /* Mirrors the Bottom Sheet's peek; the map stacks its controls above it. */
  --sheet-peek: max(96px, 15dvh);
  --one-pager-header-height: 3.5rem;
  height: 100dvh;
}

.one-pager__header {
  padding-top: env(safe-area-inset-top);
}

.one-pager__bar {
  height: var(--one-pager-header-height);
}

.one-pager__map {
  /* Read by HouseMapFrame: keeps "Search here" and the desktop zoom buttons under the header. */
  --house-map-top-offset: calc(var(--one-pager-header-height) + 16px);
}

/* Research decision 2: side panel at the Android "expanded" width, map beside it. */
@media (min-width: 840px) {
  .one-pager {
    --sheet-peek: 0px;
  }

  .one-pager__header,
  .one-pager__map {
    width: 66.667%;
  }
}
</style>
