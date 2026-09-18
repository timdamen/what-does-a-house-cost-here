/**
 * Bottom Sheet snap points (research note `docs/research/mobile-map-ux.md`, decision 2; ADR-0006).
 * Pure helpers so the drag and keyboard logic in `BottomSheet.vue` stays testable.
 */
export const SHEET_SNAPS = ['peek', 'half', 'full'] as const;
export type SheetSnap = (typeof SHEET_SNAPS)[number];

/** Peek is `15dvh` but never less than a 48 px handle plus one 48 px summary row. */
export const SHEET_PEEK_MIN_PX = 96;
const PEEK_RATIO = 0.15;
const HALF_RATIO = 0.5;
const FULL_RATIO = 0.9;

/** Pixel heights mirroring the CSS in `BottomSheet.vue` (`max(96px, 15dvh)`, `50dvh`, `90dvh`). */
export function snapHeightsPx(viewportHeightPx: number): Record<SheetSnap, number> {
  return {
    peek: Math.max(SHEET_PEEK_MIN_PX, viewportHeightPx * PEEK_RATIO),
    half: viewportHeightPx * HALF_RATIO,
    full: viewportHeightPx * FULL_RATIO,
  };
}

/** Tapping the handle walks peek -> half -> full -> peek (Apple HIG: the grabber cycles detents). */
export function cycleSnap(snap: SheetSnap): SheetSnap {
  const index = SHEET_SNAPS.indexOf(snap);
  return SHEET_SNAPS[(index + 1) % SHEET_SNAPS.length] ?? 'peek';
}

/** One step up (`1`) or down (`-1`), clamped at the ends. */
export function stepSnap(snap: SheetSnap, delta: 1 | -1): SheetSnap {
  const index = SHEET_SNAPS.indexOf(snap);
  const next = Math.min(SHEET_SNAPS.length - 1, Math.max(0, index + delta));
  return SHEET_SNAPS[next] ?? snap;
}

/** The snap point whose height is closest to a dragged height. */
export function nearestSnap(heightPx: number, heights: Record<SheetSnap, number>): SheetSnap {
  let best: SheetSnap = 'peek';
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const snap of SHEET_SNAPS) {
    const distance = Math.abs(heights[snap] - heightPx);
    if (distance < bestDistance) {
      best = snap;
      bestDistance = distance;
    }
  }
  return best;
}
