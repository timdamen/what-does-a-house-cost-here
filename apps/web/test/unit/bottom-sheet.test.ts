import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import BottomSheet from '../../app/components/BottomSheet.vue';
import { cycleSnap, nearestSnap, snapHeightsPx, stepSnap } from '../../app/utils/sheet';

async function mountSheet(snap: 'peek' | 'half' | 'full' = 'peek') {
  const wrapper = await mountSuspended(BottomSheet, {
    props: { snap, 'onUpdate:snap': (next: string) => wrapper.setProps({ snap: next }) },
    slots: {
      card: '<p data-testid="card">Card</p>',
      default: '<section id="houses">Houses</section>',
    },
  });
  const sheet = wrapper.get('[data-testid="bottom-sheet"]');
  const handle = wrapper.get('button[data-testid="sheet-handle"]');
  return { wrapper, sheet, handle };
}

describe('BottomSheet', () => {
  it('renders the card slot above the body and starts at peek', async () => {
    const { wrapper, sheet, handle } = await mountSheet();

    expect(sheet.attributes('data-snap')).toBe('peek');
    expect(handle.attributes('aria-label')).toBe('Resize panel (now peek)');
    const card = wrapper.get('[data-testid="card"]');
    const body = wrapper.get('#houses');
    expect(card.element.compareDocumentPosition(body.element)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('cycles peek -> half -> full -> peek when the handle is tapped', async () => {
    const { sheet, handle } = await mountSheet();

    await handle.trigger('click');
    expect(sheet.attributes('data-snap')).toBe('half');
    await handle.trigger('click');
    expect(sheet.attributes('data-snap')).toBe('full');
    expect(handle.attributes('aria-label')).toBe('Resize panel (now full)');
    await handle.trigger('click');
    expect(sheet.attributes('data-snap')).toBe('peek');
  });

  it('steps with the arrow keys and collapses full to half on Escape', async () => {
    const { sheet, handle } = await mountSheet();

    await handle.trigger('keydown', { key: 'ArrowUp' });
    expect(sheet.attributes('data-snap')).toBe('half');
    await handle.trigger('keydown', { key: 'ArrowUp' });
    expect(sheet.attributes('data-snap')).toBe('full');
    await handle.trigger('keydown', { key: 'ArrowUp' });
    expect(sheet.attributes('data-snap')).toBe('full');

    await sheet.trigger('keydown', { key: 'Escape' });
    expect(sheet.attributes('data-snap')).toBe('half');
    await sheet.trigger('keydown', { key: 'Escape' });
    expect(sheet.attributes('data-snap')).toBe('half');

    await handle.trigger('keydown', { key: 'ArrowDown' });
    expect(sheet.attributes('data-snap')).toBe('peek');
    await handle.trigger('keydown', { key: 'ArrowDown' });
    expect(sheet.attributes('data-snap')).toBe('peek');
  });

  it('snaps to the nearest point after a drag and ignores the trailing click', async () => {
    const { sheet, handle } = await mountSheet();
    const heights = snapHeightsPx(window.innerHeight);
    const target = heights.full - 5;

    await handle.trigger('pointerdown', { pointerId: 1, clientY: 800, button: 0 });
    await handle.trigger('pointermove', { pointerId: 1, clientY: 800 - target });
    expect(sheet.classes()).toContain('bottom-sheet--dragging');
    await handle.trigger('pointerup', { pointerId: 1, clientY: 800 - target });
    expect(sheet.attributes('data-snap')).toBe('full');
    expect(sheet.classes()).not.toContain('bottom-sheet--dragging');

    await handle.trigger('click');
    expect(sheet.attributes('data-snap')).toBe('full');
  });
});

describe('sheet helpers', () => {
  it('cycle and step stay within the three snap points', () => {
    expect(cycleSnap('peek')).toBe('half');
    expect(cycleSnap('full')).toBe('peek');
    expect(stepSnap('peek', -1)).toBe('peek');
    expect(stepSnap('half', 1)).toBe('full');
  });

  it('keeps peek at 96px on short viewports and picks the nearest snap for a height', () => {
    expect(snapHeightsPx(500)).toEqual({ peek: 96, half: 250, full: 450 });
    expect(snapHeightsPx(844).peek).toBeCloseTo(126.6);
    const heights = snapHeightsPx(844);
    expect(nearestSnap(150, heights)).toBe('peek');
    expect(nearestSnap(400, heights)).toBe('half');
    expect(nearestSnap(700, heights)).toBe('full');
  });
});
