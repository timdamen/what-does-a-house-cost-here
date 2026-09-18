/**
 * Bottom Sheet snap points (research note `docs/research/mobile-map-ux.md`, decision 2; ADR-0006).
 * The one place the heights live: `SHEET_SNAP_CSS` is what the sheet and the page put in their
 * CSS custom properties, `snapHeightsPx` the pixel mirror the drag logic snaps with. The side
 * panel breakpoint is the Tailwind theme token `--breakpoint-panel` in `assets/css/main.css`.
 */
export const SHEET_SNAPS = ['peek', 'half', 'full'] as const;
export type SheetSnap = (typeof SHEET_SNAPS)[number];

/** Peek is `15dvh` but never less than a 48 px handle plus one 48 px summary row. */
export const SHEET_PEEK_MIN_PX = 96;
const PEEK_DVH = 15;
const HALF_DVH = 50;
const FULL_DVH = 90;

/** Key in `history.state` of the entry `BottomSheet.vue` pushes when it opens fully (ADR-0006). */
export const SHEET_HISTORY_MARKER = 'houseCostSheet';

/** CSS height of each snap point. */
export const SHEET_SNAP_CSS: Readonly<Record<SheetSnap, string>> = {
  peek: `max(${SHEET_PEEK_MIN_PX}px, ${PEEK_DVH}dvh)`,
  half: `${HALF_DVH}dvh`,
  full: `${FULL_DVH}dvh`,
};

/** Pixel heights of the snap points for a viewport height, matching `SHEET_SNAP_CSS`. */
export function snapHeightsPx(viewportHeightPx: number): Record<SheetSnap, number> {
  return {
    peek: Math.max(SHEET_PEEK_MIN_PX, (viewportHeightPx * PEEK_DVH) / 100),
    half: (viewportHeightPx * HALF_DVH) / 100,
    full: (viewportHeightPx * FULL_DVH) / 100,
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
