import { UpstreamError } from '@house-cost/domain';
import { describe, expect, it } from 'vitest';

import { createHttpClient, type FetchLike } from '../src/http-client';
import {
  createNominatimClient,
  mapReverse,
  mapSearch,
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
      postcode: 'N1 2TU',
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
