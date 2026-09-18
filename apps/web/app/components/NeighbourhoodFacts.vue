<script setup lang="ts">
import type { Location, NeighbourhoodFacts, Provenance } from '@house-cost/domain';
import type { AsyncDataRequestStatus } from '#app';

import {
  AMENITY_CLASS_ICONS,
  AMENITY_CLASS_LABELS,
  AMENITY_CLASS_ORDER,
  attributionsFor,
  formatIsoDate,
  formatTimestamp,
  hierarchyTrail,
  housingMixEntries,
  housingMixTotal,
  provenanceRows,
} from '~/utils/facts';

/**
 * The Neighbourhood Facts (spec user stories 31 to 38, 44): a buyer's brief that reads top to
 * bottom under five headings. It sits inside the `#neighbourhood` section of the Bottom Sheet,
 * below that section's own `h2`, so its headings are `h3`s. The Price Summary being `null` is
 * a first-class state with its own card, not an error. Tapping an Amenity emits `focus-amenity`
 * with its Location for the map. Skeletons are shown until the facts have arrived.
 */
const props = withDefaults(
  defineProps<{
    facts: NeighbourhoodFacts | null;
    /** Provenance of the facts themselves. */
    provenance?: Provenance | null;
    /** Provenance of the Houses in the Search Area (they feed the Housing Mix). */
    housesProvenance?: Provenance | null;
    status?: AsyncDataRequestStatus;
    /** ISO 3166-1 alpha-2 code driving number, currency and date formatting. */
    countryCode?: string;
  }>(),
  { provenance: null, housesProvenance: null, status: 'idle', countryCode: undefined },
);

const emit = defineEmits<{ 'focus-amenity': [location: Location] }>();

const id = useId();
const { locale, price, distance } = useLocaleFormat(() => props.countryCode);

const loading = computed(() => props.status === 'idle' || props.status === 'pending');

const trail = computed(() => (props.facts ? hierarchyTrail(props.facts.hierarchy) : []));

const asOf = computed(() =>
  props.facts?.priceSummary ? formatIsoDate(props.facts.priceSummary.asOf, locale.value) : '',
);

const sampleSentence = computed(() => {
  const summary = props.facts?.priceSummary;
  const size = summary?.sampleSize ?? 0;
  const count = new Intl.NumberFormat(locale.value).format(size);
  const months = summary?.windowMonths ?? 0;
  return `Based on ${count} ${size === 1 ? 'sale' : 'sales'} in the last ${months} months.`;
});

const countryName = computed(() => props.facts?.hierarchy.country?.trim() || 'this country');

const amenityGroups = computed(() =>
  AMENITY_CLASS_ORDER.map((amenityClass) => ({
    class: amenityClass,
    label: AMENITY_CLASS_LABELS[amenityClass],
    icon: AMENITY_CLASS_ICONS[amenityClass],
    amenities: props.facts?.amenities[amenityClass] ?? [],
  })),
);

const mixEntries = computed(() => (props.facts ? housingMixEntries(props.facts.housingMix) : []));
const mixTotal = computed(() => (props.facts ? housingMixTotal(props.facts.housingMix) : 0));

const dataRows = computed(() =>
  provenanceRows([
    { label: 'Neighbourhood facts', provenance: props.provenance },
    { label: 'Houses', provenance: props.housesProvenance },
  ]),
);
const attributions = computed(() => attributionsFor(dataRows.value.map((row) => row.source)));

function walk(minutes: number): string {
  return `${minutes} min walk`;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat(locale.value).format(value);
}
</script>

