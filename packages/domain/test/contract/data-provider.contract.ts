import { describe, expect, it } from 'vitest';

import {
  AMENITY_CLASSES,
  BUILDING_TYPES,
  PRICE_SIGNAL_KINDS,
  PRICE_SIGNAL_SCOPES,
  type DataProvider,
  type House,
  type Location,
  type Provenance,
  type SearchArea,
} from '../../src/index';

/** What a provider under contract test must supply. */
export interface DataProviderContractSubject {
  provider: DataProvider;
  /** A Search Area whose region has open price data: Houses, a price summary and Price Signals. */
  pricedArea: SearchArea;
  /** A Search Area whose region has no open price data: `priceSummary: null`, no Price Signals. */
  unpricedArea: SearchArea;
}

export type DataProviderContractFactory = () =>
  | DataProviderContractSubject
  | Promise<DataProviderContractSubject>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_CODE = /^[A-Z]{3}$/;
const COUNTRY_CODE = /^[A-Z]{2}$/;

/**
 * The behaviour every `DataProvider` must share so the UI can rely on it. Call it from a Vitest
 * file: `runDataProviderContract('open-data', () => ({ provider, pricedArea, unpricedArea }))`.
 * The factory runs once per contract suite.
 */
export function runDataProviderContract(name: string, factory: DataProviderContractFactory): void {
  describe(`DataProvider contract: ${name}`, () => {
    const subject = (): Promise<DataProviderContractSubject> => Promise.resolve(factory());

    describe('searchHouses', () => {
      it('returns well-formed Houses inside the Search Area with cap and provenance', async () => {
        const { provider, pricedArea } = await subject();
        const result = await provider.searchHouses(pricedArea);

        expectProvenance(result.provenance);
        expect(Number.isInteger(result.cap)).toBe(true);
        expect(result.cap).toBeGreaterThan(0);
        expect(typeof result.truncated).toBe('boolean');
        expect(result.data.length).toBeLessThanOrEqual(result.cap);
        const fullWhenTruncated = !result.truncated || result.data.length === result.cap;
        expect(fullWhenTruncated).toBe(true);
        expect(result.data.length).toBeGreaterThan(0);

        const ids = new Set<string>();
        for (const house of result.data) {
          expectHouse(house);
          expect(ids.has(house.id)).toBe(false);
          ids.add(house.id);
        }
      });

      it('returns no Houses for a Search Area with nothing in it', async () => {
        const { provider, pricedArea } = await subject();
        const nowhere: SearchArea = { centre: { lat: 0, lng: 0 }, radiusMetres: 100 };
        const result = await provider.searchHouses(nowhere);

        expect(result.data).toEqual([]);
        expect(result.truncated).toBe(false);
        expectProvenance(result.provenance);
        void pricedArea;
      });
    });

    describe('getNeighbourhoodFacts', () => {
      it('returns the Neighbourhood name, hierarchy, amenities, housing mix and a price summary', async () => {
        const { provider, pricedArea } = await subject();
        const { data: facts, provenance } = await provider.getNeighbourhoodFacts(pricedArea);

        expectProvenance(provenance);
        expect(facts.name.length).toBeGreaterThan(0);
        expect(facts.hierarchy.countryCode).toMatch(COUNTRY_CODE);

        for (const amenityClass of AMENITY_CLASSES) {
          const list = facts.amenities[amenityClass];
          expect(Array.isArray(list)).toBe(true);
          for (const amenity of list) {
            expect(amenity.name.length).toBeGreaterThan(0);
            expectLocation(amenity.location);
            expect(amenity.distanceMetres).toBeGreaterThanOrEqual(0);
            expect(amenity.walkingMinutes).toBeGreaterThanOrEqual(0);
            expect(Number.isInteger(amenity.walkingMinutes)).toBe(true);
          }
        }

        for (const type of BUILDING_TYPES) {
          const count = facts.housingMix[type];
          expect(Number.isInteger(count)).toBe(true);
          expect(count).toBeGreaterThanOrEqual(0);
        }

        const summary = facts.priceSummary;
        if (summary === null) throw new Error('expected a price summary for the priced area');
        expect(summary.currency).toMatch(CURRENCY_CODE);
        expect(summary.asOf).toMatch(ISO_DATE);
        expect(summary.sampleSize).toBeGreaterThan(0);
        expect(Number.isInteger(summary.windowMonths)).toBe(true);
        expect(summary.windowMonths).toBeGreaterThan(0);
        expect(summary.low).toBeGreaterThan(0);
        expect(summary.low).toBeLessThanOrEqual(summary.typical);
        expect(summary.typical).toBeLessThanOrEqual(summary.high);
      });

      it('reports "no open price data" as priceSummary: null, not an error', async () => {
        const { provider, unpricedArea } = await subject();
        const { data: facts, provenance } = await provider.getNeighbourhoodFacts(unpricedArea);

        expectProvenance(provenance);
        expect(facts.priceSummary).toBeNull();
        expect(facts.hierarchy.countryCode).toMatch(COUNTRY_CODE);
      });
    });

    describe('getPriceSignals', () => {
      it('returns an empty list for no Houses', async () => {
        const { provider } = await subject();
        const result = await provider.getPriceSignals([]);

        expect(result.data).toEqual([]);
        expectProvenance(result.provenance);
      });

      it('returns well-formed Price Signals for Houses in a priced region', async () => {
        const { provider, pricedArea } = await subject();
        const houses = (await provider.searchHouses(pricedArea)).data;
        // Only what the server route can send: id, Location and address.
        const result = await provider.getPriceSignals(
          houses.map(({ id, location, address }) => ({ id, location, address })),
        );

        expectProvenance(result.provenance);
        expect(result.data.length).toBeGreaterThan(0);

        const ids = new Set(houses.map((house) => house.id));
        for (const signal of result.data) {
          expect(ids.has(signal.houseId)).toBe(true);
          expect(signal.amount).toBeGreaterThan(0);
          expect(signal.currency).toMatch(CURRENCY_CODE);
          expect(PRICE_SIGNAL_KINDS).toContain(signal.kind);
          expect(PRICE_SIGNAL_SCOPES).toContain(signal.scope);
          expect(signal.date).toMatch(ISO_DATE);
          expect(signal.source.length).toBeGreaterThan(0);
        }
      });

      it('returns no Price Signals for Houses in a region without open price data', async () => {
        const { provider, unpricedArea } = await subject();
        const houses = (await provider.searchHouses(unpricedArea)).data;
        const result = await provider.getPriceSignals(houses);

        expect(result.data).toEqual([]);
        expectProvenance(result.provenance);
      });
    });
  });
}

function expectProvenance(provenance: Provenance): void {
  expect(typeof provenance.source).toBe('string');
  expect(provenance.source.length).toBeGreaterThan(0);
  expect(Number.isNaN(Date.parse(provenance.fetchedAt))).toBe(false);
}

function expectLocation(location: Location): void {
  expect(location.lat).toBeGreaterThanOrEqual(-90);
  expect(location.lat).toBeLessThanOrEqual(90);
  expect(location.lng).toBeGreaterThanOrEqual(-180);
  expect(location.lng).toBeLessThanOrEqual(180);
}

function expectHouse(house: House): void {
  expect(typeof house.id).toBe('string');
  expect(house.id.length).toBeGreaterThan(0);
  expectLocation(house.location);
  expect(BUILDING_TYPES).toContain(house.buildingType);
  expect(typeof house.address).toBe('object');
  expect(typeof house.osmTags).toBe('object');
}
