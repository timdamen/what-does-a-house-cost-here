import type {
  HouseSearchResult,
  NeighbourhoodFactsResult,
  PriceSignalsResult,
} from '@house-cost/domain';
import { AMSTERDAM_CENTRE, createFixtureProvider } from '@house-cost/domain';
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../../app/app.vue';
import { stubGeolocation } from './geolocation-stub';

const provider = createFixtureProvider();
const AREA = { centre: AMSTERDAM_CENTRE, radiusMetres: 500 };
const ROUTE = `/?lat=${AMSTERDAM_CENTRE.lat}&lng=${AMSTERDAM_CENTRE.lng}&r=500`;

const UPSTREAM_502 = { error: { kind: 'upstream', service: 'overpass', retryable: true } };

let housesResponse: () => Promise<HouseSearchResult>;
let factsResponse: () => Promise<NeighbourhoodFactsResult>;
let pricesResponse: () => Promise<PriceSignalsResult>;

function fail(event: { node: { res: { statusCode: number } } }) {
  event.node.res.statusCode = 502;
  return UPSTREAM_502;
}

let housesFail = false;
registerEndpoint('/api/houses', (event) => (housesFail ? fail(event) : housesResponse()));
registerEndpoint('/api/facts', () => factsResponse());
registerEndpoint('/api/prices', { method: 'POST', handler: () => pricesResponse() });

const stubs = { HouseMap: { template: '<div data-testid="house-map-stub" />' } };

describe('index page', () => {
  beforeEach(async () => {
    clearNuxtState();
    clearNuxtData();
    housesFail = false;
    const houses = await provider.searchHouses(AREA);
    housesResponse = () => Promise.resolve(houses);
    factsResponse = () => provider.getNeighbourhoodFacts(AMSTERDAM_CENTRE);
    pricesResponse = () => provider.getPriceSignals(houses.data);
  });

  it('shows the app name and the location prompt without a Location', async () => {
    stubGeolocation('unsupported');
    const wrapper = await mountSuspended(App, { route: '/', global: { stubs } });

    expect(wrapper.get('h1').text()).toBe('What does a house cost here?');
    expect(wrapper.text()).toContain('Where are you?');
    expect(wrapper.find('[data-testid="bottom-sheet"]').exists()).toBe(false);
  });

  it('renders the header, the map frame and both sheet sections with a Location', async () => {
    stubGeolocation('unsupported');
    const wrapper = await mountSuspended(App, { route: ROUTE, global: { stubs } });

    expect(wrapper.get('header h1').text()).toBe('What does a house cost here?');
    expect(wrapper.find('button[aria-label="Search for a place"]').exists()).toBe(true);
    expect(wrapper.find('button[aria-label="Use my location"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="house-map-frame"]').exists()).toBe(true);

    const sheet = wrapper.get('[data-testid="bottom-sheet"]');
    expect(sheet.find('section#houses').exists()).toBe(true);
    expect(sheet.find('section#neighbourhood').exists()).toBe(true);
    expect(sheet.find('[data-testid="houses-skeleton"]').exists()).toBe(true);

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="houses-skeleton"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="neighbourhood-skeleton"]').exists()).toBe(false);
    });
    await vi.waitFor(() => {
      expect(sheet.text()).toMatch(/\d+ houses, \d+ with a price/);
    });
    expect(sheet.text()).toContain('Grachtengordel-Zuid');
    expect(wrapper.find('[data-testid="error-retry"]').exists()).toBe(false);
  });

  it('opens the place search from the header and closes it on Escape', async () => {
    stubGeolocation('unsupported');
    const wrapper = await mountSuspended(App, { route: ROUTE, global: { stubs } });

    expect(wrapper.find('input[role="combobox"]').exists()).toBe(false);
    await wrapper.get('[data-testid="search-toggle"]').trigger('click');
    expect(wrapper.find('input[role="combobox"]').exists()).toBe(true);
    await wrapper.get('header').trigger('keydown', { key: 'Escape' });
    expect(wrapper.find('input[role="combobox"]').exists()).toBe(false);
  });

  it('shows the retry card when the houses route answers with an Upstream Error', async () => {
    stubGeolocation('unsupported');
    housesFail = true;
    const wrapper = await mountSuspended(App, { route: ROUTE, global: { stubs } });

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="error-retry"]').exists()).toBe(true);
    });
    expect(wrapper.get('[data-testid="bottom-sheet"]').attributes('data-snap')).toBe('half');
    const card = wrapper.get('[data-testid="error-retry"]');
    expect(card.text()).toContain(
      "The open-data service is unavailable right now. It's them, not you.",
    );
    expect(card.text()).toContain('overpass');

    housesFail = false;
    await card.get('button').trigger('click');

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="error-retry"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="houses-skeleton"]').exists()).toBe(false);
    });
  });
});
