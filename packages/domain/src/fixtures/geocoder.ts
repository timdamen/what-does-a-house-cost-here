import type { Geocoder } from '../ports';
import type { GeocodeResult } from '../types';
import { AMSTERDAM_CENTRE, SYDNEY_CENTRE } from './areas';
import { FIXTURE_SOURCE } from './provider';

export interface FixtureGeocoderOptions {
  now?: () => Date;
}

interface FixturePlace extends GeocodeResult {
  /** Lower-case search terms that match this place, besides its label. */
  aliases: readonly string[];
}

/** Places the fixture geocoder knows. Both fixture area centres are here. */
export const FIXTURE_PLACES: readonly GeocodeResult[] = [
  { label: 'Amsterdam, Noord-Holland, Nederland', location: AMSTERDAM_CENTRE, countryCode: 'NL' },
  { label: 'Sydney, New South Wales, Australia', location: SYDNEY_CENTRE, countryCode: 'AU' },
  { label: 'Utrecht, Nederland', location: { lat: 52.0907, lng: 5.1214 }, countryCode: 'NL' },
  {
    label: 'London, England, United Kingdom',
    location: { lat: 51.5074, lng: -0.1278 },
    countryCode: 'GB',
  },
  {
    label: 'Melbourne, Victoria, Australia',
    location: { lat: -37.8136, lng: 144.9631 },
    countryCode: 'AU',
  },
];

const PLACES: readonly FixturePlace[] = FIXTURE_PLACES.map((place) => ({
  label: place.label,
  location: place.location,
  countryCode: place.countryCode,
  aliases: [place.label.split(',')[0]?.toLowerCase() ?? place.label.toLowerCase()],
}));

/** Dutch postcode: four digits, optional space, two letters. Resolves to Amsterdam. */
const DUTCH_POSTCODE = /^(\d{4})\s?([A-Z]{2})$/i;
/** Australian postcode: four digits. Resolves to Sydney. */
const AUSTRALIAN_POSTCODE = /^\d{4}$/;
/** UK postcode (outward + inward). Resolves to London. */
const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;

/**
 * Offline geocoder. Matches place names by prefix or substring (case-insensitive) and recognises
 * postcode-looking strings for the fixture countries. An empty query resolves to no results.
 */
export function createFixtureGeocoder(options: FixtureGeocoderOptions = {}): Geocoder {
  const now = options.now ?? (() => new Date());

  return {
    async search(query) {
      const provenance = { source: FIXTURE_SOURCE, fetchedAt: now().toISOString() };
      const trimmed = query.trim();
      if (trimmed.length === 0) return { data: [], provenance };

      const postcode = matchPostcode(trimmed);
      if (postcode) return { data: [postcode], provenance };

      const needle = trimmed.toLowerCase();
      const data = PLACES.filter(
        (place) =>
          place.aliases.some((alias) => alias.startsWith(needle)) ||
          place.label.toLowerCase().includes(needle),
      ).map(toResult);

      return { data, provenance };
    },
  };
}

function toResult(place: FixturePlace): GeocodeResult {
  return { label: place.label, location: place.location, countryCode: place.countryCode };
}

function matchPostcode(query: string): GeocodeResult | undefined {
  const dutch = DUTCH_POSTCODE.exec(query);
  if (dutch) {
    return {
      label: `${dutch[1]} ${dutch[2]?.toUpperCase()}, Amsterdam, Nederland`,
      location: AMSTERDAM_CENTRE,
      countryCode: 'NL',
    };
  }
  if (AUSTRALIAN_POSTCODE.test(query)) {
    return {
      label: `${query}, Sydney, New South Wales, Australia`,
      location: SYDNEY_CENTRE,
      countryCode: 'AU',
    };
  }
  if (UK_POSTCODE.test(query)) {
    return {
      label: `${query.toUpperCase()}, London, United Kingdom`,
      location: { lat: 51.5074, lng: -0.1278 },
      countryCode: 'GB',
    };
  }
  return undefined;
}
