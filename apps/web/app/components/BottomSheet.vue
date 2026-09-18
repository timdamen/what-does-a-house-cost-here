<script setup lang="ts">
import {
  cycleSnap,
  nearestSnap,
  SHEET_HISTORY_MARKER,
  SHEET_SNAP_CSS,
  type SheetSnap,
  snapHeightsPx,
  stepSnap,
} from '~/utils/sheet';

/**
 * The Bottom Sheet (ADR-0006): a server-rendered, always-present sheet over the map with three
 * snap points, peek / half / full, in `dvh` units. The drag handle is a real button: dragging it
 * resizes the sheet, tapping it cycles the snap points, ArrowUp/ArrowDown step them and Escape
 * collapses full to half. Opening the sheet fully pushes one history entry, so Back collapses it
 * to half instead of leaving the page; leaving full any other way pops that entry again. At the
 * side-panel breakpoint the same markup becomes a side panel one third wide, full height,
 * without snapping (CSS only, no JavaScript). The `card` slot sits above the scrollable body;
 * the default slot is the body.
 */
const props = withDefaults(defineProps<{ label?: string }>(), {
  label: 'Houses and neighbourhood',
});

const snap = defineModel<SheetSnap>('snap', { default: 'peek' });

/** Pointer travel before a press counts as a drag rather than a tap. */
const DRAG_THRESHOLD_PX = 6;

const root = useTemplateRef<HTMLElement>('root');
const dragging = ref(false);
const dragHeight = ref<number | null>(null);

let activePointer: number | null = null;
let startY = 0;
let startHeight = 0;
let suppressNextClick = false;
/** Whether the history entry for the full state is currently on the stack. */
let pushedHistoryEntry = false;

const handleLabel = computed(() => `Resize sheet (now ${snap.value})`);

const snapVars = {
  '--sheet-peek': SHEET_SNAP_CSS.peek,
  '--sheet-half': SHEET_SNAP_CSS.half,
  '--sheet-full': SHEET_SNAP_CSS.full,
};

const style = computed(() =>
  dragHeight.value === null ? snapVars : { ...snapVars, height: `${dragHeight.value}px` },
);

function heights() {
  return snapHeightsPx(window.innerHeight);
}

function onPointerDown(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const element = root.value;
  if (!element) return;
  // A mouse drag ends with a click the handler below swallows; a touch drag ends without one,
  // so a stale flag would swallow the next real tap instead.
  suppressNextClick = false;
  activePointer = event.pointerId;
  startY = event.clientY;
  startHeight = element.getBoundingClientRect().height;
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
}

function onPointerMove(event: PointerEvent) {
  if (activePointer !== event.pointerId) return;
  const delta = startY - event.clientY;
  if (!dragging.value && Math.abs(delta) < DRAG_THRESHOLD_PX) return;
  dragging.value = true;
  const { peek, full } = heights();
  dragHeight.value = Math.min(full, Math.max(peek, startHeight + delta));
}

function onPointerUp(event: PointerEvent) {
  if (activePointer !== event.pointerId) return;
  (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  activePointer = null;
  if (dragging.value && dragHeight.value !== null) {
    suppressNextClick = true;
    snap.value = nearestSnap(dragHeight.value, heights());
  }
  dragging.value = false;
  dragHeight.value = null;
}

function onPointerCancel(event: PointerEvent) {
  if (activePointer !== event.pointerId) return;
  activePointer = null;
  dragging.value = false;
  dragHeight.value = null;
}

/** A tap (or Enter/Space on the button) cycles the snap points; a drag's trailing click is ignored. */
function onHandleClick() {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  snap.value = cycleSnap(snap.value);
}

function onHandleKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowUp':
      event.preventDefault();
      snap.value = stepSnap(snap.value, 1);
      break;
    case 'ArrowDown':
      event.preventDefault();
      snap.value = stepSnap(snap.value, -1);
      break;
    case 'Home':
      event.preventDefault();
      snap.value = 'full';
      break;
    case 'End':
      event.preventDefault();
      snap.value = 'peek';
      break;
    default:
      break;
  }
}

