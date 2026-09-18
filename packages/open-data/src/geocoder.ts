import type { Geocoder } from '@house-cost/domain';

import { NOMINATIM_SOURCE } from './nominatim';
import type { OpenDataRuntime } from './provider';

/**
 * Forward geocoding through Nominatim `/search` (`limit=5`), on the runtime's Nominatim client
 * so its request gate is shared with the provider. Nominatim forbids autocomplete: call this on
 * an explicit submit only, never per keystroke, and cache by normalised query.
 */
export function createNominatimGeocoder(runtime: OpenDataRuntime): Geocoder {
  return {
    async search(query) {
      const data = await runtime.nominatim.search(query);
      return {
        data,
        provenance: { source: NOMINATIM_SOURCE, fetchedAt: runtime.now().toISOString() },
      };
    },
  };
}
