import { mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LocationPrompt from '../../app/components/LocationPrompt.vue';
import { PERMISSION_DENIED, stubGeolocation } from './geolocation-stub';

describe('LocationPrompt', () => {
  beforeEach(() => {
    clearNuxtState();
  });

  it('requests geolocation on mount and writes the Location to the URL when granted', async () => {
    const getCurrentPosition = stubGeolocation({ kind: 'granted', lat: 52.367612, lng: 4.904139 });
    const wrapper = await mountSuspended(LocationPrompt, { route: '/' });
    const router = useRouter();

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(router.currentRoute.value.query).toEqual({ lat: '52.3676', lng: '4.9041' });
    });
    expect(wrapper.find('input[role="combobox"]').exists()).toBe(false);
  });

  it('shows one sentence and the place search when permission is denied', async () => {
    stubGeolocation({ kind: 'failed', code: PERMISSION_DENIED });
    const wrapper = await mountSuspended(LocationPrompt, { route: '/' });

    await vi.waitFor(() => {
      expect(wrapper.find('input[role="combobox"]').exists()).toBe(true);
    });
    expect(wrapper.text()).toContain(
      'Location access was turned off, so search for a place instead.',
    );
    expect(wrapper.find('button[aria-label="Use my location"]').exists()).toBe(true);
    expect(useRouter().currentRoute.value.query).toEqual({});
  });

  it('shows the place search without the button when geolocation is unsupported', async () => {
    stubGeolocation('unsupported');
    const wrapper = await mountSuspended(LocationPrompt, { route: '/' });

    await vi.waitFor(() => {
      expect(wrapper.find('input[role="combobox"]').exists()).toBe(true);
    });
    expect(wrapper.text()).toContain('This browser cannot share your location');
    expect(wrapper.find('button[aria-label="Use my location"]').exists()).toBe(false);
  });
});
