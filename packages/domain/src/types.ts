/**
 * Domain types. Names follow the spec glossary: Location, Search Area, House, Price Signal,
 * Neighbourhood Facts. Everything here is plain data so it can cross the server/browser boundary
 * as JSON without loss.
 */

/** A geographic point in WGS84 degrees. */
export interface Location {
  lat: number;
  lng: number;
}

/** The circle around a Location within which Houses and Neighbourhood Facts are gathered. */
export interface SearchArea {
  centre: Location;
  radiusMetres: number;
}

/** Residential building types as OSM tags them, collapsed to a fixed union for the UI. */
export const BUILDING_TYPES = [
  'detached',
  'semi-detached',
  'terraced',
  'apartments',
  'house',
  'residential',
  'other',
] as const;

export type BuildingType = (typeof BUILDING_TYPES)[number];

/** Address fields exactly as OSM holds them (`addr:*` tags). Any of them may be missing. */
export interface HouseAddress {
  street?: string;
  housenumber?: string;
  postcode?: string;
  city?: string;
}

/** A residential building known to OpenStreetMap. */
export interface House {
  /** Stable id, OSM-shaped (`way/123` or `node/123`), also used in the URL `h=` parameter. */
  id: string;
  location: Location;
  address: HouseAddress;
  buildingType: BuildingType;
  /** The subset of OSM tags kept for display (`building`, `building:levels`, `addr:*`, ...). */
  osmTags: Record<string, string>;
}

export const PRICE_SIGNAL_KINDS = ['sale', 'valuation'] as const;
export type PriceSignalKind = (typeof PRICE_SIGNAL_KINDS)[number];

export const PRICE_SIGNAL_SCOPES = ['house', 'street', 'area'] as const;
export type PriceSignalScope = (typeof PRICE_SIGNAL_SCOPES)[number];

/**
 * A sale price or official valuation for a House, or for the street or area it sits in.
 * `houseId` is the House the signal was resolved for, whatever its scope.
 */
export interface PriceSignal {
  houseId: string;
  amount: number;
  /** ISO 4217 code, e.g. `EUR`. */
  currency: string;
  kind: PriceSignalKind;
  /** ISO date (`YYYY-MM-DD`) the sale or valuation applies to. */
  date: string;
  scope: PriceSignalScope;
  /** Name of the register the signal came from. */
  source: string;
}

export const AMENITY_CLASSES = [
  'school',
  'supermarket',
  'healthcare',
  'park',
  'transport',
] as const;
export type AmenityClass = (typeof AMENITY_CLASSES)[number];

export interface Amenity {
  name: string;
  location: Location;
  /** Straight-line distance from the queried Location. */
  distanceMetres: number;
  /** Estimated from `distanceMetres`, see `walkingMinutes()` in the geo helpers. */
  walkingMinutes: number;
}

export interface NeighbourhoodHierarchy {
  suburb?: string;
  city?: string;
  region?: string;
  country?: string;
  /** ISO 3166-1 alpha-2, upper case. Keys the regional price register registry. */
  countryCode: string;
}

export interface PriceSummary {
  typical: number;
  low: number;
  high: number;
  /** ISO 4217 code. */
  currency: string;
  /** ISO date the summary is current as of. */
  asOf: string;
  sampleSize: number;
}

/** Counts of Houses per building type inside the Search Area. */
export type HousingMix = Record<BuildingType, number>;

export interface NeighbourhoodFacts {
  name: string;
  hierarchy: NeighbourhoodHierarchy;
  /** `null` means "no open price data for this region": a normal value, not an error. */
  priceSummary: PriceSummary | null;
  amenities: Record<AmenityClass, Amenity[]>;
  housingMix: HousingMix;
}

/** Where a result came from and when it was fetched, attached to every provider result. */
export interface Provenance {
  source: string;
  /** ISO 8601 timestamp. */
  fetchedAt: string;
}

/** A forward-geocoding hit for the place-search box. */
export interface GeocodeResult {
  label: string;
  location: Location;
  /** ISO 3166-1 alpha-2, upper case. */
  countryCode: string;
}
