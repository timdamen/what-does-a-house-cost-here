import { AMENITY_CLASSES, walkingMinutes } from '@house-cost/domain';
import { describe, expect, it } from 'vitest';

import { createHttpClient } from '../src/http-client';
import {
  AMENITIES_PER_CLASS,
  buildAmenitiesQuery,
  classifyAmenity,
  fetchAmenities,
  groupAmenities,
} from '../src/overpass/amenities';
import { OVERPASS_URL } from '../src/overpass/client';
import { createFixtureFetch, loadFixture } from './helpers/fixture-fetch';
import { AMSTERDAM_AREA, ISLINGTON_AREA, TEST_USER_AGENT } from './helpers/subject';

describe('buildAmenitiesQuery', () => {
  it('is the query the fixtures were recorded with', () => {
    const recorded = loadFixture('overpass-amenities-islington').request.form?.data;
    expect(buildAmenitiesQuery(ISLINGTON_AREA)).toBe(recorded);
  });
});

describe('classifyAmenity', () => {
  it('maps OSM tags to the fixed amenity classes', () => {
    expect(classifyAmenity({ amenity: 'school' })).toBe('school');
    expect(classifyAmenity({ shop: 'supermarket' })).toBe('supermarket');
    expect(classifyAmenity({ amenity: 'pharmacy' })).toBe('healthcare');
    expect(classifyAmenity({ amenity: 'clinic' })).toBe('healthcare');
    expect(classifyAmenity({ leisure: 'park' })).toBe('park');
    expect(classifyAmenity({ highway: 'bus_stop', public_transport: 'platform' })).toBe(
      'transport',
    );
    expect(classifyAmenity({ railway: 'tram_stop' })).toBe('transport');
    expect(classifyAmenity({ public_transport: 'stop_position' })).toBe('transport');
    expect(classifyAmenity({ amenity: 'cafe' })).toBeUndefined();
  });
});

describe('groupAmenities', () => {
  const area = { centre: { lat: 51.5, lng: -0.1 }, radiusMetres: 500 };

  it('keeps the nearest five per class, sorted by distance, with walking minutes', () => {
    const elements = Array.from({ length: 8 }, (_, i) => ({
      type: 'node' as const,
      id: i,
      lat: 51.5 + (8 - i) * 0.001,
      lon: -0.1,
      tags: { amenity: 'school', name: `School ${i}` },
    }));
    const grouped = groupAmenities(elements, area);

    expect(grouped.school).toHaveLength(AMENITIES_PER_CLASS);
    expect(grouped.school[0]?.name).toBe('School 7');
    const distances = grouped.school.map((a) => a.distanceMetres);
    expect(distances).toEqual(distances.toSorted((a, b) => a - b));
    expect(grouped.school[0]?.walkingMinutes).toBe(walkingMinutes(distances[0] ?? 0));
    for (const cls of AMENITY_CLASSES) expect(Array.isArray(grouped[cls])).toBe(true);
  });

  it('collapses a stop pole and its stop position sharing a name, but keeps unnamed parks', () => {
    const grouped = groupAmenities(
      [
        {
          type: 'node',
          id: 1,
          lat: 51.5001,
          lon: -0.1,
          tags: { highway: 'bus_stop', name: 'Angel' },
        },
        {
          type: 'node',
          id: 2,
          lat: 51.5002,
          lon: -0.1,
          tags: { public_transport: 'stop_position', name: 'Angel' },
        },
        { type: 'way', id: 3, center: { lat: 51.501, lon: -0.1 }, tags: { leisure: 'park' } },
        { type: 'way', id: 4, center: { lat: 51.502, lon: -0.1 }, tags: { leisure: 'park' } },
      ],
      area,
    );
    expect(grouped.transport).toHaveLength(1);
    expect(grouped.park.map((p) => p.name)).toEqual(['Park', 'Park']);
  });
});

describe('fetchAmenities', () => {
  const client = createHttpClient({
    userAgent: TEST_USER_AGENT,
    concurrency: 2,
    fetch: createFixtureFetch(),
  });

  it('groups the recorded Islington amenities', async () => {
    const amenities = await fetchAmenities(client, OVERPASS_URL, ISLINGTON_AREA);
    expect(amenities.school.length).toBeGreaterThan(0);
    expect(amenities.supermarket.length).toBeGreaterThan(0);
    expect(amenities.healthcare.length).toBeGreaterThan(0);
    expect(amenities.park.length).toBeGreaterThan(0);
    expect(amenities.transport).toHaveLength(AMENITIES_PER_CLASS);
    for (const cls of AMENITY_CLASSES) {
      for (const amenity of amenities[cls]) {
        expect(amenity.distanceMetres).toBeLessThanOrEqual(ISLINGTON_AREA.radiusMetres + 50);
      }
    }
  });

  it('groups the recorded Amsterdam amenities, including tram stops', async () => {
    const amenities = await fetchAmenities(client, OVERPASS_URL, AMSTERDAM_AREA);
    expect(amenities.transport.length).toBeGreaterThan(0);
    expect(amenities.supermarket.length).toBeGreaterThan(0);
  });
});
