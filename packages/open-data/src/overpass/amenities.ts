import {
  AMENITY_CLASSES,
  haversineMetres,
  walkingMinutes,
  type Amenity,
  type AmenityClass,
  type SearchArea,
} from '@house-cost/domain';

import type { HttpClient } from '../http-client';
import { aroundFilter, elementLocation, overpassHeader, runOverpassQuery } from './client';
import type { OverpassElement } from './client';

/** How many of the nearest amenities each class reports. */
export const AMENITIES_PER_CLASS = 5;

const HEALTHCARE_AMENITIES = ['doctors', 'hospital', 'pharmacy', 'clinic'];
const RAILWAY_STOPS = ['station', 'halt', 'tram_stop'];
const PUBLIC_TRANSPORT = ['stop_position', 'platform'];

/** Human label used when an OSM element has no `name`. */
const FALLBACK_NAMES: Readonly<Record<AmenityClass, string>> = {
  school: 'School',
  supermarket: 'Supermarket',
  healthcare: 'Healthcare',
  park: 'Park',
  transport: 'Stop',
};

/** Overpass QL for every amenity class inside the area, in one request. */
export function buildAmenitiesQuery(area: SearchArea): string {
  const around = aroundFilter(area.centre, area.radiusMetres);
  return [
    overpassHeader(),
    '(',
    `  nwr["amenity"="school"]${around};`,
    `  nwr["shop"="supermarket"]${around};`,
    `  nwr["amenity"~"^(${HEALTHCARE_AMENITIES.join('|')})$"]${around};`,
    `  nwr["leisure"="park"]${around};`,
    `  node["highway"="bus_stop"]${around};`,
    `  nwr["railway"~"^(${RAILWAY_STOPS.join('|')})$"]${around};`,
    `  node["public_transport"~"^(${PUBLIC_TRANSPORT.join('|')})$"]${around};`,
    ');',
    'out center tags;',
  ].join('\n');
}

/** The amenity class an element belongs to, or `undefined` when its tags match none. */
export function classifyAmenity(tags: Record<string, string>): AmenityClass | undefined {
  if (tags.amenity === 'school') return 'school';
  if (tags.shop === 'supermarket') return 'supermarket';
  if (tags.amenity !== undefined && HEALTHCARE_AMENITIES.includes(tags.amenity)) {
    return 'healthcare';
  }
  if (tags.leisure === 'park') return 'park';
  if (
    tags.highway === 'bus_stop' ||
    (tags.railway !== undefined && RAILWAY_STOPS.includes(tags.railway)) ||
    (tags.public_transport !== undefined && PUBLIC_TRANSPORT.includes(tags.public_transport))
  ) {
    return 'transport';
  }
  return undefined;
}

/**
 * The nearest `AMENITIES_PER_CLASS` amenities per class within the area. Elements sharing a class
 * and name (a bus stop's pole and its stop position, both sides of a road) collapse to the
 * nearest one.
 */
export async function fetchAmenities(
  client: HttpClient,
  url: string,
  area: SearchArea,
): Promise<Record<AmenityClass, Amenity[]>> {
  const elements = await runOverpassQuery(client, url, buildAmenitiesQuery(area));
  return groupAmenities(elements, area);
}

export function groupAmenities(
  elements: readonly OverpassElement[],
  area: SearchArea,
): Record<AmenityClass, Amenity[]> {
  const grouped: Record<AmenityClass, Amenity[]> = {
    school: [],
    supermarket: [],
    healthcare: [],
    park: [],
    transport: [],
  };

  const candidates: Record<AmenityClass, Candidate[]> = {
    school: [],
    supermarket: [],
    healthcare: [],
    park: [],
    transport: [],
  };

  for (const element of elements) {
    const tags = element.tags ?? {};
    const amenityClass = classifyAmenity(tags);
    const location = elementLocation(element);
    if (!amenityClass || !location) continue;

    const name = tags.name ?? tags.brand ?? tags.operator;
    const distanceMetres = Math.round(haversineMetres(area.centre, location));
    candidates[amenityClass].push({
      named: name !== undefined,
      amenity: {
        name: name ?? FALLBACK_NAMES[amenityClass],
        location,
        distanceMetres,
        walkingMinutes: walkingMinutes(distanceMetres),
      },
    });
  }

  for (const amenityClass of AMENITY_CLASSES) {
    grouped[amenityClass] = dedupeNamed(
      candidates[amenityClass].toSorted(
        (a, b) => a.amenity.distanceMetres - b.amenity.distanceMetres,
      ),
    ).slice(0, AMENITIES_PER_CLASS);
  }
  return grouped;
}

interface Candidate {
  /** Whether the name came from OSM; fallback-named elements are never collapsed together. */
  named: boolean;
  amenity: Amenity;
}

function dedupeNamed(sortedByDistance: readonly Candidate[]): Amenity[] {
  const seen = new Set<string>();
  const kept: Amenity[] = [];
  for (const { named, amenity } of sortedByDistance) {
    const key = amenity.name.toLowerCase();
    if (named && seen.has(key)) continue;
    if (named) seen.add(key);
    kept.push(amenity);
  }
  return kept;
}
