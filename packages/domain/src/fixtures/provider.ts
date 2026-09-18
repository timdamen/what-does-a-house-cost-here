import { haversineMetres, isWithinArea, offsetLocation, walkingMinutes } from '../geo';
import { countHousingMix } from '../housing-mix';
import { HOUSE_CAP, type DataProvider } from '../ports';
import type {
  Amenity,
  AmenityClass,
  House,
  Location,
  NeighbourhoodFacts,
  PriceSignal,
  PriceSummary,
  Provenance,
} from '../types';
import { FIXTURE_AREAS, type FixtureArea } from './areas';
import { generateFixtureTown, type FixtureTown } from './houses';

/** `provenance.source` reported by the fixture provider and geocoder. */
export const FIXTURE_SOURCE = 'fixture';

/** The fixture Price Summary holds for this date and looks back `FIXTURE_SUMMARY_WINDOW_MONTHS`. */
const FIXTURE_SUMMARY_AS_OF = '2026-06-30';
const FIXTURE_SUMMARY_WINDOW_MONTHS = 48;
/** `FIXTURE_SUMMARY_AS_OF` minus the window; sales before it are left out of the summary. */
const FIXTURE_SUMMARY_SINCE = '2022-06-30';

export interface FixtureProviderOptions {
  /** Clock used for `provenance.fetchedAt`. Inject a fixed one in tests. */
  now?: () => Date;
  /** Houses to generate per area. Defaults to the area's natural size (about 120 for Amsterdam). */
  houseCount?: number;
  /** Cap applied to `searchHouses`. Defaults to `HOUSE_CAP`. */
  cap?: number;
}

/**
 * Deterministic, offline Data Provider. Two areas: Amsterdam (`AMSTERDAM_CENTRE`) with Price
 * Signals in EUR and a price summary, and Sydney (`SYDNEY_CENTRE`) whose region has no open price
 * data (`priceSummary: null`, no Price Signals). Any Location is served by its nearest area. The
 * Housing Mix counts the Houses inside the Search Area; the amenities are the whole town's,
 * nearest first, so every class has something to show at any Search Radius.
 */
export function createFixtureProvider(options: FixtureProviderOptions = {}): DataProvider {
  const now = options.now ?? (() => new Date());
  const cap = options.cap ?? HOUSE_CAP;
  const towns = new Map<FixtureArea, FixtureTown>(
    FIXTURE_AREAS.map((area) => [area, generateFixtureTown(area, options.houseCount)]),
  );

  const provenance = (): Provenance => ({ source: FIXTURE_SOURCE, fetchedAt: now().toISOString() });

  return {
    async searchHouses(area) {
      const matches: Array<{ house: House; distance: number }> = [];
      for (const town of towns.values()) {
        for (const house of town.houses) {
          const distance = haversineMetres(area.centre, house.location);
          if (distance <= area.radiusMetres) matches.push({ house, distance });
        }
      }
      matches.sort((a, b) => a.distance - b.distance || a.house.id.localeCompare(b.house.id));

      const truncated = matches.length > cap;
      return {
        data: matches.slice(0, cap).map((match) => match.house),
        cap,
        truncated,
        provenance: provenance(),
      };
    },

    async getNeighbourhoodFacts(searchArea) {
      const area = nearestArea(searchArea.centre);
      const town = towns.get(area);
      const houses = (town?.houses ?? []).filter((house) =>
        isWithinArea(house.location, searchArea),
      );
      const signals = town ? [...town.signalsByHouseId.values()].flat() : [];

      const facts: NeighbourhoodFacts = {
        name: area.name,
        hierarchy: { ...area.hierarchy },
        priceSummary: summarisePrices(area, signals),
        amenities: groupAmenities(area, searchArea.centre),
        housingMix: countHousingMix(houses),
      };
      return { data: facts, provenance: provenance() };
    },

    async getPriceSignals(houses) {
      const data: PriceSignal[] = [];
      for (const house of houses) {
        for (const town of towns.values()) {
          const signals = town.signalsByHouseId.get(house.id);
          if (signals) data.push(...signals);
        }
      }
      return { data, provenance: provenance() };
    },
  };
}

function nearestArea(location: Location): FixtureArea {
  let best: FixtureArea | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const area of FIXTURE_AREAS) {
    const distance = haversineMetres(location, area.centre);
    if (distance < bestDistance) {
      best = area;
      bestDistance = distance;
    }
  }
  if (!best) throw new Error('No fixture areas configured');
  return best;
}

function groupAmenities(area: FixtureArea, from: Location): Record<AmenityClass, Amenity[]> {
  const grouped: Record<AmenityClass, Amenity[]> = {
    school: [],
    supermarket: [],
    healthcare: [],
    park: [],
    transport: [],
  };
  for (const fixture of area.amenities) {
    const location = offsetLocation(area.centre, fixture.offset[0], fixture.offset[1]);
    const distanceMetres = Math.round(haversineMetres(from, location));
    grouped[fixture.class].push({
      name: fixture.name,
      location,
      distanceMetres,
      walkingMinutes: walkingMinutes(distanceMetres),
    });
  }
  for (const list of Object.values(grouped)) {
    list.sort((a, b) => a.distanceMetres - b.distanceMetres);
  }
  return grouped;
}

function summarisePrices(area: FixtureArea, signals: PriceSignal[]): PriceSummary | null {
  if (!area.currency) return null;
  const sales = signals
    .filter((signal) => signal.kind === 'sale' && signal.date >= FIXTURE_SUMMARY_SINCE)
    .map((signal) => signal.amount)
    .toSorted((a, b) => a - b);
  if (sales.length === 0) return null;

  return {
    typical: percentile(sales, 0.5),
    low: percentile(sales, 0.1),
    high: percentile(sales, 0.9),
    currency: area.currency,
    asOf: FIXTURE_SUMMARY_AS_OF,
    sampleSize: sales.length,
    windowMonths: FIXTURE_SUMMARY_WINDOW_MONTHS,
  };
}

function percentile(sorted: number[], fraction: number): number {
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round((sorted.length - 1) * fraction)),
  );
  return sorted[index] ?? 0;
}
