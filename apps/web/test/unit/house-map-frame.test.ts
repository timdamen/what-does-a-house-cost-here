import { AMSTERDAM_CENTRE } from '@house-cost/domain';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import HouseMapFrame from '../../app/components/HouseMapFrame.vue';
import MapPlaceholder from '../../app/components/MapPlaceholder.vue';
import type { MapHouse } from '../../app/utils/map/types';

const houses: MapHouse[] = [
  {
    id: 'way/1',
    location: AMSTERDAM_CENTRE,
    address: {},
    buildingType: 'house',
    osmTags: {},
  },
  {
    id: 'way/2',
    location: AMSTERDAM_CENTRE,
    address: {},
    buildingType: 'apartments',
    osmTags: {},
  },
];

describe('HouseMapFrame', () => {
  it('renders the text summary of the Search Area with the map stubbed out', async () => {
    const wrapper = await mountSuspended(HouseMapFrame, {
      props: { centre: AMSTERDAM_CENTRE, radiusMetres: 500, houses, peekHeight: '120px' },
      global: { stubs: { HouseMap: { template: '<div data-testid="house-map-stub" />' } } },
    });

    const frame = wrapper.get('[data-testid="house-map-frame"]');
    expect(frame.attributes('style')).toContain('--house-map-peek: 120px');
    expect(wrapper.get('[aria-live="polite"]').text()).toBe(
      '2 houses within 500 m of 52.3676, 4.9041',
    );
    expect(wrapper.find('[data-testid="house-map-stub"]').exists()).toBe(true);
  });

  it('shows the placeholder summary, a delayed spinner, and retry on error', async () => {
    const summary = '2 houses within 500 m of 52.3676, 4.9041';
    const loading = await mountSuspended(MapPlaceholder, { props: { summary } });

    expect(loading.text()).toContain(summary);
    expect(loading.find('[role="status"]').classes()).toContain(
      'map-placeholder__spinner--delayed',
    );

    const failed = await mountSuspended(MapPlaceholder, {
      props: { summary, status: 'error', detail: 'style.json 503' },
    });
    expect(failed.text()).toContain('Map failed to load');
    await failed.get('button').trigger('click');
    expect(failed.emitted('retry')).toHaveLength(1);
  });
});
