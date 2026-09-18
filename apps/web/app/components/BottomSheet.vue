<script setup lang="ts">
import { cycleSnap, nearestSnap, type SheetSnap, snapHeightsPx, stepSnap } from '~/utils/sheet';

/**
 * The Bottom Sheet (ADR-0006): a server-rendered, always-present panel over the map with three
 * snap points, peek / half / full, in `dvh` units. The drag handle is a real button: dragging it
 * resizes the sheet, tapping it cycles the snap points, ArrowUp/ArrowDown step them and Escape
 * collapses full to half. At `>= 840px` the same markup becomes a side panel one third wide,
 * full height, without snapping (CSS only, no JavaScript). The `card` slot sits above the
 * scrollable body; the default slot is the body.
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

const handleLabel = computed(() => `Resize panel (now ${snap.value})`);

const style = computed(() =>
  dragHeight.value === null ? undefined : { height: `${dragHeight.value}px` },
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
/* Snap heights in `dvh`; `snapHeightsPx()` in `~/utils/sheet` mirrors these for the drag logic. */
.bottom-sheet {
  --sheet-peek: max(96px, 15dvh);
  --sheet-half: 50dvh;
  --sheet-full: 90dvh;
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
@media (min-width: 840px) {
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
