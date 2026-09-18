import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';

import { useLocation } from '../../app/composables/useLocation';

const Probe = defineComponent({
  setup() {
    return useLocation();
  },
  render() {
    return h('div');
  },
});

async function mount(route: string) {
  const wrapper = await mountSuspended(Probe, { route });
  return { vm: wrapper.vm, router: useRouter() };
}

describe('useLocation', () => {
  it('reads and rounds Location, Search Radius and selection from the URL', async () => {
    const { vm } = await mount('/?lat=52.367612&lng=4.904139&r=1000&h=house-1');

    expect(vm.location).toEqual({ lat: 52.3676, lng: 4.9041 });
    expect(vm.radius).toBe(1000);
    expect(vm.selectedHouseId).toBe('house-1');
  });

  it('has no Location when the URL carries none or garbage, and defaults the radius', async () => {
    const { vm } = await mount('/?lat=abc&lng=4.9&r=999');

    expect(vm.location).toBeNull();
    expect(vm.radius).toBe(500);
    expect(vm.selectedHouseId).toBeNull();
  });

  it('writes a rounded Location to the URL and clears the selection', async () => {
    const { vm, router } = await mount('/?lat=1&lng=2&r=250&h=house-1');

    await vm.setLocation({ lat: 51.507351, lng: -0.127758 });

    expect(router.currentRoute.value.query).toEqual({ lat: '51.5074', lng: '-0.1278', r: '250' });
    expect(vm.location).toEqual({ lat: 51.5074, lng: -0.1278 });
    expect(vm.selectedHouseId).toBeNull();
  });

  it('writes radius and selection without touching the Location', async () => {
    const { vm, router } = await mount('/?lat=52.3676&lng=4.9041');

    await vm.setRadius(1000);
    await vm.select('house-2');

    expect(router.currentRoute.value.query).toEqual({
      lat: '52.3676',
      lng: '4.9041',
      r: '1000',
      h: 'house-2',
    });

    await vm.select(null);

    expect(router.currentRoute.value.query.h).toBeUndefined();
  });
});
