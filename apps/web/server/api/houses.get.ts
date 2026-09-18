import { roundLocation, type SearchArea } from '@house-cost/domain';
import type { H3Event } from 'h3';
import { z } from 'zod';

const querySchema = z.object({
  lat: latitudeSchema,
  lng: longitudeSchema,
  radius: radiusSchema,
});

const searchHousesCached = defineCachedFunction(
  (event: H3Event, area: SearchArea) => useDataProvider(event).searchHouses(area),
  {
    name: 'houses',
    maxAge: SIX_HOURS,
    getKey: (event, area) => cacheKey(event, area.centre.lat, area.centre.lng, area.radiusMetres),
  },
);

/**
 * `GET /api/houses?lat&lng&radius` -> `{ data: House[], cap, truncated, provenance }`.
 * The Location is rounded to 4 decimals before the search and the cache key.
 */
export default defineApiHandler(async (event) => {
  const { lat, lng, radius } = parseOrReject(querySchema, getQuery(event));
  const area: SearchArea = { centre: roundLocation({ lat, lng }), radiusMetres: radius };

  const result = await searchHousesCached(event, area);
  setPublicCache(event, SIX_HOURS);
  return result;
});
