<script setup lang="ts">
import type { Location } from '@house-cost/domain';

import { RADIUS_OPTIONS } from '~/utils/map/radius';
import type { CentreRequest, MapHouse } from '~/utils/map/types';
import { SHEET_SNAP_CSS, type SheetSnap } from '~/utils/sheet';

/**
 * The One-Pager. Without a Location in the URL it shows the prompt. With one: a header bar
 * (app name, place search, locate me), the map filling the viewport, and the Bottom Sheet with
 * the house list and Neighbourhood Facts sections. The shell is server-rendered and interactive
 * before the map script loads; houses, facts and prices are fetched in the browser and cached
 * per Search Area (ADR-0006 says why they are not server-rendered).
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
  result: housesResult,
  houses,
  truncated,
  status: housesStatus,
  upstreamError: housesError,
  refresh: refreshHouses,
} = useHouses(location, radius);
const {
  result: factsResult,
  facts,
  countryCode,
  status: factsStatus,
  upstreamError: factsError,
  refresh: refreshFacts,
} = useFacts(location, radius);
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

/** Any fetch that failed, whatever the cause, shows the retry card (user story 41). */
const failed = computed(
  () =>
    housesStatus.value === 'error' ||
    factsStatus.value === 'error' ||
    pricesStatus.value === 'error',
);
/** The typed envelope of a 502, when the failure was one; names the service on the card. */
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
  if (housesStatus.value === 'error') refreshes.push(refreshHouses());
  if (factsStatus.value === 'error') refreshes.push(refreshFacts());
  if (pricesStatus.value === 'error') refreshes.push(refreshPrices());
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
watch(failed, (hasFailed) => {
  if (hasFailed && sheetSnap.value === 'peek') sheetSnap.value = 'half';
});

/** ADR-0006: choosing a House brings the sheet up to at least half, so its card is in view. */
function showCard() {
  if (sheetSnap.value === 'peek') sheetSnap.value = 'half';
}

/** The map only pans when the tapped House is hidden (user story 26, map side). */
function onMapSelect(houseId: string | null) {
  void select(houseId);
  if (houseId) showCard();
}

/** A list row always centres the map on its House (user story 26); a fresh request each tap. */
const centreOn = ref<CentreRequest | null>(null);

function onListSelect(houseId: string) {
  void select(houseId);
  centreOn.value = { houseId };
  showCard();
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

// Neighbourhood Facts (ticket 10): provenance for "About this data" and the Amenity the map
// should point at. A new Location drops the focus; ADR-0006 collapses the sheet to half so the
// map is visible when an Amenity is focused.
const factsProvenance = computed(() => factsResult.value?.provenance ?? null);
const housesProvenance = computed(() => housesResult.value?.provenance ?? null);
const amenityFocus = ref<Location | null>(null);

function onFocusAmenity(target: Location) {
  // A fresh object so tapping the same Amenity again reveals it again.
  amenityFocus.value = { lat: target.lat, lng: target.lng };
  sheetSnap.value = 'half';
}

watch(location, () => {
  amenityFocus.value = null;
  centreOn.value = null;
});

/**
 * The sheet's phone heights, from the one module that owns them. The stylesheet maps them onto
 * `--sheet-peek` and `--sheet-height`, which drop to zero at the side-panel breakpoint where the
 * map sits beside the panel instead of under it.
 */
const sheetVars = computed(() => ({
  '--sheet-peek-phone': SHEET_SNAP_CSS.peek,
  '--sheet-height-phone': SHEET_SNAP_CSS[sheetSnap.value],
}));
</script>

<template>
  <main
    v-if="!location"
    class="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 pb-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]"
  >
    <h1 class="text-2xl font-semibold">{{ APP_NAME }}</h1>
    <LocationPrompt />
  </main>

  <div v-else class="one-pager relative overflow-hidden" :style="sheetVars" data-testid="one-pager">
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
        :centre-on="centreOn"
        :user-position="userPosition"
        :country-code="countryCode"
        :amenity-focus="amenityFocus"
        peek-height="var(--sheet-peek)"
        sheet-height="var(--sheet-height)"
        :test-hook="config.public.testHooks"
        @select="onMapSelect"
        @search-here="onSearchHere"
        @radius-change="onRadiusChange"
      />
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
        v-if="failed"
        class="mb-4"
        :service="upstreamError?.service"
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
          :country-code="countryCode"
          :prices-status="pricesStatus"
          @select="onListSelect"
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
        <NeighbourhoodFacts
          :facts="facts"
          :provenance="factsProvenance"
          :houses-provenance="housesProvenance"
          :status="factsStatus"
          :country-code="countryCode"
          @focus-amenity="onFocusAmenity"
        />
      </section>
    </BottomSheet>
  </div>
</template>

<style scoped>
@reference '../assets/css/main.css';

.one-pager {
  /* The sheet's heights (inline, from `~/utils/sheet`); the map stacks its controls above the peek. */
  --sheet-peek: var(--sheet-peek-phone);
  --sheet-height: var(--sheet-height-phone);
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
@media (width >= --theme(--breakpoint-panel)) {
  .one-pager {
    --sheet-peek: 0px;
    --sheet-height: 0px;
  }

  .one-pager__header,
  .one-pager__map {
    width: 66.667%;
  }
}
</style>
