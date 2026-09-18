import {
  AMSTERDAM_CENTRE,
  HOUSE_CAP,
  SYDNEY_CENTRE,
  haversineMetres,
  type GeocodeSearchResult,
  type HouseSearchResult,
  type NeighbourhoodFactsResult,
  type PriceSignalsResult,
} from '@house-cost/domain';
import { fetch, setup } from '@nuxt/test-utils/e2e';
import { describe, expect, it } from 'vitest';

const SIX_HOURS = 'public, max-age=21600, s-maxage=21600';
const ONE_DAY = 'public, max-age=86400, s-maxage=86400';

interface ApiError {
  error: { kind: string; message?: string; issues?: Array<{ path: string[]; message: string }> };
}

function housesUrl(lat: number, lng: number, radius = 500): string {
  return `/api/houses?lat=${lat}&lng=${lng}&radius=${radius}`;
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

describe('api routes with the fixture provider', async () => {
  await setup({
    server: true,
    browser: false,
    nuxtConfig: { runtimeConfig: { dataProvider: 'fixture' } },
  });

  describe('GET /api/houses', () => {
    it('returns the houses inside the search area with a six hour cache header', async () => {
      const response = await fetch(housesUrl(AMSTERDAM_CENTRE.lat, AMSTERDAM_CENTRE.lng));

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe(SIX_HOURS);

      const body = await json<HouseSearchResult>(response);
      expect(body.provenance.source).toBe('fixture');
      expect(body.provenance.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(body.cap).toBe(HOUSE_CAP);
      expect(body.truncated).toBe(false);
      expect(body.data.length).toBeGreaterThan(0);
      for (const house of body.data) {
        expect(house.id).toMatch(/^(way|node)\/\d+$/);
        expect(haversineMetres(AMSTERDAM_CENTRE, house.location)).toBeLessThanOrEqual(500);
      }
    });

    it('rounds the Location to four decimals before searching', async () => {
      const exact = await json<HouseSearchResult>(
        await fetch(housesUrl(AMSTERDAM_CENTRE.lat, AMSTERDAM_CENTRE.lng, 250)),
      );
      const noisy = await json<HouseSearchResult>(
        await fetch(housesUrl(AMSTERDAM_CENTRE.lat + 0.00004, AMSTERDAM_CENTRE.lng - 0.00004, 250)),
      );

      expect(noisy.data.map((house) => house.id)).toEqual(exact.data.map((house) => house.id));
    });

    it('defaults the radius to 500 metres', async () => {
      const response = await fetch(
        `/api/houses?lat=${AMSTERDAM_CENTRE.lat}&lng=${AMSTERDAM_CENTRE.lng}`,
      );
      const withRadius = await fetch(housesUrl(AMSTERDAM_CENTRE.lat, AMSTERDAM_CENTRE.lng, 500));

      expect(response.status).toBe(200);
      expect((await json<HouseSearchResult>(response)).data.length).toBe(
        (await json<HouseSearchResult>(withRadius)).data.length,
      );
    });

    it('rejects bad input with 400 and a validation envelope', async () => {
      const response = await fetch(housesUrl(999, AMSTERDAM_CENTRE.lng));

      expect(response.status).toBe(400);
      expect(response.headers.get('cache-control') ?? '').not.toContain('max-age');
      const body = await json<ApiError>(response);
      expect(body.error.kind).toBe('validation');
      expect(body.error.issues?.[0]?.path).toEqual(['lat']);
    });

    it('rejects a missing longitude with 400', async () => {
      const response = await fetch(`/api/houses?lat=${AMSTERDAM_CENTRE.lat}`);

      expect(response.status).toBe(400);
      expect((await json<ApiError>(response)).error.kind).toBe('validation');
    });
  });

  describe('GET /api/facts', () => {
    it('returns neighbourhood facts with a price summary where open price data exists', async () => {
      const response = await fetch(
        `/api/facts?lat=${AMSTERDAM_CENTRE.lat}&lng=${AMSTERDAM_CENTRE.lng}`,
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe(SIX_HOURS);

      const { data, provenance } = await json<NeighbourhoodFactsResult>(response);
      expect(provenance.source).toBe('fixture');
      expect(data.name).toBeTypeOf('string');
      expect(data.hierarchy.countryCode).toBe('NL');
      expect(data.priceSummary).not.toBeNull();
      expect(data.priceSummary?.currency).toBe('EUR');
      expect(data.priceSummary?.low).toBeLessThanOrEqual(data.priceSummary?.typical ?? 0);
      expect(Object.keys(data.amenities).toSorted()).toEqual([
        'healthcare',
        'park',
        'school',
        'supermarket',
        'transport',
      ]);
      expect(data.amenities.transport[0]?.walkingMinutes).toBeGreaterThan(0);
      expect(data.housingMix.apartments).toBeGreaterThan(0);
      expect(data.priceSummary?.windowMonths).toBeGreaterThan(0);
    });

    it('follows the radius like /api/houses: the housing mix counts the houses of that area', async () => {
      const mixTotal = async (radius?: number) => {
        const url = `/api/facts?lat=${AMSTERDAM_CENTRE.lat}&lng=${AMSTERDAM_CENTRE.lng}${radius === undefined ? '' : `&radius=${radius}`}`;
        const { data } = await json<NeighbourhoodFactsResult>(await fetch(url));
        return Object.values(data.housingMix).reduce((sum, count) => sum + count, 0);
      };
      const houseCount = async (radius: number) =>
        (
          await json<HouseSearchResult>(
            await fetch(housesUrl(AMSTERDAM_CENTRE.lat, AMSTERDAM_CENTRE.lng, radius)),
          )
        ).data.length;

      expect(await mixTotal(250)).toBe(await houseCount(250));
      expect(await mixTotal(250)).toBeLessThan(await mixTotal(500));
      expect(await mixTotal()).toBe(await mixTotal(500));
    });

    it('reports priceSummary null for an area without open price data', async () => {
      const response = await fetch(`/api/facts?lat=${SYDNEY_CENTRE.lat}&lng=${SYDNEY_CENTRE.lng}`);

      expect(response.status).toBe(200);
      const { data } = await json<NeighbourhoodFactsResult>(response);
      expect(data.hierarchy.countryCode).toBe('AU');
      expect(data.priceSummary).toBeNull();
      expect(data.housingMix.apartments).toBeGreaterThan(0);
    });

    it('rejects a non-numeric latitude with 400', async () => {
      const response = await fetch('/api/facts?lat=abc&lng=4.9');

      expect(response.status).toBe(400);
      expect((await json<ApiError>(response)).error.kind).toBe('validation');
    });
  });

  describe('POST /api/prices', () => {
    async function housesAround(lat: number, lng: number): Promise<HouseSearchResult['data']> {
      return (await json<HouseSearchResult>(await fetch(housesUrl(lat, lng, 250)))).data;
    }

    it('returns price signals joined to the requested house ids with a one day cache header', async () => {
      const houses = await housesAround(AMSTERDAM_CENTRE.lat, AMSTERDAM_CENTRE.lng);
      const response = await fetch('/api/prices', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          houses: houses.map(({ id, location, address }) => ({ id, location, address })),
        }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe(ONE_DAY);

      const { data, provenance } = await json<PriceSignalsResult>(response);
      expect(provenance.source).toBe('fixture');
      expect(data.length).toBeGreaterThan(0);
      const ids = new Set(houses.map((house) => house.id));
      for (const signal of data) {
        expect(ids.has(signal.houseId)).toBe(true);
        expect(signal.currency).toBe('EUR');
        expect(signal.amount).toBeGreaterThan(0);
      }
    });

    it('returns no signals for houses in an area without open price data', async () => {
      const houses = await housesAround(SYDNEY_CENTRE.lat, SYDNEY_CENTRE.lng);
      const response = await fetch('/api/prices', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ houses: houses.map(({ id, location }) => ({ id, location })) }),
      });

      expect(response.status).toBe(200);
      expect((await json<PriceSignalsResult>(response)).data).toEqual([]);
    });

    it('rejects a malformed body with 400', async () => {
      const response = await fetch('/api/prices', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ houses: [{ id: 'way/1' }] }),
      });

      expect(response.status).toBe(400);
      const body = await json<ApiError>(response);
      expect(body.error.kind).toBe('validation');
      expect(body.error.issues?.[0]?.path).toEqual(['houses', '0', 'location']);
    });
  });

  describe('GET /api/geocode', () => {
    it('returns matching places with a one day cache header', async () => {
      const response = await fetch('/api/geocode?q=amster');

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe(ONE_DAY);

      const { data, provenance } = await json<GeocodeSearchResult>(response);
      expect(provenance.source).toBe('fixture');
      expect(data[0]?.location).toEqual(AMSTERDAM_CENTRE);
      expect(data[0]?.countryCode).toBe('NL');
    });

    it('returns an empty list when nothing matches', async () => {
      const response = await fetch('/api/geocode?q=nowhere-at-all');

      expect(response.status).toBe(200);
      expect((await json<GeocodeSearchResult>(response)).data).toEqual([]);
    });

    it('rejects a blank query with 400', async () => {
      const response = await fetch('/api/geocode?q=%20');

      expect(response.status).toBe(400);
      expect((await json<ApiError>(response)).error.kind).toBe('validation');
    });
  });
});
