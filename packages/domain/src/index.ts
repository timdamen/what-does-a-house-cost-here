/**
 * `@house-cost/domain`: types, the Data Provider and Geocoder ports, geo helpers, price
 * formatting and the deterministic fixture provider. Browser-safe: no Node-only APIs.
 *
 * The reusable provider contract test lives behind `@house-cost/domain/testing` so Vitest never
 * enters the app bundle.
 */
export type {
  Amenity,
  AmenityClass,
  BuildingType,
  GeocodeResult,
  House,
  HouseAddress,
  HouseRef,
  HousingMix,
  Location,
  NeighbourhoodFacts,
  NeighbourhoodHierarchy,
  PriceSignal,
  PriceSignalKind,
  PriceSignalScope,
  PriceSummary,
  Provenance,
  SearchArea,
} from './types';
export { AMENITY_CLASSES, BUILDING_TYPES, PRICE_SIGNAL_KINDS, PRICE_SIGNAL_SCOPES } from './types';

export type {
  DataProvider,
  Geocoder,
  GeocodeSearchResult,
  HouseSearchResult,
  NeighbourhoodFactsResult,
  PriceSignalsResult,
  ProviderResult,
} from './ports';
export { HOUSE_CAP } from './ports';

export { isUpstreamError, UpstreamError, type UpstreamErrorShape } from './errors';

export type { BoundingBox } from './geo';
export {
  boundingBox,
  DEFAULT_RADIUS_METRES,
  EARTH_RADIUS_METRES,
  haversineMetres,
  isWithinArea,
  LOCATION_DECIMALS,
  offsetLocation,
  roundLocation,
  WALKING_DETOUR_FACTOR,
  WALKING_SPEED_METRES_PER_MINUTE,
  walkingMinutes,
} from './geo';

export {
  DEFAULT_LOCALE,
  formatPrice,
  formatPriceAbbreviated,
  localeForCountryCode,
} from './format';

export { AMSTERDAM_CENTRE, SYDNEY_CENTRE } from './fixtures/areas';
export { countHousingMix, isBuildingType } from './housing-mix';
export {
  createFixtureProvider,
  FIXTURE_SOURCE,
  type FixtureProviderOptions,
} from './fixtures/provider';
export {
  createFixtureGeocoder,
  FIXTURE_PLACES,
  type FixtureGeocoderOptions,
} from './fixtures/geocoder';
