import type { NeighbourhoodFacts as Facts, Provenance } from '@house-cost/domain';
import { AMSTERDAM_CENTRE, createFixtureProvider, SYDNEY_CENTRE } from '@house-cost/domain';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeAll, describe, expect, it } from 'vitest';

import NeighbourhoodFacts from '../../app/components/NeighbourhoodFacts.vue';
import {
  attributionsFor,
  formatIsoDate,
  hierarchyTrail,
  housingMixEntries,
  sourceNames,
} from '../../app/utils/facts';

const FIXED_NOW = new Date('2026-09-17T10:30:00Z');
const provider = createFixtureProvider({ now: () => FIXED_NOW });

let amsterdam: Facts;
let amsterdamProvenance: Provenance;
let sydney: Facts;

beforeAll(async () => {
  const ams = await provider.getNeighbourhoodFacts(AMSTERDAM_CENTRE);
  amsterdam = ams.data;
  amsterdamProvenance = ams.provenance;
  sydney = (await provider.getNeighbourhoodFacts(SYDNEY_CENTRE)).data;
});

const HEADINGS = [
  'Where you are',
  'What homes cost',
  'Daily life',
  "What's here",
  'About this data',
];

describe('NeighbourhoodFacts', () => {
  it('renders the five headings in order as h3s with real lists beneath them', async () => {
    const wrapper = await mountSuspended(NeighbourhoodFacts, {
      props: {
        facts: amsterdam,
        provenance: amsterdamProvenance,
        housesProvenance: amsterdamProvenance,
        status: 'success',
        countryCode: 'NL',
      },
    });

    expect(wrapper.findAll('h3').map((heading) => heading.text())).toEqual(HEADINGS);
    expect(wrapper.find('h2').exists()).toBe(false);
    expect(wrapper.find('[data-testid="neighbourhood-skeleton"]').exists()).toBe(false);

    expect(wrapper.get('[data-testid="facts-name"]').text()).toBe('Grachtengordel-Zuid');
    expect(
      wrapper.findAll('[data-testid="facts-hierarchy"] li').map((item) => item.text()),
    ).toEqual(['Grachtengordel-Zuid', 'Amsterdam', 'Noord-Holland', 'Nederland']);

    const summary = wrapper.get('[data-testid="price-summary"]');
    expect(summary.find('dl').exists()).toBe(true);
    expect(summary.get('[data-testid="price-typical"]').text()).toMatch(/^€\s?[\d.]+$/);
    expect(summary.get('time').attributes('datetime')).toBe('2026-06-30');
    expect(summary.text()).toMatch(/As of 30 (June|juni) 2026\./);
    expect(summary.text()).toMatch(/Based on \d+ sales in the last 24 months\./);
    expect(wrapper.find('[data-testid="no-price-data"]').exists()).toBe(false);

    const groups = wrapper.findAll('[data-testid="amenities"] > li');
    expect(groups.map((group) => group.attributes('data-amenity-class'))).toEqual([
      'school',
      'supermarket',
      'healthcare',
      'park',
      'transport',
    ]);
    expect(groups[0]?.text()).toContain('Schools');
    expect(groups[0]?.findAll('button')).toHaveLength(2);

    expect(wrapper.get('[data-testid="housing-mix-bar"]').attributes('aria-hidden')).toBe('true');
    const mixRows = wrapper.findAll('[data-testid="housing-mix"] li');
    expect(mixRows.length).toBeGreaterThan(1);
    expect(mixRows[0]?.text()).toMatch(/Apartments,\s+\d+\s+\(\d+%\)/);

    const provenance = wrapper.findAll('[data-testid="provenance"] li');
    expect(provenance).toHaveLength(2);
    expect(provenance[0]?.text()).toContain('Neighbourhood facts:');
    expect(provenance[0]?.text()).toContain('Offline sample data');
    expect(provenance[0]?.get('time').attributes('datetime')).toBe(FIXED_NOW.toISOString());
    expect(wrapper.find('[data-testid="attribution"]').exists()).toBe(false);
  });

  it('shows the designed no-data card for the Sydney fixture instead of a price summary', async () => {
    const wrapper = await mountSuspended(NeighbourhoodFacts, {
      props: { facts: sydney, status: 'success', countryCode: 'AU' },
    });

    expect(wrapper.findAll('h3').map((heading) => heading.text())).toEqual(HEADINGS);
    expect(wrapper.find('[data-testid="price-summary"]').exists()).toBe(false);
    const card = wrapper.get('[data-testid="no-price-data"]');
    expect(card.text()).toContain('No open price data for this region yet');
    expect(card.text()).toContain(
      'This app only uses open price registers, and Australia has none wired up.',
    );
    expect(
      wrapper.findAll('[data-testid="facts-hierarchy"] li').map((item) => item.text()),
    ).toEqual(['Sydney', 'New South Wales', 'Australia']);
    expect(wrapper.text()).toContain('Nothing fetched yet.');
  });

  it('emits focus-amenity with the Location when an amenity button is activated', async () => {
    const wrapper = await mountSuspended(NeighbourhoodFacts, {
      props: { facts: amsterdam, status: 'success', countryCode: 'NL' },
    });

    const first = amsterdam.amenities.school[0];
    expect(first).toBeDefined();
    const button = wrapper.get('[data-amenity-class="school"] button[data-testid="amenity"]');
    expect(button.text()).toContain(first?.name);
    expect(button.text()).toContain(`${first?.walkingMinutes} min walk`);

    await button.trigger('click');

    expect(wrapper.emitted('focus-amenity')).toEqual([[first?.location]]);
  });

  it('shows the skeleton while pending and "none within reach" for an empty class', async () => {
    const pending = await mountSuspended(NeighbourhoodFacts, {
      props: { facts: null, status: 'pending' },
    });
    expect(pending.find('[data-testid="neighbourhood-skeleton"]').exists()).toBe(true);
    expect(pending.findAll('h3')).toHaveLength(0);

    const sparse: Facts = { ...amsterdam, amenities: { ...amsterdam.amenities, park: [] } };
    const wrapper = await mountSuspended(NeighbourhoodFacts, {
      props: { facts: sparse, status: 'success', countryCode: 'NL' },
    });
    const parks = wrapper.get('[data-testid="amenities"] > li[data-amenity-class="park"]');
    expect(parks.text()).toContain('None within reach');
    expect(parks.find('button').exists()).toBe(false);
  });

  it('adds the attribution lines when open-data sources are on screen', async () => {
    const wrapper = await mountSuspended(NeighbourhoodFacts, {
      props: {
        facts: amsterdam,
        status: 'success',
        countryCode: 'GB',
        provenance: {
          source: 'nominatim+openstreetmap-overpass+hm-land-registry-ppd',
          fetchedAt: FIXED_NOW.toISOString(),
        },
        housesProvenance: { source: 'openstreetmap-overpass', fetchedAt: FIXED_NOW.toISOString() },
      },
    });

    const lines = wrapper.findAll('[data-testid="attribution"] li');
    expect(lines.map((line) => line.text())).toEqual([
      '© OpenStreetMap contributors',
      'Contains HM Land Registry data © Crown copyright and database right 2026. This data is licensed under the Open Government Licence v3.0.',
    ]);
    expect(wrapper.get('[data-testid="provenance"]').text()).toContain(
      'Nominatim (OpenStreetMap), OpenStreetMap via Overpass, HM Land Registry Price Paid Data',
    );
  });
});

