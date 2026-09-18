import { mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';

import { useAfterFirstPaint } from '../../app/composables/useAfterFirstPaint';

const Probe = defineComponent({
  setup() {
    return { painted: useAfterFirstPaint() };
  },
  render() {
    return h('div');
  },
});

describe('useAfterFirstPaint', () => {
  beforeEach(() => {
    clearNuxtState();
  });

  it('is false at mount and true two animation frames later', async () => {
    const { vm } = await mountSuspended(Probe);

    expect(vm.painted).toBe(false);
    await vi.waitFor(() => {
      expect(vm.painted).toBe(true);
    });
  });
});
