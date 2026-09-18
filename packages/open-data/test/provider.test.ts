import { BUILDING_TYPES, HOUSE_CAP, UpstreamError } from '@house-cost/domain';
import { describe, expect, it } from 'vitest';

import { createNominatimGeocoder } from '../src/geocoder';
import { createOpenDataProvider, createOpenDataRuntime } from '../src/provider';
import { createFixtureFetch, jsonResponse } from './helpers/fixture-fetch';
import {
  AMSTERDAM_AREA,
  createTestSubject,
  FIXED_NOW,
  ISLINGTON_AREA,
  RECORDED_RADIUS_METRES,
  TEST_USER_AGENT,
} from './helpers/subject';

/** Overpass requests among the stub's calls, split by the query they carry. */
function overpassCalls(calls: ReadonlyArray<{ url: string; init: RequestInit | undefined }>) {
  const queries = calls
    .filter((call) => call.url.includes('/api/interpreter'))
    .map((call) => new URLSearchParams(String(call.init?.body ?? '')).get('data') ?? '');
  return {
    houses: queries.filter((query) => query.includes('"building"')),
    amenities: queries.filter((query) => !query.includes('"building"')),
  };
}

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
      const provider = createOpenDataProvider(
        createOpenDataRuntime({
          userAgent: TEST_USER_AGENT,
          fetch: async () => jsonResponse('Too Many Requests', 429),
        }),
      );
      const error = await provider.searchHouses(ISLINGTON_AREA).catch((e) => e);
      expect(error).toBeInstanceOf(UpstreamError);
      expect(error).toMatchObject({ kind: 'upstream', service: 'overpass', retryable: true });
    });

    it('does not remember a failed Overpass query, so a retry asks again', async () => {
      let failures = 0;
      const fixtures = createFixtureFetch();
      const provider = createOpenDataProvider(
        createOpenDataRuntime({
          userAgent: TEST_USER_AGENT,
          now: () => FIXED_NOW,
          fetch: async (url, init) => {
            if (url.includes('/api/interpreter') && failures === 0) {
              failures += 1;
              return jsonResponse('Gateway Timeout', 504);
            }
            return fixtures(url, init);
          },
        }),
      );

      await expect(provider.searchHouses(ISLINGTON_AREA)).rejects.toBeInstanceOf(UpstreamError);
      await expect(provider.searchHouses(ISLINGTON_AREA)).resolves.toMatchObject({
        truncated: false,
      });
    });
  });

  describe('getNeighbourhoodFacts', () => {
    it('composes Nominatim, Overpass and the Land Registry for a GB Search Area', async () => {
      const { provider } = createTestSubject();
      const { data: facts, provenance } = await provider.getNeighbourhoodFacts(ISLINGTON_AREA);

      expect(provenance.source).toBe('nominatim+openstreetmap-overpass+hm-land-registry-ppd');
      expect(facts.name).toBe('Canonbury');
      expect(facts.hierarchy).toMatchObject({ countryCode: 'GB', city: 'Greater London' });
      expect(facts.priceSummary).toMatchObject({
        currency: 'GBP',
        asOf: '2023-06-30',
        windowMonths: 24,
      });
      expect(facts.amenities.transport.length).toBeGreaterThan(0);
      expect(facts.amenities.transport.length).toBeLessThanOrEqual(5);
      const total = BUILDING_TYPES.reduce((sum, type) => sum + facts.housingMix[type], 0);
      expect(total).toBeGreaterThan(50);
      expect(facts.housingMix.house).toBeGreaterThan(facts.housingMix.terraced);
    });

    it('queries Overpass with the Search Radius of the area it is given', async () => {
      const { provider, fetch } = createTestSubject();
      await provider.getNeighbourhoodFacts(ISLINGTON_AREA);

      const { houses, amenities } = overpassCalls(fetch.calls);
      expect(houses).toHaveLength(1);
      expect(amenities).toHaveLength(1);
      expect(houses[0]).toContain(`(around:${RECORDED_RADIUS_METRES},51.5385,-0.1025)`);
      expect(amenities[0]).toContain(`(around:${RECORDED_RADIUS_METRES},51.5385,-0.1025)`);
    });

    it('reuses the Houses of a searchHouses call for the same area instead of asking Overpass twice', async () => {
      const { provider, fetch } = createTestSubject();
      const [houses, facts] = await Promise.all([
        provider.searchHouses(ISLINGTON_AREA),
        provider.getNeighbourhoodFacts(ISLINGTON_AREA),
      ]);
      await provider.getNeighbourhoodFacts(ISLINGTON_AREA);

      expect(overpassCalls(fetch.calls).houses).toHaveLength(1);
      const total = BUILDING_TYPES.reduce((sum, type) => sum + facts.data.housingMix[type], 0);
      expect(total).toBe(houses.data.length);
    });

    it('reports no price data for a Dutch Search Area without calling any register', async () => {
      const { provider, fetch } = createTestSubject();
      const { data: facts, provenance } = await provider.getNeighbourhoodFacts(AMSTERDAM_AREA);

      expect(provenance.source).toBe('nominatim+openstreetmap-overpass');
      expect(facts.priceSummary).toBeNull();
      expect(facts.hierarchy.countryCode).toBe('NL');
      expect(facts.name).toBe('Nieuwmarkt/Lastage');
      expect(fetch.calls.some((call) => call.url.includes('landregistry'))).toBe(false);
    });

    it('fails as a whole with UpstreamError when Nominatim is down', async () => {
      const fixtures = createFixtureFetch();
      const provider = createOpenDataProvider(
        createOpenDataRuntime({
          userAgent: TEST_USER_AGENT,
          fetch: async (url, init) =>
            url.includes('/reverse') ? jsonResponse({ error: 'down' }, 503) : fixtures(url, init),
        }),
      );
      await expect(provider.getNeighbourhoodFacts(ISLINGTON_AREA)).rejects.toMatchObject({
        kind: 'upstream',
        service: 'nominatim',
      });
    });
  });

  describe('getPriceSignals', () => {
    it('resolves the country from the Houses and uses the register for GB', async () => {
      const { provider } = createTestSubject();
      const houses = (await provider.searchHouses(ISLINGTON_AREA)).data.map(
        ({ id, location, address }) => ({ id, location, address }),
      );
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
    await provider.getNeighbourhoodFacts(ISLINGTON_AREA);
    expect(fetch.calls.length).toBeGreaterThan(2);
    for (const call of fetch.calls) {
      expect(call.init?.headers).toMatchObject({ 'User-Agent': TEST_USER_AGENT });
    }
  });
});

describe('createNominatimGeocoder', () => {
  it('searches Nominatim with Nominatim provenance', async () => {
    const { geocoder } = createTestSubject();
    const result = await geocoder.search('Amsterdam');
    expect(result.provenance).toEqual({ source: 'nominatim', fetchedAt: FIXED_NOW.toISOString() });
    expect(result.data[0]).toMatchObject({ countryCode: 'NL' });
  });

  it('shares the runtime HTTP client with the provider, so the concurrency limit spans both', async () => {
    let inFlight = 0;
    let peak = 0;
    const fixtures = createFixtureFetch();
    const runtime = createOpenDataRuntime({
      userAgent: TEST_USER_AGENT,
      concurrency: 1,
      now: () => FIXED_NOW,
      fetch: async (url, init) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return fixtures(url, init);
      },
    });
    const provider = createOpenDataProvider(runtime);
    const geocoder = createNominatimGeocoder(runtime);

    await Promise.all([
      provider.searchHouses(ISLINGTON_AREA),
      provider.searchHouses(AMSTERDAM_AREA),
      geocoder.search('Amsterdam'),
    ]);

    expect(peak).toBe(1);
  });
});