describe('facts helpers', () => {
  it('builds the hierarchy trail without blanks or repeated names', () => {
    expect(
      hierarchyTrail({ suburb: 'Sydney', city: 'Sydney', country: 'Australia', countryCode: 'AU' }),
    ).toEqual(['Sydney', 'Australia']);
    expect(hierarchyTrail({ countryCode: 'XX' })).toEqual([]);
  });

  it('orders the housing mix by count with a palette slot fixed to the type', () => {
    const entries = housingMixEntries({
      detached: 1,
      'semi-detached': 0,
      terraced: 3,
      apartments: 6,
      house: 0,
      residential: 0,
      other: 0,
    });
    expect(entries.map((entry) => [entry.type, entry.percentage, entry.slot])).toEqual([
      ['apartments', 60, 4],
      ['terraced', 30, 3],
      ['detached', 10, 1],
    ]);
  });

  it('names sources and picks attributions from them', () => {
    expect(sourceNames('nominatim+unknown-thing')).toEqual([
      'Nominatim (OpenStreetMap)',
      'unknown-thing',
    ]);
    expect(attributionsFor(['fixture']).map((line) => line.id)).toEqual([]);
    expect(attributionsFor(['openstreetmap-overpass']).map((line) => line.id)).toEqual([
      'openstreetmap',
    ]);
    expect(formatIsoDate('2026-06-30', 'en-GB')).toBe('30 June 2026');
    expect(formatIsoDate('not a date', 'en')).toBe('not a date');
  });
});
