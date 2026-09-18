import { BUILDING_TYPES, HOUSE_CAP, UpstreamError } from '@house-cost/domain';
import { describe, expect, it } from 'vitest';

import { createNominatimGeocoder } from '../src/geocoder';
import { createOpenDataProvider } from '../src/provider';
import { createFixtureFetch, jsonResponse } from './helpers/fixture-fetch';
import {
  AMSTERDAM,
  AMSTERDAM_AREA,
  createTestSubject,
  FIXED_NOW,
  ISLINGTON,
  ISLINGTON_AREA,
  RECORDED_RADIUS_METRES,
  TEST_USER_AGENT,
} from './helpers/subject';

describe('createOpenDataProvider', () => {
  describe('searchHouses', () => {
    it('returns Overpass Houses with Overpass provenance and the fixed clock', async () => {
      const { provider } = createTestSubject();
      const result = await provider.searchHouses(ISLINGTON_AREA);

      expect(result.provenance).toEqual({
        source: 'openstreetmap-overpass',
        fetchedAt: FIXED_NOW.toISOString(),
      });
      expect(result.cap).toBe(HOUSE_CAP);
      expect(result.truncated).toBe(false);
      expect(result.data.some((house) => house.address.postcode === 'N1 0QU')).toBe(true);
    });

    it('rounds the centre to 4 decimals before querying', async () => {
      const { provider, fetch } = createTestSubject();
      await provider.searchHouses({
        centre: { lat: 51.53851234, lng: -0.10249876 },
        radiusMetres: RECORDED_RADIUS_METRES,
      });
      const query = new URLSearchParams(String(fetch.calls[0]?.init?.body)).get('data');
      expect(query).toContain('(around:250,51.5385,-0.1025)');
    });

    it('surfaces Overpass failures as UpstreamError', async () => {
      const provider = createOpenDataProvider({
        userAgent: TEST_USER_AGENT,
        fetch: async () => jsonResponse('Too Many Requests', 429),
      });
      const error = await provider.searchHouses(ISLINGTON_AREA).catch((e) => e);
      expect(error).toBeInstanceOf(UpstreamError);
      expect(error).toMatchObject({ kind: 'upstream', service: 'overpass', retryable: true });
    });
  });

  describe('getNeighbourhoodFacts', () => {
    it('composes Nominatim, Overpass and the Land Registry for a GB Location', async () => {
      const { provider } = createTestSubject();
      const { data: facts, provenance } = await provider.getNeighbourhoodFacts(ISLINGTON);

      expect(provenance.source).toBe('nominatim+openstreetmap-overpass+hm-land-registry-ppd');
      expect(facts.name).toBe('Canonbury');
      expect(facts.hierarchy).toMatchObject({ countryCode: 'GB', city: 'Greater London' });
      expect(facts.priceSummary).toMatchObject({ currency: 'GBP', asOf: '2023-06-30' });
      expect(facts.amenities.transport.length).toBeGreaterThan(0);
      expect(facts.amenities.transport.length).toBeLessThanOrEqual(5);
      const total = BUILDING_TYPES.reduce((sum, type) => sum + facts.housingMix[type], 0);
      expect(total).toBeGreaterThan(50);
      expect(facts.housingMix.house).toBeGreaterThan(facts.housingMix.terraced);
    });

    it('reports no price data for a Dutch Location without calling any register', async () => {
      const { provider, fetch } = createTestSubject();
      const { data: facts, provenance } = await provider.getNeighbourhoodFacts(AMSTERDAM);

      expect(provenance.source).toBe('nominatim+openstreetmap-overpass');
      expect(facts.priceSummary).toBeNull();
      expect(facts.hierarchy.countryCode).toBe('NL');
      expect(facts.name).toBe('Nieuwmarkt/Lastage');
      expect(fetch.calls.some((call) => call.url.includes('landregistry'))).toBe(false);
    });

    it('fails as a whole with UpstreamError when Nominatim is down', async () => {
      const fixtures = createFixtureFetch();
      const provider = createOpenDataProvider({
        userAgent: TEST_USER_AGENT,
        factsRadiusMetres: RECORDED_RADIUS_METRES,
        fetch: async (url, init) =>
          url.includes('/reverse') ? jsonResponse({ error: 'down' }, 503) : fixtures(url, init),
      });
      await expect(provider.getNeighbourhoodFacts(ISLINGTON)).rejects.toMatchObject({
        kind: 'upstream',
        service: 'nominatim',
      });
    });
  });

  describe('getPriceSignals', () => {
    it('resolves the country from the Houses and uses the register for GB', async () => {
      const { provider } = createTestSubject();
      const houses = (await provider.searchHouses(ISLINGTON_AREA)).data;
      const result = await provider.getPriceSignals(houses);

      expect(result.provenance.source).toBe('hm-land-registry-ppd');
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every((signal) => signal.currency === 'GBP')).toBe(true);
      expect(result.data.some((signal) => signal.scope === 'house')).toBe(true);
    });

    it('returns no signals for NL Houses and never calls the register', async () => {
      const { provider, fetch } = createTestSubject();
      const houses = (await provider.searchHouses(AMSTERDAM_AREA)).data;
      const result = await provider.getPriceSignals(houses);

      expect(result.data).toEqual([]);
      expect(result.provenance.source).toBe('nominatim');
      expect(fetch.calls.some((call) => call.url.includes('landregistry'))).toBe(false);
    });

    it('makes no upstream call for no Houses', async () => {
      const { provider, fetch } = createTestSubject();
      await expect(provider.getPriceSignals([])).resolves.toMatchObject({ data: [] });
      expect(fetch.calls).toHaveLength(0);
    });
  });

  it('sends every request with the configured User-Agent', async () => {
    const { provider, fetch } = createTestSubject();
    await provider.getNeighbourhoodFacts(ISLINGTON);
    expect(fetch.calls.length).toBeGreaterThan(2);
    for (const call of fetch.calls) {
      expect(call.init?.headers).toMatchObject({ 'User-Agent': TEST_USER_AGENT });
    }
  });
});

describe('createNominatimGeocoder', () => {
  it('searches Nominatim with Nominatim provenance', async () => {
    const geocoder = createNominatimGeocoder({
      userAgent: TEST_USER_AGENT,
      fetch: createFixtureFetch(),
      now: () => FIXED_NOW,
    });
    const result = await geocoder.search('Amsterdam');
    expect(result.provenance).toEqual({ source: 'nominatim', fetchedAt: FIXED_NOW.toISOString() });
    expect(result.data[0]).toMatchObject({ countryCode: 'NL' });
  });
});
