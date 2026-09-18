import { mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';

import { useGeolocation } from '../../app/composables/useGeolocation';
import { PERMISSION_DENIED, stubGeolocation, TIMEOUT } from './geolocation-stub';

const Probe = defineComponent({
  setup() {
    return useGeolocation();
  },
  render() {
    return h('div');
  },
});

describe('useGeolocation', () => {
  beforeEach(() => {
    clearNuxtState();
  });

  it('starts idle and becomes granted with a rounded position', async () => {
    const getCurrentPosition = stubGeolocation({ kind: 'granted', lat: 52.367612, lng: 4.904139 });
    const { vm } = await mountSuspended(Probe);

    expect(vm.status).toBe('idle');

    const found = await vm.locate();

    expect(found).toEqual({ lat: 52.3676, lng: 4.9041 });
    expect(vm.position).toEqual({ lat: 52.3676, lng: 4.9041 });
    expect(vm.status).toBe('granted');
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(getCurrentPosition.mock.calls[0]?.[2]).toMatchObject({ timeout: 10_000 });
  });

  it('becomes denied when permission is refused', async () => {
    stubGeolocation({ kind: 'failed', code: PERMISSION_DENIED });
    const { vm } = await mountSuspended(Probe);

    expect(await vm.locate()).toBeNull();
    expect(vm.status).toBe('denied');
    expect(vm.position).toBeNull();
  });

  it('becomes error on other failures such as a timeout', async () => {
    stubGeolocation({ kind: 'failed', code: TIMEOUT });
    const { vm } = await mountSuspended(Probe);

    expect(await vm.locate()).toBeNull();
    expect(vm.status).toBe('error');
  });

  it('becomes unsupported when the browser has no geolocation', async () => {
    stubGeolocation('unsupported');
    const { vm } = await mountSuspended(Probe);

    expect(await vm.locate()).toBeNull();
    expect(vm.status).toBe('unsupported');
  });
});
