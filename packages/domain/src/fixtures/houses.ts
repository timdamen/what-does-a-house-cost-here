import { offsetLocation, roundLocation } from '../geo';
import type { House, PriceSignal } from '../types';
import type { FixtureArea, FixtureStreet } from './areas';
import { createSeededRandom, type SeededRandom } from './random';

const HOUSE_SPACING_METRES = 14;
const DEGREES_TO_RADIANS = Math.PI / 180;

export interface FixtureTown {
  houses: House[];
  /** Price Signals keyed by house id. Empty for areas without a price register. */
  signalsByHouseId: Map<string, PriceSignal[]>;
}

/**
 * Generates the Houses (and their Price Signals) for a fixture area. Deterministic for a given
 * area and `houseCount`: the same input always yields the same ids, addresses and prices.
 * `houseCount` defaults to the sum of the area's street lengths; larger counts loop back over the
 * streets on a parallel line so the cap can be exercised.
 */
export function generateFixtureTown(area: FixtureArea, houseCount?: number): FixtureTown {
  const random = createSeededRandom(area.seed);
  const total = houseCount ?? area.streets.reduce((sum, street) => sum + street.houses, 0);
  const houses: House[] = [];
  const signalsByHouseId = new Map<string, PriceSignal[]>();

  let index = 0;
  let pass = 0;
  while (houses.length < total) {
    for (const street of area.streets) {
      for (let n = 0; n < street.houses && houses.length < total; n += 1) {
        const house = buildHouse(area, street, n, pass, index, random);
        houses.push(house);
        const signals = buildSignals(area, house, random);
        if (signals.length > 0) signalsByHouseId.set(house.id, signals);
        index += 1;
      }
    }
    pass += 1;
  }

  return { houses, signalsByHouseId };
}

function buildHouse(
  area: FixtureArea,
  street: FixtureStreet,
  positionOnStreet: number,
  pass: number,
  index: number,
  random: SeededRandom,
): House {
  const bearing = street.bearingDegrees * DEGREES_TO_RADIANS;
  const along = positionOnStreet * HOUSE_SPACING_METRES;
  // Alternate sides of the street (odd/even numbers), and shift each extra pass sideways.
  const side = positionOnStreet % 2 === 0 ? 1 : -1;
  const across = side * 9 + pass * 40 + (random.next() - 0.5) * 3;
  const dx = street.start[0] + Math.sin(bearing) * along + Math.cos(bearing) * across;
  const dy = street.start[1] + Math.cos(bearing) * along - Math.sin(bearing) * across;

  const buildingType = random.weighted(area.buildingTypeWeights);
  const housenumber = String(street.firstNumber + positionOnStreet + pass * 200);
  const levels = String(
    random.int(buildingType === 'apartments' ? 3 : 2, buildingType === 'apartments' ? 6 : 4),
  );

  return {
    id: `way/${area.firstOsmId + index}`,
    location: roundLocation(offsetLocation(area.centre, dx, dy), 6),
    address: {
      street: street.name,
      housenumber,
      postcode: street.postcode,
      city: area.city,
    },
    buildingType,
    osmTags: {
      building: buildingType === 'other' ? 'yes' : buildingType,
      'building:levels': levels,
      'addr:street': street.name,
      'addr:housenumber': housenumber,
      'addr:postcode': street.postcode,
      'addr:city': area.city,
    },
  };
}

function buildSignals(area: FixtureArea, house: House, random: SeededRandom): PriceSignal[] {
  // Always draw the same number of random values per house so later houses stay stable
  // whether or not this one ends up with signals.
  const hasSale = random.next() < 0.5;
  const priceRoll = random.next();
  const yearRoll = random.int(2022, 2025);
  const monthRoll = random.int(1, 12);
  const dayRoll = random.int(1, 28);
  const hasValuation = random.next() < 0.6;
  const valuationDrift = 0.92 + random.next() * 0.12;

  if (!area.currency || !area.priceRegister || !hasSale) return [];

  const [low, high] = area.priceBands[house.buildingType];
  const amount = roundToThousand(low + (high - low) * priceRoll);
  const date = `${yearRoll}-${pad(monthRoll)}-${pad(dayRoll)}`;

  const signals: PriceSignal[] = [
    {
      houseId: house.id,
      amount,
      currency: area.currency,
      kind: 'sale',
      date,
      scope: 'house',
      source: area.priceRegister,
    },
  ];

  if (hasValuation) {
    signals.push({
      houseId: house.id,
      amount: roundToThousand(amount * valuationDrift),
      currency: area.currency,
      kind: 'valuation',
      date: '2026-01-01',
      scope: 'house',
      source: `${area.priceRegister}:woz`,
    });
  }

  return signals;
}

function roundToThousand(value: number): number {
  return Math.round(value / 1000) * 1000;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
