import { UpstreamError } from '@house-cost/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createHttpClient, type FetchLike } from '../src/http-client';
import {
  createNominatimClient,
  mapReverse,
  mapSearch,
  NOMINATIM_MIN_INTERVAL_MS,
  NOMINATIM_URL,
  UNKNOWN_COUNTRY_CODE,
} from '../src/nominatim';
import { createFixtureFetch, jsonResponse } from './helpers/fixture-fetch';
import { AMSTERDAM, ISLINGTON, TEST_USER_AGENT } from './helpers/subject';

function nominatimWith(fetch: FetchLike) {
  const client = createHttpClient({ userAgent: TEST_USER_AGENT, concurrency: 2, fetch });
  return createNominatimClient(client, NOMINATIM_URL);
}

describe('reverse', () => {
  it('names the Islington area and reports the GB hierarchy', async () => {
    const fetch = createFixtureFetch();
    const place = await nominatimWith(fetch).reverse(ISLINGTON);

    expect(place).toEqual({
      name: 'Canonbury',
      hierarchy: {
        suburb: 'Islington',
        city: 'Greater London',
        region: 'England',
        country: 'United Kingdom',
        countryCode: 'GB',
      },
    });
    const url = new URL(fetch.calls[0]?.url ?? '');
    expect(url.pathname).toBe('/reverse');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      lat: '51.5385',
      lon: '-0.1025',
      format: 'jsonv2',
      zoom: '16',
      addressdetails: '1',
    });
  });

  it('names the Amsterdam quarter and reports NL', async () => {
    const place = await nominatimWith(createFixtureFetch()).reverse(AMSTERDAM);
    expect(place.name).toBe('Nieuwmarkt/Lastage');
    expect(place.hierarchy).toMatchObject({
      suburb: 'Centrum',
      city: 'Amsterdam',
      countryCode: 'NL',
    });
  });

  it('treats "unable to geocode" as an unknown place, not a failure', () => {
    expect(mapReverse({ error: 'Unable to geocode' })).toEqual({
      name: 'Unknown place',
      hierarchy: { countryCode: UNKNOWN_COUNTRY_CODE },
    });
  });

  it('falls back to the first display_name segment when no area key is present', () => {
    const place = mapReverse({
      display_name: 'Somewhere, Far Away',
      address: { country: 'Atlantis', country_code: 'xx' },
    });
    expect(place.name).toBe('Somewhere');
    expect(place.hierarchy).toEqual({ country: 'Atlantis', countryCode: 'XX' });
  });

  it('rejects with UpstreamError on HTTP failures', async () => {
    const failing = nominatimWith(async () => jsonResponse({ error: 'Bandwidth limit' }, 429));
    const error = await failing.reverse(ISLINGTON).catch((e) => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect(error).toMatchObject({ service: 'nominatim', retryable: true });
  });
});

describe('pacing', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts consecutive requests at least NOMINATIM_MIN_INTERVAL_MS apart', async () => {
    vi.useFakeTimers();
    const fixtures = createFixtureFetch();
    const startedAt: number[] = [];
    const nominatim = nominatimWith(async (url, init) => {
      startedAt.push(Date.now());
      return fixtures(url, init);
    });

    const first = nominatim.reverse(ISLINGTON);
    const second = nominatim.reverse(AMSTERDAM);
    const third = nominatim.search('Amsterdam');

    await vi.advanceTimersByTimeAsync(0);
    expect(startedAt).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(NOMINATIM_MIN_INTERVAL_MS - 1);
    expect(startedAt).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(startedAt).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(NOMINATIM_MIN_INTERVAL_MS);
    expect(startedAt).toHaveLength(3);

    await Promise.all([first, second, third]);
    expect((startedAt[1] ?? 0) - (startedAt[0] ?? 0)).toBeGreaterThanOrEqual(
      NOMINATIM_MIN_INTERVAL_MS,
    );
    expect((startedAt[2] ?? 0) - (startedAt[1] ?? 0)).toBeGreaterThanOrEqual(
      NOMINATIM_MIN_INTERVAL_MS,
    );
  });

  it('does not delay a request that comes more than a second after the previous one', async () => {
    vi.useFakeTimers();
    const fixtures = createFixtureFetch();
    const startedAt: number[] = [];
    const nominatim = nominatimWith(async (url, init) => {
      startedAt.push(Date.now());
      return fixtures(url, init);
    });

    await nominatim.reverse(ISLINGTON);
    await vi.advanceTimersByTimeAsync(NOMINATIM_MIN_INTERVAL_MS * 2);
    const before = Date.now();
    await nominatim.reverse(AMSTERDAM);

    expect(startedAt[1]).toBe(before);
  });
});

describe('search', () => {
  it('maps the recorded "Amsterdam" search to Geocoder results', async () => {
    const fetch = createFixtureFetch();
    const results = await nominatimWith(fetch).search('Amsterdam');

    expect(results).toHaveLength(5);
    expect(results[0]).toEqual({
      label: 'Amsterdam, Noord-Holland, Nederland',
      location: { lat: 52.3730796, lng: 4.8924534 },
      countryCode: 'NL',
    });
    expect(results.map((r) => r.countryCode)).toEqual(['NL', 'NL', 'FR', 'US', 'US']);
    expect(Object.fromEntries(new URL(fetch.calls[0]?.url ?? '').searchParams)).toEqual({
      q: 'Amsterdam',
      format: 'jsonv2',
      limit: '5',
      addressdetails: '1',
    });
  });

  it('returns nothing for a blank query without calling upstream', async () => {
    const fetch = createFixtureFetch();
    await expect(nominatimWith(fetch).search('   ')).resolves.toEqual([]);
    expect(fetch.calls).toHaveLength(0);
  });

  it('skips malformed places and rejects non-array bodies', () => {
    expect(mapSearch([{ lat: 'x', lon: '1', display_name: 'bad' }, null])).toEqual([]);
    expect(() => mapSearch({ error: 'nope' })).toThrow(UpstreamError);
  });
});
