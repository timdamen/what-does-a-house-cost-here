import { roundLocation, type SearchArea } from '@house-cost/domain';
import type { H3Event } from 'h3';
import { z } from 'zod';

const querySchema = z.object({
  lat: latitudeSchema,
  lng: longitudeSchema,
  radius: radiusSchema,
});

const factsCached = defineCachedFunction(
  (event: H3Event, area: SearchArea) => useDataProvider(event).getNeighbourhoodFacts(area),
  {
    name: 'facts',
    maxAge: SIX_HOURS,
    getKey: (event, area) => cacheKey(event, area.centre.lat, area.centre.lng, area.radiusMetres),
  },
);

/**
 * `GET /api/facts?lat&lng&radius` -> `{ data: NeighbourhoodFacts, provenance }`, for the same
 * Search Area as `/api/houses` (radius defaults to `DEFAULT_RADIUS_METRES`).
 * `data.priceSummary` is `null` when the region has no open price data; that is a 200.
 */
export default defineApiHandler(async (event) => {
  const { lat, lng, radius } = parseOrReject(querySchema, getQuery(event));
  const area: SearchArea = { centre: roundLocation({ lat, lng }), radiusMetres: radius };

  const result = await factsCached(event, area);
  setPublicCache(event, SIX_HOURS);
  return result;
});
