import { AMSTERDAM_CENTRE, offsetLocation } from '@house-cost/domain';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import HouseList from '../../app/components/HouseList.vue';
import { houseAddressLabel, listHouses, osmUrl } from '../../app/utils/houses';
import type { MapHouse } from '../../app/utils/map/types';

function house(id: string, metresEast: number, amount: number | null, number = '1'): MapHouse {
  return {
    id,
    location: offsetLocation(AMSTERDAM_CENTRE, metresEast, 0),
    address: { street: 'Keizersgracht', housenumber: number },
    buildingType: 'apartments',
    osmTags: {},
    priceSignal:
      amount === null
        ? null
        : {
            houseId: id,
            amount,
            currency: 'EUR',
            kind: 'sale',
            date: '2024-03-15',
            scope: 'house',
            source: 'fixture',
          },
  };
}

/** Nearest first by distance: expensive (way/1), unpriced (way/2), cheap (way/3). */
const houses: MapHouse[] = [
  house('way/1', 100, 900_000, '1'),
  house('way/2', 200, null, '2'),
  house('way/3', 300, 400_000, '3'),
];

async function mountList(overrides: Record<string, unknown> = {}) {
  return mountSuspended(HouseList, {
    props: {
      houses,
      centre: AMSTERDAM_CENTRE,
      countryCode: 'NL',
      pricesStatus: 'success',
      ...overrides,
    },
  });
}

function rowIds(wrapper: Awaited<ReturnType<typeof mountList>>) {
  return wrapper.findAll('[data-testid="house-row"]').map((row) => row.attributes('data-house-id'));
}

describe('HouseList', () => {
  it('states how many Houses there are and how many have a price, in one live row', async () => {
    const wrapper = await mountList();

    const count = wrapper.get('[data-testid="house-count"]');
    expect(count.text()).toBe('3 houses, 2 with a price');
    expect(count.attributes('aria-live')).toBe('polite');
    expect(wrapper.get('#houses-heading').text()).toBe('Houses');
  });

  it('says it is showing the first N when the result was capped', async () => {
    const wrapper = await mountList({ truncated: true, cap: 3 });

    expect(wrapper.get('[data-testid="house-count"]').text()).toBe(
      '3 houses, 2 with a price, showing the first 3',
    );
  });

  it('sorts by distance by default and by price with unpriced Houses last', async () => {
    const wrapper = await mountList();

    expect(rowIds(wrapper)).toEqual(['way/1', 'way/2', 'way/3']);
    expect(wrapper.get('[data-testid="sort-distance"]').attributes('aria-pressed')).toBe('true');

    await wrapper.get('[data-testid="sort-price"]').trigger('click');

    expect(rowIds(wrapper)).toEqual(['way/3', 'way/1', 'way/2']);
    expect(wrapper.get('[data-testid="sort-price"]').attributes('aria-pressed')).toBe('true');
  });

  it('shows address, building type, price with kind and distance, or "No price data"', async () => {
    const wrapper = await mountList();
    const rows = wrapper.findAll('[data-testid="house-row"]');

    expect(rows[0]?.text()).toContain('Keizersgracht 1');
    expect(rows[0]?.text()).toContain('Apartments');
    expect(rows[0]?.text()).toContain('900k');
    expect(rows[0]?.text()).toContain('Sale');
    expect(rows[0]?.text()).toContain('100 m');
    expect(rows[1]?.text()).toContain('No price data');
  });

  it('emits select with the House id when a row is tapped and marks the selected row', async () => {
    const wrapper = await mountList({ selectedHouseId: 'way/2' });

    const rows = wrapper.findAll('[data-testid="house-row"]');
    expect(rows[1]?.attributes('aria-current')).toBe('true');
    expect(rows[0]?.attributes('aria-current')).toBeUndefined();

    await rows[2]?.trigger('click');
    expect(wrapper.emitted('select')).toEqual([['way/3']]);
  });

  it('shows the empty state when the Search Area holds no Houses', async () => {
    const wrapper = await mountList({ houses: [] });

    expect(wrapper.get('[data-testid="house-count"]').text()).toBe('0 houses, 0 with a price');
    expect(wrapper.find('[data-testid="house-list-empty"]').exists()).toBe(true);
  });
});

describe('house helpers', () => {
  it('labels an address from street and number, with fallbacks', () => {
    expect(houseAddressLabel({ street: 'Keizersgracht', housenumber: '12' })).toBe(
      'Keizersgracht 12',
    );
    expect(houseAddressLabel({ street: 'Keizersgracht' })).toBe('Keizersgracht');
    expect(houseAddressLabel({ housenumber: '12' })).toBe('Number 12');
    expect(houseAddressLabel({})).toBe('Unnamed building');
  });

  it('keeps ties in the price sort ordered by distance', () => {
    const tied = [house('way/9', 300, 500_000), house('way/8', 100, 500_000)];
    expect(listHouses(tied, AMSTERDAM_CENTRE, 'price').map((item) => item.house.id)).toEqual([
      'way/8',
      'way/9',
    ]);
  });

  it('links OSM-shaped ids to openstreetmap.org and nothing else', () => {
    expect(osmUrl('way/123')).toBe('https://www.openstreetmap.org/way/123');
    expect(osmUrl('node/7')).toBe('https://www.openstreetmap.org/node/7');
    expect(osmUrl('fixture-1')).toBeNull();
  });
});
