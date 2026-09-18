import { HOUSE_CAP, UpstreamError } from '@house-cost/domain';
import { describe, expect, it } from 'vitest';

import { createHttpClient, type FetchLike } from '../src/http-client';
import { OVERPASS_URL } from '../src/overpass/client';
import { buildHousesQuery, mapHouse, searchHousesOverpass } from '../src/overpass/houses';
import { createFixtureFetch, jsonResponse, loadFixture } from './helpers/fixture-fetch';
import { AMSTERDAM_AREA, ISLINGTON_AREA, TEST_USER_AGENT } from './helpers/subject';

function clientWith(fetch: FetchLike) {
  return createHttpClient({ userAgent: TEST_USER_AGENT, concurrency: 2, fetch });
}

describe('buildHousesQuery', () => {
  it('is the query the fixtures were recorded with', () => {
    const recorded = loadFixture('overpass-houses-islington').request.form?.data;
    expect(buildHousesQuery(ISLINGTON_AREA, HOUSE_CAP + 1)).toBe(recorded);
  });

  it('asks for residential building types around the centre with a timeout and a limit', () => {
    const query = buildHousesQuery({ centre: { lat: 1.5, lng: -2.25 }, radiusMetres: 500 }, 301);
    expect(query).toContain('[out:json][timeout:25];');
    expect(query).toContain('(around:500,1.5,-2.25)');
    expect(query).toContain('"building"~"^(house|detached|semidetached_house|terrace|');
    expect(query).toContain('out center tags 301;');
  });
});

const node = (building: string) => ({
  type: 'node' as const,
  id: 1,
  lat: 0,
  lon: 0,
  tags: { building },
});

describe('mapHouse', () => {
  it('maps a way with a centre and addr:* tags', () => {
    const withCenter = mapHouse({
      type: 'way',
      id: 31024606,
      center: { lat: 51.53, lon: -0.1 },
      tags: {
        building: 'terrace',
        'building:levels': '3',
        'addr:housenumber': '8',
        'addr:street': 'Moon Street',
        'addr:postcode': 'n1  0qu',
        'addr:city': 'London',
        source: 'survey',
      },
    });
    expect(withCenter).toEqual({
      id: 'way/31024606',
      location: { lat: 51.53, lng: -0.1 },
      address: { street: 'Moon Street', housenumber: '8', postcode: 'N1 0QU', city: 'London' },
      buildingType: 'terraced',
      osmTags: {
        building: 'terrace',
        'building:levels': '3',
        'addr:housenumber': '8',
        'addr:street': 'Moon Street',
        'addr:postcode': 'n1  0qu',
        'addr:city': 'London',
      },
    });
  });

  it('maps OSM building values onto the domain union and drops non-residential ones', () => {
    expect(mapHouse(node('semidetached_house'))?.buildingType).toBe('semi-detached');
    expect(mapHouse(node('bungalow'))?.buildingType).toBe('house');
    expect(mapHouse(node('apartments'))?.buildingType).toBe('apartments');
    expect(mapHouse(node('residential'))?.buildingType).toBe('residential');
    expect(mapHouse(node('yes'))).toBeUndefined();
    expect(mapHouse({ type: 'node', id: 2, lat: 0, lon: 0 })).toBeUndefined();
  });
});

describe('searchHousesOverpass', () => {
  it('returns the recorded Islington Houses nearest first, none truncated', async () => {
    const client = clientWith(createFixtureFetch());
    const result = await searchHousesOverpass(client, OVERPASS_URL, ISLINGTON_AREA, HOUSE_CAP);

    expect(result.cap).toBe(HOUSE_CAP);
    expect(result.truncated).toBe(false);
    expect(result.data.length).toBeGreaterThan(50);
    expect(result.data.map((house) => house.id)).toContain('way/31024606');

    const moon = result.data.find((house) => house.id === 'way/31024606');
    expect(moon?.address).toMatchObject({
      street: 'Moon Street',
      housenumber: '8',
      postcode: 'N1 0QU',
    });
    expect(moon?.buildingType).toBe('house');
  });

  it('serves Amsterdam Houses without addresses and nothing at sea', async () => {
    const client = clientWith(createFixtureFetch());
    const amsterdam = await searchHousesOverpass(client, OVERPASS_URL, AMSTERDAM_AREA, HOUSE_CAP);
    expect(amsterdam.data.length).toBeGreaterThan(50);
    expect(amsterdam.data.every((house) => house.address.postcode === undefined)).toBe(true);

    const nowhere = { centre: { lat: 0, lng: 0 }, radiusMetres: 100 };
    const sea = await searchHousesOverpass(client, OVERPASS_URL, nowhere, HOUSE_CAP);
    expect(sea).toEqual({ data: [], cap: HOUSE_CAP, truncated: false });
  });

  it('caps at HOUSE_CAP and reports truncation when Overpass returns more', async () => {
    const elements = Array.from({ length: HOUSE_CAP + 1 }, (_, i) => ({
      type: 'way',
      id: i + 1,
      center: { lat: 51.5385 + i * 0.00001, lon: -0.1025 },
      tags: { building: i % 2 === 0 ? 'house' : 'apartments' },
    }));
    const fetch: FetchLike = async (_url, init) => {
      const query = new URLSearchParams(String(init?.body)).get('data');
      expect(query).toContain(`out center tags ${HOUSE_CAP + 1};`);
      return jsonResponse({ version: 0.6, elements });
    };
    const result = await searchHousesOverpass(
      clientWith(fetch),
      OVERPASS_URL,
      ISLINGTON_AREA,
      HOUSE_CAP,
    );

    expect(result.truncated).toBe(true);
    expect(result.cap).toBe(HOUSE_CAP);
    expect(result.data).toHaveLength(HOUSE_CAP);
    expect(result.data[0]?.id).toBe('way/1');
    expect(result.data.map((h) => h.id)).not.toContain(`way/${HOUSE_CAP + 1}`);
  });

  it('reports Overpass runtime errors and bad shapes as UpstreamError', async () => {
    const timedOut = clientWith(async () =>
      jsonResponse({
        version: 0.6,
        remark: 'runtime error: Query timed out in "query"',
        elements: [],
      }),
    );
    const error = await searchHousesOverpass(
      timedOut,
      OVERPASS_URL,
      ISLINGTON_AREA,
      HOUSE_CAP,
    ).catch((e) => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect(error).toMatchObject({ service: 'overpass', retryable: true });

    const html = clientWith(async () => jsonResponse({ unexpected: true }));
    await expect(
      searchHousesOverpass(html, OVERPASS_URL, ISLINGTON_AREA, HOUSE_CAP),
    ).rejects.toMatchObject({ kind: 'upstream', service: 'overpass', retryable: false });
  });
});