/** Escape anywhere in the sheet collapses the full (page-like) state, as NN/g asks of sheets. */
function onRootKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && snap.value === 'full') {
    event.preventDefault();
    snap.value = 'half';
  }
}

/**
 * Back collapses the sheet from full (ADR-0006). The entry is pushed with `history.pushState`
 * on top of the router's own state, so `router.replace` (which never adds entries) is not
 * disturbed; only this component's marker, or its own bookkeeping, makes it react to `popstate`.
 */
function onPopState(event: PopStateEvent) {
  const state: unknown = event.state;
  const marked =
    typeof state === 'object' &&
    state !== null &&
    (state as Record<string, unknown>)[SHEET_HISTORY_MARKER] === 'full';
  if (marked) {
    // Forward, back onto the entry the full state pushed.
    pushedHistoryEntry = true;
    snap.value = 'full';
    return;
  }
  if (!pushedHistoryEntry) return;
  pushedHistoryEntry = false;
  if (snap.value === 'full') snap.value = 'half';
}

watch(snap, (next, previous) => {
  if (typeof window === 'undefined') return;
  if (next === 'full' && !pushedHistoryEntry) {
    pushedHistoryEntry = true;
    window.history.pushState({ ...window.history.state, [SHEET_HISTORY_MARKER]: 'full' }, '');
  } else if (previous === 'full' && next !== 'full' && pushedHistoryEntry) {
    // Collapsed by a drag, tap or Escape: drop the entry so Back leaves the page as usual.
    pushedHistoryEntry = false;
    window.history.back();
  }
});

onMounted(() => {
  window.addEventListener('popstate', onPopState);
});

onBeforeUnmount(() => {
  window.removeEventListener('popstate', onPopState);
  if (pushedHistoryEntry) {
    pushedHistoryEntry = false;
    window.history.back();
  }
});
</script>

<template>
  <aside
    ref="root"
    class="bottom-sheet bg-default border-default fixed inset-x-0 bottom-0 z-20 flex flex-col border-t shadow-[0_-4px_24px_rgba(0,0,0,0.12)]"
    :class="{ 'bottom-sheet--dragging': dragging }"
    :data-snap="snap"
    :style="style"
    :aria-label="props.label"
    data-testid="bottom-sheet"
    @keydown="onRootKeydown"
  >
    <button
      type="button"
      class="bottom-sheet__handle flex h-12 w-full shrink-0 cursor-grab touch-none items-center justify-center"
      :aria-label="handleLabel"
      data-testid="sheet-handle"
      @click="onHandleClick"
      @keydown="onHandleKeydown"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
    >
      <span class="bg-accented block h-1 w-10 rounded-full" aria-hidden="true" />
    </button>

    <div v-if="$slots.card" class="bottom-sheet__card border-default shrink-0 border-b px-4 pb-4">
      <slot name="card" />
    </div>

    <div class="bottom-sheet__body min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
      <slot />
    </div>
  </aside>
</template>

<style scoped>
@reference '../assets/css/main.css';

/* Snap heights come from `SHEET_SNAP_CSS` (`~/utils/sheet`) through the inline custom properties. */
.bottom-sheet {
  height: var(--sheet-peek);
  padding-bottom: env(safe-area-inset-bottom);
  border-radius: 16px 16px 0 0;
  transition: height 250ms ease-out;
}

.bottom-sheet[data-snap='half'] {
  height: var(--sheet-half);
}

.bottom-sheet[data-snap='full'] {
  height: var(--sheet-full);
}

.bottom-sheet--dragging {
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  .bottom-sheet {
    transition-duration: 0ms;
  }
}

/* Research decision 2: at the Android "expanded" width the sheet becomes a side panel. */
@media (width >= --theme(--breakpoint-panel)) {
  .bottom-sheet,
  .bottom-sheet[data-snap] {
    inset: 0 0 0 auto;
    width: 33.333%;
    height: auto;
    padding-bottom: 0;
    border-radius: 0;
    border-top: 0;
    border-left-width: 1px;
    box-shadow: none;
    transition: none;
  }

  .bottom-sheet__handle {
    display: none;
  }

  .bottom-sheet__body {
    padding-top: calc(env(safe-area-inset-top) + 1rem);
  }
}
</style>
