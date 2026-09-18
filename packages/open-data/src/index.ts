/**
 * `@house-cost/open-data`: the real Data Provider and Geocoder built on OpenStreetMap
 * (Overpass), Nominatim and the regional price registry (HM Land Registry Price Paid Data for
 * `GB`). Server-side only: every request carries an identifying `User-Agent`, goes through one
 * concurrency-limited HTTP client and maps failures to `UpstreamError`.
 */
import { DOMAIN_PACKAGE_NAME } from '@house-cost/domain';

export const OPEN_DATA_PACKAGE_NAME = '@house-cost/open-data';

/** The domain package this adapter set implements the port of. */
export const IMPLEMENTS_PORT_FROM = DOMAIN_PACKAGE_NAME;

export {
  createOpenDataProvider,
  DEFAULT_CONCURRENCY,
  DEFAULT_FACTS_RADIUS_METRES,
  type OpenDataOptions,
} from './provider';
export { createNominatimGeocoder } from './geocoder';

export { createHttpClient, type FetchLike, type HttpClient, type JsonRequest } from './http-client';

export { OVERPASS_SERVICE, OVERPASS_SOURCE, OVERPASS_URL } from './overpass/client';
export {
  NOMINATIM_SERVICE,
  NOMINATIM_SOURCE,
  NOMINATIM_URL,
  UNKNOWN_COUNTRY_CODE,
} from './nominatim';

export { createPriceRegistry, type PriceAdapter, type PriceRegistry } from './prices/registry';
export {
  createLandRegistryAdapter,
  LAND_REGISTRY_SERVICE,
  LAND_REGISTRY_SOURCE,
  LAND_REGISTRY_URL,
  SUMMARY_WINDOW_MONTHS,
} from './prices/land-registry-gb';
