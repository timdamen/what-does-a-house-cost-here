import {
  haversineMetres,
  isBuildingType,
  type BuildingType,
  type House,
  type HouseAddress,
  type SearchArea,
} from '@house-cost/domain';

import type { HttpClient } from '../http-client';
import {
  aroundFilter,
  elementId,
  elementLocation,
  overpassHeader,
  runOverpassQuery,
} from './client';
import type { OverpassElement } from './client';

/**
 * `building=*` values that mean "people live here" (OSM wiki, "Accommodation" section).
 * Each maps to a domain `BuildingType`.
 */
const RESIDENTIAL_BUILDING_TYPES: Readonly<Record<string, BuildingType>> = {
  house: 'house',
  detached: 'detached',
  semidetached_house: 'semi-detached',
  terrace: 'terraced',
  apartments: 'apartments',
  residential: 'residential',
  bungalow: 'house',
};

/** OSM tags copied onto `House.osmTags` for display. `addr:*` tags are always kept. */
const DISPLAY_TAGS = new Set(['building', 'building:levels', 'building:flats', 'name']);

/** Overpass QL for residential buildings inside the Search Area, limited to `limit` elements. */
export function buildHousesQuery(area: SearchArea, limit: number): string {
  const values = Object.keys(RESIDENTIAL_BUILDING_TYPES).join('|');
  return [
    overpassHeader(),
    `nwr["building"~"^(${values})$"]${aroundFilter(area.centre, area.radiusMetres)};`,
    `out center tags ${limit};`,
  ].join('\n');
}

/** Maps one Overpass element to a House, or `undefined` when it has no usable location or type. */
export function mapHouse(element: OverpassElement): House | undefined {
  const location = elementLocation(element);
  const tags = element.tags ?? {};
  const building = tags.building;
  if (!location || building === undefined) return undefined;
  const buildingType = RESIDENTIAL_BUILDING_TYPES[building];
  if (buildingType === undefined) return undefined;

  return {
    id: elementId(element),
    location,
    address: mapAddress(tags),
    buildingType: isBuildingType(buildingType) ? buildingType : 'other',
    osmTags: pickDisplayTags(tags),
  };
}

export interface OverpassHouseSearch {
  data: House[];
  cap: number;
  truncated: boolean;
}

/**
 * Houses inside the Search Area, nearest to the centre first, at most `cap` of them. The query
 * asks Overpass for `cap + 1` elements so truncation is detected without downloading everything.
 */
export async function searchHousesOverpass(
  client: HttpClient,
  url: string,
  area: SearchArea,
  cap: number,
): Promise<OverpassHouseSearch> {
  const elements = await runOverpassQuery(client, url, buildHousesQuery(area, cap + 1));
  const houses = elements
    .map(mapHouse)
    .filter((house): house is House => house !== undefined)
    .map((house) => ({ house, distance: haversineMetres(area.centre, house.location) }))
    .toSorted((a, b) => a.distance - b.distance || a.house.id.localeCompare(b.house.id))
    .map((entry) => entry.house);

  return {
    data: houses.slice(0, cap),
    cap,
    truncated: houses.length > cap,
  };
}

function mapAddress(tags: Record<string, string>): HouseAddress {
  const address: HouseAddress = {};
  const street = tags['addr:street'] ?? tags['addr:place'];
  const housenumber = tags['addr:housenumber'] ?? tags['addr:housename'];
  const postcode = tags['addr:postcode'];
  const city = tags['addr:city'];
  if (street) address.street = street;
  if (housenumber) address.housenumber = housenumber;
  if (postcode) address.postcode = normalisePostcode(postcode);
  if (city) address.city = city;
  return address;
}

function pickDisplayTags(tags: Record<string, string>): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const [key, value] of Object.entries(tags)) {
    if (key.startsWith('addr:') || DISPLAY_TAGS.has(key)) kept[key] = value;
  }
  return kept;
}

/** Upper case with single internal spaces, so `n1 1aa` and `N1  1AA` key the same register lookup. */
export function normalisePostcode(postcode: string): string {
  return postcode.trim().toUpperCase().replace(/\s+/g, ' ');
}
