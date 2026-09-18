import type {
  AmenityClass,
  BuildingType,
  HousingMix,
  NeighbourhoodHierarchy,
  Provenance,
} from '@house-cost/domain';
import { AMENITY_CLASSES, BUILDING_TYPES } from '@house-cost/domain';

import { BUILDING_TYPE_LABELS } from './houses';

/**
 * Pure helpers behind `NeighbourhoodFacts.vue`: labels, the place hierarchy trail, the Housing
 * Mix entries, and the provenance wording ("About this data"). Kept out of the component so
 * they stay unit-testable without mounting anything.
 */

/** Display order and label of each Amenity class (spec user story 33). */
export const AMENITY_CLASS_LABELS: Record<AmenityClass, string> = {
  school: 'Schools',
  supermarket: 'Supermarkets',
  healthcare: 'Healthcare',
  park: 'Parks',
  transport: 'Public transport',
};

export const AMENITY_CLASS_ICONS: Record<AmenityClass, string> = {
  school: 'i-lucide-graduation-cap',
  supermarket: 'i-lucide-shopping-cart',
  healthcare: 'i-lucide-heart-pulse',
  park: 'i-lucide-trees',
  transport: 'i-lucide-bus',
};

/** The five classes in the fixed display order. */
export const AMENITY_CLASS_ORDER: readonly AmenityClass[] = AMENITY_CLASSES;

/**
 * The place hierarchy as a trail from the smallest unit outwards, with blanks and consecutive
 * duplicates dropped (a city-centre suburb often carries the city's name).
 */
export function hierarchyTrail(hierarchy: NeighbourhoodHierarchy): string[] {
  const trail: string[] = [];
  for (const part of [hierarchy.suburb, hierarchy.city, hierarchy.region, hierarchy.country]) {
    const value = part?.trim();
    if (value && trail.at(-1) !== value) trail.push(value);
  }
  return trail;
}

export interface HousingMixEntry {
  type: BuildingType;
  label: string;
  count: number;
  /** Whole-number percentage of all Houses in the Search Area. */
  percentage: number;
  /** 1-based slot in the categorical palette; follows the building type, never the rank. */
  slot: number;
}

/**
 * Non-empty Housing Mix rows, largest first, with the palette slot fixed to the building type so
 * a type keeps its colour from one area to the next.
 */
export function housingMixEntries(mix: HousingMix): HousingMixEntry[] {
  const total = housingMixTotal(mix);
  return BUILDING_TYPES.map((type, index) => ({
    type,
    label: BUILDING_TYPE_LABELS[type],
    count: mix[type] ?? 0,
    percentage: total === 0 ? 0 : Math.round(((mix[type] ?? 0) / total) * 100),
    slot: index + 1,
  }))
    .filter((entry) => entry.count > 0)
    .toSorted((a, b) => b.count - a.count || a.slot - b.slot);
}

export function housingMixTotal(mix: HousingMix): number {
  return BUILDING_TYPES.reduce((sum, type) => sum + (mix[type] ?? 0), 0);
}

/** Human names for the `provenance.source` identifiers the providers report. */
const SOURCE_NAMES: Record<string, string> = {
  fixture: 'Offline sample data',
  nominatim: 'Nominatim (OpenStreetMap)',
  'openstreetmap-overpass': 'OpenStreetMap via Overpass',
  'hm-land-registry-ppd': 'HM Land Registry Price Paid Data',
};

/** Splits a joined source (`nominatim+openstreetmap-overpass`) into its contributors' names. */
export function sourceNames(source: string): string[] {
  return source
    .split('+')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => SOURCE_NAMES[part] ?? part);
}

export interface Attribution {
  id: 'openstreetmap' | 'land-registry';
  text: string;
  href: string;
}

/** ODbL attribution for anything that came from OpenStreetMap (Houses, Amenities, geocoding). */
const OSM_ATTRIBUTION: Attribution = {
  id: 'openstreetmap',
  text: '© OpenStreetMap contributors',
  href: 'https://www.openstreetmap.org/copyright',
};

/** Wording the Open Government Licence requires for Price Paid Data, with the current year. */
function landRegistryAttribution(year: number): Attribution {
  return {
    id: 'land-registry',
    text: `Contains HM Land Registry data © Crown copyright and database right ${year}. This data is licensed under the Open Government Licence v3.0.`,
    href: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
  };
}

/** The attribution lines the sources on screen oblige the app to show (`packages/open-data/README.md`). */
export function attributionsFor(
  sources: readonly string[],
  year = new Date().getUTCFullYear(),
): Attribution[] {
  const joined = sources.join('+');
  const lines: Attribution[] = [];
  if (/openstreetmap|overpass|nominatim/.test(joined)) lines.push(OSM_ATTRIBUTION);
  if (/land-registry/.test(joined)) lines.push(landRegistryAttribution(year));
  return lines;
}

export interface ProvenanceRow {
  /** What the row is the provenance of, e.g. "Neighbourhood facts". */
  label: string;
  /** The raw `provenance.source`, for `attributionsFor`. */
  source: string;
  /** Human names of the contributors, for display. */
  sources: string[];
  fetchedAt: string;
}

/** Rows for "About this data", skipping anything not fetched yet. */
export function provenanceRows(
  entries: ReadonlyArray<{ label: string; provenance: Provenance | null | undefined }>,
): ProvenanceRow[] {
  return entries.flatMap(({ label, provenance }) =>
    provenance
      ? [
          {
            label,
            source: provenance.source,
            sources: sourceNames(provenance.source),
            fetchedAt: provenance.fetchedAt,
          },
        ]
      : [],
  );
}

/** A `YYYY-MM-DD` date as a long date in the visitor's locale, immune to the browser's time zone. */
export function formatIsoDate(isoDate: string, locale: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

/** An ISO 8601 timestamp as date and time in the visitor's locale and time zone. */
export function formatTimestamp(isoTimestamp: string, locale: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return isoTimestamp;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
