import type {
  BuildingType,
  HouseAddress,
  Location,
  PriceSignalKind,
  PriceSignalScope,
} from '@house-cost/domain';
import { haversineMetres } from '@house-cost/domain';

import type { MapHouse } from './map/types';

/** How the house list is ordered (user story 25). Distance is the default. */
export type HouseSort = 'distance' | 'price';

/** A House as the list and the card show it: with its straight-line distance from the Location. */
export interface ListedHouse {
  house: MapHouse;
  distanceMetres: number;
}

/** The one label per building type, shared by the list, the card and the Housing Mix. */
export const BUILDING_TYPE_LABELS: Record<BuildingType, string> = {
  detached: 'Detached house',
  'semi-detached': 'Semi-detached house',
  terraced: 'Terraced house',
  apartments: 'Apartments',
  house: 'House',
  residential: 'Residential building',
  other: 'Other building',
};

const PRICE_KIND_LABELS: Record<PriceSignalKind, string> = {
  sale: 'Sale',
  valuation: 'Valuation',
};

const PRICE_SCOPE_LABELS: Record<PriceSignalScope, string> = {
  house: 'this house',
  street: 'this street',
  area: 'this area',
};

/** Copy for a House without a Price Signal (user story 28: shown, never hidden). */
export const NO_PRICE_DATA = 'No price data';

export function buildingTypeLabel(type: BuildingType): string {
  return BUILDING_TYPE_LABELS[type];
}

export function priceKindLabel(kind: PriceSignalKind): string {
  return PRICE_KIND_LABELS[kind];
}

export function priceScopeLabel(scope: PriceSignalScope): string {
  return PRICE_SCOPE_LABELS[scope];
}

/** `Keizersgracht 12` from the OSM `addr:*` tags, or a fallback when OSM holds no street. */
export function houseAddressLabel(address: HouseAddress): string {
  const street = address.street?.trim();
  const number = address.housenumber?.trim();
  if (street && number) return `${street} ${number}`;
  if (street) return street;
  if (number) return `Number ${number}`;
  return 'Unnamed building';
}

/** Month and year of an ISO date (`2024-03-15` -> `Mar 2024`), or the raw string if unparseable. */
export function formatSignalDate(isoDate: string, locale: string): string {
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

/** Link to the OSM object behind a House id (`way/123`, `node/123`), or `null` for foreign ids. */
export function osmUrl(houseId: string): string | null {
  return /^(?:way|node|relation)\/\d+$/.test(houseId)
    ? `https://www.openstreetmap.org/${houseId}`
    : null;
}

/**
 * Houses with their distance from the Location, in list order. Distance sorts nearest first;
 * price sorts cheapest first with Houses without a Price Signal last (still by distance among
 * themselves), so "no price data" rows stay visible but out of the way (user stories 25, 28).
 */
export function listHouses(
  houses: readonly MapHouse[],
  centre: Location,
  sort: HouseSort,
): ListedHouse[] {
  const listed = houses.map((house) => ({
    house,
    distanceMetres: haversineMetres(centre, house.location),
  }));
  return listed.toSorted(sort === 'distance' ? byDistance : byPriceThenDistance);
}

function byDistance(a: ListedHouse, b: ListedHouse): number {
  return a.distanceMetres - b.distanceMetres;
}

function byPriceThenDistance(a: ListedHouse, b: ListedHouse): number {
  const priceA = a.house.priceSignal?.amount;
  const priceB = b.house.priceSignal?.amount;
  if (priceA === undefined && priceB === undefined) return byDistance(a, b);
  if (priceA === undefined) return 1;
  if (priceB === undefined) return -1;
  return priceA - priceB || byDistance(a, b);
}

/** Number of Houses that carry a Price Signal. */
export function countPriced(houses: readonly MapHouse[]): number {
  return houses.filter((house) => house.priceSignal).length;
}

/** The one-row summary shown in the sheet's peek state (ADR-0006, user story 29). */
export function houseCountSummary(
  count: number,
  priced: number,
  pricesKnown: boolean,
  truncated: boolean,
): string {
  const base = count === 1 ? '1 house' : `${count} houses`;
  const withPrice = pricesKnown ? `, ${priced} with a price` : '';
  const capped = truncated ? `, showing the first ${count}` : '';
  return `${base}${withPrice}${capped}`;
}
