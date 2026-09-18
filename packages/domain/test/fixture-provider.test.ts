import { describe, expect, it } from 'vitest';

import {
  AMSTERDAM_CENTRE,
  createFixtureProvider,
  FIXTURE_SOURCE,
  haversineMetres,
  HOUSE_CAP,
  SYDNEY_CENTRE,
  type NeighbourhoodFacts,
} from '../src/index';

const FIXED_NOW = new Date('2026-09-17T10:00:00.000Z');
const provider = () => createFixtureProvider({ now: () => FIXED_NOW });

const metroDistance = (facts: NeighbourhoodFacts): number | undefined =>
  facts.amenities.transport.find((a) => a.name === 'Metro Vijzelgracht')?.distanceMetres;

const mixTotal = (facts: NeighbourhoodFacts): number =>
  Object.values(facts.housingMix).reduce((sum, count) => sum + count, 0);

describe('fixture provider', () => {
  it('is deterministic across instances', async () => {
    const area = { centre: AMSTERDAM_CENTRE, radiusMetres: 2000 };
    const first = await provider().searchHouses(area);
    const second = await provider().searchHouses(area);
    expect(first).toEqual(second);
  });

  it('serves about 120 Houses around Amsterdam with plausible addresses', async () => {
    const { data, cap, truncated, provenance } = await provider().searchHouses({
      centre: AMSTERDAM_CENTRE,
      radiusMetres: 2000,
    });

    expect(data.length).toBeGreaterThanOrEqual(110);
    expect(data.length).toBeLessThanOrEqual(130);
    expect(cap).toBe(HOUSE_CAP);
    expect(truncated).toBe(false);
    expect(provenance).toEqual({ source: FIXTURE_SOURCE, fetchedAt: FIXED_NOW.toISOString() });

    for (const house of data) {
      expect(house.id).toMatch(/^way\/\d+$/);
      expect(house.address.street).toBeTruthy();
      expect(house.address.housenumber).toMatch(/^\d+$/);
      expect(house.address.postcode).toMatch(/^\d{4} [A-Z]{2}$/);
      expect(house.address.city).toBe('Amsterdam');
      expect(house.osmTags.building).toBeTruthy();
    }
    expect(new Set(data.map((house) => house.address.street)).size).toBeGreaterThan(5);
  });

  it('honours the Search Radius and sorts by distance from the centre', async () => {
    const area = { centre: AMSTERDAM_CENTRE, radiusMetres: 250 };
    const { data } = await provider().searchHouses(area);
    const wider = await provider().searchHouses({ ...area, radiusMetres: 500 });

    expect(data.length).toBeGreaterThan(0);
    expect(data.length).toBeLessThan(wider.data.length);
    const distances = data.map((house) => haversineMetres(area.centre, house.location));
    expect(Math.max(...distances)).toBeLessThanOrEqual(250);
    expect(distances).toEqual(distances.toSorted((a, b) => a - b));
  });

  it('applies the cap and reports truncation', async () => {
    const big = createFixtureProvider({ now: () => FIXED_NOW, houseCount: 400 });
    const { data, cap, truncated } = await big.searchHouses({
      centre: AMSTERDAM_CENTRE,
      radiusMetres: 5000,
    });

    expect(cap).toBe(HOUSE_CAP);
    expect(truncated).toBe(true);
    expect(data.length).toBe(HOUSE_CAP);
  });

  it('gives roughly half the Amsterdam Houses a sale Price Signal in EUR', async () => {
    const p = provider();
    const { data: houses } = await p.searchHouses({ centre: AMSTERDAM_CENTRE, radiusMetres: 2000 });
    const { data: signals } = await p.getPriceSignals(houses);

    const pricedHouses = new Set(signals.map((signal) => signal.houseId));
    expect(pricedHouses.size).toBeGreaterThan(houses.length * 0.35);
    expect(pricedHouses.size).toBeLessThan(houses.length * 0.65);
    expect(signals.every((signal) => signal.currency === 'EUR')).toBe(true);
    expect(signals.some((signal) => signal.kind === 'sale')).toBe(true);
    expect(signals.some((signal) => signal.kind === 'valuation')).toBe(true);
  });

  it('returns Neighbourhood Facts for Amsterdam with every amenity class and a price summary', async () => {
    const { data: facts } = await provider().getNeighbourhoodFacts({
      centre: AMSTERDAM_CENTRE,
      radiusMetres: 500,
    });

    expect(facts.name).toBe('Grachtengordel-Zuid');
    expect(facts.hierarchy).toMatchObject({ city: 'Amsterdam', countryCode: 'NL' });
    expect(facts.priceSummary?.currency).toBe('EUR');
    expect(facts.priceSummary?.sampleSize).toBeGreaterThan(30);
    expect(facts.priceSummary?.windowMonths).toBe(48);
    for (const list of Object.values(facts.amenities)) {
      expect(list.length).toBeGreaterThan(0);
    }
    const total = Object.values(facts.housingMix).reduce((sum, count) => sum + count, 0);
    expect(total).toBeGreaterThanOrEqual(110);
  });

  it('counts the Housing Mix over the Houses inside the Search Area only', async () => {
    const p = provider();
    const wide = await p.getNeighbourhoodFacts({ centre: AMSTERDAM_CENTRE, radiusMetres: 500 });
    const narrow = await p.getNeighbourhoodFacts({ centre: AMSTERDAM_CENTRE, radiusMetres: 250 });
    const { data: houses } = await p.searchHouses({ centre: AMSTERDAM_CENTRE, radiusMetres: 250 });

    expect(mixTotal(narrow.data)).toBe(houses.length);
    expect(mixTotal(narrow.data)).toBeLessThan(mixTotal(wide.data));
  });

  it('measures amenity distances from the queried Location', async () => {
    const p = provider();
    const here = await p.getNeighbourhoodFacts({ centre: AMSTERDAM_CENTRE, radiusMetres: 500 });
    const nearby = await p.getNeighbourhoodFacts({
      centre: { lat: 52.369, lng: 4.906 },
      radiusMetres: 500,
    });

    expect(metroDistance(here.data)).not.toBe(metroDistance(nearby.data));
  });

  it('returns no price data for Sydney as a normal value', async () => {
    const p = provider();
    const { data: facts } = await p.getNeighbourhoodFacts({
      centre: SYDNEY_CENTRE,
      radiusMetres: 500,
    });
    const { data: houses } = await p.searchHouses({ centre: SYDNEY_CENTRE, radiusMetres: 1000 });
    const { data: signals } = await p.getPriceSignals(houses);

    expect(facts.hierarchy.countryCode).toBe('AU');
    expect(facts.priceSummary).toBeNull();
    expect(houses.length).toBeGreaterThan(30);
    expect(houses.every((house) => house.address.city === 'Sydney')).toBe(true);
    expect(signals).toEqual([]);
  });

  it('ignores unknown house ids when looking up Price Signals', async () => {
    const { data } = await provider().getPriceSignals([
      { id: 'way/1', location: AMSTERDAM_CENTRE },
    ]);
    expect(data).toEqual([]);
  });
});
