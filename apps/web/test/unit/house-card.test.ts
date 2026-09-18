import { AMSTERDAM_CENTRE, formatPrice, offsetLocation } from '@house-cost/domain';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import HouseCard from '../../app/components/HouseCard.vue';
import type { MapHouse } from '../../app/utils/map/types';

const priced: MapHouse = {
  id: 'way/42',
  location: offsetLocation(AMSTERDAM_CENTRE, 250, 0),
  address: { street: 'Keizersgracht', housenumber: '12' },
  buildingType: 'terraced',
  osmTags: {},
  priceSignal: {
    houseId: 'way/42',
    amount: 602_000,
    currency: 'EUR',
    kind: 'sale',
    date: '2024-03-15',
    scope: 'house',
    source: 'fixture',
  },
};

describe('HouseCard', () => {
  it('renders the address, type, distance, price with kind, date and scope, and the OSM link', async () => {
    const wrapper = await mountSuspended(HouseCard, {
      props: {
        house: priced,
        centre: AMSTERDAM_CENTRE,
        countryCode: 'NL',
        pricesStatus: 'success',
      },
    });

    expect(wrapper.get('#house-card-title').text()).toBe('Keizersgracht 12');
    expect(wrapper.text()).toContain('Terraced house');
    expect(wrapper.text()).toContain('250 m away');

    const price = wrapper.get('[data-testid="house-card-price"]');
    expect(price.text()).toContain(formatPrice(602_000, 'EUR', 'nl-NL'));
    expect(price.text()).toContain('Sale');
    expect(price.text()).toContain('2024');
    expect(price.text()).toContain('this house');

    const link = wrapper.get('[data-testid="house-card-osm"]');
    expect(link.attributes('href')).toBe('https://www.openstreetmap.org/way/42');
    expect(link.attributes('target')).toBe('_blank');
  });

  it('says "No price data" without a Price Signal and emits close', async () => {
    const wrapper = await mountSuspended(HouseCard, {
      props: {
        house: { ...priced, priceSignal: null },
        centre: AMSTERDAM_CENTRE,
        pricesStatus: 'success',
      },
    });

    expect(wrapper.get('[data-testid="house-card-price"]').text()).toBe('No price data');

    await wrapper.get('[data-testid="house-card-close"]').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
