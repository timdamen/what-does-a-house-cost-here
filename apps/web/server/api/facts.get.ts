import { roundLocation, type Location } from '@house-cost/domain';
import type { H3Event } from 'h3';
import { z } from 'zod';

const querySchema = z.object({
  lat: latitudeSchema,
  lng: longitudeSchema,
});

const factsCached = defineCachedFunction(
  (event: H3Event, location: Location) => useDataProvider(event).getNeighbourhoodFacts(location),
  {
    name: 'facts',
    maxAge: SIX_HOURS,
    getKey: (event, location) => cacheKey(event, location.lat, location.lng),
  },
);

/**
 * `GET /api/facts?lat&lng` -> `{ data: NeighbourhoodFacts, provenance }`.
 * `data.priceSummary` is `null` when the region has no open price data; that is a 200.
 */
export default defineApiHandler(async (event) => {
  const query = parseOrReject(querySchema, getQuery(event));
  const location = roundLocation(query);

  const result = await factsCached(event, location);
  setPublicCache(event, SIX_HOURS);
  return result;
});
