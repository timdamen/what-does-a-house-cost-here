<script setup lang="ts">
import type { GeocodeResult, GeocodeSearchResult } from '@house-cost/domain';

/**
 * Place search box backed by `GET /api/geocode?q`. Searches only on submit (Enter or the search
 * button), never per keystroke: Nominatim's usage policy forbids autocomplete. A combobox: the
 * input owns keyboard focus, arrow keys move the highlight, Enter selects the highlighted result
 * or searches, Escape closes. Results stay until the query changes. Selecting a result writes
 * the rounded Location to the URL.
 */
const props = withDefaults(
  defineProps<{
    minLength?: number;
    autofocus?: boolean;
  }>(),
  { minLength: 2, autofocus: false },
);

const emit = defineEmits<{
  select: [result: GeocodeResult];
}>();

const { setLocation } = useLocation();
const listId = useId();

const query = ref('');
const results = ref<GeocodeResult[]>([]);
const status = ref<'idle' | 'pending' | 'success' | 'error'>('idle');
const open = ref(false);
const highlighted = ref(-1);

let requestId = 0;
let ignoreNextQueryChange = false;

const activeDescendant = computed(() =>
  open.value && highlighted.value >= 0 ? optionId(highlighted.value) : undefined,
);

function optionId(index: number) {
  return `${listId}-option-${index}`;
}

function cancelPending() {
  requestId += 1;
}

function reset() {
  cancelPending();
  results.value = [];
  status.value = 'idle';
  open.value = false;
  highlighted.value = -1;
}

async function search(term: string) {
  const trimmed = term.trim();
  if (trimmed.length < props.minLength) return;

  cancelPending();
  const id = requestId;
  status.value = 'pending';

  try {
    const response = await $fetch<GeocodeSearchResult>('/api/geocode', {
      query: { q: trimmed },
    });
    if (id !== requestId) return;
    results.value = response.data;
    status.value = 'success';
    highlighted.value = response.data.length > 0 ? 0 : -1;
  } catch {
    if (id !== requestId) return;
    results.value = [];
    status.value = 'error';
    highlighted.value = -1;
  }
  open.value = true;
}

/** Editing the query drops the previous results; nothing is fetched until the next submit. */
watch(query, () => {
  if (ignoreNextQueryChange) {
    ignoreNextQueryChange = false;
    return;
  }
  reset();
});

function onSubmit() {
  void search(query.value);
}

async function choose(result: GeocodeResult) {
  cancelPending();
  ignoreNextQueryChange = true;
  query.value = result.label;
  results.value = [];
  open.value = false;
  highlighted.value = -1;
  status.value = 'idle';
  await setLocation(result.location);
  emit('select', result);
}

function move(delta: number) {
  if (results.value.length === 0) return;
  open.value = true;
  const count = results.value.length;
  highlighted.value = (highlighted.value + delta + count) % count;
}

function onKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      move(1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      move(-1);
      break;
    case 'Enter': {
      event.preventDefault();
      const current = open.value ? results.value[highlighted.value] : undefined;
      if (current) void choose(current);
      else void search(query.value);
      break;
    }
    case 'Escape':
      if (open.value) {
        event.preventDefault();
        open.value = false;
      }
      break;
    default:
      break;
  }
}

function onBlur() {
  open.value = false;
}

/** Coming back to the box shows the last results again until the query changes. */
function onFocus() {
  if (status.value !== 'idle') open.value = true;
}

onBeforeUnmount(cancelPending);
</script>

<template>
  <form class="flex flex-col gap-2" role="search" @submit.prevent="onSubmit">
    <div class="flex items-start gap-2">
      <UInput
        v-model="query"
        type="search"
        role="combobox"
        aria-label="Search for a place"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        :aria-expanded="open"
        :aria-controls="listId"
        :aria-activedescendant="activeDescendant"
        autocomplete="off"
        enterkeyhint="search"
        icon="i-lucide-search"
        size="xl"
        placeholder="Town, street or postcode"
        :autofocus="props.autofocus"
        :loading="status === 'pending'"
        :trailing="false"
        class="w-full"
        :ui="{ base: 'min-h-12' }"
        @keydown="onKeydown"
        @focus="onFocus"
        @blur="onBlur"
      />
      <UButton
        type="submit"
        icon="i-lucide-search"
        color="neutral"
        variant="solid"
        square
        aria-label="Search"
        :disabled="query.trim().length < props.minLength"
        :ui="{ base: 'min-h-12 min-w-12 justify-center' }"
        data-testid="place-search-submit"
      />
    </div>

    <ul
      v-show="open"
      :id="listId"
      role="listbox"
      aria-label="Places"
      class="divide-default border-default bg-default divide-y overflow-hidden rounded-lg border shadow-sm"
    >
      <li
        v-for="(result, index) in results"
        :id="optionId(index)"
        :key="`${result.location.lat},${result.location.lng}`"
        role="option"
        :aria-selected="index === highlighted"
        class="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2"
        :class="index === highlighted ? 'bg-elevated' : ''"
        @mousedown.prevent
        @mouseenter="highlighted = index"
        @click="choose(result)"
      >
        <UIcon name="i-lucide-map-pin" class="text-muted size-5 shrink-0" />
        <span class="text-default">{{ result.label }}</span>
      </li>
      <li
        v-if="status === 'success' && results.length === 0"
        class="text-muted flex min-h-12 items-center px-3 py-2"
      >
        No places found. Try a town, street or postcode.
      </li>
      <li v-if="status === 'error'" class="text-muted flex min-h-12 items-center px-3 py-2">
        Search is unavailable right now. Please try again in a moment.
      </li>
    </ul>
  </form>
</template>
