/**
 * Open-data package: the real Data Provider adapters (OpenStreetMap, Nominatim, Overpass and
 * the regional price registers). Populated by later tickets.
 */
import { DOMAIN_PACKAGE_NAME } from '@house-cost/domain';

export const OPEN_DATA_PACKAGE_NAME = '@house-cost/open-data';

/** The domain package this adapter set implements the port of. */
export const IMPLEMENTS_PORT_FROM = DOMAIN_PACKAGE_NAME;
