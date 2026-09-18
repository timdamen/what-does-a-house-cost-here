import type { Geocoder } from '@house-cost/domain';

import { createNominatimClient, NOMINATIM_SOURCE } from './nominatim';
import { createOpenDataRuntime, type OpenDataOptions } from './provider';

/**
 * Forward geocoding through Nominatim `/search` (`limit=5`). Nominatim forbids autocomplete:
 * call this on an explicit submit only, never per keystroke, and cache by normalised query.
 */
export function createNominatimGeocoder(options: OpenDataOptions): Geocoder {
  const runtime = createOpenDataRuntime(options);
  const nominatim = createNominatimClient(runtime.client, runtime.nominatimUrl);

  return {
    async search(query) {
      const data = await nominatim.search(query);
      return {
        data,
        provenance: { source: NOMINATIM_SOURCE, fetchedAt: runtime.now().toISOString() },
      };
    },
  };
}