<template>
  <div class="neighbourhood-facts flex flex-col gap-6" data-testid="neighbourhood-facts">
    <div
      v-if="loading || !facts"
      class="grid grid-cols-2 gap-2"
      aria-busy="true"
      data-testid="neighbourhood-skeleton"
    >
      <USkeleton v-for="n in 4" :key="n" class="h-20 w-full" />
    </div>

    <p
      v-else-if="status === 'error'"
      class="text-muted text-sm"
      data-testid="neighbourhood-unavailable"
    >
      The Neighbourhood Facts could not be loaded.
    </p>

    <template v-else>
      <section :aria-labelledby="`${id}-where`" class="flex flex-col gap-2">
        <h3 :id="`${id}-where`" class="text-highlighted text-sm font-semibold">Where you are</h3>
        <p class="text-lg font-semibold" data-testid="facts-name">{{ facts.name }}</p>
        <ol
          v-if="trail.length"
          class="hierarchy-trail text-muted flex flex-wrap items-center text-sm"
          aria-label="Place hierarchy"
          data-testid="facts-hierarchy"
        >
          <li v-for="part in trail" :key="part">{{ part }}</li>
        </ol>
      </section>

      <section :aria-labelledby="`${id}-cost`" class="flex flex-col gap-2">
        <h3 :id="`${id}-cost`" class="text-highlighted text-sm font-semibold">What houses cost</h3>

        <UCard
          v-if="facts.priceSummary"
          variant="subtle"
          :ui="{ body: 'p-4 sm:p-4' }"
          data-testid="price-summary"
        >
          <dl class="grid grid-cols-2 gap-x-4 gap-y-3">
            <div class="col-span-2">
              <dt class="text-muted text-xs uppercase tracking-wide">Typical</dt>
              <dd class="text-highlighted text-2xl font-semibold" data-testid="price-typical">
                {{ price(facts.priceSummary.typical, facts.priceSummary.currency) }}
              </dd>
            </div>
            <div>
              <dt class="text-muted text-xs uppercase tracking-wide">Low</dt>
              <dd class="font-medium" data-testid="price-low">
                {{ price(facts.priceSummary.low, facts.priceSummary.currency) }}
              </dd>
            </div>
            <div>
              <dt class="text-muted text-xs uppercase tracking-wide">High</dt>
              <dd class="font-medium" data-testid="price-high">
                {{ price(facts.priceSummary.high, facts.priceSummary.currency) }}
              </dd>
            </div>
          </dl>
          <p class="text-muted mt-3 text-xs">
            As of
            <time :datetime="facts.priceSummary.asOf">{{ asOf }}</time
            >. {{ sampleSentence }}
          </p>
        </UCard>

        <div
          v-else
          class="no-price-data border-accented bg-muted flex gap-3 rounded-lg border border-dashed p-4"
          data-testid="no-price-data"
        >
          <UIcon
            name="i-lucide-map-pin-off"
            class="text-muted mt-0.5 size-5 shrink-0"
            aria-hidden="true"
          />
          <div class="flex flex-col gap-1">
            <p class="text-highlighted font-semibold">No open price data for this region yet</p>
            <p class="text-muted text-sm">
              This app only uses open price registers, and {{ countryName }} has none wired up.
            </p>
          </div>
        </div>
      </section>

      <section :aria-labelledby="`${id}-life`" class="flex flex-col gap-3">
        <h3 :id="`${id}-life`" class="text-highlighted text-sm font-semibold">Daily life</h3>
        <ul class="flex flex-col gap-3" aria-label="Amenities by type" data-testid="amenities">
          <li
            v-for="group in amenityGroups"
            :key="group.class"
            class="flex flex-col gap-1"
            :data-amenity-class="group.class"
          >
            <p class="flex items-center gap-2 text-sm font-medium">
              <UIcon :name="group.icon" class="text-muted size-4" aria-hidden="true" />
              {{ group.label }}
            </p>
            <p v-if="group.amenities.length === 0" class="text-muted pl-6 text-sm">
              None within reach
            </p>
            <ul v-else class="flex flex-col">
              <li
                v-for="amenity in group.amenities"
                :key="`${amenity.name}:${amenity.distanceMetres}`"
              >
                <button
                  type="button"
                  class="amenity hover:bg-elevated focus-visible:outline-primary flex min-h-12 w-full items-center gap-3 rounded-md px-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
                  data-testid="amenity"
                  :data-amenity-class="group.class"
                  @click="emit('focus-amenity', amenity.location)"
                >
                  <span class="min-w-0 flex-1 truncate">{{ amenity.name }}</span>
                  <span class="sr-only">, </span>
                  <span class="text-muted shrink-0 text-sm">
                    {{ walk(amenity.walkingMinutes) }}
                    <span class="text-dimmed">({{ distance(amenity.distanceMetres) }})</span>
                  </span>
                  <UIcon
                    name="i-lucide-map-pin"
                    class="text-muted size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span class="sr-only">, show on map</span>
                </button>
              </li>
            </ul>
          </li>
        </ul>
      </section>

      <section :aria-labelledby="`${id}-mix`" class="housing-mix flex flex-col gap-3">
        <h3 :id="`${id}-mix`" class="text-highlighted text-sm font-semibold">What's here</h3>
        <p v-if="mixTotal === 0" class="text-muted text-sm">No Houses found in the Search Area.</p>
        <template v-else>
          <div
            class="housing-mix__bar flex h-3 gap-0.5 overflow-hidden rounded"
            aria-hidden="true"
            data-testid="housing-mix-bar"
          >
            <span
              v-for="entry in mixEntries"
              :key="entry.type"
              class="block h-full"
              :style="{ width: `${entry.percentage}%`, background: `var(--mix-${entry.slot})` }"
              :title="`${entry.label}: ${entry.percentage}%`"
            />
          </div>
          <ul class="flex flex-col gap-1 text-sm" data-testid="housing-mix">
            <li v-for="entry in mixEntries" :key="entry.type" class="flex items-center gap-2">
              <span
                class="size-2.5 shrink-0 rounded-sm"
                :style="{ background: `var(--mix-${entry.slot})` }"
                aria-hidden="true"
              />
              <span class="flex-1">{{ entry.label }}</span>
              <span class="sr-only">, </span>
              <span class="text-muted tabular-nums">
                {{ formatCount(entry.count) }}
                <span class="text-dimmed">({{ entry.percentage }}%)</span>
              </span>
            </li>
          </ul>
          <p class="text-muted text-xs">{{ formatCount(mixTotal) }} Houses in the Search Area.</p>
        </template>
      </section>

      <section :aria-labelledby="`${id}-data`" class="flex flex-col gap-2">
        <h3 :id="`${id}-data`" class="text-highlighted text-sm font-semibold">About this data</h3>
        <p v-if="dataRows.length === 0" class="text-muted text-sm">Nothing fetched yet.</p>
        <ul v-else class="text-muted flex flex-col gap-1 text-sm" data-testid="provenance">
          <li v-for="row in dataRows" :key="row.label">
            <span class="text-default">{{ row.label }}:</span>
            {{ row.sources.join(', ') }}, fetched
            <time :datetime="row.fetchedAt">{{ formatTimestamp(row.fetchedAt, locale) }}</time>
          </li>
        </ul>
        <ul
          v-if="attributions.length"
          class="text-dimmed flex flex-col gap-1 text-xs"
          data-testid="attribution"
        >
          <li v-for="line in attributions" :key="line.id">
            <a :href="line.href" target="_blank" rel="noreferrer" class="underline">{{
              line.text
            }}</a>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
/* A chevron between hierarchy parts, drawn so screen readers only hear the names. */
.hierarchy-trail li + li::before {
  content: '›';
  padding: 0 0.4em;
  color: var(--ui-text-dimmed);
}

/*
 * Categorical palette for the Housing Mix, one slot per building type (dataviz reference
 * palette; the dark steps are selected for the dark surface, not a flipped light palette).
 */
.housing-mix {
  --mix-1: #2a78d6;
  --mix-2: #eb6834;
  --mix-3: #1baf7a;
  --mix-4: #eda100;
  --mix-5: #e87ba4;
  --mix-6: #008300;
  --mix-7: #4a3aa7;
}

.dark .housing-mix {
  --mix-1: #3987e5;
  --mix-2: #d95926;
  --mix-3: #199e70;
  --mix-4: #c98500;
  --mix-5: #d55181;
  --mix-6: #008300;
  --mix-7: #9085e9;
}
</style>
