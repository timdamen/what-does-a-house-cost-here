import { UpstreamError, type HouseRef } from '@house-cost/domain';
import { describe, expect, it } from 'vitest';

import { createHttpClient, type FetchLike } from '../src/http-client';
import {
  createLandRegistryAdapter,
  LAND_REGISTRY_SOURCE,
  MAX_HOUSE_SIGNALS,
  monthsBefore,
  parsePpdDate,
  rankedPostcodes,
  summarise,
  type LandRegistryTransaction,
} from '../src/prices/land-registry-gb';
import { createFixtureFetch, jsonResponse } from './helpers/fixture-fetch';
import { FIXED_NOW, TEST_USER_AGENT } from './helpers/subject';

function house(id: string, address: HouseRef['address']): HouseRef {
  return { id, location: { lat: 51.5385, lng: -0.1025 }, address };
}

const MOON_8 = house('way/31024606', {
  street: 'Moon Street',
  housenumber: '8',
  postcode: 'N1 0QU',
});
const MOON_99 = house('way/99', { street: 'Moon Street', housenumber: '99', postcode: 'n1  0qu' });
const WATER_TOWER_1 = house('way/317021312', {
  street: 'Water Tower Place',
  housenumber: '1',
  postcode: 'N1 0YW',
});
const NO_POSTCODE = house('way/1', { street: 'Somewhere' });

function adapterWith(fetch: FetchLike, now = FIXED_NOW) {
  const client = createHttpClient({ userAgent: TEST_USER_AGENT, concurrency: 2, fetch });
  return createLandRegistryAdapter({ client, now: () => now });
}

describe('getPriceSignals', () => {
  it('matches exact addresses as house-scope signals and falls back to the newest street sale', async () => {
    const fetch = createFixtureFetch({ emptyLandRegistryForUnknownPostcodes: false });
    const signals = await adapterWith(fetch).getPriceSignals([
      MOON_8,
      MOON_99,
      WATER_TOWER_1,
      NO_POSTCODE,
    ]);

    const forMoon8 = signals.filter((s) => s.houseId === MOON_8.id);
    expect(forMoon8.length).toBeGreaterThan(0);
    expect(forMoon8.length).toBeLessThanOrEqual(MAX_HOUSE_SIGNALS);
    expect(forMoon8.every((s) => s.scope === 'house')).toBe(true);
    const dates = forMoon8.map((s) => s.date);
    expect(dates).toEqual(dates.toSorted().toReversed());

    const forMoon99 = signals.filter((s) => s.houseId === MOON_99.id);
    expect(forMoon99).toHaveLength(1);
    expect(forMoon99[0]).toMatchObject({
      scope: 'street',
      kind: 'sale',
      currency: 'GBP',
      date: '2023-06-30',
      source: LAND_REGISTRY_SOURCE,
    });
    expect(forMoon99[0]?.amount).toBeGreaterThan(0);

    expect(signals.some((s) => s.houseId === WATER_TOWER_1.id)).toBe(false);
    expect(signals.some((s) => s.houseId === NO_POSTCODE.id)).toBe(false);

    const postcodesRequested = fetch.calls.map((call) =>
      new URL(call.url).searchParams.get('propertyAddress.postcode'),
    );
    expect(postcodesRequested.toSorted()).toEqual(['N1 0QU', 'N1 0YW']);
  });

  it('makes no request for no Houses', async () => {
    const fetch = createFixtureFetch();
    await expect(adapterWith(fetch).getPriceSignals([])).resolves.toEqual([]);
    expect(fetch.calls).toHaveLength(0);
  });

  it('rejects with UpstreamError when the register is down', async () => {
    const down = adapterWith(async () => jsonResponse('Service Unavailable', 503));
    const error = await down.getPriceSignals([MOON_8]).catch((e) => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect(error).toMatchObject({ service: 'land-registry', retryable: true });
  });
});

describe('getPriceSummary', () => {
  it('summarises standard sales in the last 24 months across the area postcodes', async () => {
    const summary = await adapterWith(createFixtureFetch()).getPriceSummary([
      MOON_8,
      MOON_99,
      WATER_TOWER_1,
    ]);

    if (summary === null) throw new Error('expected a summary');
    expect(summary).toMatchObject({
      currency: 'GBP',
      asOf: '2023-06-30',
      sampleSize: 2,
      windowMonths: 24,
    });
    expect(summary.low).toBeLessThanOrEqual(summary.typical);
    expect(summary.typical).toBeLessThanOrEqual(summary.high);
  });

  it('is null when the window holds no sales, or there are no Houses', async () => {
    const recordedOn = new Date('2026-09-17T00:00:00Z');
    const stale = await adapterWith(createFixtureFetch(), recordedOn).getPriceSummary([MOON_8]);
    expect(stale).toBeNull();

    await expect(adapterWith(createFixtureFetch()).getPriceSummary([])).resolves.toBeNull();
  });
});

const sale = (pricePaid: number, date: string): LandRegistryTransaction => ({
  pricePaid,
  date,
  postcode: 'N1 0QU',
  standard: true,
});

describe('summarise', () => {
  it('uses the median for typical and nearest-rank p10/p90 for low/high', () => {
    const sales = Array.from({ length: 10 }, (_, i) =>
      sale((i + 1) * 100_000, `2024-0${(i % 9) + 1}-01`),
    );
    expect(summarise(sales)).toEqual({
      typical: 550_000,
      low: 100_000,
      high: 900_000,
      currency: 'GBP',
      asOf: '2024-09-01',
      sampleSize: 10,
      windowMonths: 24,
    });
    expect(summarise([sale(300_000, '2024-01-01')])).toMatchObject({
      typical: 300_000,
      low: 300_000,
      high: 300_000,
    });
    expect(summarise([])).toBeNull();
  });
});

describe('helpers', () => {
  it('parses the JSON API date format and ISO dates', () => {
    expect(parsePpdDate('Mon, 30 Jun 2025')).toBe('2025-06-30');
    expect(parsePpdDate('2025-06-30T00:00:00Z')).toBe('2025-06-30');
    expect(parsePpdDate('yesterday')).toBeUndefined();
    expect(parsePpdDate(42)).toBeUndefined();
  });

  it('counts months back, clamping to month end', () => {
    expect(monthsBefore(new Date('2024-03-31T00:00:00Z'), 1)).toBe('2024-02-29');
    expect(monthsBefore(new Date('2026-09-17T00:00:00Z'), 24)).toBe('2024-09-17');
  });

  it('ranks postcodes by House count then alphabetically, normalised', () => {
    expect(rankedPostcodes([MOON_99, WATER_TOWER_1, MOON_8, NO_POSTCODE])).toEqual([
      'N1 0QU',
      'N1 0YW',
    ]);
  });
});
